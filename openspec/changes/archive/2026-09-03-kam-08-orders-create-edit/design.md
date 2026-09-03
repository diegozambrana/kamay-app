# Diseño · KAM-08 · Alta y edición de pedidos

## Context

Motivación en `proposal.md` — *Why*. Requisitos en `specs/orders/spec.md` y `specs/catalog-directory/spec.md`. Este documento resuelve las decisiones técnicas que esos dejan abiertas.

Lo que ya está construido y este cambio consume tal cual:

- `orders`, `order_items`, `order_totals`, el trigger de numeración `assign_order_code()`, los triggers de `queued_at` y `enforce_archive_rules()` sobre `orders` (KAM-07). El trigger de numeración respeta un `code` dado, y los de cola actúan al insertar según el `is_queue` del estado inicial: nada de eso se toca.
- `resolve_statuses(org, line, 'order')` (KAM-05): la única vía de lectura del juego vigente, también dentro de la base.
- `ContactCombobox` con `createContactInline` y `quickContactSchema` (KAM-06): el buscador nació "para los formularios de pedido"; aquí se estrena en su destino.
- `FileDropzone`, `AttachmentService`, el bucket `attachments` con sus políticas y el patrón `uploadItemPhoto(FormData)` (KAM-06): el adjunto viaja como `FormData` en una acción aparte del alta.
- `ItemService.list` / `ItemVariantService.listForItem` con `search_name` normalizado y `matchesSearch` en el cliente (KAM-06).
- `moveOrderToStatus` (KAM-07): valida el destino contra el juego resuelto de la línea del pedido; la cancelación lo reutiliza.
- `todayInTimezone()` (KAM-07 D5) y `preselectedLineId()` (KAM-04).
- `react-hook-form` + `@hookform/resolvers` + `zod` ya en `package.json`, aunque los formularios anteriores usaron `FormData` a mano: V5 es el primero con líneas repetibles y estado sucio que justifica el `useForm`.

## Goals / Non-Goals

**Goals:**

- Que un alta con fallo a medias sea imposible: pedido y líneas viven o mueren juntos, y el estado inicial no depende de que el cliente lo mande bien.
- Que el formulario sea rápido de verdad (criterio 7: < 15 interacciones) sin sacrificar los mínimos obligatorios.
- Reutilizar todo lo que KAM-06 y KAM-07 dejaron preparado para esto, sin duplicar buscadores, subida de archivos ni validación de destinos.

**Non-Goals:**

- Sincronización sin conexión (KAM-11). Se generan los UUID en el cliente y `occurred_at` lo fija el cliente, para no estorbarla; no se implementa cola local.
- Cambiar la línea de negocio de un pedido existente: cambiaría su flujo de estados y obligaría a reasignar el estado; no lo pide el backlog.
- Cobros al registrar (KAM-10), el menú «+ Registrar» y V16 (KAM-13), la venta directa (KAM-12).

## Decisions

### D1 · Alta y edición son funciones de base (`create_order`, `update_order`), no dos inserciones encadenadas

PostgREST no ofrece transacciones entre llamadas, y sin política `DELETE` no hay compensación posible: si el `insert` de líneas fallara después del de `orders`, quedaría un pedido sin líneas que nadie puede borrar y que viola el criterio 2. Decisión: dos funciones `plpgsql` con `security invoker` (RLS sigue decidiendo quién escribe), que reciben el pedido como `jsonb` y las líneas como `jsonb[]`:

- `create_order(p_order jsonb, p_items jsonb) returns uuid`: resuelve el estado inicial con `resolve_statuses(org, line, 'order')` filtrando `kind = 'initial'` y tomando el de menor `position`; **exige `jsonb_array_length(p_items) > 0`** y falla con un mensaje propio si no; inserta el pedido con el `id` que trae el cliente y luego las líneas. Los triggers de KAM-07 (numeración, `queued_at`, bitácora) actúan solos.
- `update_order(p_order jsonb, p_items jsonb) returns void`: actualiza los campos editables del pedido (nunca `business_line_id`, `status_id`, `kind`, `code` ni `archived_at`); hace *upsert* de las líneas por `id` (la que trae `id` conocido se actualiza, la nueva se inserta) y **archiva las líneas vigentes del pedido cuyo `id` no venga en `p_items`**; exige que quede al menos una línea vigente.

