# inventory Specification

## Purpose

Permite saber qué insumo se está acabando sin exigir una disciplina de registro que nadie sostiene: el saldo se deriva de un documento inmutable de movimientos —entradas automáticas desde las compras, consumos rápidos y ajustes por conteo sin justificación— y solo se vuelve visible donde sirve para decidir.

> Origen: `specs/PRD/kamay-backlog.md` — KAM-18; `specs/PRD/kamay-esquema-base-de-datos-supabase.md` §10, §11, § Matriz de acceso; `specs/PRD/kamay-especificacion-producto-v6.md` — V11 y flujo F; `specs/PRD/kamay-mapa-navegacion-ui.md` §5 (Consumo y ajuste como diálogo).

## Requirements

### Requirement: Los movimientos de inventario son el único documento del saldo

El sistema SHALL registrar todo cambio de existencias en `inventory_movements` según el esquema canónico (§10): `organization_id`, `item_id`, `variant_id` opcional, `kind` restringido a `in`, `out` y `adjustment`, `quantity` con signo y distinta de cero, `source_type` restringido a `expense_item`, `order_item`, `manual` y `count`, `source_id`, `occurred_at`, `note`, `created_by` y `created_at`. El signo SHALL corresponder al tipo: una entrada SHALL llevar cantidad positiva, una salida SHALL llevar cantidad negativa y un ajuste SHALL admitir cualquiera de los dos signos. La tabla SHALL admitir clave primaria generada en el dispositivo y `occurred_at` fijado por el cliente.

#### Scenario: Tipo de movimiento fuera del juego permitido

- **WHEN** se intenta guardar un movimiento con un `kind` distinto de `in`, `out` o `adjustment`
- **THEN** la base de datos rechaza la operación

#### Scenario: Entrada con cantidad negativa

- **WHEN** se intenta guardar un movimiento de tipo entrada con cantidad negativa
- **THEN** la base de datos lo rechaza por la restricción que liga el signo al tipo

#### Scenario: Salida con cantidad positiva

- **WHEN** se intenta guardar un movimiento de tipo salida con cantidad positiva
- **THEN** la base de datos lo rechaza por la misma restricción

#### Scenario: Movimiento de cantidad cero

- **WHEN** se intenta guardar un movimiento con cantidad cero
- **THEN** la base de datos lo rechaza

#### Scenario: Ajuste en cualquiera de los dos sentidos

- **WHEN** se guarda un ajuste con cantidad positiva y otro con cantidad negativa
- **THEN** ambos se aceptan

### Requirement: Un movimiento no se edita, no se archiva y no se borra

El sistema SHALL tratar todo movimiento de inventario como definitivo: `inventory_movements` SHALL NOT tener columna de archivado, ningún rol autenticado SHALL poder modificar una fila existente y ningún rol SHALL poder eliminarla. Toda corrección SHALL expresarse como un movimiento nuevo, de modo que el error y su corrección queden ambos a la vista. La interfaz SHALL NOT ofrecer editar ni archivar un movimiento.

#### Scenario: Intento de editar un movimiento

- **WHEN** un miembro autenticado intenta modificar la cantidad de un movimiento ya guardado
- **THEN** la operación es rechazada y el movimiento queda intacto

#### Scenario: Intento de borrar un movimiento

- **WHEN** un miembro autenticado intenta eliminar un movimiento
- **THEN** la operación es rechazada

#### Scenario: Corregir es registrar de nuevo

- **WHEN** una persona detecta un consumo anotado dos veces y lo corrige
- **THEN** la corrección aparece como un movimiento nuevo y el consumo duplicado sigue visible en el historial

### Requirement: El saldo se deriva de los movimientos y nunca se almacena

El sistema SHALL exponer el saldo de cada insumo como valor derivado de la suma de sus movimientos, en una vista que SHALL declarar `security_invoker = true`. La vista SHALL cubrir únicamente los ítems de tipo insumo y SHALL exponer, por ítem, su saldo, su mínimo y si está por debajo de él. Ninguna columna de ninguna tabla SHALL almacenar el saldo, y la ausencia SHALL verificarse con una prueba automática que falle si alguien la añade. Un insumo sin ningún movimiento SHALL presentar saldo cero, no ausencia de dato.

#### Scenario: El saldo coincide con la suma manual

- **WHEN** un insumo tiene una entrada de 100, un consumo de 30 y un ajuste de −5
- **THEN** su saldo derivado es 65, igual que la suma directa de sus movimientos

#### Scenario: Insumo sin movimientos

- **WHEN** se consulta el saldo de un insumo que nunca se movió
- **THEN** su saldo es cero y el insumo aparece en el listado de saldos

#### Scenario: Ninguna columna guarda el saldo

- **WHEN** se inspeccionan las columnas de las tablas del catálogo y del inventario
- **THEN** no existe ninguna columna de saldo, existencias ni costo promedio

#### Scenario: Solo los insumos tienen saldo

- **WHEN** se consultan los saldos de una organización con insumos, productos y activos
- **THEN** solo aparecen los insumos

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

### Requirement: La misma compra sincronizada dos veces deja una sola entrada

El sistema SHALL garantizar en la base de datos que una línea de compra no pueda generar dos entradas de inventario, de modo que el reenvío de una compra encolada sin conexión —o cualquier otro reintento— deje exactamente un movimiento por línea. La segunda llegada SHALL NOT provocar un error visible para quien registró la compra.

#### Scenario: Compra reenviada tras una respuesta perdida

