## Purpose

Registra el dinero que efectivamente entró o salió —cobros contra pedidos y pagos contra egresos— como hechos inmutables, y deja que el saldo pendiente, el estado de pago y los indicadores "Por cobrar" y "Por pagar" se deriven de ellos sin almacenarse nunca.

> Origen: `specs/PRD/kamay-backlog.md` — KAM-10; `specs/PRD/kamay-esquema-base-de-datos-supabase.md` § Cobros y pagos, § Vistas derivadas, § Matriz de acceso; `specs/PRD/kamay-especificacion-producto-v6.md` — principio 2, tabla 6.1 (Cobro / Pago), V4 y V7; `specs/PRD/kamay-mapa-navegacion-ui.md` (registrar cobro es un diálogo); `specs/PRD/ARCHITECTURE.md` (convención 3: nada se borra; convención 4: nada derivado se almacena).

## ADDED Requirements

### Requirement: Modelo de movimiento de dinero

El sistema SHALL almacenar cada movimiento real de dinero en la tabla `payments` según el esquema canónico, con `organization_id` obligatorio, `direction` restringido a `in` u `out`, `amount` de tipo `numeric(14,2)` estrictamente mayor que cero, y los campos opcionales `order_id`, `expense_id`, `method` (restringido a `cash`, `transfer` u `other`), `occurred_at`, `note`, `created_by` y `archived_at`. El importe SHALL registrarse siempre en positivo: la dirección del movimiento la expresa `direction`, nunca el signo del monto.

#### Scenario: Movimiento válido

- **WHEN** se guarda un movimiento con organización, dirección `in`, un pedido y monto 50.00
- **THEN** la operación se acepta

#### Scenario: Monto cero

- **WHEN** se intenta guardar un movimiento con `amount` igual a cero
- **THEN** la base de datos rechaza la operación

#### Scenario: Monto negativo

- **WHEN** se intenta guardar un movimiento con `amount` negativo
- **THEN** la base de datos rechaza la operación

#### Scenario: Método fuera del dominio

- **WHEN** se intenta guardar un movimiento con `method` distinto de `cash`, `transfer` u `other`
- **THEN** la base de datos rechaza la operación

#### Scenario: Método ausente

- **WHEN** se guarda un movimiento sin `method`
- **THEN** la operación se acepta y el movimiento queda sin método declarado

### Requirement: Un movimiento apunta exactamente a un destino

El sistema SHALL garantizar mediante la restricción `exactly_one_target` que todo movimiento apunte a un pedido **o** a un egreso, y nunca a ambos ni a ninguno. La garantía SHALL vivir en la base de datos, de modo que ninguna ruta de escritura —formulario, acción de servidor, semilla o cola de sincronización— pueda producir un movimiento huérfano o de doble destino.

#### Scenario: Movimiento con dos destinos

- **WHEN** se intenta guardar un movimiento con `order_id` y `expense_id` no nulos a la vez
- **THEN** la base de datos rechaza la operación por la restricción `exactly_one_target`

#### Scenario: Movimiento sin destino

- **WHEN** se intenta guardar un movimiento con `order_id` y `expense_id` nulos
- **THEN** la base de datos rechaza la operación por la restricción `exactly_one_target`

#### Scenario: Movimiento contra un pedido

- **WHEN** se guarda un movimiento con `order_id` y sin `expense_id`
- **THEN** la operación se acepta

#### Scenario: Movimiento contra un egreso

- **WHEN** se guarda un movimiento con `expense_id` y sin `order_id`
- **THEN** la operación se acepta

### Requirement: La dirección se deduce del destino y la base de datos la impone

El sistema SHALL garantizar mediante la restricción `direction_matches_target` que todo movimiento contra un pedido tenga `direction = 'in'` y todo movimiento contra un egreso tenga `direction = 'out'`. No SHALL existir ninguna combinación válida de cobro sobre un egreso ni de pago sobre un pedido.

#### Scenario: Cobro de pedido

- **WHEN** se guarda un movimiento con `order_id` y `direction = 'in'`
- **THEN** la operación se acepta

#### Scenario: Pago de egreso

- **WHEN** se guarda un movimiento con `expense_id` y `direction = 'out'`
- **THEN** la operación se acepta

#### Scenario: Dirección contraria sobre un pedido

- **WHEN** se intenta guardar un movimiento con `order_id` y `direction = 'out'`
- **THEN** la base de datos rechaza la operación por la restricción `direction_matches_target`