`organization_id` se toma de `p_order` y se compara con `is_member()` explícitamente al principio de cada función, antes de tocar nada (convención nº 2), además de lo que RLS ya impone fila a fila.

- *Alternativa: inserts encadenados desde `OrderService`.* Rechazada: fallo a medias irrecuperable sin `DELETE`.
- *Alternativa: `security definer`.* Rechazada: rompería el principio de que RLS es la autorización real; con `invoker` la función no puede hacer nada que el usuario no pudiera hacer a mano.
- Precedente en el proyecto: `accept_invitation()`, `archive_status()` y `restore_default_statuses()` ya son funciones de base invocadas por `rpc()`.

### D2 · `order_items.archived_at`: quitar una línea es archivarla

El esquema canónico §9 no tiene `archived_at` en `order_items`, pero la convención nº 3 prohíbe borrar y la edición necesita quitar líneas. Decisión: una migración nueva añade `archived_at timestamptz` a `order_items` con índice parcial, y `create or replace view order_totals` para sumar solo `archived_at is null` (misma técnica que KAM-07 D3 previó para `paid`). `OrderItemService.listByOrder` y `summariesFor` filtran igual.

**No se adjunta `enforce_archive_rules()` a `order_items`.** Ese trigger exige `is_owner()` para tocar `archived_at`, y la matriz de acceso §16 dice que el ayudante edita pedidos y sus líneas: quitar una línea es editar el pedido, no archivar un registro maestro. La protección de la fila es la ausencia de `DELETE` y el archivado del pedido padre (que sí es solo del dueño y congela todo). La bitácora registrará `archived` para la línea, que es exactamente lo que pasó.

- *Alternativa: no permitir quitar líneas, solo editar cantidad y precio.* Rechazada: obligaría a poner cantidad 0 (prohibido por el `check`) o a "vaciar" líneas de forma artificial.
- *Alternativa: `DELETE` solo para `order_items`.* Rechazada: convención nº 3 sin excepciones; además borraría historia de precios.
- Es la misma clase de desviación del DDL canónico que KAM-06 (`item_variants.organization_id`) y KAM-07 (`order_items.organization_id`): una columna al servicio de una convención, no un concepto nuevo (convención nº 11).

### D3 · El estado inicial se resuelve dentro de `create_order`, no en la acción

El criterio 6 del backlog ("estado inicial de tipo `initial` del juego de su línea") es una garantía de datos, así que vive donde las otras dos garantías duras (numeración, total derivado): en la base. La acción no envía `status_id`; el esquema Zod del alta ni siquiera lo admite. `configurable-statuses` ya garantiza que todo juego tiene al menos un `initial`, así que la función no tiene rama de "sin inicial" más allá de un `raise` defensivo.

- *Alternativa: resolverlo en `actions/orders.ts` con `StatusService.resolve()`.* Rechazada: dos consultas, una carrera entre leer el juego y escribir el pedido si alguien lo edita en medio, y una regla de datos fuera de la base.

### D4 · Cancelar = `moveOrderToStatus` al estado de tipo `cancelled` del juego resuelto

No hay una acción nueva ni una columna nueva. El detalle ya recibe `statuses` (el juego resuelto de la línea del pedido): busca el de `kind === 'cancelled'` y, si existe y el pedido no está ya en uno de ese tipo, ofrece «Cancelar pedido» con un `AlertDialog` de confirmación que llama a `moveOrderToStatus`. Convención nº 5: se compara por `kind`; la bitácora lo registra como `status_changed` (spec `activity-log`).

Cancelar **no archiva**: archivar es del dueño y saca el pedido del tablero; cancelar es de ambos roles y el pedido cancelado sigue siendo información del día (la semilla misma tiene uno cancelado y luego archivado, en dos pasos). Si el juego no tiene `cancelled`, la acción no se ofrece; configurar uno es asunto de V22, no de este formulario.

- *Alternativa: acción `cancelOrder` propia.* Rechazada: repetiría la validación del destino que `moveOrderToStatus` ya hace.

### D5 · Formulario con `react-hook-form` + resolver Zod; un solo esquema para alta y edición

