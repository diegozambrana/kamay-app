## Context

Ver `proposal.md` (Why). Estado actual relevante:

- `features/orders/order-form.tsx` usa un solo destino tras «Guardar»: `router.push('/orders/${id}')` para alta y edición. La escritura pasa por la cola (`lib/offline/capture.ts`), que espera el vaciado solo `FLUSH_DEADLINE_MS = 2 500 ms`; si vence, devuelve `queued` y el formulario se queda abierto con «pendiente de sincronizar» **aunque haya red**. Eso es lo que hace que la edición «no vaya al detalle» cuando el envío tarda.
- `MainContainer` (`components/layout/main-container.tsx`) es el encabezado común (título, descripción, acción). Cada pantalla de detalle improvisa su vuelta en `description` (flecha + «Pedidos», «Egresos», «Catálogo») o en `action` (botón «Volver» del panel de plataforma). No existe `components/ui/breadcrumb.tsx`.
- `app/(app)/orders/page.tsx` con «Todas» pasa `statuses = []` y `orders-screen.tsx` rinde `PickALine` en lugar de `BoardView`. Lista y calendario ya usan `allStatuses` y muestran todas las líneas.
- `KanbanBoard` (`components/board/kanban-board.tsx`) es un cascarón genérico: columnas, `onMove(itemId, columnId)`, `onReorder` opcional y menú «Mover a…» que ofrece todas las columnas a toda tarjeta.
- `moveOrderToStatus` ya rechaza un estado fuera del juego de la línea del pedido: la regla de servidor no cambia.

## Goals / Non-Goals

**Goals:**
- Un solo componente de migas, declarado por las pantallas vía `MainContainer`, sin lógica de rutas centralizada.
- Destinos tras guardar decididos por el modo del formulario, sin tocar la cola sin conexión.
- Tablero «Todas» construido sobre el mismo `KanbanBoard`, sin duplicarlo.

**Non-Goals:**
- Un registro global de rutas → migas (no se infieren del pathname).
- Interceptar la navegación del menú lateral con cambios sin guardar (sigue fuera, como hoy en `DiscardGuard`).
- Conservar la vista de origen en secciones distintas de pedidos.

## Decisions

### D1 · Migas como prop de `MainContainer`, sobre `breadcrumb` de shadcn

Se instala `breadcrumb` con el CLI de shadcn (`components/ui/breadcrumb.tsx`) y `MainContainer` gana `breadcrumbs?: { label: string; href?: string }[]`. Se rinden encima del `<h1>`; el último tramo es `BreadcrumbPage` (`aria-current="page"`), los anteriores `BreadcrumbLink asChild` con `next/link`. La lista va en una sola línea con `min-w-0`; el último tramo lleva `truncate` y los enlaces `min-h-11` (44 px) con padding vertical para el área táctil.

Cada pantalla declara su propia ruta porque es quien conoce el nombre del elemento (título de tarea, nombre de ítem, `#code`). *Alternativa descartada:* derivarlas del pathname en el layout — obligaría al layout a cargar el nombre de cada entidad y duplicaría consultas.

Los `loading.tsx` de rutas de detalle/edición pasan solo el tramo padre (`Pedidos`) para que el encabezado no salte al llegar los datos. `expense-detail` en variante `panel` no rinde `MainContainer` y por tanto no tiene migas.

### D2 · Vista de origen de pedidos por parámetro `from`

