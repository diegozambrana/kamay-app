## Why

Hoy un cliente que quiere pedir algo solo puede llamar, escribir o mandar un mensaje suelto; quien atiende transcribe eso a mano al alta de pedido, y cada transcripción es una oportunidad de perder un dato, equivocar un teléfono o cansar a quien vende. KAM-28 le da al cliente un enlace de un solo uso, generado siempre por una persona de la organización, para que mande sus propios datos de contacto y sus fotos de referencia — sin abrir ninguna puerta a los datos de la organización, sin crear un pedido por sí solo, y sin saltarse la revisión humana que hoy es el único filtro contra el abuso.

## What Changes

- **Prerrequisito (convención nº 11):** se define «solicitud de pedido» en `specs/PRD/kamay-especificacion-producto-v6.md` §6.1, con su frontera explícita — **una solicitud no es un pedido** — antes de que este cambio construya nada sobre ese concepto.
- Nueva tabla `order_requests` (una sola tabla): organización, línea, `token_hash bytea` (sha256, el token en claro nunca se guarda), `contact_id` opcional, prellenado de nombre y teléfono, lo declarado por el cliente, `expires_at`, `submitted_at`, `order_id` una vez aceptada, y `archived_at`. Estado siempre derivado de esas marcas, nunca almacenado.
- Función `security definer` concedida a `anon` que resuelve el token y devuelve solo el nombre de la organización, la línea, el prellenado y los dos identificadores (`organization_id`, `request_id`) que la subida de imágenes necesita — nunca la solicitud completa ni nada de otra organización.
- Función `security definer` concedida a `anon` que recibe el envío del formulario, marca `submitted_at`, registra la bitácora con `actor_label = 'Formulario público'` (vía una variable de configuración local a la transacción, sin cambiar la firma de `log_activity()`) e inserta el aviso a cada dueño con la preferencia activa.
- Grupo de rutas público `/r/<token>`, sin sesión, con layout propio sin navegación (al estilo de `(fair)`), `noindex` y sin exponer el nombre de la organización fuera del cuerpo de la página.
- Bucket privado nuevo `order-requests` con **una sola política `insert` para `anon`** sobre `storage.objects`, acotada a `<organization_id>/<request_id>/` y solo mientras la solicitud espera al cliente y no ha vencido. Sin `select`, `update` ni `delete` para `anon`.
- Bandeja de solicitudes dentro de la aplicación: leer con sus imágenes, aceptar o descartar. Accesible a cualquier rol con membresía, como `orders`.
- **Aceptar** reutiliza el alta de pedido existente sin modificarla, sugiere un contacto por teléfono cuando no hay `contact_id` prellenado, y copia (no mueve) las imágenes de la cuarentena a `attachments` en un paso idempotente y reintentable.
- **Generar y enviar:** desde la aplicación se crea la solicitud con el teléfono prellenado y se abre WhatsApp con `wa.me`, sin API ni credencial.
- `order_requests` se declara en `lib/export/tables.ts`, con `token_hash` en `EXCLUDED_COLUMNS` y su motivo escrito.
- Ningún cambio es incompatible hacia atrás: todo lo anterior es aditivo (tabla nueva, tipo de notificación nuevo, entrada nueva en el manifiesto de exportación).

## Capabilities

### New Capabilities
- `order-requests`: solicitudes de pedido públicas de un solo uso — tabla, funciones `security definer`, ruta pública `/r/<token>`, cuarentena de imágenes, bandeja, aceptar/descartar y su vínculo con el alta de pedido existente.

### Modified Capabilities
- `notifications`: se añade el tipo `order_request_received` al catálogo cerrado de `type` y su preferencia apagable individual, generado por una función sin sesión en lugar de un trabajo programado.
- `data-export`: `order_requests` se suma a la lista de tablas que produce la exportación completa, con `token_hash` excluido por el mismo motivo que `invitations.token_hash`.

## Impact

- **Base de datos:** migración nueva con `order_requests`, sus índices, su trigger de bitácora, sus políticas RLS (sin política `anon`), el bucket `order-requests` y su única política de `storage.objects`, y la cuarta redefinición de `log_activity()` para leer la variable de sesión del actor sin nombre.
- **Capas de aplicación:** `services/order-requests/`, `actions/order-requests.ts`, `features/order-requests/` (formulario público y bandeja), `app/r/[token]/` (grupo de rutas público) y la entrada de bandeja dentro de `(app)`.
- **Código existente tocado, no modificado en su contrato:** `lib/export/tables.ts`, `lib/notifications/defaults.ts`, `lib/activity/describe.ts` y `lib/activity/fields.ts` (checklist de tabla nueva), `lib/auth/routes.ts` y `route-states.test.tsx` si `/r/` necesita entrar explícitamente en la lista de rutas públicas verificadas. El alta de pedido (`actions/orders.ts`, `OrderForm`) se reutiliza intacta.
- **Patrones reutilizados:** `token_hash` y mensaje único de fallo al estilo `invitations`/`accept_invitation`; políticas de `storage.objects` al estilo `attachments`; layout público sin navegación al estilo `(fair)`.
- **Pruebas:** unitarias (Zod del formulario, derivación de estado, resolución de token, armado del enlace `wa.me`), pgTAP (ausencia de políticas `anon` en `public`, la única política de `storage.objects`, aislamiento entre organizaciones, ausencia de `DELETE`, bitácora con `actor_label`), integración (aceptar/descartar, aviso y su preferencia) y e2e (recorrido público completo, enlace vencido, aceptar desde la bandeja).
