## Context

Ver `proposal.md` — Why. El editor del cuerpo de tarea ya existe (`features/tasks/editor/markdown-editor.tsx`, KAM-29) con su ciclo Guardar/Cancelar y su saneamiento de Markdown. No existe hoy ningún código que llame a un modelo de lenguaje; este cambio escribe el primer puerto (`lib/ai/port.ts`) y el primer flujo de propuesta/aceptación que las funcionalidades futuras podrán reutilizar.

Decisiones ya tomadas con el dueño del producto, antes de este documento:
- **Proveedor:** SDK de Anthropic directo (`@anthropic-ai/sdk`), no la pasarela de IA de Vercel.
- **Contexto enviado al modelo:** solo el cuerpo de la tarea. Ni título ni línea de negocio salen del taller.
- **Dónde vive el interruptor:** una llave nueva en `organizations.settings`, con el mismo patrón que `allocation` y `activity_retention`.
- **Efecto de *Aceptar*:** reemplaza el borrador del editor con la propuesta; no persiste nada por sí mismo. Solo *Guardar* escribe en la base de datos, reutilizando el ciclo existente de KAM-29 sin un segundo camino de guardado.

## Goals / Non-Goals

**Goals:**
- Definir el puerto `lib/ai/port.ts` y sus tres implementaciones (real, en memoria, que siempre falla).
- Definir cómo se activa la organización, cómo se cuenta y hace cumplir el límite de uso, y cómo la bitácora se entera de que un guardado fue asistido, todo del lado del servidor y verificable sin pasar por la interfaz.
- Definir el esquema nuevo mínimo necesario, respetando que nada derivado se almacena y que toda tabla lleva RLS.

**Non-Goals:**
- Elegir el modelo exacto de Anthropic más allá de una decisión de implementación razonable (no es una decisión de producto ni afecta las specs).
- Un límite de uso configurable por organización desde la interfaz: el PRD no lo pide y añadirlo sería un concepto nuevo no declarado. El límite es un valor global.
- Cualquier punto de enganche fuera del editor del cuerpo de tarea.

## Decisions

### El puerto y sus adaptadores

`lib/ai/port.ts` declara `AiAssistant` con un único método, `proposeBodyImprovement(body: string): Promise<{ proposal: string }>`, que lanza en caso de fallo o de exceder el plazo — nunca devuelve un valor parcial. Tres implementaciones:
- `AnthropicAiAssistant` (`lib/ai/anthropic.ts`): llama al SDK de Anthropic con un mensaje de sistema que exige español, conservar la estructura Markdown y conservar los ítems de verificación con su estado; usa un `AbortController` con un plazo de 15 s.
- `MemoryAiAssistant`: configurable con una respuesta fija o una función, para que las pruebas unitarias e de integración no salgan a la red.
- `FailingAiAssistant`: siempre lanza, para probar la degradación del editor.

Alternativa descartada: exponer el puerto como una función en vez de una interfaz de clase. Se prefiere la clase para que el adaptador real pueda mantener el cliente del SDK inicializado una sola vez, igual que `lib/email/resend.ts`.

### Activación por organización

Nueva llave `ai_writing_assist: { enabled: boolean }` en `organizations.settings`, con `lib/ai/writing-assist-settings.ts` (schema Zod + `readWritingAssistSettings`) y `services/configuration/ai-writing-assist-service.ts` (mismo patrón de lectura/escritura que `allocation-rule-service.ts`: relee `settings`, esparce y sobrescribe solo su llave). Una acción de servidor `updateWritingAssistSettings` en `actions/configuration.ts`, guardia de dueño, `revalidateConfiguration()`.

### Límite de uso: tabla de solicitudes + vista, no un contador

En vez de una columna contador en `organizations` (que sería exactamente el dato derivado que la Convención 4 prohíbe), una tabla `ai_writing_assist_requests`:

```
id uuid primary key
organization_id uuid not null references organizations(id)
requested_by uuid not null references auth.users(id)
requested_at timestamptz not null default now()
```

Con RLS: cualquier miembro autenticado de la organización puede insertar una fila de su propia organización (la acción de mejorar no es exclusiva del dueño), y puede leer las filas de su propia organización (necesario para que la acción de servidor cuente antes de decidir). Sin política `DELETE`, sin `archived_at` porque no es un registro de negocio que se archive — es un registro de uso, análogo a `activity_log`, que se conserva.

Una vista `ai_writing_assist_usage_by_period` (`security_invoker = true`) agrupa por `organization_id` y por mes calendario (`date_trunc('month', requested_at)`), con el conteo. La acción de servidor lee esa vista para el mes corriente antes de proceder.

**Cuándo se cuenta:** la fila se inserta antes de llamar al proveedor, no después de una respuesta exitosa. Así el límite es a prueba de una persona que reintenta muchas veces contra un proveedor que falla, y a prueba de condiciones de carrera entre dos solicitudes concurrentes de la misma organización. La contrapartida — que un fallo del proveedor igual consume una unidad del periodo — se documenta en Riesgos.