#### Scenario: Dirección contraria sobre un egreso

- **WHEN** se intenta guardar un movimiento con `expense_id` y `direction = 'in'`
- **THEN** la base de datos rechaza la operación por la restricción `direction_matches_target`

### Requirement: El saldo pendiente se deriva y nunca se almacena

El sistema SHALL exponer lo cobrado de un pedido y lo pagado de un egreso como la columna `paid` de las vistas `order_totals` y `expense_totals`, calculada como la suma de los `payments` **no archivados** de ese documento. El saldo pendiente SHALL calcularse como `total - paid` en el momento de la lectura. Ninguna columna de ninguna tabla SHALL almacenar cobrado, pagado ni saldo, y ningún store del cliente SHALL persistirlos.

#### Scenario: Pedido con anticipo

- **WHEN** un pedido con total 300 tiene un cobro de 100
- **THEN** `order_totals` devuelve `paid = 100` y el saldo pendiente mostrado es 200

#### Scenario: Pedido sin cobros

- **WHEN** un pedido no tiene ningún cobro
- **THEN** `order_totals` devuelve `paid = 0`, no nulo, y el saldo pendiente es igual al total

#### Scenario: Se registra un cobro adicional

- **WHEN** se registra un segundo cobro sobre un pedido
- **THEN** `paid` y el saldo pendiente reflejan el cambio sin ninguna operación de recálculo

#### Scenario: Un cobro archivado no cuenta

- **WHEN** uno de los cobros de un pedido tiene `archived_at` no nulo
- **THEN** `paid` no lo incluye y el saldo pendiente sube en ese importe

#### Scenario: Egreso pagado en parte

- **WHEN** un egreso con total 500 tiene un pago de 200
- **THEN** `expense_totals` devuelve `paid = 200` y el saldo por pagar es 300

#### Scenario: Ninguna columna almacena el derivado

- **WHEN** se inspecciona la definición de las tablas `orders`, `order_items`, `expenses` y `payments`
- **THEN** no existe ninguna columna de cobrado, pagado, saldo ni estado de pago

### Requirement: El estado de pago se deriva, no se edita

El sistema SHALL derivar el estado de pago de un documento comparando su `total` con su `paid`: `pendiente` cuando `paid` es cero, `parcial` cuando `paid` es mayor que cero y menor que `total`, `pagado` cuando `paid` es igual a `total`, y `sobrepagado` cuando `paid` es mayor que `total`. No SHALL existir ningún campo, control ni acción que permita fijar el estado de pago directamente.

#### Scenario: Pedido sin cobros

- **WHEN** un pedido con total 300 no tiene cobros
- **THEN** su estado de pago derivado es `pendiente`

#### Scenario: Pedido con anticipo

- **WHEN** un pedido con total 300 tiene cobros por 100
- **THEN** su estado de pago derivado es `parcial`

#### Scenario: Pedido saldado

- **WHEN** un pedido con total 300 tiene cobros por 300
- **THEN** su estado de pago derivado es `pagado`

#### Scenario: Pedido de total cero

- **WHEN** un pedido sin líneas y sin cobros tiene total 0 y `paid` 0
- **THEN** su estado de pago derivado es `pagado`, no `pendiente`

#### Scenario: No hay control para fijarlo

- **WHEN** se inspecciona el detalle del pedido y el formulario de cobro
- **THEN** ninguno ofrece un campo, casilla ni selector para fijar el estado de pago

### Requirement: Registrar un cobro desde el detalle del pedido

El detalle de un pedido SHALL ofrecer la acción *Registrar cobro*, que abre un diálogo con monto, método, fecha del hecho y nota. El diálogo SHALL proponer el saldo pendiente como monto por omisión. Al confirmar, el cobro SHALL quedar registrado con `direction = 'in'` contra ese pedido, el saldo mostrado SHALL actualizarse y el hecho SHALL quedar en la bitácora. El diálogo SHALL ser el único nivel de profundidad añadido: no SHALL abrir otra pantalla.

#### Scenario: Cobro del saldo completo

- **WHEN** se abre *Registrar cobro* en un pedido con saldo pendiente 200 y se confirma sin cambiar el monto
- **THEN** se registra un cobro de 200, el saldo pasa a 0 y el estado de pago pasa a `pagado`

#### Scenario: Anticipo parcial

