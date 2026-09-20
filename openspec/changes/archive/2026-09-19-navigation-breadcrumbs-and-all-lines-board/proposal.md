## Why

Moverse entre las pantallas de alta, edición y detalle no siempre lleva a donde la persona espera: al crear un pedido se aterriza en su detalle en lugar de volver al tablero donde se estaba trabajando; al editar, si el envío tarda más que el plazo corto de la cola, el formulario se queda abierto en vez de mostrar el pedido actualizado; y cada pantalla de detalle resuelve el «volver» a su manera (una flecha en la descripción, un botón «Volver», o nada). Además, con «Todas» activa en el selector de línea el tablero de pedidos no muestra ningún pedido —pide elegir una línea—, justo cuando la persona quiere ver todo lo que tiene en curso.

## What Changes

- **Crear un pedido vuelve a la lista.** «Guardar» en `/orders/new` lleva a `/orders` (la vista que se estaba usando) con una confirmación del número guardado, en lugar de al detalle del pedido. «Guardar y crear otro» y el comportamiento sin conexión no cambian. **BREAKING** (de comportamiento): reemplaza el escenario vigente «Guardar lleva al detalle».
- **Editar un pedido lleva al detalle.** «Guardar» en `/orders/[id]/edit` lleva a `/orders/[id]` cuando hay conexión: el formulario espera a que el envío se confirme (mostrando «Guardando…») en lugar de rendirse al plazo corto de la cola, que hoy lo deja en el formulario con el aviso «pendiente de sincronizar». Sin conexión, o si la red no responde ni con la espera larga, se mantiene el aviso actual.
- **Migas de pan en toda pantalla de alta, edición y detalle.** Un encabezado común (en `MainContainer`) muestra la ruta de vuelta: `Lista › Elemento` en detalle, `Lista › Nuevo …` en alta y `Lista › Elemento › Editar` en edición, con cada tramo anterior enlazado. Reemplaza los enlaces ad hoc actuales («← Pedidos», «← Egresos», «← Catálogo», botón «Volver» del panel de plataforma). Alcance: pedidos (nuevo, detalle, edición), tareas (nueva, detalle), egresos (nueva compra, nuevo gasto, detalle), catálogo (detalle de ítem) y panel de plataforma (detalle de organización y de usuario).
- **Tablero de pedidos con «Todas».** Con «Todas» activa, el tablero deja de pedir una línea y muestra los pedidos de todas las líneas en **columnas comunes por tipo de estado** (`initial`, `in_progress`, `waiting`, `final`, `cancelled`), cada tarjeta con el color y el nombre de su estado real. Arrastrar a una columna mueve el pedido al primer estado de ese tipo en el juego de **su** línea; si su línea no tiene ningún estado de ese tipo, el destino no se ofrece. En este modo no se reordena la cola. Con una línea concreta el tablero sigue igual.
- **Fuera de alcance:** cambios de esquema, servicios de datos o reglas del servidor; cambiar a dónde llevan los formularios de tareas y egresos (ya vuelven a su lista); migas de pan en pantallas de lista, ajustes, reportes o perfil; renombrar o reordenar tipos de estado; reordenar colas desde el tablero con «Todas».

## Capabilities

### New Capabilities

- `navigation-breadcrumbs`: migas de pan en las pantallas de alta, edición y detalle — qué tramos muestra cada tipo de pantalla, a dónde enlaza cada uno y cómo se comporta en móvil.

### Modified Capabilities

- `orders`: «Guardar y Guardar y crear otro» se reemplaza por «Guardar vuelve a la lista y Guardar y crear otro sigue en el formulario» (Guardar al crear vuelve a la lista); cambian «Confirmación antes de descartar» (la salida tras guardar ya no es necesariamente al detalle), «Edición de pedido» (guardar lleva al detalle, incluso si la cola tarda) y se agrega «Tablero con todas las líneas agrupado por tipo de estado».

## Impact

- **UI**: `components/layout/main-container.tsx` (nueva prop de migas); nuevo `components/ui/breadcrumb.tsx` (shadcn); `features/orders/order-form.tsx`, `features/orders/order-detail.tsx`, `features/orders/orders-screen.tsx`, `features/orders/board-view.tsx`; `features/tasks/task-form.tsx`, `features/tasks/detail/task-detail.tsx`; `features/expenses/{purchase-form,cost-form,expense-detail}.tsx`; `features/catalog/item-detail.tsx`; `app/(platform)/admin/{organizations,users}/[id]/page.tsx`; `app/(app)/orders/[id]/edit/page.tsx` (estado archivado).
- **Páginas**: `app/(app)/orders/page.tsx` resuelve, con «Todas», el juego de estados de cada línea activa para que el tablero sepa a qué estado corresponde cada tipo.
- **Lógica pura**: nueva función en `lib/orders/` que, dado el juego de una línea y un tipo, devuelve el estado destino (o ninguno).
- **Acciones**: sin cambios; `moveOrderToStatus` sigue validando que el destino pertenezca al juego de la línea del pedido.
- **Pruebas**: unitarias de migas, del formulario (destinos tras guardar) y del tablero agrupado; e2e `order-board` (el escenario «el tablero necesita una línea» se reemplaza), `order-entry` y `order-edit` (destino tras guardar).