**Límite:** un valor global, no por organización, en `AI_WRITING_ASSIST_MONTHLY_LIMIT` (variable de entorno opcional, con un valor por omisión razonable si falta — 200 solicitudes por organización y por mes). No es editable desde Configuración: el PRD no pide esa pantalla y añadirla sería un concepto nuevo no declarado en la especificación funcional (Convención 11).

Alternativa descartada: contar sobre `activity_log`. Se descartó porque `activity_log` registra cambios de datos confirmados (vía el disparador genérico), no intentos de llamar a un proveedor externo, y mezclar ambos conceptos rompería la Convención 7 de que la bitácora es un solo historial de "qué pasó aquí" en los datos del negocio.

### La marca de "asistido" en la bitácora

`tasks` gana una columna `body_assisted_by_ai boolean not null default false`. El servidor la pone en `true` cuando el cuerpo que se guarda es exactamente igual al texto de la última propuesta aceptada en esa sesión de edición, y en `false` en cualquier otro guardado — incluida una edición manual posterior a una aceptación. El disparador genérico `log_activity()` ya diferencia columnas cambiadas; no hace falta tocarlo.

**Corrección sobre la primera versión de este documento:** no hace falta ninguna entrada nueva en `lib/activity/describe.ts`. Ese módulo redacta la frase encabezado por **tabla**, no por campo (`describeEvent()` compone actor + verbo + `SUBJECTS[tableName]`, sin mirar qué columnas cambiaron); el detalle campo a campo —incluido el antes/después de `body_assisted_by_ai`— ya lo muestra la fila expandible que lee `lib/activity/fields.ts`, y ese archivo sí necesita el rótulo nuevo (`FIELDS.tasks.body_assisted_by_ai`), exigido además por `tests/integration/activity-fields-coverage.test.ts`.

Alternativa descartada: un evento de bitácora insertado a mano desde la acción de servidor. Se descartó por la Convención 7 — el único camino hacia `activity_log` es el disparador genérico sobre una columna real, no una inserción de aplicación.

### Saneamiento de la propuesta

La propuesta se rinde con el mismo pipeline de saneamiento que ya sanea cualquier cuerpo guardado (el que satisface "El Markdown rendido se sanea" en `task-detail`). No hace falta un saneamiento distinto: el panel de comparación reutiliza el mismo renderizador para el texto actual y para la propuesta.

### Detección de ítems de verificación perdidos

Función pura en `lib/ai/checklist-diff.ts`: extrae las líneas `- [ ]` / `- [x]` de ambos textos, compara por el texto del ítem normalizado (espacios, mayúsculas) sin importar el estado marcado, y reporta los del original ausentes en la propuesta. Corre en el cliente, sobre la respuesta ya recibida, para que la advertencia aparezca sin una segunda ida y vuelta al servidor.

## Risks / Trade-offs

- Un proveedor que falla consume igual una unidad del límite del periodo, porque se cuenta antes de llamar → Mitigación: el valor por omisión (200/mes) deja margen amplio frente al uso esperado de un taller; si se vuelve un problema de soporte, se revisita contando solo respuestas exitosas.
- La detección de ítems perdidos es una comparación de texto, no semántica: un ítem reformulado con las mismas palabras en otro orden podría marcarse como perdido → Mitigación: es el sesgo correcto para esta función — el PRD pide un aviso *determinista* y prefiere un falso positivo ocasional a dejar pasar una pérdida real.
- Una sola credencial de la plataforma para todas las organizaciones significa que el uso de una organización cuenta contra el presupuesto compartido con el proveedor → Mitigación: el límite por organización y por periodo ya reparte el uso; alertas de gasto del lado del proveedor quedan fuera de este cambio.
- Una llamada de red nueva dentro de una acción de servidor de Next.js puede colgar la solicitud si el proveedor no responde → Mitigación: `AbortController` con plazo de 15 s en el adaptador real; `FailingAiAssistant` prueba que el editor se degrada sin bloquear.

## Migration Plan

1. Migración `..._ai_writing_assist_requests.sql`: tabla, índices por `(organization_id, requested_at)`, RLS de inserción y lectura por miembro, vista `ai_writing_assist_usage_by_period` con `security_invoker = true`, prueba pgTAP.
2. Migración `..._tasks_body_assisted_by_ai.sql`: columna nueva con `default false`, prueba pgTAP que verifica que el disparador genérico registra su cambio.
3. `lib/env.ts`: grupo opcional nuevo (`ANTHROPIC_API_KEY`, `AI_WRITING_ASSIST_MONTHLY_LIMIT`), cuya ausencia apaga la función sin romper la compilación ni el arranque.
4. Sin cambios a `organizations.settings` en esquema — la llave nueva vive en el `jsonb` existente.
5. Sin necesidad de retroceso de esquema especial: ambas migraciones son aditivas (tabla nueva, columna con valor por omisión) y no tocan datos existentes.
