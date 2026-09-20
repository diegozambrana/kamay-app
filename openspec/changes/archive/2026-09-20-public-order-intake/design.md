## Context

Ver `proposal.md` — Why. El patrón a seguir ya existe en el código: `invitations` (token_hash, mensaje único de fallo, `accept_invitation()` security definer), las políticas de `storage.objects` de `attachments`, y el grupo de rutas público `(fair)` sin navegación. `log_activity()` ya lleva tres redefiniciones (creación, `offline_sync`, `platform_admins`) y este cambio añade la cuarta.

`notifications` ya se genera fuera del trabajo programado: `task_assigned` y `task_review` nacen de un acto concreto, vía `services/notifications/emit-task-events.ts` llamado desde `actions/tasks.ts` (design D5 de `notifications`). Esa es la frontera real, y la hace cumplir `services/notifications/service-role-boundary.test.ts`: solo `app/api/notifications/`, `app/api/activity/retention/` y `services/notifications/` pueden importar `lib/supabase/admin.ts`; ninguna Server Action lo hace directamente. Este cambio sigue exactamente ese patrón (ver D4) en vez de escribir el aviso desde SQL.

## Goals / Non-Goals

**Goals:**
- Que el cliente pueda mandar sus datos y sus imágenes sin sesión, sin tocar ningún dato de la organización que no le corresponda.
- Que la revisión humana siga siendo el único camino hacia un pedido real.
- Reutilizar los tres patrones ya establecidos (token, storage, ruta pública) en lugar de inventar uno nuevo.

**Non-Goals:**
- Enlace abierto, captcha, límite de envíos por origen (`proposal.md` — Fuera de alcance en el backlog).
- Conversión automática a pedido.
- WhatsApp Business API.
- Normalizar `contacts.phone` en toda la base — solo se usa para sugerir, nunca para fusionar.
- Política de retención y purga de la cuarentena — se deja como candidato para resolverse junto con la cuarentena que introducirá KAM-32.

## Decisions

### D1 — La función de resolución devuelve `organization_id` y `request_id`, no solo el prellenado

El backlog original solo pedía nombre de organización, línea y prellenado. La ruta de subida es `<organization_id>/<request_id>/<archivo>` y la política de `storage.objects` necesita ambos valores. Se devuelven junto con el resto. El `request_id` pasa a ser, de hecho, un segundo secreto: solo lo conoce quien ya resolvió un token vigente. Es aceptable — es un uuid que nunca se expone por otra vía — pero queda escrito aquí para que no se descubra como sorpresa durante la implementación.

**Alternativa descartada:** subir las imágenes a través de un server action que reciba el token y armara la ruta internamente. Se descartó porque no reduce superficie: el llamador sigue siendo `anon` sin sesión, y además mete el binario de la imagen por el servidor de Next sin necesidad.

### D2 — El criterio "sin políticas anon" se divide en dos afirmaciones verificables

"Ninguna política para `anon` en ninguna tabla" es imposible de cumplir a la vez que la subida sin sesión: `createSignedUploadUrl`/`insert` sobre `storage.objects` evalúa RLS, y el proyecto no usa `service_role` en código de aplicación (convención nº 2). La regla queda como: cero políticas `anon` en el esquema `public`; exactamente una política `anon` en `storage.objects`, con nombre fijo. El pgTAP prueba ambas. Ver spec `order-requests` — Requirement: Ninguna tabla del esquema `public` gana una política para `anon`.

### D3 — `actor_label` llega por una variable de sesión local a la transacción

`submit_order_request()` ejecuta `set_config('kamay.actor_label', 'Formulario público', true)` antes de marcar `submitted_at`. `log_activity()` (cuarta redefinición) lee esa variable solo cuando `auth.uid()` es nulo — una condición que un usuario autenticado no puede simular, porque `auth.uid()` no depende de lo que la sesión escriba. `true` en `set_config` limita la variable a la transacción actual, así que no sobrevive ni se filtra a otra conexión.

**Alternativa descartada:** una rama `if tg_table_name = 'order_requests'` dentro del trigger. Se descartó porque ata el trigger genérico a una tabla concreta, y KAM-32 (que comparte el mismo patrón de autor externo) tendría que añadir otra rama en vez de reutilizar el mecanismo.

### D4 — El aviso lo genera `services/notifications/`, no la función SQL — corregido durante la implementación

