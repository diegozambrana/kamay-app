## MODIFIED Requirements

### Requirement: El total del pedido se deriva, nunca se almacena

El sistema SHALL exponer el total de cada pedido a través de la vista `order_totals`, declarada con `security_invoker = true`, calculado como la suma de `quantity * unit_price` de sus líneas vigentes —las que no tienen `archived_at`—. La misma vista SHALL exponer `paid`, la suma de los movimientos de cobro no archivados del pedido, de modo que el saldo pendiente se obtenga como `total - paid` en el momento de la lectura. Ninguna columna de `orders` SHALL almacenar total, cobrado, saldo ni margen.

#### Scenario: Total de un pedido con líneas

- **WHEN** un pedido tiene dos líneas de 3 × 25 y 1 × 40
- **THEN** `order_totals` devuelve 115 como total de ese pedido

#### Scenario: Pedido sin líneas

- **WHEN** un pedido no tiene ninguna línea
- **THEN** `order_totals` devuelve 0 como total, no nulo

#### Scenario: Se agrega una línea

- **WHEN** se agrega una línea a un pedido existente
- **THEN** el total devuelto por `order_totals` refleja el cambio sin ninguna operación de recálculo

#### Scenario: Se archiva una línea

- **WHEN** se archiva una de las líneas de un pedido
- **THEN** el total devuelto por `order_totals` deja de incluirla sin ninguna operación de recálculo

#### Scenario: Cobrado de un pedido con anticipo

- **WHEN** un pedido con total 115 tiene un cobro no archivado de 40
- **THEN** `order_totals` devuelve `paid = 40` y el saldo pendiente derivado es 75

#### Scenario: Pedido sin cobros

- **WHEN** un pedido no tiene ningún cobro
- **THEN** `order_totals` devuelve `paid = 0`, no nulo

#### Scenario: La vista sigue respetando al invocante

- **WHEN** un miembro de otra organización consulta `order_totals`
- **THEN** no obtiene ninguna fila de pedidos ajenos, porque la vista conserva `security_invoker = true`

#### Scenario: Ninguna columna almacena el derivado

- **WHEN** se inspecciona la definición de la tabla `orders`
- **THEN** no existe ninguna columna de total, saldo, cobrado ni margen


### Requirement: Tarjeta del tablero

Cada tarjeta del tablero SHALL mostrar el número del pedido, el cliente, un resumen de lo pedido, la fecha comprometida, el modo de entrega distinguible entre recojo y delivery, el color de su línea de negocio, la señal de pago derivada del estado de pago del pedido y, cuando corresponda, la alerta de retraso y el número de posición en cola. La señal de pago SHALL derivarse de `total` y `paid`, y no SHALL ser editable desde la tarjeta.

#### Scenario: Pedido con modo de entrega

- **WHEN** un pedido tiene `delivery_mode = 'delivery'`
- **THEN** su tarjeta lo distingue visualmente de uno con `pickup`

#### Scenario: Señal de pago de un pedido con anticipo

- **WHEN** un pedido tiene cobros por menos de su total
- **THEN** su tarjeta muestra la señal de pago parcial

#### Scenario: Señal de pago de un pedido saldado

- **WHEN** un pedido tiene cobros por su total exacto
- **THEN** su tarjeta muestra la señal de pagado

#### Scenario: La señal de pago no depende del estado del pedido

- **WHEN** un pedido está en un estado de tipo `final` y no tiene ningún cobro
- **THEN** su tarjeta muestra la señal de pendiente, porque entregado y cobrado son hechos distintos

#### Scenario: Datos opcionales ausentes

- **WHEN** un pedido no tiene fecha comprometida ni modo de entrega
- **THEN** la tarjeta se muestra sin esos elementos y sin error

#### Scenario: Abrir el detalle

- **WHEN** se activa una tarjeta del tablero
- **THEN** se abre el detalle de ese pedido


### Requirement: Detalle del pedido

El detalle de un pedido SHALL mostrar su número, cliente, línea de negocio, canal de venta, modo de entrega, sus líneas vigentes con cantidad y precio unitario, el total derivado, la fecha comprometida y la fecha del hecho, las notas, las imágenes de referencia y el historial del pedido leído de la bitácora. El detalle SHALL incluir además un bloque de **cobros y saldo** con la lista de cobros registrados, el saldo pendiente derivado, el estado de pago y la acción *Registrar cobro*. El detalle SHALL permitir cambiar el estado del pedido, navegar al cliente, abrir la edición del pedido y cancelarlo.

#### Scenario: Pedido completo

- **WHEN** se abre el detalle de un pedido con líneas, notas e imágenes
- **THEN** se muestran todos sus datos y el total calculado desde sus líneas

#### Scenario: Bloque de cobros y saldo

- **WHEN** se abre el detalle de un pedido con dos cobros registrados
- **THEN** el bloque de cobros lista ambos con su importe, método y fecha, y muestra el saldo pendiente derivado

#### Scenario: Pedido sin cobros

- **WHEN** se abre el detalle de un pedido sin ningún cobro
- **THEN** el bloque muestra el saldo pendiente igual al total y ofrece la acción *Registrar cobro*

#### Scenario: Historial

- **WHEN** un pedido ha cambiado de estado dos veces
- **THEN** su historial muestra ambos cambios en orden cronológico, leídos de la bitácora

#### Scenario: Cambio de estado desde el detalle

- **WHEN** se cambia el estado del pedido desde su detalle
- **THEN** el estado cambia, el historial lo registra y el tablero refleja el cambio al volver

#### Scenario: Imagen de referencia

- **WHEN** un pedido tiene una imagen de referencia adjunta
- **THEN** se muestra en el detalle y solo es accesible para miembros de la organización del pedido

#### Scenario: Acciones de edición y cancelación

- **WHEN** se abre el detalle de un pedido vigente que no está cancelado
- **THEN** se ofrecen las acciones «Editar» y «Cancelar pedido»

#### Scenario: Pedido archivado

- **WHEN** se abre el detalle de un pedido archivado
- **THEN** no se ofrecen «Editar» ni «Cancelar pedido»