- **WHEN** se registra un cobro de 100 sobre un pedido con total 300 y sin cobros previos
- **THEN** el saldo mostrado pasa a 200 y el estado de pago pasa a `parcial`

#### Scenario: Monto vacío o no positivo

- **WHEN** se intenta confirmar el diálogo con el monto vacío, en cero o negativo
- **THEN** se impide con un mensaje claro señalando el campo y no se registra nada

#### Scenario: El cobro queda en la bitácora

- **WHEN** se registra un cobro sobre un pedido
- **THEN** el historial del pedido muestra el cobro con su importe, su método y quién lo registró

### Requirement: El sobrepago se advierte pero se permite

El sistema SHALL advertir antes de confirmar un cobro cuyo importe exceda el saldo pendiente, indicando el excedente, y SHALL permitir confirmarlo. Tras el registro, el saldo pendiente SHALL quedar negativo y visible como tal, y el estado de pago derivado SHALL ser `sobrepagado`. El sistema no SHALL truncar el importe al saldo pendiente ni rechazar el movimiento.

#### Scenario: Advertencia antes de confirmar

- **WHEN** se introduce un cobro de 250 en un pedido con saldo pendiente 200
- **THEN** el diálogo advierte del excedente de 50 antes de permitir confirmar

#### Scenario: Sobrepago confirmado

- **WHEN** se confirma ese cobro de 250
- **THEN** se registra por 250, el saldo mostrado es −50 y el estado de pago es `sobrepagado`

#### Scenario: El importe no se recorta

- **WHEN** se consulta el movimiento registrado tras un sobrepago
- **THEN** su `amount` es el introducido por el usuario, no el saldo pendiente anterior

### Requirement: Anular un cobro mediante movimiento inverso

El sistema SHALL permitir anular un cobro registrado por error archivándolo (`archived_at`) en lugar de borrarlo. Tanto el cobro original como su anulación SHALL quedar visibles en la bitácora del documento. El movimiento archivado SHALL dejar de contar en `paid` y en los indicadores. No SHALL existir ninguna política `DELETE` sobre `payments`, de modo que ninguna ruta —incluida la de servicio— pueda eliminar la fila.

#### Scenario: Anulación devuelve el saldo

- **WHEN** se anula un cobro de 100 sobre un pedido con total 300 y `paid` 100
- **THEN** `paid` vuelve a 0, el saldo pendiente vuelve a 300 y el estado de pago vuelve a `pendiente`

#### Scenario: Ambos hechos quedan registrados

- **WHEN** se anula un cobro
- **THEN** el historial del pedido muestra el cobro original y su anulación, en orden cronológico

#### Scenario: La fila no se borra

- **WHEN** se intenta eliminar una fila de `payments` como usuario autenticado
- **THEN** la operación es rechazada porque no existe política `DELETE`

#### Scenario: Un movimiento archivado no se edita

- **WHEN** se intenta modificar el importe de un movimiento ya archivado
- **THEN** la operación es rechazada

### Requirement: Un movimiento registrado no se edita

El sistema SHALL tratar cada movimiento de dinero como un hecho inmutable: una vez registrado, ni su importe, ni su dirección, ni su destino, ni su fecha SHALL poder modificarse. La única corrección disponible SHALL ser anularlo y registrar uno nuevo, de modo que la bitácora conserve lo que realmente ocurrió en vez de una versión reescrita. El único campo modificable SHALL ser `archived_at`, y solo por el dueño.

#### Scenario: Intento de corregir el importe

- **WHEN** se intenta modificar el `amount` de un movimiento ya registrado
- **THEN** la operación es rechazada

#### Scenario: Intento de cambiar el destino

- **WHEN** se intenta cambiar el `order_id` de un movimiento ya registrado
- **THEN** la operación es rechazada

#### Scenario: Corrección por la vía prevista

- **WHEN** un cobro se registró con un importe equivocado y se anula, y luego se registra otro con el importe correcto
- **THEN** el saldo refleja solo el movimiento vigente y la bitácora conserva los tres hechos

#### Scenario: Archivar sí está permitido

- **WHEN** el dueño fija `archived_at` sobre un movimiento vigente
- **THEN** la operación se acepta

### Requirement: Registrar un pago desde el detalle del egreso

