## MODIFIED Requirements

### Requirement: Modelo de egreso con dos tipos en una sola tabla

El sistema SHALL almacenar compras y gastos en la tabla `expenses` según el esquema canónico, con `kind` restringido a `purchase` o `expense`, `business_line_id` obligatorio, y los campos opcionales `contact_id` (proveedor), `expense_category_id`, `order_id`, `amount`, `note` y `archived_at`. La restricción `purchase_needs_supplier` SHALL exigir `contact_id` cuando `kind = 'purchase'`; `expense_needs_category_and_amount` SHALL exigir `expense_category_id` y `amount` cuando `kind = 'expense'`; `purchase_has_no_own_amount` SHALL rechazar `amount` cuando `kind = 'purchase'`. La tabla SHALL admitir clave primaria generada por el cliente y `occurred_at` fijado por el cliente.

Un egreso SHALL poder además **pertenecer a un activo**, declarando a la vez el activo y el **papel** que ese egreso cumple para él: `acquisition` —el egreso con el que se adquirió— o `maintenance` —lo gastado después en mantenerlo—. Los dos campos SHALL declararse juntos o no declararse: ninguno SHALL admitirse sin el otro. Un activo SHALL tener a lo sumo un egreso con papel de adquisición, y SHALL poder tener cualquier número con papel de mantenimiento. El activo referido SHALL pertenecer a la misma organización que el egreso.

#### Scenario: Gasto sin categoría

- **WHEN** se intenta guardar una fila con `kind = 'expense'`, `amount` presente y `expense_category_id` nulo
- **THEN** la base de datos rechaza la operación por `expense_needs_category_and_amount`

#### Scenario: Gasto sin monto

- **WHEN** se intenta guardar una fila con `kind = 'expense'`, categoría presente y `amount` nulo
- **THEN** la base de datos rechaza la operación por `expense_needs_category_and_amount`

#### Scenario: Compra sin proveedor

- **WHEN** se intenta guardar una fila con `kind = 'purchase'` y `contact_id` nulo
- **THEN** la base de datos rechaza la operación por `purchase_needs_supplier`

#### Scenario: Compra con monto propio

- **WHEN** se intenta guardar una fila con `kind = 'purchase'` y `amount` distinto de nulo
- **THEN** la base de datos rechaza la operación por `purchase_has_no_own_amount`

#### Scenario: Egreso sin línea de negocio

- **WHEN** se intenta guardar un egreso de cualquier tipo con `business_line_id` nulo
- **THEN** la base de datos rechaza la operación

#### Scenario: Identificador y fecha del hecho fijados por el cliente

- **WHEN** se guarda un gasto con un `id` generado por el cliente y un `occurred_at` de ayer
- **THEN** la fila conserva ese `id` y ese `occurred_at`, y `created_at` lo fija el servidor

#### Scenario: Egreso que pertenece a un activo

- **WHEN** se guarda un gasto declarando el activo al que pertenece y el papel `maintenance`
- **THEN** la fila queda registrada con ambos datos

#### Scenario: Activo sin papel

- **WHEN** se intenta guardar un egreso declarando un activo sin declarar su papel, o un papel sin declarar el activo
- **THEN** la base de datos rechaza la operación

#### Scenario: Una sola adquisición por activo

- **WHEN** se intenta declarar con papel `acquisition` un segundo egreso para un activo que ya tiene uno
- **THEN** la base de datos rechaza la operación

#### Scenario: Varios mantenimientos por activo

- **WHEN** se declaran tres egresos con papel `maintenance` para el mismo activo
- **THEN** los tres quedan registrados

#### Scenario: El activo es de la misma organización

- **WHEN** se intenta declarar para un egreso un activo de otra organización
- **THEN** la base de datos rechaza la operación

### Requirement: Formulario de compra (V8)

