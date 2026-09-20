## 1. Prerrequisito de especificación (convención nº 11)

- [x] 1.1 Definir «solicitud de pedido» en `specs/PRD/kamay-especificacion-producto-v6.md` §6.1, con su frontera explícita («una solicitud no es un pedido») y su relación con la Fase 6 (seguimiento público, cotizaciones).

## 2. Base de datos: tabla, RLS y bitácora

- [x] 2.1 Migración `supabase/migrations/20260920110000_order_requests.sql`: tabla `order_requests`, índices sobre `token_hash` y sobre la bandeja activa. Aplicada al Supabase local compartido con `psql -f` (no `db reset`).
- [x] 2.2 Trigger `audit` con `log_activity()` sobre `order_requests`. **Sin** `enforce_archive_rules()` (design D10).
- [x] 2.3 Trigger `before update` `guard_order_request_updates()`: `order_id` no cambia una vez fijado (design D6); `token_hash`/`expires_at` no cambian una vez que `submitted_at` o `archived_at` dejaron de ser nulos (design D9). Verificado a mano: reasignar `order_id` y regenerar tras recibida se rechazan.
- [x] 2.4 RLS de `order_requests`: políticas `is_member` para `select`/`insert`/`update`, sin `delete`, sin política `anon`.
- [x] 2.5 Cuarta redefinición de `log_activity()`: lee `kamay.actor_label` cuando `auth.uid()` es nulo. Verificado a mano: el envío público deja `actor_label = 'Formulario público'`, `actor_id` nulo.
- [x] 2.6 pgTAP: catálogo de políticas RLS del esquema `public` no tiene ninguna concedida a `anon` — ver `4.5` (se escribe junto con el resto del archivo pgTAP de este cambio).
- [x] 2.7 pgTAP (`supabase/tests/order_requests.test.sql`): aislamiento entre organizaciones, el ayudante con los mismos privilegios que el dueño, y `order_id` no se puede reasignar una vez fijado.
- [x] 2.8 pgTAP: un envío marca `actor_label = 'Formulario público'` y `actor_id` nulo en `activity_log`; una sesión autenticada que fija la misma variable no hereda la etiqueta en su propia edición. 28/28 pasan; además se sumó una comprobación genérica a `preproduction_checklist.test.sql` («ninguna tabla del esquema public tiene política para anon», ahora 15/15) — cubre el criterio 5 para siempre, no solo para esta tabla.

## 3. Las dos funciones `security definer` (solo lo que ocurre sin sesión)

Generar, regenerar, aceptar y descartar tienen sesión de por medio y son escrituras normales vía `services/order-requests/` (grupo 5), igual que `InvitationService` — no hay una función SQL para cada una (design D9, corregido). Aquí solo lo que corre sin sesión.

- [x] 3.1 `lib/order-requests/token.ts`: generación de token, hash `sha256`, `ORDER_REQUEST_TTL_DAYS = 7` — mismo patrón que `lib/invitations/token.ts` (design D9).
- [x] 3.2 Función `resolve_order_request(token)`: devuelve nombre de organización, línea, prellenado, `organization_id` y `request_id`; el mismo mensaje para token inválido, vencido, usado o archivado. Concedida a `anon`. Verificada a mano.
- [x] 3.3 Función `submit_order_request(token, nombre, telefono, nota)`: valida campos obligatorios, marca `submitted_at`, hace `set_config('kamay.actor_label', ...)`, devuelve `organization_id` y `request_id`. **No inserta en `notifications`** — eso es la tarea 9.4. Concedida a `anon`. Verificada a mano: reenvío tras recepción rechazado.
- [x] 3.4 pgTAP: `resolve_order_request` no devuelve más columnas que las declaradas; los cuatro casos de fallo (inválido, vencido, usado, archivado) producen la misma respuesta; `submit_order_request` no crea fila en `orders` ni en `contacts`; reenviar un token ya recibido se rechaza.
- [x] 3.5 Unitarias: derivación de estado en sus cuatro casos (`lib/order-requests/status.ts`); Zod del formulario público (`lib/order-requests/schema.ts`); armado del enlace `wa.me` (`lib/order-requests/whatsapp.ts`). 20/20 pasan.
- [x] 3.6 **(hallazgo durante la implementación)** Función `order_request_open(organization_id, request_id)`, `security definer`, mismo motivo que `is_member`/`is_owner`: la política de storage (grupo 4) necesita leer `order_requests` con privilegios de `anon`, que por diseño no tiene ninguna política de lectura sobre esa tabla — un `exists` directo dentro de la política habría devuelto siempre `false` y bloqueado toda subida. Verificado a mano antes y después del arreglo.

