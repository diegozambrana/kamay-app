## 1. Componente de migas

- [x] 1.1 Instalar `breadcrumb` con el CLI de shadcn (sin `--overwrite`). Rechazar cualquier sobrescritura de componentes existentes; si el CLI importa `cn` de un paquete npm, cambiarlo a `@/lib/utils` (como en `order-form-picker-dialogs`).
- [x] 1.2 `components/layout/main-container.tsx` (design D1): prop `breadcrumbs?: { label: string; href?: string; onClick?: (e) => void }[]`, rendida encima del `<h1>`; último tramo `BreadcrumbPage`, anteriores `BreadcrumbLink asChild` + `next/link`; una línea, último tramo `truncate`, enlaces con área táctil ≥ 44 px.
- [x] 1.3 `components/layout/main-container.test.tsx`: sin `breadcrumbs` no se rinde `nav`; con tres tramos los dos primeros son enlaces a su `href` y el último tiene `aria-current="page"` y no es enlace («El último tramo no es un enlace»); `onClick` se invoca al pulsar un tramo.

## 2. Vista de origen de pedidos

- [x] 2.1 `lib/orders/list-href.ts` · `ordersListHref(from?: string | null)` (design D2): conserva solo `view`, `q`, `archived`, `closed`; devuelve `/orders` o `/orders?…`. Y `withFrom(href, from)` para propagar el parámetro.
- [x] 2.2 `lib/orders/list-href.test.ts`: filtros conocidos se conservan («Volver al calendario filtrado»); sin `from` → `/orders` («Enlace directo»); `from` con URL absoluta, `//host`, rutas u otras llaves → se descartan («Origen ajeno ignorado»).
- [x] 2.3 `features/orders/orders-screen.tsx`, `order-card.tsx`, `list-view.tsx`, `calendar-view.tsx`: los enlaces a `/orders/new` y `/orders/[id]` llevan `from` con la consulta actual.
- [x] 2.4 `app/(app)/orders/[id]/page.tsx`, `[id]/edit/page.tsx`, `new/page.tsx`: leer `searchParams.from` y pasarlo a la pantalla; `order-detail.tsx` lo propaga al enlace «Editar».

## 3. Migas en pedidos