`lib/orders/schema.ts` gana `orderFormSchema`: `id` (guid, generado en el cliente, convención nº 9), `businessLineId`, `contactId` (obligatorio, con mensaje «Elige o crea un cliente»), `salesChannelId | null`, `deliveryMode | null`, `dueDate | null` (ISO `YYYY-MM-DD`), `notes` (texto opcional), `occurredAt` (ISO, lo fija el cliente al abrir el formulario), e `items: z.array(orderLineSchema).min(1, «Agrega al menos una línea»)` con `orderLineSchema` = `id`, `itemId | null`, `variantId | null`, `description`, `quantity > 0`, `unitPrice >= 0`, y un `refine` que exige `description` cuando no hay `itemId`. El total **no está** en el esquema: se calcula en pantalla con `lib/orders/lines.ts` y jamás viaja.

`useForm` con `zodResolver(orderFormSchema)` y `useFieldArray` para las líneas. `formState.isDirty` es la única fuente de "hay datos escritos" (D8). Los errores de campo se pintan con `Field`/`FieldError` de shadcn, señalando el campo (criterio 2).

- *Alternativa: `FormData` a mano como en los formularios anteriores.* Rechazada: líneas repetibles con ids, valores numéricos prellenados y `isDirty` fiable son justo los tres motivos por los que `react-hook-form` está en el stack.

### D6 · Un solo componente `OrderForm` con `mode: "create" | "edit"`

`features/orders/order-form.tsx` recibe `defaultValues`, los catálogos (contactos, productos con variantes, canales, líneas), el `mode` y `today`. En `create` el campo de línea es un `Select` (preseleccionado con `preselectedLineId`), en `edit` es una etiqueta. Cambiar la línea en `create` vacía las líneas del pedido cuyo producto no pertenece a la nueva línea ni es compartido, avisando. Ambas rutas (`/orders/new` y `/orders/[id]/edit`) son páginas delgadas que cargan datos y rinden el mismo formulario. `OrderForm` llama a `createOrder` o `updateOrder` según `mode`.

- *Alternativa: dos formularios.* Rechazada: duplicaría el editor de líneas, el buscador y la guardia de descarte.

### D7 · El editor de líneas: buscador de productos en memoria + fila editable

`CatalogPicker` recibe los productos vigentes (`kind = 'product'`) de la organización con sus variantes vigentes, filtra en memoria por la línea del pedido (`businessLineId === línea || businessLineId === null`) y por texto con `matchesSearch` (misma normalización que la base, spec `catalog-directory`). Elegir un producto sin variantes agrega la fila con `quantity = 1` y `unitPrice = item.salePrice ?? 0`; con variantes despliega la lista de variantes y agrega con `unitPrice = variant.salePrice ?? item.salePrice ?? 0`. Un botón «Línea libre» agrega una fila sin producto que exige descripción. Cada fila muestra cantidad, precio, descripción, subtotal y «Quitar»; el total en pie se recalcula con `lineTotals()`.

Los productos se cargan en el servidor de una vez (un taller tiene decenas, no miles); si algún día crecen, `onTermChange` del mismo patrón que `ContactCombobox` permite filtrar del lado del servidor sin cambiar la interfaz. Se limita a `product` porque los insumos no se venden y los activos tampoco; es una decisión de interfaz reversible (la base admite cualquier ítem en `order_items.item_id`).

### D8 · Guardia de descarte: `isDirty` + `AlertDialog` en las salidas propias + `beforeunload`

`features/orders/discard-guard.tsx` recibe `dirty` y envuelve las salidas del formulario («Cancelar» y el enlace de volver): con `dirty`, abre un `AlertDialog` («¿Descartar los cambios?») y solo navega si se confirma; sin `dirty`, navega directo. Registra además `beforeunload` mientras `dirty` para recarga y cierre de pestaña. Tras un guardado exitoso se llama a `reset()` antes de navegar, así la salida no pregunta.

Los enlaces del menú lateral y de la barra inferior **no se interceptan**: el App Router no expone un bloqueo de navegación, y envolver todo el shell por un formulario sería desproporcionado. En móvil la barra inferior se oculta en las rutas de captura (D9), así que en el celular la única salida no interceptada es el botón atrás del sistema, que dispara `beforeunload` si sale de la aplicación. Se anota como riesgo.

