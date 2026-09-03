# KAM-08 · Alta y edición de pedidos

## Why

KAM-07 dejó a Kamay mirando pedidos que solo entran por semilla: el tablero (V3) y el detalle (V4) funcionan, pero nadie puede registrar un encargo real. Este cambio cierra ese hueco con **V5 · Nuevo pedido**: registrar un pedido completo en menos de un minuto, en el celular o en el escritorio, y poder guardarlo incompleto —sin fecha, sin canal, sin modo de entrega— sin fricción. También trae la edición y la cancelación de pedidos existentes, porque un encargo cambia entre que se anota y que se entrega. Es la primera captura de datos de negocio del producto y la que fija el patrón para compras (KAM-09) y gastos.

## What Changes

- **V5 · Nuevo pedido** en móvil y escritorio, como página (`/orders/new`), con la línea de negocio preseleccionada desde el selector global (y elección explícita cuando la activa es «Todas»).
- **Buscador de cliente con creación al vuelo**: reutiliza el buscador de contactos de KAM-06; cuando el nombre no existe, lo crea con **nombre y teléfono** sin abandonar el formulario, marcado como cliente, y lo deja seleccionado.
- **Líneas de pedido desde el catálogo**: buscador de productos de la línea (o compartidos), con variante si el ítem las tiene; cantidad y precio editables, precio prellenado desde el catálogo pero **guardado en la línea** (el catálogo puede cambiar después sin tocar el pedido). Línea libre solo con descripción para lo que no está en el catálogo. Total calculado en pantalla desde las líneas, nunca almacenado.
- **Fecha comprometida con atajos** (Hoy, Mañana, En 3 días, En una semana) más selector de fecha; «hoy» en la zona horaria de la organización. **Canal**, **modo de entrega** (recojo / delivery), **nota** y **adjuntos** (imágenes de referencia, mismo mecanismo que las fotos de ítem, en el bucket `attachments`).
- **Mínimos obligatorios**: cliente y al menos una línea. Todo lo demás puede quedar vacío. Sin cliente o sin líneas, el guardado se impide con un mensaje que señala el campo.
- **Guardar** lleva al detalle del pedido creado; **Guardar y crear otro** deja el formulario en blanco conservando línea de negocio y canal.
- **Confirmación antes de descartar** cuando hay datos escritos y se sale sin guardar.
- **El estado inicial lo decide la base**: el pedido nace en el estado de tipo `initial` del juego resuelto de su línea; el formulario no envía estado.
- **Alta atómica**: pedido y líneas se guardan en una sola transacción mediante una función de base (`create_order`). No puede quedar un pedido sin líneas por un fallo a medias.
- **Edición de pedidos** (`/orders/[id]/edit`): cliente, líneas (agregar, modificar, quitar), fecha, canal, modo de entrega, nota y adjuntos. La línea de negocio no se cambia una vez creado el pedido (cambiarla cambiaría su flujo de estados). Un pedido archivado no se edita.
- **Las líneas de pedido se archivan, nunca se borran**: nueva columna `order_items.archived_at`; quitar una línea al editar la archiva. `order_totals`, el detalle y los resúmenes del tablero excluyen las líneas archivadas.
- **Cancelación de pedidos** desde el detalle: mueve el pedido al estado de tipo `cancelled` del juego de su línea, con confirmación. Compara por `kind`, no por nombre. Si el juego no tiene un estado de ese tipo, la acción no se ofrece.
- **Entradas**: botón «Nuevo pedido» en V3; acciones «Editar» y «Cancelar pedido» en V4. En móvil, el formulario es pantalla completa: la barra inferior se oculta y las acciones quedan fijas al pie.

**Fuera de alcance** (copiado del backlog):
- Descuentos, impuestos, condiciones de pago, cotizaciones formales.
- Campos estructurados de personalización (sigue pendiente de decisión: por ahora, nota y foto).

