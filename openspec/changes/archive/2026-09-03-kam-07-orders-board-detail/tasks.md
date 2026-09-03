# Tareas · KAM-07 · Pedidos: tablero y detalle

Requisitos en `specs/orders/spec.md`; decisiones (D1–D8) en `design.md`.
Convención nº 12: cada escenario del delta tiene al menos una prueba aquí referenciada.

## 1. Base de datos

- [x] 1.1 Crear `supabase/migrations/<timestamp>_orders.sql` con las tablas `orders` y `order_items` según el esquema canónico §9, incluidos `order_needs_customer`, el `check` de `delivery_mode`, los de `quantity > 0` y `unit_price >= 0`, `unique (organization_id, code)` y los tres índices de `orders` más los dos de `order_items`.
- [x] 1.2 Añadir a esa migración el trigger `before insert` de numeración por organización (D2): bloqueo `for update` sobre la fila de `organizations` y `coalesce(max(code), 0) + 1`, tomando el máximo incluidos los archivados.
- [x] 1.3 Añadir el trigger `before update` que mantiene `queued_at` (D4): actúa solo cuando cambia `status_id`; `now()` al entrar a un estado con `is_queue = true`, `null` al salir.
- [x] 1.4 Añadir la vista `order_totals` con `security_invoker = true` y las columnas `order_id, organization_id, business_line_id, kind, occurred_at, total`, sin `paid` (D3), con `coalesce(..., 0)` para el pedido sin líneas.
- [x] 1.5 Adjuntar a `orders` el trigger `enforce_archive` reutilizando `enforce_archive_rules()` y los triggers `audit` de `log_activity()` en `orders` y en `order_items` (D7).
- [x] 1.6 Cerrar privilegios y RLS con el patrón del proyecto: `grant select, insert, update` a `authenticated`, `revoke delete` a todos, políticas de leer/crear/editar con `is_member(organization_id)` y **ninguna política `DELETE`** en ninguna de las dos tablas.
- [x] 1.7 Ampliar `supabase/seed.sql` con los pedidos de Geeko Store: repartidos por línea y estado, con sus líneas de pedido, e incluyendo explícitamente tres pedidos en la columna en cola con `queued_at` en orden inverso a `due_date`, un pedido vencido en estado `waiting`, uno vencido en `in_progress`, uno vencido en `final`, uno sin `due_date`, uno archivado y uno con adjunto de referencia.
- [x] 1.8 Verificar `supabase db reset` sin error y regenerar el grafo con `graphify .` (convención nº 6).

## 2. Pruebas de base de datos (pgTAP)

- [x] 2.1 `supabase/tests/order_numbering.test.sql`: primer pedido con `code = 1`; numeración independiente entre dos organizaciones; inserciones simultáneas sin duplicados; el número del pedido archivado no se reutiliza.
- [x] 2.2 `supabase/tests/order_integrity.test.sql`: `order_needs_customer` rechaza el pedido sin cliente y acepta la venta directa sin cliente; `delivery_mode` fuera del dominio rechazado; `quantity` no positiva y `unit_price` negativo rechazados; `order_totals` devuelve 115 para 3×25 + 1×40, 0 para el pedido sin líneas, y refleja una línea añadida; `orders` no tiene ninguna columna de total, saldo, cobrado ni margen.
- [x] 2.3 `supabase/tests/order_queue.test.sql`: entrar a un estado `is_queue` fija `queued_at`; salir lo pone a `null`; salir y volver lo actualiza al nuevo momento; un cambio que no toca `status_id` no altera `queued_at`.
- [x] 2.4 El borrado se rechaza y un miembro de otra organización no obtiene ninguna fila. *(Escrito en `supabase/tests/order_access.test.sql` en vez de extender `no_delete`/`rls_isolation`, que son de KAM-02: mismo criterio que `catalog.test.sql`, cada suite cubre su capacidad. Misma cobertura.)*
- [x] 2.5 El ayudante crea y edita pedidos y líneas; el ayudante que intenta archivar recibe `insufficient_privilege`; el pedido archivado no se puede editar. *(También en `order_access.test.sql`, por lo dicho en 2.4.)*
- [x] 2.6 Extender `supabase/tests/seed_geeko.test.sql` con los casos límite que la semilla debe contener (D4, riesgo anotado): tres en cola, vencido en `waiting`, vencido en `in_progress`.