- [x] 3.1 `features/orders/order-detail.tsx`: `Pedidos › Pedido #N` con `ordersListHref(from)`; quitar el enlace «← Pedidos» de `description`.
- [x] 3.2 `features/orders/order-form.tsx`: `Pedidos › Nuevo pedido` (alta) y `Pedidos › Pedido #N › Editar` (edición, «Pedido #N» → `/orders/[id]?from=…`).
- [x] 3.3 `app/(app)/orders/[id]/edit/page.tsx`: las mismas migas en el estado «pedido archivado».
- [x] 3.4 `loading.tsx` de `orders/new`, `orders/[id]` y `orders/[id]/edit`: pasar el tramo padre «Pedidos» (design D1) si `RouteLoading` lo admite; si no, extender `RouteLoading` con `breadcrumbs`.
- [x] 3.5 Pruebas: `order-detail.test.tsx` («Detalle vuelve a la lista», «Un solo camino de vuelta» — no hay «← Pedidos»); `order-form.test.tsx` («Edición vuelve al detalle o a la lista», migas del alta).

## 4. Guardia de descarte en migas

- [x] 4.1 `features/orders/discard-guard.tsx` (design D4): extraer `useDiscardConfirm(dirty)` → `{ confirmThen(href), dialog }`; `DiscardGuard` lo usa sin cambiar su comportamiento.
- [x] 4.2 `order-form.tsx`: con `isDirty`, los tramos de las migas hacen `preventDefault` y llaman `confirmThen(href)`; tras guardar (`reset`) navegan sin preguntar.
- [x] 4.3 `discard-guard.test.tsx` / `order-form.test.tsx`: «Seguir una miga de pan con datos escritos» (pregunta; aceptar navega a la lista), «Salir sin cambios» por la miga (no pregunta); las pruebas existentes de «Cancelar» siguen en verde.

## 5. Destinos tras guardar

- [x] 5.1 `order-form.tsx` alta (design D3): con `sent` y sin fallos de imágenes, `router.push` a `ordersListHref(from)` con `created=<code>`. «Guardar y crear otro», `queued` y fallo de imágenes sin cambios.
- [x] 5.2 `orders-screen.tsx`: leer `created`, mostrar «Pedido #N guardado» descartable y quitar el parámetro con `router.replace` conservando el resto de la consulta.
- [x] 5.3 `order-form.tsx` edición: `capture` con `deadlineMs: EDIT_FLUSH_DEADLINE_MS` (~15 s, constante exportada) cuando hay red; botón «Guardando…» con `Spinner` y deshabilitado mientras espera; `sent` → `/orders/[id]?from=…`; `failed` → error; `queued` → aviso de pendiente actual.
- [x] 5.4 `order-form.test.tsx`: «Guardar vuelve a la lista» (push a `/orders?…&created=`), «Guardar conserva la vista de origen», «Guardar sin vista de origen»; edición «Guardar con un envío lento lleva igual al detalle» (drain que resuelve después de 2,5 s y antes del plazo largo → push al detalle, sin aviso de pendiente), «Editar sin conexión» (no navega, aviso), «Un fallo deja el pedido como estaba» (error, sin navegación). Actualizar la prueba que hoy espera el detalle tras crear.
- [x] 5.5 `orders-screen.test.tsx`: con `created` se muestra el aviso con el número y se limpia de la dirección.

## 6. Tablero «Todas» por tipo de estado

- [x] 6.1 `lib/orders/kind-board.ts` (design D5): `KIND_COLUMNS` (orden `initial, in_progress, waiting, final, cancelled`; títulos Por empezar, En curso, En espera, Terminados, Cancelados) y `targetStatusFor(lineStatuses, kind)` → primer estado de ese `kind` por `position`, o `null`.
- [x] 6.2 `lib/orders/kind-board.test.ts`: dos estados `in_progress` → el de menor `position` («Mover al primer estado de ese tipo en la línea del pedido»); sin estado de ese tipo → `null` («La línea del pedido no tiene ese tipo»); ignora estados archivados si el juego los trae.
- [x] 6.3 `components/board/kanban-board.tsx`: prop opcional `canMoveTo(item, columnId)`; filtra el menú «Mover a…» y trata un soltar no permitido como soltar fuera. Prueba en `kanban-board.test.tsx`; el tablero de tareas no pasa la prop y sus pruebas siguen en verde.
- [x] 6.4 `app/(app)/orders/page.tsx`: con «Todas», resolver el juego de cada línea activa en paralelo y pasar `statusesByLine`.
- [x] 6.5 `features/orders/board-view.tsx`: modo `groupBy: "kind"` — columnas de `KIND_COLUMNS`, sin `sortable` ni posición de cola; `moveCard` traduce `kind → statusId` con `targetStatusFor` (mismo tipo → nada) y reutiliza el movimiento optimista y `moveOrderToStatus`; `canMoveTo` según `targetStatusFor`.
- [x] 6.6 `features/orders/order-card.tsx`: en modo por tipo, mostrar el nombre del estado real.
- [x] 6.7 `features/orders/orders-screen.tsx`: con «Todas» y vista tablero rendir `BoardView` en modo `kind`; eliminar `PickALine`.
- [x] 6.8 `board-view.test.tsx` (o `orders-screen.test.tsx`): «“Todas” muestra los pedidos de todas las líneas», «Las columnas son los tipos, no los estados» (cinco columnas en orden), «Soltar en la misma columna no cambia nada» (no llama la acción), «Sin reordenamiento de cola con “Todas”», «La línea del pedido no tiene ese tipo» (el menú no ofrece la columna); reemplazar la prueba de `board-needs-line`.

## 7. Migas en el resto de la app

- [x] 7.1 Tareas: `app/(app)/tasks/new/page.tsx` → `Tareas › Nueva tarea`; `features/tasks/detail/task-detail.tsx` → `Tareas › <título>`.
- [x] 7.2 Egresos: `features/expenses/purchase-form.tsx` → `Egresos › Nueva compra`; `cost-form.tsx` → `Egresos › Nuevo gasto`; `expense-detail.tsx` (solo variante página) → `Egresos › Compra|Gasto`, quitando «← Egresos».
- [x] 7.3 Catálogo: `features/catalog/item-detail.tsx` → `Catálogo › <nombre>`, quitando «← Catálogo».
- [x] 7.4 Plataforma: `app/(platform)/admin/organizations/[id]/page.tsx` → `Organizaciones › <nombre>`; `admin/users/[id]/page.tsx` → `Usuarios › <nombre o correo>`, quitando el botón «Volver».
- [x] 7.5 Pruebas unitarias donde ya hay archivo de prueba de la pantalla (p. ej. `task-detail`, `expense-detail`, `item-detail`): la miga de la lista enlaza a su lista («Alta vuelve a la lista», «Panel de plataforma» en la pantalla de admin si tiene prueba) y no queda el enlace de vuelta anterior; la variante `panel` de `expense-detail` no rinde migas.

## 8. e2e y verificación

- [x] 8.1 `tests/e2e/order-entry.spec.ts`: «Guardar vuelve a la lista» y «Guardar conserva la vista de origen» (lista + búsqueda → guardar → misma lista con el aviso).
- [x] 8.2 `tests/e2e/order-edit.spec.ts`: guardar lleva al detalle con los cambios; «Edición vuelve al detalle o a la lista» por las migas.
- [x] 8.3 `tests/e2e/order-board.spec.ts`: reemplazar el caso `board-needs-line` por «“Todas” muestra los pedidos de todas las líneas» y un movimiento por tipo que queda en el primer estado de ese tipo.
- [x] 8.4 Revisar las e2e que crean pedidos y esperan el detalle (`task-from-order`, `orders-tasks-independence`, `mobile-capture`, `offline-capture`, `accessibility`, `account`) y ajustarlas al nuevo destino (abrir el pedido desde la lista o por su URL).
- [x] 8.5 `tests/e2e/accessibility.spec.ts` (o nuevo caso): «Título largo en un teléfono» — 390 px, detalle de tarea con título largo, sin desplazamiento horizontal y la miga visible.
- [x] 8.6 `npm run lint`, `npm run typecheck`, `npm run test:unit`, e2e afectadas; verificación visual en el navegador (migas en escritorio y móvil, tablero «Todas»). `graphify update .` al terminar.
