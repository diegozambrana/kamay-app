## 1. Esquema

- [x] 1.1 Migración `ai_writing_assist_requests`: tabla (`id`, `organization_id`, `requested_by`, `requested_at`), índice `(organization_id, requested_at)`, RLS de inserción y lectura por miembro de la organización, sin política `DELETE`.
- [x] 1.2 Vista `ai_writing_assist_usage_by_period` (`security_invoker = true`) agrupando por `organization_id` y mes calendario.
- [x] 1.3 Prueba pgTAP: un miembro inserta y lee solo las filas de su organización; la vista cuenta correctamente por mes.
- [x] 1.4 Migración `tasks.body_assisted_by_ai boolean not null default false`.
- [x] 1.5 Prueba pgTAP: el disparador genérico `log_activity()` registra el cambio de `body_assisted_by_ai` como cualquier otra columna.
- [x] 1.6 `graphify .` tras ambas migraciones.

## 2. Puerto hacia el modelo

- [x] 2.1 `lib/ai/port.ts`: interfaz `AiAssistant` con `proposeBodyImprovement(body: string): Promise<{ proposal: string }>`.
- [x] 2.2 `lib/ai/anthropic.ts`: adaptador real sobre `@anthropic-ai/sdk`, instrucción de sistema (español, conservar estructura Markdown, conservar ítems de verificación con su estado), `AbortController` con plazo de 15 s.
- [x] 2.3 `MemoryAiAssistant`: adaptador de pruebas, configurable con una respuesta fija o una función.
- [x] 2.4 `FailingAiAssistant`: adaptador que siempre lanza.
- [x] 2.5 Pruebas unitarias de los tres adaptadores; ninguna sale a la red.

## 3. Configuración de la organización

- [x] 3.1 `lib/ai/writing-assist-settings.ts`: schema Zod y `readWritingAssistSettings(settings: unknown)` con valor por omisión apagado.
- [x] 3.2 `services/configuration/ai-writing-assist-service.ts`: `get(organizationId)` y `save(organizationId, input)` que relee, esparce y sobrescribe solo su llave en `organizations.settings`.
- [x] 3.3 Acción de servidor `updateWritingAssistSettings` en `actions/configuration.ts`: guardia de dueño, valida con Zod, llama al servicio, `revalidateConfiguration()`.
- [x] 3.4 Sección General de Configuración: interruptor con el aviso explícito de que el texto sale hacia un tercero, apagado por omisión.
- [x] 3.5 Pruebas unitarias del servicio (relee y no pisa otras llaves de `settings`); prueba de que un ayudante no puede escribir el interruptor (pgTAP `writing_assist_settings_access.test.sql`, mismo patrón que `allocation_rule_access.test.sql`).

## 4. Variables de entorno y límite de uso

- [x] 4.1 `lib/env.ts`: grupo opcional nuevo (`ANTHROPIC_API_KEY`, `AI_WRITING_ASSIST_MONTHLY_LIMIT`), ausencia apaga la función sin romper compilación ni arranque; se reporta el nombre, nunca el valor.
- [x] 4.2 `services/ai/usage-service.ts` (o similar): `countCurrentPeriod(organizationId)` sobre la vista, `recordRequest(organizationId, userId)` que inserta antes de llamar al proveedor.
- [x] 4.3 Pruebas unitarias/integración del servicio de uso: cuenta correcto por organización y por mes, aislado entre organizaciones (unitarias con `FakeClient`; el aislamiento entre organizaciones y el conteo real ya quedan probados en pgTAP `ai_writing_assist_requests.test.sql`).

## 5. Acción de servidor de la propuesta

- [x] 5.1 Acción de servidor `proposeTaskBodyImprovement(taskId, body)`: sesión + organización + rol; rechaza si el interruptor está apagado o si falta la variable de entorno, verificable sin pasar por la interfaz; rechaza si se superó el límite del periodo, con un mensaje sobrio, sin llamar al proveedor.
- [x] 5.2 Registra la solicitud (`recordRequest`) antes de invocar el puerto; propaga el error en lenguaje llano si el proveedor falla o excede el plazo.
- [x] 5.3 Corrección sobre design.md: no hace falta sanear la propuesta en la acción. `task-detail` ya exige que el Markdown se sanee **al rendir** (D1: `MarkdownView` es el único componente que rinde Markdown), nunca al guardar ni al devolver; el panel de comparación (6.4) muestra la propuesta a través de `MarkdownView`, que hereda el mismo saneado sin un segundo camino.
- [x] 5.4 Pruebas: la acción de servidor no puede probarse contra la base real (usa `getSessionContext()`, que depende de cookies de Next.js, como ya le pasa a `updateAllocationRule`/`updateRetentionPolicy`); en su lugar, `actions/tasks.test.ts` cubre con dobles la orquestación completa (rechazo por organización sin activar, por variable ausente, por límite superado, por cuerpo vacío o tarea archivada/fuera de alcance, degradación cuando el proveedor falla), y el conteo real por organización y por mes ya queda probado en pgTAP (`ai_writing_assist_requests.test.sql`).

## 6. Editor: acción "Mejorar la descripción"

