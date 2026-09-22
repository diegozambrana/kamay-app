## ADDED Requirements

### Requirement: El saldo por variante se deriva y nunca se almacena

El sistema SHALL exponer el saldo de cada variante de un insumo como valor derivado de la suma de los movimientos de esa variante, en una vista que SHALL declarar `security_invoker = true` y SHALL ejecutarse con los permisos de quien consulta. La vista SHALL cubrir únicamente los ítems de tipo insumo y SHALL exponer una fila por cada variante del ítem —vigente o archivada—, con saldo cero cuando la variante nunca se movió, y una fila «Sin variante» con la suma de los movimientos del ítem que no llevan variante, solo cuando existe al menos uno. La suma de los saldos por variante de un ítem, incluida la fila «Sin variante», SHALL ser igual a su saldo por ítem. La vista de saldo por ítem y su bandera de bajo mínimo SHALL NOT cambiar: el mínimo sigue siendo del ítem.

Ninguna columna de ninguna tabla SHALL almacenar el saldo de una variante, y la ausencia SHALL verificarse con una prueba automática.

#### Scenario: Cada saldo coincide con la suma de sus movimientos

- **GIVEN** un filamento con las variantes «Negro» y «Rojo»
- **WHEN** se compran 2 de Negro y 1 de Rojo, se consumen 0,5 de Negro y se ajusta Rojo en −0,2
- **THEN** el saldo de Negro es 1,5, el de Rojo es 0,8, y el saldo del ítem es 2,3

#### Scenario: Una variante que nunca se movió

- **WHEN** se añade la variante «Azul» a un filamento y se consultan sus saldos
- **THEN** Azul aparece con saldo cero

#### Scenario: Movimientos anteriores sin variante

- **GIVEN** un insumo con un consumo registrado antes de que tuviera variantes
- **WHEN** se le añaden variantes y se consultan sus saldos
- **THEN** aparece una fila «Sin variante» con la suma de esos movimientos, y ningún movimiento se reescribe

#### Scenario: Sin fila «Sin variante» cuando no hace falta

- **WHEN** todos los movimientos de un filamento llevan variante
- **THEN** sus saldos no incluyen la fila «Sin variante»

#### Scenario: Un color agotado no dispara la alerta del ítem

- **GIVEN** un filamento con mínimo 1, Negro con saldo 0 y Rojo con saldo 3
- **WHEN** se consulta el panel y el catálogo
- **THEN** el filamento no aparece bajo mínimo, porque su saldo es 3, y el detalle muestra Negro en cero

#### Scenario: Saldos por variante de otra organización

- **WHEN** un miembro de la organización A consulta los saldos por variante
- **THEN** obtiene cero filas de la organización B

#### Scenario: Ninguna columna guarda el saldo por variante

- **WHEN** se inspeccionan las columnas de las tablas del catálogo y del inventario
- **THEN** no existe ninguna columna que guarde el saldo de una variante

## MODIFIED Requirements

### Requirement: Cada línea de compra de un insumo genera exactamente una entrada

El sistema SHALL generar automáticamente una entrada de inventario por cada línea de compra cuyo ítem sea un insumo, con la cantidad de la línea, la variante de la línea cuando la tiene, el origen `expense_item` y la referencia a esa línea. La generación SHALL ocurrir cualquiera sea la vía por la que se registre la compra. Una línea de compra cuyo ítem sea producto o activo SHALL NOT generar movimiento alguno.

#### Scenario: Compra de tres insumos

- **WHEN** se registra una compra con tres líneas de insumo
- **THEN** existen exactamente tres entradas de inventario, una por línea, con las cantidades de la compra

#### Scenario: El saldo sube con la compra

- **WHEN** se registra una compra de 50 unidades de un insumo con saldo 0
- **THEN** su saldo pasa a 50 sin que nadie registre nada más

#### Scenario: Línea de compra de un producto

- **WHEN** se registra una compra cuya línea apunta a un ítem de tipo producto
- **THEN** no se genera ninguna entrada de inventario para esa línea

#### Scenario: La compra de una variante sube el saldo de esa variante

- **WHEN** se registra una compra de 1 kg de la variante «Negro» de un filamento, y se sincroniza dos veces
- **THEN** existe exactamente una entrada de inventario de 1 para la variante Negro, el saldo de Negro sube en 1 y el de las demás variantes no cambia

### Requirement: Registrar un consumo cuesta tres interacciones o menos

El sistema SHALL ofrecer el registro de consumo como un diálogo con los datos mínimos —ítem, variante cuando el ítem tiene variantes vigentes, cantidad y nota opcional—, abierto desde el detalle del ítem, desde la fila de una variante en el detalle del ítem, desde el detalle de un pedido o de una tarea, y desde el destino *Consumo* de la pantalla de registro rápido y del menú *+ Registrar*. Abierto desde el detalle de un ítem, el ítem SHALL venir puesto; abierto desde la fila de una variante, el ítem y la variante SHALL venir puestos. Abierto desde un pedido o una tarea, la nota SHALL venir prellenada con su referencia y SHALL ser modificable.

