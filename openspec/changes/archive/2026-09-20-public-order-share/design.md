## Context

Ver `proposal.md` — Why. Este cambio se apoya en dos precedentes ya construidos y probados en `public-order-intake` (KAM-28, mismo repositorio, `openspec/changes/public-order-intake/`):

1. **El patrón del token público**: `token_hash bytea` (sha256), mensaje único de fallo, generar/regenerar/revocar como escrituras de sesión (`insert`/`update`, sin función SQL), y las únicas dos funciones `security definer` reservadas a lo que de verdad ocurre sin sesión.
2. **`kamay.actor_label` en `log_activity()`**: la cuarta redefinición de la función (`20260920110000_order_requests.sql`) ya lee esa variable de sesión cuando `auth.uid()` es nulo. Este cambio la **reutiliza tal cual** — no hace falta una quinta redefinición, porque la condición ya es genérica («sin actor autenticado, lee la etiqueta que alguien haya fijado en esta transacción»).

También se apoya en un hallazgo real de KAM-28: una política de RLS para `anon` no puede leer otra tabla con un `exists (select ...)` directo si `anon` no tiene ninguna política sobre esa tabla — la subconsulta corre con los privilegios del rol que dispara la política, no con los de quien creó la función. La solución fue una función `security definer` de apoyo (`order_request_open()`). Este cambio necesita la misma pieza para la lectura pública de imágenes.

## Goals / Non-Goals

**Goals:**
- Que el cliente vea su pedido —número, estado, líneas, total, imágenes— sin sesión y sin que nadie se lo repita por WhatsApp.
- Que pueda dejar un comentario, sin que eso lo convierta en usuario ni abra ninguna puerta a los datos de la organización.
- Reutilizar el aparato de KAM-28 en vez de inventar uno nuevo.

**Non-Goals:**
- Cualquier cifra que no sea lo que el cliente paga: costo, margen, proveedor, último precio pagado (`proposal.md` — Fuera de alcance en el backlog).
- Responder al comentario desde la aplicación, aprobación del pedido, pago desde el enlace, documento imprimible, comentarios en otro tipo de registro, enlace de una venta directa, aviso automático de cambio de estado.
- Normalizar o rediseñar los nombres de estado por línea — se muestran tal como están.

## Decisions

### D1 — `orders.notes` y `order_items.description`: el primero nunca se expone, el segundo sí

El backlog mismo ya traza la línea sin decirlo: el alcance de la función de resolución lista «líneas con su descripción, cantidad y precio unitario» pero en ningún momento `orders.notes`. Se sigue esa evidencia:

- **`order_items.description` se muestra.** Es lo que el cliente ya sabe que pidió — lo más parecido a la lista de su propio pedido — y el riesgo de que contenga algo que no debería verse es bajo.
- **`orders.notes` no se muestra nunca**, ni siquiera con vista previa de por medio. Es un campo de propósito general que pudo escribirse cuando nadie de fuera lo iba a leer («cliente difícil, cobrar por adelantado» es exactamente el tipo de nota que existe hoy). Activar un enlace no puede exponer retroactivamente lo que era privado — es la misma razón por la que KAM-28 nunca lee `contacts` desde la función pública.

**Alternativa descartada:** un campo nuevo de «descripción para el cliente» en `orders`. Se descartó por ahora — añade una tabla/columna y una pantalla de edición nueva para un caso que `order_items.description` ya cubre razonablemente bien; queda como candidato futuro si hace falta.

### D2 — Sí se muestran lo pagado y el saldo pendiente

El texto de fuera de alcance dice «cualquier cifra que no sea **lo que el cliente paga**» — y lo pagado y lo que falta pagar son exactamente eso, no una cifra interna. `order_totals` (vista `security_invoker`, KAM-08) ya expone `total` y `paid`; el saldo es `total - paid`, derivado y no almacenado (convención nº 4). Es información que el cliente normalmente pediría por WhatsApp — mostrarla es lo que evita la pregunta.

### D3 — El nombre del estado es el configurado, sin traducir

Se muestra `statuses.name` tal como la organización lo configuró, no una etiqueta genérica derivada de `kind`. Los nombres del flujo por defecto de Sublimación («En diseño», «Sublimando», «Listo para entrega») ya son legibles para un cliente; esconder el nombre real y mostrar solo «en curso» perdería información real a cambio de una jerga que, en la práctica, no es tan interna como el open question temía. Si una organización concreta usa nombres que no quiere mostrar, ese es un problema de cómo nombra sus estados, no de esta función.

### D4 — Vigencia larga (no es un token de un solo uso)

A diferencia del enlace de KAM-28 —que se consume una vez y por eso vive 7 días—, este enlace se abre muchas veces mientras el pedido avanza: el cliente vuelve a mirar el estado. `ORDER_SHARE_TTL_DAYS = 180`, reiniciado cada vez que se regenera. Revocar (`archived_at`) sigue siendo el mecanismo principal para cortar el acceso, no el vencimiento — que aquí es una red de seguridad de fondo, no el control primario, al revés que en `order_requests`.

**Regenerar:** rota `token_hash` y `expires_at` en la misma fila (mismo mecanismo que `order_requests`, mismo trigger de guarda adaptado). El enlace anterior deja de resolver de inmediato. **Los comentarios sobreviven**: `order_comments.order_id` referencia el pedido, no la fila de `order_shares` — un comentario es del pedido, no de una generación concreta del enlace.

### D5 — Un enlace vigente por pedido, y la URL solo se ve al generar o regenerar

Igual que `invitations` y `order_requests`, **el token en claro nunca se guarda** — solo su hash. Eso significa que la URL completa no puede «recuperarse» después: el bloque «Compartir» la muestra justo después de generar o regenerar (estado de React, patrón de `InviteDialog`), y en cualquier otra visita al detalle el bloque dice que hay un enlace vigente, desde cuándo, y ofrece **regenerarlo** — no reimprimir uno que ya no está en memoria.