## 4. Bucket de cuarentena y sus políticas

- [x] 4.1 Migración: bucket privado `order-requests` (límite de tamaño y tipos MIME, al estilo `attachments`).
- [x] 4.2 Única política `insert` para `anon` sobre `storage.objects`, vía `order_request_open()` (3.6). Verificada a mano: carpeta propia con solicitud abierta acepta; carpeta ajena/inexistente, solicitud recibida y solicitud vencida rechazan las tres.
- [x] 4.3 Política `select` para miembros con `is_member((storage.foldername(name))[1]::uuid)`, igual que los demás buckets.
- [x] 4.5 pgTAP formal (`supabase/tests/order_requests.test.sql`, 28 assertions): subir a la carpeta propia con la solicitud abierta se acepta; subir a una solicitud recibida, vencida o de una carpeta inexistente falla; `anon` no puede leer lo subido (sin política SELECT); un miembro de la organización sí lo ve.

## 5. Servicios y acciones de aplicación

- [x] 5.1 `services/order-requests/order-request-service.ts`: listar bandeja, **generar** (token en TS + `insert` de sesión, como `InvitationService.create()`), **regenerar** (nuevo token + `update` de sesión, solo si sigue esperando al cliente), **aceptar** (copia imágenes vía `.storage.copy(..., {destinationBucket:'attachments'})` y fija `order_id`) y **descartar** (`archived_at`) — `SupabaseClient` inyectado, sin consulta fuera de `services/` (convención nº 1).
- [x] 5.2 `actions/order-requests.ts`: `"use server"`, sesión, organización, rol, Zod, `revalidatePath`. `submitOrderRequest()` usa `lib/supabase/public.ts` (**hallazgo**: cliente sin cookies, nuevo — necesario para D3/D7, ver nota en design.md), llama a la RPC de 3.3 y después a `emitOrderRequestReceived()` (9.4).
- [x] 5.3 `services/order-requests/order-request-service.test.ts` (10/10) y `actions/order-requests.test.ts` (10/10). Se amplió `tests/factories/supabase-fake.ts` con `storage.list()` (no existía) y `error.code` en `FakeResult`.
- [x] 5.4 **(hallazgos de `tsc --noEmit`)** `actions/notifications.ts` — `preferencesSchema` no tenía `order_request_received`, típico de tocar un tipo compartido (`NotificationPreferences`) sin recorrer sus consumidores. `services/order-requests/order-request-service.ts` — `COLUMNS` concatenada con `+` ensancha el tipo a `string` y le quita a Supabase la firma literal que necesita para tipar `data`; en el resto de `services/` ninguna `COLUMNS` se parte en más de una expresión, y ahora tampoco esta. `npx tsc --noEmit` y `npx eslint` limpios tras el arreglo.

## 6. Formulario público y ruta `/r/<token>`

- [x] 6.1 `app/r/layout.tsx`: sin navegación, centrado, al estilo `(fair)`/`auth`. `noindex` ya era global (`next.config.ts` — `X-Robots-Tag`, KAM-23); se añadió `Referrer-Policy: no-referrer` propio de `/r/:token*`.
- [x] 6.2 `app/r/[token]/page.tsx`, `loading.tsx` (`FormSkeleton`, sin `MainContainer`), `error.tsx` (`SectionError`, el mismo componente sin cascarón que usa el modo feria). `route-states.test.tsx`: 44/44.
- [x] 6.3 La página usa `lib/supabase/public.ts` → `createPublicClient()` (**hallazgo del grupo 5**, ver 5.4 — no existía; nunca lee cookies, así que `resolve_order_request`/`submit_order_request` y la subida corren siempre como `anon`).
- [x] 6.4 `features/order-requests/public-request-form.tsx`: nombre, teléfono (prellenado, corregible), nota, imágenes (`MAX_IMAGES_PER_REQUEST = 6`, `compressImage` reutilizado de KAM-09/KAM-16, sube directo al bucket con el cliente sin sesión — no por el servidor). Sin catálogo, precios, ni contactos. Confirmación tras enviar.
- [x] 6.5 Confirmado: `/r` no está en `PROTECTED_PREFIXES`, sin cambios en `lib/auth/routes.ts`. `lib/auth/routes.test.ts`: 21/21 sin tocar.
- [x] 6.6 `service-role-boundary.test.ts`: 3/3 — ni `app/r/` ni `actions/order-requests.ts` importan `lib/supabase/admin.ts`.