Cuando el ítem elegido tiene variantes vigentes, el diálogo SHALL ofrecer sus variantes y SHALL exigir elegir una antes de guardar; SHALL NOT ofrecer variantes archivadas. Cuando el ítem no tiene variantes vigentes, el diálogo SHALL verse como antes de este cambio y el consumo SHALL guardarse sin variante. El servidor SHALL rechazar un consumo sin variante de un ítem con variantes vigentes, y un consumo cuya variante no pertenezca al ítem o esté archivada.

La operación SHALL costar **tres interacciones o menos** contadas desde que el diálogo está a la vista cuando el ítem viene puesto y no tiene variantes, o cuando el ítem y la variante vienen puestos. Cuando la persona tiene que elegir la variante, esa elección SHALL sumar exactamente una interacción. Ambas mediciones SHALL verificarse en una prueba de extremo a extremo. El consumo SHALL registrarse con origen `manual` cualquiera sea el punto de entrada. El diálogo SHALL NOT cambiar de dirección: registrar un consumo SHALL NOT sacar a la persona de la pantalla en la que estaba.

#### Scenario: Consumo desde el detalle del insumo

- **WHEN** una persona abre el diálogo desde un insumo sin variantes, escribe 5 y confirma
- **THEN** el saldo baja en 5, la persona sigue en el detalle del insumo y la operación no exigió más de tres interacciones

#### Scenario: Consumo desde la fila de una variante

- **WHEN** una persona abre el diálogo desde la fila «Negro» de un filamento, escribe 0,3 y confirma
- **THEN** el saldo de Negro baja en 0,3, el de las demás variantes no cambia, y la operación no exigió más de tres interacciones

#### Scenario: Consumo de un ítem con variantes exige elegir cuál

- **WHEN** una persona abre el diálogo desde el detalle de un filamento con variantes, escribe 0,3 e intenta confirmar sin elegir variante
- **THEN** no se guarda nada y el diálogo pide elegir la variante

#### Scenario: El servidor rechaza el consumo sin variante

- **WHEN** llega al servidor, sin pasar por la interfaz, un consumo sin variante de un ítem que tiene variantes vigentes
- **THEN** la operación se rechaza con un mensaje comprensible y el saldo no cambia

#### Scenario: El servidor rechaza una variante ajena

- **WHEN** llega un consumo cuya variante pertenece a otro ítem o está archivada
- **THEN** la operación se rechaza y el saldo no cambia

#### Scenario: Consumo desde la retícula de registro rápido

- **WHEN** una persona activa el destino Consumo, elige un insumo sin variantes, escribe la cantidad y confirma
- **THEN** el consumo queda registrado en tres interacciones dentro del diálogo

#### Scenario: Registro rápido de un ítem con variantes

- **WHEN** una persona activa el destino Consumo, elige un filamento, elige «Rojo», escribe la cantidad y confirma
- **THEN** el consumo queda registrado para Rojo en cuatro interacciones dentro del diálogo

#### Scenario: Consumo desde un pedido

- **WHEN** una persona registra un consumo desde el detalle de un pedido
- **THEN** la nota llega prellenada con la referencia del pedido, es modificable y el movimiento queda con origen `manual`

#### Scenario: Varios insumos para el mismo pedido

- **WHEN** se registran tres consumos de insumos distintos desde el mismo pedido
- **THEN** los tres quedan guardados, sin que ninguno impida al siguiente

#### Scenario: El ayudante registra consumo

- **WHEN** un ayudante registra un consumo de un insumo
- **THEN** el movimiento queda guardado con él como autor

### Requirement: El ajuste por conteo no pide justificación

El sistema SHALL ofrecer un ajuste por conteo físico que pregunte únicamente cuánto hay. SHALL calcular la diferencia contra el saldo derivado y SHALL guardar un único movimiento de tipo ajuste con origen `count`, dejando el saldo exactamente en la cantidad contada. SHALL NOT exigir motivo, justificación ni categoría de merma; una nota SHALL estar disponible y SHALL ser opcional. El movimiento SHALL registrar quién lo hizo y cuándo.

Cuando el ítem tiene variantes vigentes, el conteo SHALL hacerse **por variante**: SHALL abrirse desde la fila de una variante con la variante puesta, SHALL mostrar el saldo de esa variante, SHALL calcular la diferencia contra ese saldo y SHALL guardar el ajuste con esa variante. El servidor SHALL rechazar un ajuste sin variante de un ítem con variantes vigentes. La fila «Sin variante» SHALL admitir un conteo, que la lleva al valor contado —normalmente cero— con un ajuste sin variante.