### D9 · Pantalla completa móvil: `MobileNav` se oculta en rutas de captura

`components/layout/mobile-nav.tsx` ya lee `usePathname()`. Se le añade una lista `CAPTURE_ROUTES` (patrones `/orders/new` y `/orders/[id]/edit`; KAM-09 añadirá los suyos) en la que devuelve `null`. `OrderForm` pone su barra de acciones con `sticky bottom-0` y fondo, con «Cancelar», «Guardar y crear otro» (solo en `create`) y «Guardar». Así el formulario cumple el formato «Página / completa móvil» del mapa de navegación sin un layout aparte.

- *Alternativa: un route group con layout propio sin shell.* Rechazada: duplicaría providers y la resolución de línea activa, y el encabezado sigue siendo útil.

### D10 · Adjuntos: después del pedido, uno a uno, con `uploadOrderAttachment(FormData)`

Mismo patrón que `uploadItemPhoto`: el pedido se guarda primero (D1); luego cada `File` viaja en su propio `FormData` a `uploadOrderAttachment`, que valida tamaño y tipo, y llama a `AttachmentService.upload` con `entityType: 'order'` y `bucket: ATTACHMENTS_BUCKET`. Si una subida falla, el pedido ya existe y el formulario avisa cuál falló y ofrece reintentar desde la edición; nunca se pierde lo escrito. `FileDropzone` se usa con `maxFiles = 20 - adjuntos vigentes` y `accept` de imágenes.

Quitar un adjunto existente (en edición) llama a `setOrderAttachmentArchived`, que **no exige rol de dueño**: la matriz §16 dice «según el registro padre», y el pedido lo editan ambos roles. Difiere a propósito de `setItemPhotoArchived` (solo dueño), porque la foto de un ítem del catálogo es un dato maestro y la referencia de un pedido es parte del pedido.

- *Alternativa: subir los adjuntos dentro de `create_order`.* Rechazada: un `File` no cabe en `jsonb` ni en una Server Action normal, y un pedido no debe fallar por una foto.

### D11 · «Guardar» y «Guardar y crear otro»

Ambos llaman a `createOrder`, que devuelve `{ orderId, code }`. «Guardar»: `reset()` y `router.push('/orders/<id>')`. «Guardar y crear otro»: `reset({ ...blank, businessLineId, salesChannelId, id: crypto.randomUUID(), occurredAt: now })`, muestra un `Alert` «Pedido #N guardado» y enfoca el buscador de cliente. Los identificadores se regeneran en cada reinicio para que el siguiente pedido no colisione con el anterior.

### D12 · Atajos de fecha en `lib/orders/due-date.ts`

`shiftDate(today: string, days: number): string` sobre fechas `YYYY-MM-DD` sin zona (aritmética de días civil, no de milisegundos: evita el error de horario de verano). `today` llega del servidor con `todayInTimezone(org.timezone)` (KAM-07 D5), así los atajos son "hoy" del taller y no del navegador. El campo es un `<input type="date">` nativo más cuatro botones y «Borrar»; no se añade ninguna librería de calendario.

### D13 · Creación al vuelo con teléfono

`quickContactSchema` gana `phone: optionalText`; `createContactInline` lo pasa a `ContactService.create`. `ContactCombobox` gana un paso mínimo al pulsar «Crear»: el nombre ya escrito y un campo de teléfono, con «Crear» y «Cancelar», dentro del mismo desplegable. El contacto se crea con `isCustomer: true` y `isSupplier: false` cuando el buscador tiene `role="customer"`, como ya hace. El directorio (V13) usa el mismo buscador y hereda el teléfono sin cambios.

### D14 · Medición de interacciones (criterio 7)

`tests/e2e/order-entry.spec.ts` envuelve el `page` en un contador (`click`, `fill`, `selectOption`, `press`, `setInputFiles`) durante el recorrido de alta completa —cliente existente, dos líneas, fecha por atajo, canal, modo de entrega, nota, «Guardar»— y afirma `count < 15`, anotando el número con `test.info().annotations` para que quede en el reporte. La medición es del recorrido de la interfaz, no del inicio de sesión.