Derivado de lo anterior, tampoco entran: cobros al registrar (KAM-10), venta directa y modo feria (V6, KAM-12), el registro rápido móvil (V16, KAM-13) y el menú «+ Registrar» con las seis acciones (KAM-13). Tampoco el modo sin conexión (KAM-11), aunque el alta genera los UUID en el cliente para no estorbarlo.

## Capabilities

### New Capabilities

_(ninguna — el alta y la edición son requisitos nuevos de la capacidad `orders` que KAM-07 creó, no una capacidad aparte)_

### Modified Capabilities

- `orders`: se añaden los requisitos del alta (V5) con sus mínimos obligatorios, la asignación del estado inicial por la base, la transacción única de pedido y líneas, «Guardar» y «Guardar y crear otro», la confirmación antes de descartar, la edición y la cancelación de pedidos, el archivado de líneas, los adjuntos subidos desde el formulario y la fecha comprometida con atajos. Se modifican dos requisitos existentes: el total derivado pasa a excluir las líneas archivadas, y el detalle (V4) ofrece además editar y cancelar.
- `catalog-directory`: el requisito «Creación de contactos al vuelo» pasa a admitir el **teléfono** como dato opcional en el momento de crear, porque el criterio 3 del backlog exige nombre y teléfono sin abandonar el formulario de pedido.

## Impact

- **Base de datos:** una migración nueva `YYYYMMDDHHMMSS_order_entry.sql` con: `order_items.archived_at` e índice; `create or replace view order_totals` excluyendo líneas archivadas (misma técnica que KAM-07 D3 previó para `paid`); funciones `create_order(jsonb, jsonb)` y `update_order(jsonb, jsonb)` con `security invoker` (RLS sigue mandando), que asignan el estado inicial, exigen al menos una línea y archivan las líneas que la edición quita. Ninguna migración existente se toca. `supabase/seed.sql` no cambia: los pedidos siguen entrando por semilla para las pruebas de KAM-07, y las de este cambio crean los suyos.
- **Almacenamiento:** ninguno nuevo. Las imágenes van al bucket `attachments` con `entity_type = 'order'`, políticas ya creadas en KAM-06.
- **Código de aplicación:** `lib/orders/schema.ts` (esquemas Zod del alta y la edición), `lib/orders/due-date.ts` (atajos de fecha), `lib/orders/lines.ts` (total en pantalla); `services/orders/order-service.ts` (`create`, `update` vía RPC) y `order-item-service.ts` (excluir archivadas); `actions/orders.ts` (`createOrder`, `updateOrder`, `uploadOrderAttachment`, `setOrderAttachmentArchived`); `actions/contacts.ts` (`createContactInline` con teléfono) y `features/contacts/contact-combobox.tsx`; `features/orders/order-form.tsx`, `order-lines-editor.tsx`, `catalog-picker.tsx`, `due-date-field.tsx`, `discard-guard.tsx`; rutas delgadas `app/(app)/orders/new/page.tsx` y `app/(app)/orders/[id]/edit/page.tsx`; botones en `orders-screen.tsx` y `order-detail.tsx`; `components/layout/mobile-nav.tsx` (ocultarse en formularios de captura).
- **Dependencias:** ninguna nueva. `react-hook-form`, `@hookform/resolvers` y `zod` ya están en `package.json`; `FileDropzone` y `ContactCombobox` ya existen.
- **Pruebas:** unitarias (esquema Zod y mínimos obligatorios, atajos de fecha, total de líneas, formulario: reinicio que conserva línea y canal, guardia de descarte), pgTAP (atomicidad de `create_order`, estado inicial por `kind`, rechazo sin líneas, `update_order` archiva líneas quitadas, `order_totals` excluye archivadas, el ayudante crea y edita, el archivado no se edita), e2e (alta completa con medición de interacciones < 15, alta mínima, creación de cliente al vuelo, edición, cancelación, descarte con confirmación).
- **Grafo:** regenerar `graphify .` tras la migración (convención nº 6).
- **Dependencias de tareas:** KAM-06 (contactos, catálogo, adjuntos) y KAM-07 (pedidos) están fusionadas. Nada bloquea.