- [x] 6.1 `lib/ai/checklist-diff.ts`: función pura que compara ítems de verificación por texto normalizado y reporta los del original ausentes en la propuesta.
- [x] 6.2 Pruebas unitarias de `checklist-diff.ts`: pérdida detectada, sin pérdida, ítems reordenados con el mismo texto.
- [x] 6.3 `features/tasks/editor/markdown-editor.tsx`: botón *Mejorar la descripción* en la barra de herramientas, visible solo con borrador no vacío y organización activada; detección de "sin conexión" que lo muestra no disponible en vez de ofrecer un intento.
- [x] 6.4 Panel de comparación (`improve-body-dialog.tsx`): texto actual junto a la propuesta, *Aceptar* y *Descartar*; *Aceptar* reemplaza el borrador sin guardar; *Descartar* cierra el panel sin tocar el borrador.
- [x] 6.5 Advertencia de ítems de verificación perdidos en el panel, bloqueando *Aceptar* hasta que se reconozca.
- [x] 6.6 Estado local que recuerda si el borrador actual proviene de la última propuesta aceptada (comparación exacta de texto), para marcar `body_assisted_by_ai` al guardar; se apaga con cualquier edición manual posterior.
- [x] 6.7 El ciclo existente Guardar/Cancelar (con su confirmación de cambios sin guardar) sigue aplicándose sin cambios sobre un borrador que provenga de una propuesta aceptada.
- [x] 6.8 Pruebas unitarias del editor: acción ausente con cuerpo vacío o sin activación; estado pendiente/aceptada/descartada de la propuesta; descartar no muta el borrador; comportamiento con el adaptador que falla (sin conexión probado aparte, gateando `navigator.onLine`).

## 7. Bitácora

- [x] 7.1 Corrección sobre el plan original: `describeEvent()` redacta por **tabla** ("Persona editó la tarea «Título»"), no por columna — no hay entrada de `lib/activity/describe.ts` que añadir. Lo que hacía falta era el rótulo en `lib/activity/fields.ts` (`FIELDS.tasks.body_assisted_by_ai`, "Descripción mejorada con IA"), que alimenta la fila expandible de antes/después y que `tests/integration/activity-fields-coverage.test.ts` exige para toda columna auditable. Hecho.
- [x] 7.2 Cubierto por `tests/integration/activity-fields-coverage.test.ts` (pasa) y por el pgTAP `tasks_body_assisted_by_ai.test.sql`, que prueba el antes/después real en `activity_log`; no hace falta una prueba unitaria de frase porque no hay frase nueva que redactar (7.1).

## 8. Pruebas de frontera y e2e

- [x] 8.1 Prueba de frontera: `ANTHROPIC_API_KEY` no aparece en ninguna variable `NEXT_PUBLIC_*` (`lib/env.test.ts`); `lib/ai/anthropic.ts` no se importa desde código de cliente (`lib/ai/client-boundary.test.ts`, mismo patrón que `service-role-boundary.test.ts`). Verificado además con `npm run build` real (limpio, sin fuga del cliente ni ruptura del guardia `server-only`) y `npm run check:bundle`.
- [x] 8.2 / 8.3 Corrección sobre el plan original: el flujo completo mejorar → ver la propuesta → aceptar/descartar no tiene recorrido e2e real posible en este entorno — no hay (ni debería haber) un `ANTHROPIC_API_KEY` de pruebas, y `resolveAiAssistant()` no tiene una puerta de sustitución para el navegador (el puerto con `MemoryAiAssistant`/`FailingAiAssistant` es explícitamente para unitarias e integración). Ese flujo completo —pedir, comparar, la advertencia de ítems perdidos, aceptar reemplaza sin guardar, descartar no toca nada, guardar marca `assisted`— queda cubierto a nivel de componente en `features/tasks/editor/markdown-editor.test.tsx` (7 escenarios nuevos), con el `onProposeBodyImprovement` inyectado como dependencia, igual que `onSave`.
- [x] 8.4 e2e (`tests/e2e/task-writing-assist.spec.ts`): con la asistencia activada, `context.setOffline(true)` hace que *Mejorar la descripción* deje de ofrecerse sin haber intentado nada.
- [x] 8.5 e2e (`tests/e2e/task-writing-assist.spec.ts`): una organización recién creada, que nunca activó el interruptor, no ve la acción.

**Nota de infraestructura descubierta durante 8.1–8.5:** el `npm run build` de verificación de 8.1 dejó `public/sw.js` (el service worker de producción) en disco; como `ServiceWorkerProvider` lo registra sin distinguir desarrollo de producción, el navegador de cada prueba e2e posterior lo tomaba y servía una versión vieja del cliente aunque el servidor ya leyera el ajuste correcto — un desajuste real entre servidor y cliente que costó varias corridas diagnosticar (confirmado con `console.error` server-side: el servidor sí leía `{enabled: true}`, pero el botón no aparecía). Se borró `public/sw.js` y `public/sw.js.map` (artefactos regenerables, ignorados por git) y se reinició el `next dev` que los servía, con permiso explícito del usuario antes de matar el proceso. Quien vuelva a correr `npm run build` en este checkout mientras `next dev` sigue vivo debe borrar `public/sw.*` después, o reiniciar el servidor de desarrollo.