Esto interpreta el criterio de aceptación 3 («el detalle muestra su URL en un campo») como *mientras la URL siga en el estado de la pantalla que la generó*, no como una garantía de que sobrevive a una recarga de página. La alternativa —guardar el token en claro para poder remostrarlo siempre— se descarta: rompería la única propiedad de seguridad que todo este aparato de tokens comparte en el proyecto.

### D6 — Lectura pública de imágenes: función `security definer` de apoyo, como en KAM-28

`order_share_attachment_open(p_organization_id uuid, p_entity_type text, p_entity_id uuid)` — mismo motivo que `order_request_open()` (KAM-28, hallazgo de esa implementación): la política de `storage.objects` para `anon` no puede leer `order_shares` con un `exists` directo, porque `anon` no tiene ninguna política sobre esa tabla. La función comprueba `p_entity_type = 'order'` y que exista un `order_shares` vigente (`archived_at is null and expires_at > now()`) para ese pedido en esa organización.

La política se añade **solo** al bucket `attachments` (no a `receipts`, `item-photos` ni `org-logos`): es el único bucket donde un adjunto puede ser la imagen de referencia de un pedido.

**Revocar corta el acceso de inmediato** (criterio 11): la función depende de `archived_at is null and expires_at > now()` evaluados en cada lectura, no de una copia ni de una lista cacheada — no hay nada que purgar.

### D7 — El límite de comentarios se cuenta por pedido, no por token

`MAX_COMMENTS_PER_WINDOW = 5` cada `COMMENT_WINDOW = 1 hora`, contado sobre `order_comments` del pedido (no de la fila `order_shares` concreta): regenerar el enlace no resetea el límite, porque el abuso es del pedido expuesto, no del token que se usó para llegar a él.

### D8 — Copiar y compartir: mismo patrón que `InviteDialog`, sin capa de inyección nueva

`features/settings/members/invite-dialog.tsx` ya llama a `navigator.clipboard.writeText` directamente, y `members-section.test.tsx` ya lo ejercita sin mocks —`jsdom` lo soporta—. Se sigue el mismo camino para `navigator.share`: se llama directo, con `"share" in navigator` como guardia para ofrecer o no el botón (criterio 5). Las pruebas que necesiten el caso «sin capacidad de compartir» lo logran borrando `navigator.share` antes de renderizar (`Object.defineProperty` + `delete`), sin inventar una prop de inyección que no tiene precedente en el resto del proyecto.

### D9 — El bloque «Compartir» es un componente hermano de `PaymentBlock`

`features/orders/order-detail.tsx` ya compone bloques independientes (`PaymentBlock`, `RelatedTasks`) dentro del detalle. `features/order-shares/share-block.tsx` sigue el mismo patrón: recibe el pedido y el enlace vigente (si existe) como props, sin tocar la lógica de estado ni de líneas de `order-detail.tsx`.

## Risks / Trade-offs

- **Vigencia larga (180 días) mantiene más enlaces «vivos» que uno de un solo uso** → Mitigado por D6: revocar corta el acceso de inmediato y es el control primario, no el vencimiento.
- **Mostrar lo pagado es información de dinero, aunque no interna** → Aceptado conscientemente (D2): es «lo que el cliente paga», que el propio alcance del backlog excluye de la prohibición.
- **`order_items.description` podría, en teoría, llevar algo que no debería verse** → Menor que `orders.notes` por naturaleza (describe lo que se pidió, no una nota operativa); si una organización concreta lo usa mal, es un problema de cómo llena ese campo, no de este cambio.
- **El límite de comentarios por pedido (D7) no distingue entre un cliente legítimo insistente y abuso real** → Aceptable para un primer corte: 5 por hora no bloquea una conversación normal, y no hay IP ni cuenta que rastrear sin sesión.

## Migration Plan

Una sola migración nueva `supabase/migrations/<timestamp>_order_shares.sql` (convención nº 6):
1. Tablas `order_shares` y `order_comments`, índices, triggers `audit`.
2. Trigger de guarda sobre `order_shares` (mismo patrón que `guard_order_request_updates`): `token_hash`/`expires_at` no cambian una vez archivado.
3. RLS de ambas tablas: `is_member` para `select`/`insert`/`update`, sin `delete`, sin política `anon`. `order_comments` además sin `update` para nadie salvo `archived_at` (inmutable para quien la escribió — el cuerpo del comentario no se edita ni con sesión).
4. Función `order_share_attachment_open()` y la política de `storage.objects` que la usa.
5. Funciones públicas: `resolve_order_share(token)` y `submit_order_comment(token, nombre, cuerpo)`.
6. Catálogo de `notifications.type` ampliado a `order_comment_received`, columna en `notification_preferences`.
7. `lib/export/tables.ts`: `order_shares` y `order_comments`, con `token_hash` excluido.

No redefine `log_activity()` — ya lee `kamay.actor_label` desde KAM-28.

**Orden de archivado:** la delta de `notifications` de este cambio da por hecho que `order_request_received` (KAM-28) ya está en el catálogo — escribe el `type` con los ocho valores de una vez, no siete más uno. `public-order-intake` SHALL archivarse antes que `public-order-share`; archivar en el orden contrario dejaría el catálogo canónico en ocho tipos antes de que la delta de KAM-28 (que asume seis) intente aplicarse sobre él.

## Open Questions

Ninguna. Las cuatro preguntas que el backlog dejó abiertas (`orders.notes`, cobros y saldo, vigencia y regeneración, nombre del estado) quedan resueltas en D1–D4.