### D15 · Reparto por capas

| Capa | Archivos |
|---|---|
| `supabase/migrations/` | `<timestamp>_order_entry.sql`: `order_items.archived_at` + índice, `create or replace view order_totals`, `create_order()`, `update_order()`, `grant execute` a `authenticated` |
| `lib/orders/` | `schema.ts` (+ `orderFormSchema`, `orderLineSchema`, `orderAttachmentSchema`), `due-date.ts`, `lines.ts` (subtotales y total en pantalla), `errors.ts` (+ mensajes de `create_order`/`update_order`) |
| `lib/catalog/` | `schema.ts` (`quickContactSchema` + `phone`) |
| `services/orders/` | `order-service.ts` (+ `create()`, `update()` vía `rpc`), `order-item-service.ts` (excluir archivadas) |
| `services/catalog/` | `item-service.ts` (+ `listProductsWithVariants()` si hace falta una sola consulta) |
| `actions/` | `orders.ts` (+ `createOrder`, `updateOrder`, `uploadOrderAttachment`, `setOrderAttachmentArchived`), `contacts.ts` (`createContactInline` + `phone`) |
| `features/orders/` | `order-form.tsx`, `order-lines-editor.tsx`, `catalog-picker.tsx`, `due-date-field.tsx`, `discard-guard.tsx`, `cancel-order-button.tsx`; `orders-screen.tsx` y `order-detail.tsx` (botones) |
| `features/contacts/` | `contact-combobox.tsx` (paso de teléfono) |
| `components/layout/` | `mobile-nav.tsx` (rutas de captura) |
| `app/(app)/orders/` | `new/page.tsx`, `[id]/edit/page.tsx`, delgadas |

## Risks / Trade-offs

- **Los enlaces del shell no piden confirmación al salir con cambios (D8)** → `beforeunload` cubre recarga y cierre; en móvil la barra inferior está oculta; el menú lateral queda como salida no interceptada en escritorio. Se documenta y se revisa cuando KAM-13 traiga el menú «+ Registrar», que tocará el shell de todos modos.
- **`update_order` archiva líneas que no vienen en el payload** → un cliente que mande la lista incompleta archivaría líneas sin querer. Mitigación: el formulario siempre envía todas las vigentes; la función exige al menos una; y todo queda en la bitácora con posibilidad de desarchivar desde V23 en el futuro.
- **Cargar todos los productos con variantes en la página de alta** → aceptable a la escala de un taller; `CatalogPicker` deja `onTermChange` para pasar a filtrado en servidor sin cambiar su contrato.
- **Un adjunto que falla deja un pedido "incompleto" desde la óptica del usuario** → se avisa explícitamente cuál falló y la edición permite reintentar; es preferible a perder el pedido por una foto (misma decisión que KAM-06).
- **D2 se desvía del DDL canónico** → anotado en la propia migración con el mismo comentario que las desviaciones anteriores; el documento de esquema debería recogerlo cuando se revise.
- **Dos funciones de base más que probar** → cada una lleva sus pgTAP (atomicidad, estado inicial, rechazo sin líneas, archivado de líneas, `is_member` explícito); es el precio de mover la garantía a donde no se puede saltar.

## Migration Plan

Una migración nueva, `supabase/migrations/<timestamp>_order_entry.sql`, en este orden: `alter table order_items add column archived_at` + índice parcial → `create or replace view order_totals` (misma lista de columnas, filtro de líneas vigentes) → `create_order()` → `update_order()` → `grant execute` a `authenticated` y `revoke` a `anon`. Ninguna migración existente se toca; `supabase/seed.sql` no cambia.

Reversión: `supabase db reset` en local; en un entorno desplegado, una migración nueva que `drop function` y restaure la vista anterior — la columna `archived_at` se deja (es inocua si nadie la escribe).

Tras la migración, `graphify .` (convención nº 6).

## Open Questions

- ¿Deben poder editarse los pedidos en estado de tipo `final` o `cancelled`? Este diseño lo permite (corregir una nota tras la entrega es legítimo) y `enforce_archive_rules` sigue protegiendo lo archivado. Si el taller prefiere congelarlos, es un `refine` en el formulario y un `raise` en `update_order`, sin cambio de esquema ni de especificación.