**Esta decisión reemplaza la redacción original**, que proponía insertar el aviso dentro de `submit_order_request()`. Al llegar a la tarea 3.3 apareció `services/notifications/service-role-boundary.test.ts`: una prueba de arquitectura que limita quién puede importar `lib/supabase/admin.ts` a `app/api/notifications/`, `app/api/activity/retention/` y `services/notifications/` — y explícitamente **ninguna Server Action lo importa directamente**. El precedente ya existente, `task_assigned`/`task_review` vía `services/notifications/emit-task-events.ts` (invocado desde `actions/tasks.ts`, nunca desde SQL), es el patrón a seguir, no uno nuevo a inventar.

La forma corregida:
1. `submit_order_request(token, nombre, telefono, nota)` (SQL, `security definer`, concedida a `anon`) hace únicamente lo que su nombre dice: valida, marca `submitted_at`, fija `kamay.actor_label` para la bitácora (D3), y devuelve `organization_id` y el resto de lo que la Server Action necesita. **No toca `notifications`.**
2. `actions/order-requests.ts` → `submitOrderRequest()` llama a esa función por RPC con un cliente sin privilegios (no hace falta service role: la RPC ya corre con los suyos), y si tiene éxito llama a `emitOrderRequestReceived()`.
3. `services/notifications/emit-order-request-events.ts` (nuevo, mismo directorio que `emit-task-events.ts` y por tanto ya permitido por la prueba de frontera) crea el cliente admin, resuelve los dueños de la organización y sus preferencias, y llama a `NotificationGenerator.emit()` con la llave de idempotencia derivada del id de la solicitud. **Nunca lanza**, igual que `emitTaskEvents()`: un fallo al avisar no deshace que la solicitud ya quedó recibida.

`notifications` sigue teniendo `insert` revocado para `authenticated` y sin ninguna vía para `anon` — eso no cambia. Lo que cambia es que la escritura ocurre en una segunda llamada desde el servidor, con el cliente privilegiado ya establecido, y no dentro de la transacción SQL de `submit_order_request()`.

**Impacto en lo ya escrito:** el delta spec de `notifications` decía "la misma función que la recibe SHALL generar..." — ese detalle de implementación se retira del spec (que describe comportamiento observable, no mecanismo) y las tareas 2.4/3.3/9.x del `tasks.md` se ajustan para reflejar las dos piezas en vez de una.

### D5 — Contacto opcional al generar, sugerencia por teléfono al aceptar, nunca fusión automática

`contacts.phone` es texto libre sin normalizar y sin índice (`openspec/specs/catalog-directory/spec.md`), así que una coincidencia automática sería frágil. Se opta por: `order_requests.contact_id` opcional, elegible al generar el enlace; si está presente, el alta de pedido lo preselecciona al aceptar. Si no está presente, el selector de cliente se abre prellenado con nombre y teléfono, y lista arriba los contactos cuyo teléfono coincide — sugerido, nunca elegido por el sistema. La persona decide siempre, igual que decide aceptar o descartar la solicitud misma.

### D6 — Aceptar es: crear pedido → copiar imágenes (idempotente) → fijar `order_id`, en ese orden

El id del pedido lo genera el cliente antes de llamar a la acción existente (convención nº 9), así que ya se conoce antes de tocar la cuarentena. El orden es: 1) `createOrder` (acción existente, intacta), 2) copiar cada objeto de `order-requests` a `attachments` e insertar su fila — `unique (bucket, storage_path)` hace que repetir el paso no duplique nada —, 3) fijar `order_requests.order_id` al final. Si algo falla entre el paso 1 y el 3, la solicitud sigue "recibida" en la bandeja con la opción de reintentar el paso 2, en vez de aparecer aceptada con adjuntos a medias. Las imágenes se **copian**, no se mueven: no existe `delete` sobre la cuarentena, así que mover no es una operación disponible.

### D7 — La página pública usa siempre un cliente sin cookies

La función de resolución y la política de `storage.objects` se conceden solo a `anon`. Si la página pública reutilizara el cliente de sesión de quien la abre, un dueño que prueba su propio enlace vería el formulario fallar. `/r/<token>` crea su propio cliente de Supabase sin cookies, de modo que se comporta igual lo abra quien lo abra.

### D8 — El layout público no se deja indexar ni previsualizar

El layout de `/r/<token>` (sin navegación, al estilo `(fair)`) lleva `robots: { index: false }`, `Referrer-Policy: no-referrer` y un título genérico («Solicitud de pedido · Kamay»). El nombre de la organización no aparece en metadatos, solo en el cuerpo de la página tras resolver el token. Esto, junto con D-abrir-no-consume (ver spec `order-requests` — Requirement: Abrir el enlace no lo consume), hace inofensiva la vista previa que arma un cliente de mensajería al compartir el enlace.

### D9 — Vigencia de 7 días, regenerar rota el token en la misma fila