#### Scenario: El saldo pasa al valor contado

- **GIVEN** un insumo con saldo derivado 65
- **WHEN** una persona registra un conteo de 60
- **THEN** el saldo pasa a 60 y queda un movimiento de ajuste de −5

#### Scenario: Conteo por encima del saldo

- **GIVEN** un insumo con saldo derivado 60
- **WHEN** una persona registra un conteo de 72
- **THEN** el saldo pasa a 72 y queda un movimiento de ajuste de +12

#### Scenario: No se pide explicación

- **WHEN** una persona abre el ajuste por conteo
- **THEN** el único dato obligatorio es la cantidad contada, y ningún campo de motivo bloquea el guardado

#### Scenario: El conteo queda atribuido

- **WHEN** se consulta un movimiento de ajuste por conteo
- **THEN** muestra quién lo registró y cuándo

#### Scenario: Conteo que coincide con el saldo

- **GIVEN** un insumo con saldo derivado 60
- **WHEN** una persona registra un conteo de 60
- **THEN** no se guarda ningún movimiento y la interfaz lo dice sin presentarlo como un fallo

#### Scenario: Conteo de una variante

- **GIVEN** un filamento con Negro en 1,5 y Rojo en 0,8
- **WHEN** una persona cuenta 1,2 desde la fila Negro
- **THEN** queda un ajuste de −0,3 para Negro, Negro pasa a 1,2 y Rojo sigue en 0,8

#### Scenario: El servidor rechaza el conteo sin variante

- **WHEN** llega al servidor un ajuste sin variante de un ítem que tiene variantes vigentes
- **THEN** la operación se rechaza y el saldo no cambia

#### Scenario: Poner en cero lo que no tiene variante

- **GIVEN** un filamento con una fila «Sin variante» de −0,4
- **WHEN** una persona cuenta 0 desde esa fila
- **THEN** queda un ajuste sin variante de +0,4 y la fila «Sin variante» deja de aparecer

### Requirement: El detalle del insumo muestra saldo, movimientos y evolución de precios

El detalle de un ítem de tipo insumo SHALL presentar tres secciones además de las que ya tiene: el **saldo** derivado con su mínimo y su estado respecto de él, junto a las acciones de registrar consumo y de ajuste por conteo; los **movimientos**, con cantidad, origen, autor, variante cuando la tienen y fecha, en orden descendente por fecha del hecho; y la **evolución de precios de compra**, con el último costo conocido y los precios pagados. Cuando el insumo tiene variantes, la sección de saldo SHALL mostrar además el saldo de cada variante —y la fila «Sin variante» cuando existe— con la unidad del ítem, y cada fila SHALL ofrecer registrar consumo y ajuste por conteo de esa variante; el ajuste por conteo del ítem completo SHALL NOT ofrecerse en ese caso. La sección de evolución de precios SHALL ser visible únicamente para la persona dueña, y el recorte SHALL producirse en la fuente de datos y no por una condición en la interfaz. Las tres secciones SHALL NOT aparecer para ítems de tipo producto o activo.

#### Scenario: Las tres secciones en un insumo

- **WHEN** la persona dueña abre el detalle de un insumo
- **THEN** ve el saldo con su mínimo, la lista de movimientos y la evolución de precios de compra

#### Scenario: Disponibilidad por variante en el detalle

- **WHEN** una persona abre el detalle de un filamento con Negro en 1,5 kg y Rojo en 0,8 kg
- **THEN** la sección de saldo muestra el total 2,3 kg y una fila por variante con su saldo, cada una con sus acciones de consumo y conteo

#### Scenario: Un insumo con variantes no se cuenta entero

- **WHEN** una persona abre el detalle de un insumo con variantes vigentes
- **THEN** no se ofrece el ajuste por conteo del ítem completo, solo el de cada variante

#### Scenario: El historial explica un número que no cuadra

- **WHEN** una persona revisa la sección de movimientos de un insumo
- **THEN** ve cada entrada, consumo y ajuste con su cantidad, su origen, su autor, su variante cuando la tiene y su fecha

#### Scenario: El ayudante no ve precios de compra

- **WHEN** un ayudante abre el detalle de un insumo
- **THEN** ve el saldo y los movimientos, y no ve ninguna sección ni cifra de precios de compra

#### Scenario: Tampoco por consulta directa

- **WHEN** un ayudante consulta directamente la fuente derivada del último costo de un ítem
- **THEN** obtiene cero filas

#### Scenario: Un producto no tiene secciones de inventario

- **WHEN** se abre el detalle de un ítem de tipo producto
- **THEN** no aparecen las secciones de saldo ni de movimientos