La pantalla de pedidos añade `?from=<query actual codificada>` a los enlaces que salen hacia alta y detalle (`order-card`, `list-view`, calendario, «Nuevo pedido», «Crear pedido»). Detalle y edición lo propagan entre sí (enlace «Editar», miga «Pedido #N»). Una función pura `ordersListHref(from)` en `lib/orders/` parsea `from` como `URLSearchParams`, conserva solo las llaves conocidas (`view`, `q`, `archived`, `closed`) y devuelve `/orders?…` o `/orders`. Así un origen ajeno se ignora por construcción: nunca se usa como URL, solo como consulta filtrada.

*Alternativas descartadas:* `sessionStorage` con la última URL de la lista (no se rinde en el servidor, la miga cambiaría tras hidratar y un enlace directo podría heredar filtros viejos de la pestaña); `router.back()` (no sirve para una miga de dos niveles ni tras recargar).

### D3 · Destino tras guardar según el modo

- **Alta** con resultado `sent` y sin fallos de imágenes: `router.push(ordersListHref(from) + '&created=<code>')`. `OrdersScreen` lee `created`, muestra un aviso «Pedido #N guardado» descartable y lo quita de la dirección con `router.replace` (para que recargar no lo repita). «Guardar y crear otro» y la rama `queued` no cambian.
- **Edición** con red: se llama a `capture` con un plazo largo propio (`EDIT_FLUSH_DEADLINE_MS`, ~15 s) en lugar del corto, y el botón muestra «Guardando…» con `Spinner` mientras tanto. `sent` → `router.push('/orders/${id}?from=…')` + `router.refresh()` implícito por la navegación dinámica. `failed` → error en el formulario (como hoy). Si aun así vuelve `queued` (fallo transitorio o plazo largo vencido) se conserva el aviso actual de pendiente: es el caso en que la red realmente no está respondiendo.

*Por qué no navegar al detalle con `queued`:* el detalle se sirve desde el servidor y mostraría los datos anteriores a la edición, que es peor que el aviso de pendiente. *Por qué no subir el plazo también al alta:* el alta ya no navega a una pantalla que dependa de ese pedido concreto, y el plazo corto es lo que mantiene la captura rápida en la feria.

### D4 · Guardia de descarte en las migas

Las migas de los formularios de pedido deben preguntar antes de salir con cambios. `DiscardGuard` hoy solo cubre «Cancelar» y usa `router.back()`. Se extrae de él un hook `useDiscardConfirm(dirty)` que devuelve `confirmThen(href)` y el diálogo; el formulario pasa a `MainContainer` migas cuyos enlaces, con `dirty`, hacen `preventDefault` y llaman a `confirmThen`. Para ello el tramo admite `onClick` además de `href`. El botón «Cancelar» sigue usando `router.back()`.

### D5 · Tablero «Todas» por tipo de estado

- **Datos**: con «Todas», `orders/page.tsx` resuelve el juego de cada línea activa (`Promise.all` sobre `StatusService.resolve`; son pocas líneas) y pasa `statusesByLine: Record<lineId, Status[]>` a la pantalla. El `statusKind` de cada pedido ya viene de `allStatuses`.
- **Lógica pura** en `lib/orders/kind-board.ts`: `KIND_COLUMNS` (orden y títulos fijos por `kind`, convención nº 5: se compara por `kind`, nunca por nombre) y `targetStatusFor(lineStatuses, kind)` → primer estado de ese `kind` por `position`, o `null`.
- **Vista**: `BoardView` gana un modo `groupBy: "status" | "kind"`. En `kind`, las columnas son los cinco tipos, sin `sortable` (no hay cola) y sin posición de cola en la tarjeta; `moveCard(orderId, kind)` traduce a `statusId` con `targetStatusFor` y reutiliza el mismo movimiento optimista y `moveOrderToStatus`. Mismo tipo → no hace nada. La tarjeta muestra el nombre del estado real (hoy no hace falta porque la columna lo dice).
- **Cascarón**: `KanbanBoard` gana `canMoveTo?: (item, columnId) => boolean`. Filtra los destinos del menú «Mover a…» y, al soltar, un destino no permitido se trata como soltar fuera (la tarjeta vuelve). Por omisión todo se permite, así que el tablero de tareas no cambia.
- `PickALine` se elimina.

*Alternativas descartadas* (consultadas con el usuario): carriles por línea con sus propias columnas; cambiar automáticamente a lista.

## Risks / Trade-offs

- [Esperar hasta ~15 s al editar con una red mala se siente lento] → el botón muestra «Guardando…» y no se bloquea el resto de la app; vencido el plazo cae al aviso de pendiente actual, sin perder nada.
- [El `from` alarga las URL de detalle y aparece en enlaces compartidos] → solo lleva llaves de filtro, sin datos personales; quien abre un enlace compartido con `from` ve la miga apuntando a esos filtros, lo que es inocuo.
- [Una línea sin estado de cierto tipo deja tarjetas que no se pueden mover a esa columna] → el menú «Mover a…» simplemente no la ofrece; el cambio de estado desde el detalle sigue disponible.
- [Dos estados del mismo tipo en una línea: la columna solo lleva al primero] → es la regla especificada; para elegir otro se usa el tablero de la línea o el detalle. Mover dentro del mismo tipo no hace nada, así que no se pierde el estado fino.
- [Pruebas e2e que esperan el detalle tras crear (`order-entry`, `task-from-order` y otras que encadenan alta → detalle)] → se revisan todas las que pasan por «Guardar» en `/orders/new` y se ajustan al nuevo destino.