## 3. Lógica pura y tipos

- [x] 3.1 Añadir a `types/index.ts` los tipos `Order`, `OrderItem`, `OrderKind`, `DeliveryMode` y `OrderTotals`, siguiendo el estilo de los ya existentes.
- [x] 3.2 `lib/orders/overdue.ts` (D5): `isOverdue({ dueDate, statusKind, today })`, verdadero solo con `due_date` pasada y `kind` `initial` o `in_progress`; más el ayudante que calcula "hoy" en la zona horaria de la organización.
- [x] 3.3 `lib/orders/overdue.test.ts`: vencido en `waiting` sin alerta; vencido en `in_progress` con alerta; vencido en `final` y en `cancelled` sin alerta; sin `due_date` sin alerta; renombrar el estado no cambia el resultado (se compara por `kind`).
- [x] 3.4 `lib/orders/queue.ts` (D4): `queuePositions(orders)` derivando 1, 2, 3… del orden `queued_at asc` con `code asc` de desempate, y `midpoint(before, after)` con la señal de renormalización cuando la distancia baja de 2 µs.
- [x] 3.5 `lib/orders/queue.test.ts`: tres pedidos numerados por llegada y no por fecha comprometida; adelantar el tercero renumera a 1, 2, 3 sin huecos; retrasar el primero al final; el punto medio cae entre las vecinas; distancia insuficiente pide renormalizar.
- [x] 3.6 `lib/orders/schema.ts`: esquemas Zod de las Server Actions (identificadores, destino de estado, reordenamiento).

## 4. Servicios

- [x] 4.1 `services/orders/order-service.ts`: `list()` con filtros de línea, estado, texto y `includeArchived` (excluyendo lo archivado por defecto), `getById()` con sus líneas y su total desde `order_totals`, `moveToStatus()`, `setQueuedAt()`, `archive()` y `unarchive()`. Toda consulta filtra `organization_id` explícitamente (convención nº 2).
- [x] 4.2 `services/orders/order-item-service.ts`: `listByOrder()` con el ítem y la variante resueltos para mostrar.
- [x] 4.3 `services/orders/order-service.test.ts`: el listado excluye lo archivado salvo que se pida; el total se lee de `order_totals` y no de las columnas de `orders`; los filtros se traducen a la consulta esperada.

## 5. Server Actions

- [x] 5.1 `actions/orders.ts` · `moveOrderToStatus`: valida con Zod, exige sesión, y **verifica en el servidor que el estado destino pertenece al juego resuelto de la línea del pedido** (D6) antes de escribir; devuelve mensaje comprensible si no.
- [x] 5.2 `actions/orders.ts` · `reorderQueue`: calcula el punto medio con `lib/orders/queue.ts`, renormaliza y reintenta una vez si la distancia es insuficiente, y persiste `queued_at`.
- [x] 5.3 `actions/orders.ts` · `archiveOrder` y `unarchiveOrder`: piden la operación y traducen el `insufficient_privilege` de la base a "Solo la persona dueña puede archivar o desarchivar" — sin comprobar el rol en TypeScript (D7).
- [x] 5.4 Revalidar `/orders` y `/orders/[id]` tras cada acción.

## 6. Tablero V3