El formulario de compra SHALL pedir proveedor —con creación al vuelo desde el propio buscador—, fecha del hecho con el día de hoy por defecto, línea de negocio preseleccionada desde la línea activa, una tabla editable de **insumos y activos** con cantidad y precio unitario por fila, un comprobante opcional y una nota opcional. SHALL mostrar el total calculado en vivo desde las filas. SHALL impedir guardar sin proveedor, sin línea o sin al menos una fila válida, señalando el campo. Al guardar SHALL volver a la bandeja de egresos con la compra visible.

El selector de la tabla SHALL ofrecer los ítems de tipo activo junto a los insumos, distinguiendo su tipo: comprar una máquina es un egreso como cualquier otro, y sin poder registrarlo no habría compra desde la que declarar el activo. SHALL NOT ofrecer productos: lo que se fabrica no se compra.

#### Scenario: Compra completa

- **WHEN** se elige un proveedor, se agregan dos insumos con cantidad y precio y se guarda
- **THEN** la compra aparece en la bandeja con su total igual a la suma de las filas

#### Scenario: Sin proveedor

- **WHEN** se intenta guardar con insumos pero sin proveedor
- **THEN** se impide con un mensaje que señala el campo de proveedor

#### Scenario: Proveedor nuevo al vuelo

- **WHEN** se escribe el nombre de un proveedor que no existe y se elige crearlo
- **THEN** se crea con rol de proveedor, queda seleccionado y el formulario conserva las filas ya cargadas

#### Scenario: El total sigue a las filas

- **WHEN** se cambia la cantidad de una fila de 2 a 5
- **THEN** el total mostrado se actualiza sin recargar

#### Scenario: Quitar una fila

- **WHEN** se quita una de tres filas antes de guardar
- **THEN** el total se recalcula y la compra se guarda con dos líneas

#### Scenario: Comprar una máquina

- **WHEN** se busca un ítem de tipo activo en el selector de la tabla
- **THEN** aparece entre las opciones, marcado como activo, y se puede agregar con cantidad y precio

#### Scenario: Los productos no se compran

- **WHEN** se busca un ítem de tipo producto en el selector de la tabla
- **THEN** no aparece entre las opciones

### Requirement: Detalle del egreso

El detalle SHALL mostrar tipo, fecha del hecho, proveedor enlazado a su ficha (compra) o categoría (gasto), línea, las líneas de compra con cantidad y precio unitario, el total derivado, la nota, el pedido asignado enlazado si existe, el **activo al que pertenece enlazado a su detalle si existe, con el papel que cumple**, los comprobantes y el historial leído de la bitácora. SHALL permitir archivar y desarchivar, adjuntar un comprobante y, para la persona dueña, **vincular el egreso a un activo como mantenimiento o deshacer ese vínculo**. El mismo detalle SHALL abrirse por enlace directo en `/expenses/[id]`.

#### Scenario: Compra completa

- **WHEN** se abre el detalle de una compra con líneas y comprobante
- **THEN** se muestran sus líneas, el total calculado y el comprobante

#### Scenario: Gasto asignado a un pedido

- **WHEN** se abre el detalle de un gasto con `order_id`
- **THEN** muestra el número del pedido enlazado a su detalle

#### Scenario: Gasto que pertenece a un activo

- **WHEN** se abre el detalle de un gasto vinculado a un activo como mantenimiento
- **THEN** muestra el nombre del activo enlazado a su detalle y el papel que ese egreso cumple

#### Scenario: Vincular desde el egreso

- **WHEN** la persona dueña vincula desde el detalle un gasto a un activo como mantenimiento
- **THEN** el vínculo queda guardado y el activo aparece en el detalle del egreso

#### Scenario: Historial

- **WHEN** un egreso se registró y luego se archivó
- **THEN** su historial muestra ambos eventos en orden cronológico, leídos de la bitácora

#### Scenario: Enlace directo

- **WHEN** se abre `/expenses/<id>` de un egreso de la propia organización
- **THEN** se muestra el mismo detalle que el panel de la bandeja
