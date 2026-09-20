## 1. Prerrequisito de especificación (convención nº 11)

- [x] 1.1 Definir «comentario del cliente» en `specs/PRD/kamay-especificacion-producto-v6.md` §6.1: es contenido, no un evento de bitácora, y no convierte al cliente en usuario.

## 2. Base de datos: tablas, RLS y bitácora

- [x] 2.1 Migración `supabase/migrations/20260920120000_order_shares.sql`: tablas `order_shares` y `order_comments`, índices. Aplicada al Supabase local compartido con `psql -f`.
- [x] 2.2 Triggers `audit` con `log_activity()` sobre ambas tablas.
- [x] 2.3 Trigger de guarda sobre `order_shares`: `token_hash`/`expires_at` no cambian una vez `archived_at`. Verificado a mano: regenerar tras revocar se rechaza.
- [x] 2.4 RLS de `order_shares` (`is_member` select/insert/update) y `order_comments` (`is_member` select; `update` acotado a la columna `archived_at` vía `grant update (archived_at)`, revocar-antes-que-conceder como en `notifications`). Sin política `anon` en ninguna de las dos. Único enlace vigente por pedido (índice único parcial) verificado a mano.
- [x] 2.5 pgTAP: `preproduction_checklist.test.sql` sigue en 15/15 con las tablas nuevas (la comprobación genérica de KAM-28 las cubre automáticamente).
- [x] 2.6 pgTAP (`supabase/tests/order_shares.test.sql`, 22/22): aislamiento entre organizaciones, el ayudante con los mismos privilegios, segundo enlace vigente rechazado, regenerar tras revocar rechazado, el cuerpo del comentario no se edita ni con sesión.
- [x] 2.7 pgTAP: un comentario marca `actor_label = 'Cliente'`, `actor_id` nulo — reutilizando la variable de KAM-28 sin nueva redefinición de `log_activity()`.

## 3. Las dos funciones `security definer` (solo lo que ocurre sin sesión)

Generar, regenerar y revocar el enlace son escrituras de sesión vía `services/order-shares/`, igual que `order_requests` de KAM-28 — no hay función SQL para cada una (design D5).

- [x] 3.1 `lib/order-shares/token.ts`: generación de token, hash `sha256`, `ORDER_SHARE_TTL_DAYS = 180` (design D4).
- [x] 3.2 Función `resolve_order_share(token)`: devuelve número, estado (nombre configurado), fecha comprometida, líneas (descripción, cantidad, precio unitario), total, pagado y saldo de `order_totals`, y la lista de adjuntos — nunca `orders.notes`, costo, margen ni proveedor. Mismo mensaje único de fallo para los cuatro casos. Concedida a `anon`. Verificada a mano contra un pedido real de Geeko (líneas, total 190, pagado 60, saldo 130, adjunto real).
- [x] 3.3 Función `submit_order_comment(token, nombre, cuerpo)`: valida campos, límite de 5 por hora por pedido (no por `order_shares`), inserta en `order_comments` con `order_id`, fija `kamay.actor_label = 'Cliente'`. **No inserta en `notifications`** — eso es la tarea 8.4/8.5. Concedida a `anon`. Verificada a mano: sexto comentario en la ventana rechazado.
- [x] 3.4 Función `order_share_attachment_open(organization_id, entity_type, entity_id)`, `security definer`, mismo motivo que `order_request_open()` de KAM-28.
- [x] 3.5 pgTAP: `resolve_order_share` no devuelve más de los once campos declarados (comprobado contra `information_schema.parameters`, no a mano); los cuatro casos de fallo dan la misma respuesta; `submit_order_comment` dentro/fuera del límite; regenerar no reinicia el conteo. 22/22 en `order_shares.test.sql`.
- [x] 3.6 Unitarias: `lib/order-shares/token.ts` (3/3), `lib/order-shares/schema.ts` (4/4). La forma exacta de `resolve_order_share` ya la prueba el pgTAP de 3.5 contra `information_schema.parameters` — no hace falta repetirla en TypeScript, porque la fuente de verdad de esa forma es la función SQL.

## 4. Lectura pública de imágenes

- [x] 4.1 Política `select` para `anon` sobre `storage.objects`, acotada a `bucket_id = 'attachments'`, vía `order_share_attachment_open()` (3.4). Sin `insert`, `update` ni `delete` para `anon` en ese bucket.
- [x] 4.2 pgTAP: con enlace vigente, se lee; sin enlace vigente (misma ruta exacta), se rechaza; otro bucket con la misma forma de ruta no gana la política; revocar corta el acceso en la misma prueba.

## 5. Servicios y acciones de aplicación

- [x] 5.1 `services/order-shares/order-share-service.ts`: generar, regenerar, revocar, listar comentarios, archivar un comentario. `lib/order-shares/share-url.ts` (**hallazgo**: la URL se arma server-side desde el `host` de la petición, mismo patrón que `lib/invitations/invite-url.ts` — no existía un equivalente para `order_requests` todavía; conviene aplicarlo ahí también cuando se retome el grupo 7 de KAM-28).
- [x] 5.2 `actions/order-shares.ts`: `generateOrderShare`/`regenerateOrderShare` devuelven la URL completa (no el token suelto), `revokeOrderShare`, `archiveOrderComment`, `submitOrderComment()` sin sesión con `emitOrderCommentReceived()`.
- [x] 5.3 `services/order-shares/order-share-service.test.ts` (8/8) y `actions/order-shares.test.ts` (10/10).

## 6. Página pública `/p/<token>`

