## Why

Una tarea escrita a las apuradas queda con un cuerpo desordenado que nadie vuelve a arreglar a mano. KAM-29 ya le dio a la descripción un editor propio; KAM-30 le agrega una acción que propone una versión mejor redactada del mismo texto, sin tocarlo nunca sin permiso explícito de quien lo escribió. De paso, establece el primer puerto hacia un modelo de lenguaje (`lib/ai/port.ts`), con su adaptador en memoria y su adaptador que siempre falla, para que las próximas funcionalidades que llamen a un modelo no inventen cada una su propio camino.

## What Changes

- Nuevo puerto `lib/ai/port.ts` (estilo `lib/email/port.ts`): interfaz mínima, adaptador concreto sobre el SDK de Anthropic, `MemoryAiAssistant` para pruebas y `FailingAiAssistant` para probar la degradación.
- Nueva acción de servidor que recibe el cuerpo de una tarea, valida la organización (activada, dentro de su límite de uso), llama al puerto y devuelve la propuesta saneada; la credencial vive solo en el servidor.
- En el editor Markdown de la tarea (`features/tasks/editor/markdown-editor.tsx`), una acción *Mejorar la descripción* que muestra la propuesta junto al texto actual, con **Aceptar** y **Descartar**; nada se guarda hasta aceptar.
- Aviso determinista cuando la propuesta pierde ítems de lista de verificación presentes en el original, antes de permitir aceptar.
- Variable de entorno opcional (`lib/env.ts`, grupo nuevo) cuya ausencia apaga la función sin romper la compilación; se reporta el nombre, nunca el valor.
- Interruptor de activación por organización en `organizations.settings`, apagado por omisión, con aviso explícito de que el texto sale hacia un tercero — editable desde la sección General de Configuración, junto a la regla de reparto.
- Límite de uso por organización y por periodo, contado del lado del servidor, independiente de la interfaz.
- Detección de "sin conexión": la acción se muestra no disponible por falta de red, no como un fallo.
- La bitácora deja constancia de que un cambio de cuerpo fue asistido; el autor del evento sigue siendo la persona que aceptó.

## Capabilities

### New Capabilities
- `ai-writing-assist`: el puerto hacia el modelo de lenguaje, la acción de servidor que arbitra activación/límite/saneamiento, el flujo propuesta→aceptar/descartar, el aviso de ítems de verificación perdidos y el registro en la bitácora de que un cambio fue asistido.

### Modified Capabilities
- `task-detail`: el editor del cuerpo de la tarea gana la acción *Mejorar la descripción*, visible solo con cuerpo no vacío, que no se ofrece si la organización no activó la asistencia.
- `org-configuration`: la sección General gana el interruptor de activación de la asistencia de redacción, apagado por omisión, con aviso. El límite de uso por periodo es global (variable de entorno), no editable por organización — ver `design.md`.

## Impact

- **Código nuevo:** `lib/ai/port.ts` y adaptadores; acción de servidor (`actions/`); lectura/escritura del interruptor en `services/configuration/` al estilo de `allocation-rule-service.ts` y `retention-service.ts`; registro y conteo de uso por organización y periodo vía una tabla de solicitudes y una vista `security_invoker`.
- **Código modificado:** `features/tasks/editor/markdown-editor.tsx` (acción *Mejorar la descripción* y panel de propuesta); `lib/env.ts` (grupo opcional nuevo); sección General de Configuración (`features/settings/` o equivalente).
- **Esquema:** migración nueva para la tabla de solicitudes de asistencia y su vista de conteo por periodo; migración nueva que agrega `tasks.body_assisted_by_ai boolean` para que el disparador genérico de bitácora deje constancia del guardado asistido sin duplicar el historial.
- **Dependencias:** SDK de Anthropic (nueva dependencia de servidor, nunca en el bundle de cliente).
- **Pruebas:** unitarias para el puerto y sus tres adaptadores, el saneamiento de la salida del modelo y la detección de ítems perdidos; integración para el rechazo por organización sin activar o sobre su límite; e2e para el flujo completo de mejorar/aceptar/descartar y el aviso sin conexión.
