## Why

Hoy la única manera de que un cliente sepa en qué va su pedido es que alguien de la organización se lo cuente uno por uno, casi siempre por WhatsApp, y cada vez que pregunta. KAM-32 le da un enlace de solo lectura para ver su pedido —número, estado, líneas, total, imágenes— y dejar un comentario, sin abrir sesión, sin ver ni un costo ni un margen, y sin que nadie tenga que repetirle el estado a mano.

## What Changes

- **Prerrequisito (convención nº 11):** se define «comentario del cliente» en `specs/PRD/kamay-especificacion-producto-v6.md` §6.1 — es contenido, no un evento de bitácora, y no convierte al cliente en usuario. «Seguimiento público del pedido» ya figuraba en la Fase 6; este cambio lo construye.
- Nueva tabla `order_shares`: organización, pedido, `token_hash bytea` (sha256, el token en claro nunca se guarda), `expires_at`, `archived_at`, quién lo generó. Un enlace vigente por pedido, revocable y regenerable — mismo patrón que `order_requests` (KAM-28): token en TS, `insert`/`update` de sesión, sin función SQL para generar o revocar.
- Nueva tabla `order_comments`: organización, pedido, nombre declarado, cuerpo, `occurred_at`, `archived_at`. Inmutable para quien la escribió; la organización archiva, nunca borra.
- Función `security definer` concedida a `anon` que resuelve el token y devuelve **solo** lo público: número, estado, fecha comprometida, líneas (descripción, cantidad, precio unitario), el total de `order_totals`, y los adjuntos — nunca costo, margen, proveedor, ni nada de otro pedido.
- Función `security definer` concedida a `anon` que recibe un comentario, con límite de cantidad por enlace y ventana de tiempo, comprobado en la propia función.
- **Lectura pública de imágenes sin service role:** una política `select` para `anon` sobre el bucket `attachments`, respaldada por una función `security definer` (mismo motivo que `order_request_open` de KAM-28: la política no puede leer `order_shares` directamente porque `anon` no tiene ninguna política sobre esa tabla) que confirma que la ruta pertenece a un pedido con enlace vigente.
- Grupo de rutas público `/p/<token>`, sin sesión, sin navegación — mismo patrón que `/r/<token>` de KAM-28.
- En el detalle del pedido (`/orders/<id>`): un bloque «Compartir con el cliente» con vista previa obligatoria antes de activar, campo de URL, copiar y compartir (API del dispositivo, con respaldo a copiar).
- Los comentarios recibidos se leen en el detalle del pedido.
- Aviso al dueño cuando llega un comentario: octavo tipo en `notifications`, apagable por separado.
- Autor en la bitácora: `actor_label = 'Cliente'`, sin `actor_id` — mismo mecanismo de `set_config` que KAM-28 (design D3 de `public-order-intake`), reutilizado sin tocar `log_activity()` otra vez.
- Ambas tablas declaradas en `lib/export/tables.ts`, `token_hash` en `EXCLUDED_COLUMNS`.
- Ningún cambio es incompatible hacia atrás: todo lo anterior es aditivo.

## Capabilities

### New Capabilities
- `order-share`: el enlace público de seguimiento de un pedido y los comentarios del cliente — tablas, funciones `security definer`, ruta pública `/p/<token>`, lectura pública de imágenes, bloque «Compartir» en el detalle del pedido.

### Modified Capabilities
- `notifications`: se añade el tipo `order_comment_received` al catálogo cerrado de `type` y su preferencia apagable individual, generado por una función sin sesión (mismo mecanismo que `order_request_received` de KAM-28).

**`data-export` no lleva delta.** El cambio hermano `public-order-intake` (KAM-28, aún sin archivar) ya añadió ahí la regla general «cuando una tabla guarde un resumen de token, la exportación lo omite» — no está sobre una tabla en particular. `order_shares.token_hash` ya queda cubierto por esa regla en cuanto se archive; este cambio solo declara la tabla en `lib/export/tables.ts` (tarea de implementación, sin requisito nuevo que escribir).

## Impact

- **Base de datos:** migración nueva con `order_shares`, `order_comments`, sus índices, triggers de bitácora, políticas RLS (sin política `anon` en ninguna tabla), la política de `storage.objects` para lectura pública de adjuntos y su función `security definer` de apoyo, las dos funciones públicas (resolver, comentar), y la reutilización — sin redefinir — del mecanismo de `kamay.actor_label` que KAM-28 ya instaló en `log_activity()`.
- **Capas de aplicación:** `services/order-shares/`, `actions/order-shares.ts`, `features/order-shares/` (bloque «Compartir», página pública, comentarios), `app/p/[token]/` (grupo de rutas público).
- **Código existente tocado, no modificado en su contrato:** el detalle del pedido (`app/(app)/orders/[id]/page.tsx`, `features/orders/order-detail.tsx`) gana el bloque «Compartir» y la lista de comentarios, sin tocar su lógica de estado ni de líneas. `lib/export/tables.ts`, `lib/notifications/defaults.ts`, `lib/activity/describe.ts`, `lib/activity/fields.ts`.
- **Patrones reutilizados:** todo el aparato de token/bitácora/RLS-sin-`anon` que estableció `public-order-intake` (KAM-28) — token_hash, mensaje único de fallo, `set_config('kamay.actor_label', ...)`, función `security definer` de apoyo para políticas de `anon` que necesitan leer una tabla sin política propia, y el copiar/compartir de `features/settings/members/invite-dialog.tsx`.
- **Pruebas:** unitarias (armado de URL, copiar, compartir con y sin la capacidad del dispositivo, forma del objeto público sin campos internos, la vista previa coincide con la página pública), pgTAP (ausencia de políticas `anon`, la función de resolución en sus cuatro casos de fallo, la política del bucket en todos sus casos, comentarios sin `DELETE`, bitácora con `actor_label`), integración (un comentario genera el aviso y respeta la preferencia; revocar corta el acceso a las imágenes), e2e (generar con vista previa, abrir sin sesión, comentar, leer en el detalle, revocar).