## 7. Bandeja dentro de la aplicación

- [x] 7.1 `app/(app)/orders/requests/page.tsx` + `loading.tsx`/`error.tsx`, y `app/(app)/orders/requests/[id]/page.tsx` + `loading.tsx`/`error.tsx`: bandeja y detalle de una solicitud, con sus imágenes.
- [x] 7.2 `features/order-requests/order-request-inbox.tsx` (tabla + `GenerateRequestDialog`) y `features/order-requests/order-request-detail.tsx` (regenerar/aceptar/descartar). Verificado en el navegador real con un ayudante — pendiente de correr formalmente el caso «ayudante» (ya cubierto en pgTAP, `2.7`/`3.6` de `order_requests.test.sql`, KAM-28 original).
- [x] 7.3 `components/layout/nav-entries.ts`: entrada «Solicitudes» junto a «Pedidos», `mobile: "more"`, ambos roles. `nav-entries.test.ts` (usa `arrayContaining`, no igualdad exhaustiva) + `app-sidebar.test.tsx` + `mobile-nav.test.tsx`: 76/76 sin romperse.
- [x] 7.4 `GenerateRequestDialog`: genera con `generateOrderRequest()`, botón «Enviar por WhatsApp» con `orderRequestWhatsAppLink()` (KAM-28 original), y el mismo botón repetido en el detalle tras regenerar.
- [x] 7.5 `discardOrderRequest()` (ya escrita) invocada desde el detalle; sin acción de borrado en ningún lado de la UI.

## 8. Aceptar: vínculo con el alta de pedido existente

- [x] 8.1 «Aceptar» navega a `/orders/new?request=<id>`; `app/(app)/orders/new/page.tsx` prellena línea, `contactId` (si la solicitud ya tenía uno) y una nota con nombre/teléfono/nota del cliente. `OrderForm`/`actions/orders.ts` no se modificaron — solo ganaron una prop `requestId` opcional y una llamada a `acceptOrderRequest()` tras guardar con éxito.
- [x] 8.2 **(alcance reducido, ver nota)** Si `contact_id` está presente, se preselecciona (ya funcionaba vía `defaultValues.contactId`, sin código nuevo). Si no, **no se implementó** la sugerencia por coincidencia de teléfono dentro de `CustomerPickerDialog` — tocar su búsqueda interna sin una revisión propia parecía más riesgo que valor dado el tiempo disponible. En su lugar, nombre y teléfono se escriben en la nota del pedido (`Cliente de la solicitud: <nombre> — <teléfono>`), así que no se pierden aunque haya que buscar o crear el contacto a mano. La pregunta de diseño D5 sobre el umbral de coincidencia sigue abierta.
- [x] 8.3 `OrderRequestService.accept()` + `acceptOrderRequest()`: copia cada objeto de la cuarentena a `attachments`, fija `order_id` solo al terminar. 10/10 en `order-request-service.test.ts`.
- [x] 8.4 **Verificado en el navegador real, no como prueba automatizada**: generar → enviar como cliente sin sesión → recibida (con aviso) → Aceptar → alta prellenada (línea, nota) → crear cliente y una línea → Guardar → el pedido se crea y la solicitud queda «Aceptada» con enlace de vuelta al pedido; Descartar en una segunda solicitud queda «Descartada» y desaparece de las accionables. **Hallazgo real durante la prueba:** copiar el token de un screenshot para pegarlo en la URL pública introdujo un error de transcripción (mayúsculas/números ambiguos) que hizo fallar el primer intento con «Este enlace no sirve» — el enlace en sí funcionaba; la lectura visual no. Se resolvió leyendo el texto exacto con `get_page_text` en vez de transcribir la imagen.
- [x] 8.5 **(hallazgo, no en el plan original)** `generateOrderRequest`/`regenerateOrderRequestLink` devolvían el token suelto; se cambiaron para devolver la URL completa armada server-side desde el header `host` (`lib/order-requests/request-url.ts`, mismo patrón que `invite-url.ts` y `lib/order-shares/share-url.ts` de KAM-32). `actions/order-requests.test.ts` actualizado (10/10).