- [x] 6.1 `app/(app)/orders/page.tsx`: página delgada que resuelve la línea activa, obtiene el juego de estados con `StatusService.resolve(org, línea, 'order')` y delega en la pantalla.
- [x] 6.2 `features/orders/orders-screen.tsx`: contenedor con conmutador tablero/lista/calendario que conserva los filtros al cambiar de vista.
- [x] 6.3 `features/orders/board-view.tsx` y `board-column.tsx`: columnas construidas **solo** desde el juego resuelto, en su orden declarado, sin ninguna lista de estados escrita en el código.
- [x] 6.4 Aplicar D1: con la línea «Todas» activa, el tablero muestra el aviso para elegir línea con las líneas vigentes a mano; lista y calendario siguen mostrando todas las líneas.
- [x] 6.5 `features/orders/order-card.tsx`: número, cliente, resumen, fecha comprometida, modo de entrega distinguible entre recojo y delivery, color de línea, alerta de retraso y posición en cola; tolera la ausencia de fecha y de modo de entrega; al activarse abre el detalle.
- [x] 6.6 `features/orders/board-store.ts` (D6): store de Zustand con los movimientos en vuelo, aplicación inmediata y reversión con mensaje al fallar.
- [x] 6.7 Arrastre entre columnas con `@dnd-kit` —ya instalado—, disparando `moveOrderToStatus`.
- [x] 6.8 Posición visible en las columnas con `is_queue = true`, derivada con `queuePositions()`; las demás columnas no la muestran. Reordenar dentro de la cola dispara `reorderQueue`.
- [x] 6.9 `features/orders/list-view.tsx` y `calendar-view.tsx`: la lista y el calendario por fecha comprometida, con los pedidos sin fecha agrupados aparte.
- [x] 6.10 `features/orders/order-filters.tsx` con el filtro "Ver archivados", que por defecto oculta lo archivado en las tres vistas y al activarse lo muestra distinguido.

## 7. Detalle V4

- [x] 7.1 `app/(app)/orders/[id]/page.tsx`: página delgada que carga el pedido, sus líneas y su total.
- [x] 7.2 `features/orders/order-detail.tsx`: número, cliente enlazado a su ficha, línea, canal, modo de entrega, líneas con cantidad y precio unitario, total derivado, fechas y notas.
- [x] 7.3 Imágenes de referencia leídas de `attachments` con `entity_type = 'order'` vía `AttachmentService` (D7), solo lectura — la subida es de KAM-08.
- [x] 7.4 Bloque de historial leído de `activity_log` para ese pedido, en orden cronológico.
- [x] 7.5 Cambio de estado desde el detalle, reutilizando `moveOrderToStatus`.

## 8. Pruebas de interfaz y de extremo a extremo

- [x] 8.1 `features/orders/order-card.test.tsx`: la tarjeta con `delivery` se distingue de la de `pickup`; sin fecha ni modo de entrega se rinde sin error; la alerta aparece según el `kind`.
- [x] 8.2 `features/orders/orders-screen.test.tsx` *(y no `board-view.test.tsx`: el aviso de D1 vive en la pantalla, y rendirla ejercita el tablero igual — misma cobertura)*: seis columnas para el juego de Sublimación y tres para el de Alfarería sin rastro de las otras; la línea sin juego propio muestra el de la organización; renombrar un estado cambia el rótulo de la columna; con «Todas» activa aparece el aviso de D1; la posición solo se muestra en la columna de cola.
- [x] 8.3 `features/orders/board-store.test.ts`: la tarjeta se mueve antes de la respuesta del servidor; el error devuelve la tarjeta a su columna original y muestra el mensaje.
- [x] 8.4 `tests/e2e/order-flow.spec.ts`: recorrer un pedido por todos los estados de su línea arrastrándolo, comprobando que el historial registra cada cambio.
- [x] 8.5 `tests/e2e/order-board.spec.ts`: las tres posiciones de la cola por orden de llegada; reordenar y comprobar que la renumeración persiste tras recargar; alternar a lista y calendario conservando el filtro; "Ver archivados".

## 9. Cierre

- [x] 9.1 Corregir en `proposal.md` las dos notas obsoletas del apartado *Impact*: KAM-06 ya está fusionada y `@dnd-kit` ya estaba instalado (no hay dependencia nueva).
- [x] 9.2 Ejecutar la secuencia completa: `lint → typecheck → test:unit → test:integration → build → test:e2e`.