- **GIVEN** una compra cuya escritura llegó al servidor pero cuya respuesta no llegó al dispositivo
- **WHEN** la cola la reintenta
- **THEN** sigue existiendo una sola entrada de inventario por línea y el saldo no se duplica

#### Scenario: Dos reintentos, un solo movimiento

- **WHEN** el envío de la misma compra se reintenta dos veces
- **THEN** la base de datos conserva un movimiento por línea y la persona no ve ningún error

### Requirement: Archivar una compra no altera el inventario

El sistema SHALL conservar intactas las entradas de inventario de una compra archivada: archivar SHALL NOT eliminarlas, modificarlas ni generar automáticamente ningún movimiento compensatorio. Si además el insumo no entró al taller, la corrección SHALL hacerse con un ajuste por conteo registrado por una persona.

#### Scenario: Compra archivada, saldo intacto

- **WHEN** se archiva una compra que había generado entradas de inventario
- **THEN** el saldo de sus insumos no cambia y sus movimientos siguen listados

#### Scenario: Ningún movimiento aparece sin autor

- **WHEN** se revisan los movimientos de un insumo cuya compra fue archivada
- **THEN** cada movimiento listado corresponde a un hecho registrado, sin filas generadas por el archivado

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

### Requirement: El consumo y el ajuste se registran sin conexión

El sistema SHALL cubrir el registro de consumo y el ajuste por conteo con la captura sin conexión: sin red, la operación SHALL quedar en la cola local, la interfaz SHALL confirmarla sin error y el envío SHALL resolverse al recuperar la conexión. El identificador del movimiento SHALL generarse en el dispositivo y la hora del hecho SHALL ser la del dispositivo, no la de llegada al servidor.

#### Scenario: Consumo sin red

- **GIVEN** un dispositivo sin conexión
- **WHEN** una persona registra un consumo válido
- **THEN** queda guardado localmente, la interfaz lo confirma sin ningún error y la navegación continúa

#### Scenario: La hora es la del taller

- **WHEN** un consumo encolado a las 15:40 se sincroniza a las 18:00
- **THEN** el movimiento conserva las 15:40 como hora del hecho

#### Scenario: Reintento sin duplicar

- **WHEN** el envío de un consumo encolado se reintenta tras un fallo de red
- **THEN** existe exactamente un movimiento en la base de datos

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

### Requirement: El mínimo por insumo se declara y significa algo

El sistema SHALL permitir declarar un nivel mínimo por insumo desde el formulario del ítem, sin pantalla nueva. Un insumo cuyo saldo quede por debajo de su mínimo SHALL señalarse en la tarjeta *Insumos bajo mínimo* del panel principal y con un distintivo en su fila del catálogo. Un insumo sin mínimo declarado SHALL NOT aparecer nunca en la alerta. La tarjeta del panel SHALL respetar el selector de línea de negocio y SHALL conducir al detalle del insumo; SHALL NOT presentar cifras monetarias.

#### Scenario: Cruzar el mínimo enciende las dos alertas

- **GIVEN** un insumo con mínimo 10 y saldo 12
- **WHEN** se registra un consumo de 5
- **THEN** el insumo aparece en la tarjeta del panel y su fila del catálogo lleva el distintivo de bajo mínimo

#### Scenario: Volver por encima del mínimo apaga la alerta

- **WHEN** una compra devuelve el saldo del insumo por encima de su mínimo
- **THEN** deja de aparecer en la tarjeta del panel y su fila pierde el distintivo

#### Scenario: Insumo sin mínimo declarado

- **WHEN** un insumo sin mínimo llega a saldo cero
- **THEN** no aparece en la alerta

#### Scenario: La alerta respeta la línea activa

- **WHEN** el selector de línea está en Sublimación
- **THEN** la tarjeta lista los insumos bajo mínimo de esa línea y los compartidos, y ninguno exclusivo de otra línea

#### Scenario: De la alerta al insumo

- **WHEN** se activa un insumo de la tarjeta del panel
- **THEN** se abre el detalle de ese insumo

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

### Requirement: Aislamiento entre organizaciones del inventario

El inventario SHALL estar sujeto a RLS en su tabla y en su vista derivada. Un miembro SHALL leer y crear movimientos únicamente de su organización, y SHALL obtener cero filas de cualquier otra. La vista de saldos SHALL ejecutarse con los permisos de quien consulta. Un movimiento cuyo ítem pertenezca a otra organización SHALL ser rechazado.

#### Scenario: Movimientos de otra organización

- **WHEN** un miembro de la organización A consulta los movimientos de inventario
- **THEN** obtiene cero filas de la organización B

#### Scenario: Saldos de otra organización

- **WHEN** un miembro de la organización A consulta la vista de saldos
- **THEN** obtiene cero filas de la organización B

#### Scenario: Escritura cruzada

- **WHEN** un miembro de la organización A intenta registrar un movimiento sobre un ítem de la organización B
- **THEN** la operación es rechazada

### Requirement: Todo movimiento de inventario queda en la bitácora

El sistema SHALL registrar cada movimiento de inventario en la bitácora, con su autor y su hora, leyendo de ella todo lo que muestre «qué pasó aquí». SHALL NOT existir una segunda tabla de historial de inventario: la sección de movimientos del detalle es una lectura del propio documento, y el rastro de quién hizo qué vive en la bitácora única.

#### Scenario: El consumo queda registrado

- **WHEN** una persona registra un consumo
- **THEN** la bitácora recoge la creación del movimiento con su autor y su hora

#### Scenario: Una sola bitácora

- **WHEN** se inspeccionan las tablas del sistema
- **THEN** no existe ninguna tabla de historial propia del inventario

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