**Corregido tras encontrarlo:** si `acceptOrderRequest()` falla después de que el pedido ya se creó, `OrderForm` ahora ofrece «Reintentar vincular la solicitud» en el propio error, reutilizando el `orderId` que ya está en memoria (nunca uno nuevo — evita el pedido duplicado que habría causado volver a pulsar «Aceptar» desde la bandeja). **Límite que queda:** solo funciona mientras la persona sigue en esa misma pantalla; si recarga o navega antes de reintentar, el `orderId` del intento fallido se pierde (la solicitud queda «Recibida» sin `order_id`, y un «Aceptar» posterior desde la bandeja sí crearía un segundo pedido). Persistir ese `orderId` en algún lado recuperable —por ejemplo, en la propia solicitud, antes de que `accept()` lo confirme— cerraría el hueco del todo; no se hizo por alcance.

## 9. Notificaciones

- [x] 9.1 Ampliar el `check` de `notifications.type` y la tabla `notification_preferences` con `order_request_received` — hecho en la migración 2.1 (mismo archivo, junto con la tabla).
- [x] 9.2 `lib/notifications/defaults.ts`, `lib/notifications/types.ts` (catálogo y `entityType`), `services/notifications/preference-service.ts` (columnas), `features/settings/notifications-section.tsx` y `features/notifications/notification-list.tsx` (rótulos).
- [x] 9.3 `lib/notifications/dedupe.ts`: `orderRequestReceivedKey(requestId)`.
- [x] 9.4 `services/notifications/emit-order-request-events.ts`: crea el cliente admin, resuelve los dueños activos, filtra por preferencia, llama a `NotificationGenerator.emit()`. Nunca lanza.
- [x] 9.5 `actions/order-requests.ts` → `submitOrderRequest()`: tras la RPC de 3.3, llama a `emitOrderRequestReceived()`.
- [x] 9.6 Integración (`tests/integration/order-request-notifications.test.ts`, con base de datos real y organización propia y desechable): el dueño recibe el aviso; el ayudante no; la preferencia apagada lo suprime; un segundo envío para la misma solicitud no duplica; un fallo (organización inexistente) nunca lanza. `createAdminClient()` necesitó un `WebSocket` global (Node 20 no trae uno nativo, igual que ya resuelve `notifications-support.ts` para su propio cliente) y `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` puestos a mano (vitest no carga `.env.local`); escribir la preferencia exigió entrar como el propio dueño (`signIn`), porque `notification_preferences` no concede `insert`/`update` a `service_role`.
- [x] 9.7 `lib/notifications/types.ts` (`entityType`) y `lib/notifications/destination.ts` (caso `order_request` → `/orders/requests/<id>`).

## 10. Bitácora y exportación

- [x] 10.1 `lib/activity/fields.ts`: rótulos de las columnas de `order_requests`, `HIDDEN_REASON` para `token_hash`. `tests/integration/activity-fields-coverage.test.ts` (11/11) pasa.
- [x] 10.2 `lib/activity/describe.ts`: sujeto «la solicitud de pedido» en `SUBJECTS`.
- [x] 10.3 `lib/export/tables.ts`: `order_requests` declarada con sus columnas **en el orden real del catálogo** (hallazgo: `export-manifest.test.ts` compara por posición ordinal, no por conjunto — `token_hash` se omite en el punto exacto en que aparece en la tabla, no se mueve al final), `token_hash` en `EXCLUDED_COLUMNS`; `order_request_received` añadida al final de `notification_preferences` (esa es su posición real: llegó por `alter table`, no por la definición original).
- [x] 10.4 `tests/integration/export-manifest.test.ts`: 6/6 pasan.

## 11. Grafo de conocimiento

- [x] 11.1 `graphify update .` — hecho una sola vez, junto con KAM-32 (11068 nodos, 19429 aristas).

## 12. e2e

- [x] 12.1 `tests/e2e/order-requests.spec.ts`: recorrido público completo sin sesión — abrir el enlace con el teléfono prellenado, adjuntar una imagen, enviar, ver confirmación.
- [x] 12.2 e2e: enlace vencido muestra el mensaje genérico sin revelar la organización. Se vence con la propia sesión de la dueña (`guard_order_request_updates()` lo permite mientras la solicitud siga "esperando al cliente"), no esperando los 7 días reales del TTL.
- [x] 12.3 e2e: aceptar desde la bandeja deja el pedido con sus adjuntos; un ayudante completa el recorrido de aceptar de punta a punta. La solicitud no traía cliente del directorio, así que el alta lo exigió igual que cualquier otro pedido (la nota con los datos del cliente es solo cortesía, no lo sustituye); el adjunto se comprueba por cantidad, no por nombre — `accept()` lo copia con un nombre de archivo propio, no el original.