El detalle de un egreso SHALL ofrecer la acción *Registrar pago*, con el mismo diálogo de monto, método, fecha y nota. Al confirmar, el pago SHALL quedar registrado con `direction = 'out'` contra ese egreso, el saldo por pagar SHALL actualizarse y el hecho SHALL quedar en la bitácora.

#### Scenario: Pago parcial de una compra

- **WHEN** se registra un pago de 200 sobre un egreso con total 500 y sin pagos previos
- **THEN** el saldo por pagar mostrado pasa a 300 y el estado de pago pasa a `parcial`

#### Scenario: El pago queda en la bitácora

- **WHEN** se registra un pago sobre un egreso
- **THEN** el historial del egreso muestra el pago con su importe y quién lo registró

### Requirement: El ayudante cobra pero no paga

El sistema SHALL permitir a un miembro con rol de ayudante crear movimientos con `direction = 'in'` y SHALL impedirle crear movimientos con `direction = 'out'`. La separación SHALL estar implementada en la política RLS de `payments`, de modo que se sostenga aunque la interfaz se salte. El dueño SHALL poder crear movimientos en ambas direcciones y anularlos.

#### Scenario: El ayudante registra un cobro

- **WHEN** un ayudante inserta un movimiento con `order_id` y `direction = 'in'` en su organización
- **THEN** la operación se acepta

#### Scenario: El ayudante intenta registrar un pago

- **WHEN** un ayudante intenta insertar un movimiento con `expense_id` y `direction = 'out'`
- **THEN** la operación es rechazada por la política de escritura

#### Scenario: El ayudante no ve el egreso de todos modos

- **WHEN** un ayudante consulta los movimientos con `expense_id` de su organización
- **THEN** obtiene cero filas, porque no tiene acceso a los egresos a los que apuntan

#### Scenario: El dueño registra un pago

- **WHEN** el dueño inserta un movimiento con `expense_id` y `direction = 'out'`
- **THEN** la operación se acepta

#### Scenario: Solo el dueño anula

- **WHEN** un ayudante intenta archivar un movimiento
- **THEN** la operación es rechazada

### Requirement: Aislamiento por organización de los movimientos

El sistema SHALL activar RLS sobre `payments` y SHALL restringir toda lectura y escritura a los movimientos de organizaciones de las que el usuario es miembro. Un movimiento SHALL pertenecer siempre a la misma organización que el documento al que apunta.

#### Scenario: Movimientos de otra organización

- **WHEN** un miembro de la organización A consulta los movimientos existentes
- **THEN** no obtiene ninguno de la organización B

#### Scenario: Crear en organización ajena

- **WHEN** un miembro de la organización A intenta crear un movimiento con `organization_id` de la organización B
- **THEN** la operación es rechazada

#### Scenario: Destino de otra organización

- **WHEN** se intenta crear un movimiento cuya organización no coincide con la del pedido al que apunta
- **THEN** la operación es rechazada

### Requirement: Indicadores agregados Por cobrar y Por pagar

El sistema SHALL exponer, como derivados agregados por organización y por línea de negocio, el total **Por cobrar** —la suma de los saldos pendientes positivos de los pedidos no archivados— y el total **Por pagar** —la suma de los saldos pendientes positivos de los egresos no archivados—. Ambos SHALL respetar la línea de negocio activa y SHALL calcularse en la lectura, nunca almacenarse. El indicador Por cobrar SHALL mostrarse en la cabecera del tablero de pedidos y el indicador Por pagar en la cabecera de la bandeja de egresos.

#### Scenario: Por cobrar con varios pedidos

- **WHEN** una organización tiene un pedido con saldo 200 y otro con saldo 50, ambos no archivados
- **THEN** el indicador Por cobrar muestra 250

#### Scenario: Un pedido sobrepagado no resta

- **WHEN** uno de los pedidos tiene saldo −50
- **THEN** ese pedido aporta 0 al indicador Por cobrar, que no baja por su excedente

#### Scenario: Filtro por línea de negocio

- **WHEN** la línea activa es Sublimación
- **THEN** el indicador Por cobrar suma solo los pedidos de esa línea

#### Scenario: El ayudante no ve Por pagar

- **WHEN** un ayudante consulta el indicador Por pagar
- **THEN** obtiene cero, porque los egresos a los que se refiere le son inaccesibles

#### Scenario: Ningún pedido pendiente

- **WHEN** todos los pedidos de la organización están saldados
- **THEN** el indicador Por cobrar muestra 0, no nulo