Mismo valor que `INVITATION_TTL_DAYS` (`lib/invitations/token.ts`), con su propia constante en `lib/order-requests/token.ts` — se reutiliza el patrón, no el valor importado, porque son conceptos distintos que podrían divergir. "Regenerar" solo actúa mientras `submitted_at` y `archived_at` son nulos: sustituye `token_hash` y `expires_at`, y el enlace anterior deja de resolver de inmediato porque ya no hay fila con ese hash.

**Mecanismo, igual que `invitations`:** generar, regenerar, aceptar y descartar son escrituras directas desde el cliente de la sesión —`insert`/`update` normales, gobernados por la política `is_member`—, no funciones SQL. `invitations` ya establece este patrón: el token se genera y se hashea en `lib/invitations/token.ts`, y el `insert` lo hace `InvitationService` con el cliente de quien tiene sesión; no existe una función `create_invitation()`. Las **únicas** dos funciones `security definer` de este cambio son `resolve_order_request` y `submit_order_request`, porque son las únicas dos operaciones que ocurren sin sesión. Un trigger `before update` (`guard_order_request_updates`) refuerza en la base lo que la aplicación ya respeta: `order_id` no cambia una vez fijado (D6), y `token_hash`/`expires_at` no cambian una vez que `submitted_at` o `archived_at` dejaron de ser nulos.

### D10 — El ayudante tiene los mismos privilegios que el dueño sobre la bandeja

Igual que `orders`, todas las políticas de `order_requests` usan `is_member`, no `is_owner`. La única asimetría es el aviso (D4), que por definición de producto va solo a los dueños — no por una restricción de acceso a la tabla.

Por esto `order_requests` **no lleva** el trigger `enforce_archive_rules()` que sí llevan `orders`, `tasks` e `items`: esa función ata archivar y desarchivar a `is_owner()`, que es exactamente la asimetría que aquí no debe existir — descartar una solicitud es tan del ayudante como aceptarla. La política `update` con `is_member` ya gobierna todo el ciclo de vida de la fila (recibir, aceptar, descartar, regenerar); no hace falta una segunda regla encima.

## Risks / Trade-offs

- **El `request_id` es un secreto implícito** → Mitigado por D1: solo sale de la función de resolución, nunca de otra vía, y la política de storage lo trata como tal.
- **La copia de imágenes a `attachments` no es una sola transacción con la creación del pedido** → Mitigado por D6: orden fijo, paso de copia idempotente por la restricción de unicidad, `order_id` como marca de éxito final.
- **Cuarta redefinición de `log_activity()`** → Aumenta la complejidad del trigger genérico, pero D3 usa el mismo mecanismo que reutilizará KAM-32 sin una quinta redefinición.
- **La sugerencia de contacto por teléfono es aproximada** (sin normalizar) → Mitigado por D5: nunca se autoselecciona ni se fusiona: siempre decide la persona.
- **Rastreador de WhatsApp abriendo el enlace repetidamente** → Mitigado por D8 y por que abrir no consume el token.

## Migration Plan

Una sola migración nueva `supabase/migrations/<timestamp>_order_requests.sql` (convención nº 6), con su prueba pgTAP en el mismo cambio:
1. Tabla `order_requests`, índices (incluido uno por `token_hash`, al estilo `invitations`), trigger `audit` con `log_activity()`.
2. RLS de `order_requests`: políticas `is_member` para `select`/`insert`/`update`, sin `delete`, sin política `anon`.
3. Bucket `order-requests` (privado, límite de tamaño y tipos) y su única política `insert` para `anon` sobre `storage.objects`.
4. Funciones `security definer`: `resolve_order_request(token)` y `submit_order_request(token, …)`, concedidas a `anon`; revocado el `execute` de `public`.
5. Cuarta redefinición de `log_activity()` para leer `kamay.actor_label` cuando `auth.uid()` es nulo.
6. Catálogo de `notifications.type` ampliado a `order_request_received`, y su columna en `notification_preferences`.
7. `lib/export/tables.ts`: entrada `order_requests` con `token_hash` en `EXCLUDED_COLUMNS`.

No requiere `down`-migration (convención nº 6: solo migraciones nuevas, nunca editar una existente); un rollback se resuelve con una migración adicional que revierta las columnas y funciones si hiciera falta.

## Open Questions

- **Umbral de coincidencia telefónica en la sugerencia de contacto (D5):** ¿comparar los últimos 7-8 dígitos, o normalizar todo el número antes de comparar? No cambia la especificación (que solo exige "sugerir, nunca fusionar") ni el enfoque; se resuelve al escribir `services/order-requests/`.