- [x] 6.1 `app/p/layout.tsx` propio (mismo patrón que `app/r/layout.tsx`, sin reutilizarlo literalmente — grupos de rutas distintos). `app/p/[token]/page.tsx`, `loading.tsx`, `error.tsx`. `Referrer-Policy: no-referrer` para `/p/:token*` en `next.config.ts`.
- [x] 6.2 La página usa `createPublicClient()` (KAM-28, reutilizado sin cambios), incluida la firma de URLs de imágenes con el mismo cliente sin sesión.
- [x] 6.3 `features/order-shares/public-order-view.tsx`: número, estado, fecha comprometida, líneas, total, pagado, saldo, imágenes, formulario de comentario. **Verificado en el navegador real** (ver la nota de verificación al final): coincide exactamente con la vista previa del bloque «Compartir».
- [x] 6.4 `service-role-boundary.test.ts` (3/3) — ni `app/p/` ni `actions/order-shares.ts` importan `lib/supabase/admin.ts`.

## 7. Bloque «Compartir» en el detalle del pedido

- [x] 7.1 `features/order-shares/share-block.tsx`: sin enlace → generar con vista previa obligatoria; con enlace → URL mientras siga en memoria, copiar, compartir (`navigator.share` si existe), fecha de vigencia, regenerar, revocar. **Hallazgo:** `"share" in navigator` calculado directo en el cuerpo del componente desajusta la hidratación (el servidor nunca tiene `navigator`) y, calculado en un `useEffect`, dispara el lint `react-hooks/set-state-in-effect`; resuelto con `useSyncExternalStore` (`getServerSnapshot` fijo en `false`, sin efecto ni desajuste).
- [x] 7.2 `features/order-shares/share-preview.tsx`: mismo contenido que `public-order-view.tsx`, alimentado con `order`/`lines`/`statusName`/`businessLineName` que el detalle ya tenía cargados.
- [x] 7.3 `ShareBlock` y `OrderComments` compuestos en `features/orders/order-detail.tsx`, junto a `PaymentBlock`. `share`/`comments` opcionales con default (`null`/`[]`) para no tocar `order-detail.test.tsx`, que no los pasa.
- [x] 7.4 `features/order-shares/order-comments.tsx`: lista con nombre, cuerpo, fecha, y «Archivar» por comentario.

**Verificado en el navegador real** contra una organización nueva (`createFreshOrganization()`, no Geeko): generar → vista previa exacta → activar → URL con copiar/regenerar/revocar visibles → abierta en otra pestaña sin sesión, misma vista que la previa → comentario enviado → aparece en el detalle bajo «Comentarios del cliente» → aviso `order_comment_received` recibido por el dueño (campana + panel, agrupado «Comentarios de pedidos») → revocar deja «Genera un enlace…» de nuevo y el enlace público responde «Este enlace no sirve». Organización de prueba archivada al terminar (no se puede borrar — bitácora la referencia).

## 8. Notificaciones

- [x] 8.1 `notifications.type` y `notification_preferences` ampliados en la migración 2.1.
- [x] 8.2 `lib/notifications/types.ts`, `lib/notifications/defaults.ts`, `services/notifications/preference-service.ts`, rótulos en `features/settings/notifications-section.tsx` y `features/notifications/notification-list.tsx`, esquema de `actions/notifications.ts`.
- [x] 8.3 `lib/notifications/dedupe.ts`: `orderCommentReceivedKey(commentId)`.
- [x] 8.4 `services/notifications/emit-order-comment-events.ts`. Verificado en vivo (ver nota al final): el dueño lo recibió con el título y cuerpo correctos.
- [x] 8.5 `actions/order-shares.ts` → `submitOrderComment()` → `emitOrderCommentReceived()`.
- [x] 8.6 `lib/notifications/destination.ts`: caso `order` → `/orders/<entityId>`.
- [x] 8.7 Integración (`tests/integration/order-comment-notifications.test.ts`, con base de datos real y organización propia y desechable): el dueño recibe el aviso; el ayudante no; la preferencia apagada lo suprime; un segundo envío para el mismo comentario no duplica; un fallo (organización inexistente) nunca lanza. Mismos dos hallazgos que 9.6 de `public-order-intake` (KAM-28): `WebSocket` global para `createAdminClient()` en Node 20, y la preferencia se escribe con la sesión del propio dueño porque `service_role` no tiene `insert`/`update` en `notification_preferences`.

## 9. Bitácora y exportación

- [x] 9.1 `lib/activity/fields.ts`: rótulos de `order_shares` y `order_comments`, `HIDDEN_REASON` para `token_hash`.
- [x] 9.2 `lib/activity/describe.ts`: sujetos «el enlace del pedido» y «el comentario del cliente».
- [x] 9.3 `lib/export/tables.ts`: ambas tablas en el orden real del catálogo; `order_comment_received` añadida al final de `notification_preferences` (posición real, llegó por `alter table`).
- [x] 9.4 `tests/integration/activity-fields-coverage.test.ts` (11/11) y `export-manifest.test.ts` (6/6).

## 10. Grafo de conocimiento

- [x] 10.1 `graphify update .` — hecho una sola vez, junto con KAM-28.

## 11. e2e

- [x] 11.1 `tests/e2e/order-shares.spec.ts`: generar el enlace con su vista previa, abrirlo sin sesión, ver líneas y total, dejar un comentario, leerlo en el detalle, revocar y comprobar que la página ya no responde. Revocar hace que `revalidatePath` regrese el bloque a su estado inicial («Generar enlace») en vez de dejarlo en «Regenerar»: la prueba comprueba eso, no un estado intermedio inventado.

## 12. Archivado (orden obligatorio)

- [x] 12.1 Archivar `public-order-intake` (KAM-28) **antes** que `public-order-share`: la delta de `notifications` de este cambio asume que `order_request_received` ya está en el catálogo canónico (design.md — nota de orden de archivado). Hecho: KAM-28 se archivó primero en esta misma sesión (`2026-09-20-public-order-intake`).
