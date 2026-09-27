# fair-mode Specification

## Purpose

La venta que no pasa por ningún pedido: feria y mostrador. Registra una venta directa con su cobro en menos de quince segundos, con o sin señal, en una pantalla donde ningún toque accidental puede sacar a quien vende del puesto.

> Origen: `specs/PRD/kamay-backlog.md` — KAM-12; `specs/PRD/kamay-esquema-base-de-datos-supabase.md` §9 (una sola tabla `orders` con `kind`), § Vistas derivadas; `specs/PRD/kamay-especificacion-producto-v6.md` — V6 🔑, principio de captura sin conexión, flujos B y E; `specs/PRD/kamay-mapa-navegacion-ui.md` §4.3 (el modo feria); `specs/PRD/ARCHITECTURE.md` (grupo de rutas `(fair)`; convención 5: los estados se comparan por `kind`; convención 9: `uuid` de cliente y `occurred_at` del hecho).

## Requirements

### Requirement: La venta directa es un pedido de tipo `direct_sale` nacido en estado final

El sistema SHALL almacenar cada venta de feria o mostrador como una fila de `orders` con `kind = 'direct_sale'`, sin crear ninguna tabla ni ningún concepto nuevo. La venta SHALL nacer en el estado de tipo `final` de menor posición del juego de estados resuelto para su línea y el flujo `order`, decidido por la base de datos y no por la interfaz: una venta directa no recorre ningún ciclo de producción. El cliente SHALL ser opcional. La línea de negocio SHALL ser obligatoria y el canal de venta SHALL guardarse cuando esté definido.

#### Scenario: Nace en el estado final de su línea

- **WHEN** se registra una venta directa en una línea cuyo juego tiene como estado de tipo `final` uno llamado «Entregado»
- **THEN** la venta queda en ese estado, y no en el de tipo `initial`

#### Scenario: Renombrar el estado final no cambia el comportamiento

- **WHEN** el dueño renombra el estado de tipo `final` de la línea y luego se registra una venta
- **THEN** la venta queda igualmente en el estado de tipo `final`, ahora con su nombre nuevo

#### Scenario: Venta sin cliente

- **WHEN** se registra una venta directa sin elegir cliente
- **THEN** la venta se guarda con `contact_id` nulo y la operación se acepta

#### Scenario: Venta con cliente

- **WHEN** se registra una venta directa eligiendo un cliente del directorio
- **THEN** la venta queda asociada a ese contacto y aparece en su historial

#### Scenario: La línea sigue siendo obligatoria

- **WHEN** se intenta registrar una venta directa sin línea de negocio
- **THEN** la operación se rechaza

#### Scenario: Numerada como cualquier pedido

- **WHEN** se registra una venta directa en una organización cuyo último número visible es 41
- **THEN** la venta recibe el número 42 y ningún pedido posterior lo reutiliza

### Requirement: La venta y su cobro se registran en una sola operación

El sistema SHALL registrar la venta, sus líneas y su movimiento de cobro en **una única operación de base de datos**: si cualquier parte falla, no SHALL persistir ni la venta, ni ninguna línea, ni ningún cobro. La operación SHALL rechazar una venta sin líneas. Los identificadores de la venta, de cada línea y del cobro SHALL poder generarse en el cliente, y `occurred_at` SHALL fijarlo el cliente con la hora real del hecho mientras `created_at` lo fija el servidor. El movimiento de cobro SHALL ser un cobro ordinario contra la venta, indistinguible en su tabla de un cobro registrado sobre un pedido.

#### Scenario: Venta cobrada en el acto

- **WHEN** se confirma una venta de dos productos por 115 cobrando el total
- **THEN** existen la venta, sus dos líneas y un cobro de 115 contra ella, y `order_totals` devuelve `total = 115` y `paid = 115`

#### Scenario: Un fallo deja todo como estaba

- **WHEN** la operación falla al guardar el cobro
- **THEN** no existe ninguna venta nueva, ninguna línea nueva ni ningún cobro nuevo

#### Scenario: Venta sin líneas

- **WHEN** se invoca la operación con la lista de líneas vacía
- **THEN** la operación se rechaza y no persiste nada

#### Scenario: Cobro parcial

- **WHEN** se confirma una venta de 115 cobrando 80
- **THEN** la venta queda registrada con `paid = 80` y su saldo pendiente derivado es 35

#### Scenario: Venta sin cobro

- **WHEN** se confirma una venta sin registrar cobro
- **THEN** la venta existe con `paid = 0` y su saldo pendiente es el total

#### Scenario: La hora real es la del hecho

- **WHEN** se registra una venta a las 15:40 sin señal y se sincroniza a las 21:00
- **THEN** `occurred_at` de la venta y de su cobro es 15:40 y `created_at` es 21:00

#### Scenario: Registro en la bitácora

- **WHEN** se confirma una venta de dos productos con cobro
- **THEN** la bitácora contiene el alta de la venta, la de cada línea y la del cobro

### Requirement: El modo feria no ofrece ningún elemento de navegación tocable salvo la salida

El modo feria SHALL presentarse en su propio grupo de rutas, con un layout sin barra superior, sin barra inferior, sin menú lateral y sin botón flotante de registro. El único control de navegación alcanzable SHALL ser *Salir del modo feria*, situado de forma explícita y separada de los controles de venta, que devuelve a la pantalla de registro rápido. Entrar al modo SHALL ser siempre una acción explícita del usuario.

#### Scenario: Ningún elemento de navegación

- **WHEN** se abre el modo feria
- **THEN** no existe en la pantalla ningún enlace, pestaña, barra ni botón de navegación tocable salvo el control de salida

#### Scenario: Salida explícita

- **WHEN** se activa *Salir del modo feria*
- **THEN** la aplicación vuelve a la pantalla de registro rápido con su cascarón habitual

#### Scenario: El control de salida no se confunde con el de cobro

- **WHEN** se observa la pantalla con productos en el carrito
- **THEN** el control de salida y el control de cobro están separados y no son adyacentes

#### Scenario: Entrada explícita

- **WHEN** se navega por la aplicación sin activar el modo feria
- **THEN** ninguna acción lleva al modo feria sin que el usuario lo pida

### Requirement: Cuadrícula de productos vendibles ordenada por más vendidos

La cuadrícula SHALL mostrar los ítems de tipo producto no archivados, con el ajuste «Mostrar en venta rápida» activado, que pertenecen a la línea de la feria o que son compartidos y tienen precio de venta definido. Cuando la organización tiene encendida la bandera «Venta rápida con todas las líneas», la cuadrícula SHALL mostrar además, con los mismos filtros, los productos de todas las demás líneas **activas** de la organización, y SHALL NOT mostrar los de líneas archivadas; cada tarjeta SHALL mostrar el nombre de la línea del producto, o «Compartido» si no tiene. Cada producto SHALL mostrarse en una tarjeta con su foto vigente como miniatura a la izquierda —o un sustituto del mismo tamaño cuando no la tenga o no se pueda cargar—, y a la derecha su nombre, su precio, un selector de cantidad y el botón *Agregar*. La foto vigente de un producto SHALL ser la más reciente de las suyas no archivadas. SHALL ordenarlos por cantidad vendida en los últimos 90 días dentro de la línea —o en toda la organización, con la bandera encendida—, de mayor a menor, y colocar después, por nombre, los que no registran ventas. Los objetivos táctiles SHALL ser alcanzables con el pulgar en una pantalla de 390 px de ancho, sin desplazamiento horizontal. Cuando la línea no tiene ningún producto que mostrar, la cuadrícula SHALL explicar que hacen falta productos con precio de venta y con «Mostrar en venta rápida» activado.

#### Scenario: Orden por ventas recientes

- **WHEN** un producto vendió 30 unidades en los últimos 90 días y otro vendió 4
- **THEN** el primero aparece antes que el segundo en la cuadrícula

#### Scenario: Producto sin ventas

- **WHEN** un producto vendible no registra ninguna venta en los últimos 90 días
- **THEN** aparece después de todos los que sí registran ventas, ordenado por nombre

#### Scenario: Producto sin precio de venta

- **WHEN** un producto no tiene precio de venta definido
- **THEN** no aparece en la cuadrícula

#### Scenario: Producto oculto de la venta rápida

- **WHEN** un producto con precio tiene el ajuste «Mostrar en venta rápida» desactivado
- **THEN** no aparece en la cuadrícula

#### Scenario: Insumos y activos fuera

- **WHEN** la organización tiene insumos y activos en su catálogo
- **THEN** ninguno aparece en la cuadrícula

#### Scenario: Producto archivado fuera

- **WHEN** un producto vendible se archiva
- **THEN** deja de aparecer en la cuadrícula

#### Scenario: Producto de otra línea

- **WHEN** la línea activa es Alfarería y existe un producto exclusivo de Sublimación
- **THEN** ese producto no aparece, y sí aparecen los productos compartidos

#### Scenario: Producto con foto

- **WHEN** un producto vendible tiene dos fotos
- **THEN** su tarjeta muestra la más reciente como miniatura a la izquierda del nombre y el precio

#### Scenario: Producto sin foto

- **WHEN** un producto vendible no tiene foto
- **THEN** aparece igualmente, con un sustituto del mismo tamaño que la miniatura, y se reconoce por su nombre

#### Scenario: Línea sin productos que mostrar

- **WHEN** todos los productos con precio de la línea tienen el ajuste desactivado
- **THEN** la cuadrícula explica que hacen falta productos con precio y con «Mostrar en venta rápida» activado

#### Scenario: Sin desplazamiento horizontal

- **WHEN** se abre el modo feria en una pantalla de 390 px de ancho
- **THEN** la cuadrícula, sus tarjetas con miniatura, selector y *Agregar*, y la barra inferior se completan sin desplazamiento horizontal

#### Scenario: Con la bandera, productos de todas las líneas

- **WHEN** la bandera está encendida, la feria se abrió en Alfarería y existe un producto vendible exclusivo de Sublimación
- **THEN** ese producto aparece en la cuadrícula, con «Sublimación» en su tarjeta, junto a los de Alfarería y los compartidos

#### Scenario: Con la bandera, nada de líneas archivadas

- **WHEN** la bandera está encendida y una línea archivada tiene productos vendibles
- **THEN** ninguno de ellos aparece en la cuadrícula

#### Scenario: Con la bandera, el orden es de toda la organización

- **WHEN** la bandera está encendida, una taza de Sublimación vendió 30 unidades en los últimos 90 días y una maceta de Alfarería vendió 4
- **THEN** la taza aparece antes que la maceta, aunque la feria se haya abierto en Alfarería

#### Scenario: Sin la bandera, nada cambia

- **WHEN** la bandera está apagada
- **THEN** la cuadrícula muestra solo los productos de la línea de la feria y los compartidos, sin el nombre de la línea en las tarjetas

### Requirement: Carrito y cobro en cuatro interacciones o menos

Tocar la tarjeta de un producto SHALL NOT agregarlo al carrito. Cada tarjeta SHALL ofrecer un selector de cantidad, que empieza en 1, baja con − sin pasar de 1 y sube con +, y un botón *Agregar* que suma esa cantidad al carrito —incrementando la línea si el producto ya estaba— sin abrir ningún diálogo, y devuelve el selector a 1. Una barra inferior fija SHALL mostrar en todo momento el número de unidades y el total del carrito, y ofrecer *Ver carrito*, que abre un panel lateral desde la derecha. El panel SHALL mostrar cada línea con su nombre, su precio unitario, su subtotal, controles − y + para cambiar su cantidad y un control para quitarla; el total; el monto a cobrar, propuesto como el total y editable; el método de pago; y *Registrar pedido*, que registra la venta con su cobro con un solo control. La elección de cliente SHALL ser opcional. Bajar con − la cantidad de una línea SHALL detenerse en 1; quitarla SHALL hacerse con su control propio. Una venta de dos productos distintos SHALL completarse en cuatro interacciones: *Agregar*, *Agregar*, *Ver carrito*, *Registrar pedido*.

#### Scenario: Venta de dos productos en cuatro interacciones

- **WHEN** se pulsa *Agregar* en dos productos distintos, luego *Ver carrito* y luego *Registrar pedido*
- **THEN** la venta queda registrada con sus dos líneas y su cobro, sin ninguna interacción adicional

#### Scenario: Tocar la tarjeta no agrega

- **WHEN** se toca la tarjeta de un producto fuera de su selector y de *Agregar*
- **THEN** el carrito no cambia

#### Scenario: Agregar varias unidades de una vez

- **WHEN** se sube el selector de un producto de 1 a 3 y se pulsa *Agregar*
- **THEN** el carrito tiene una línea de ese producto con cantidad 3, el total refleja el triple del precio y el selector vuelve a 1

#### Scenario: Tocar dos veces el mismo producto

- **WHEN** se pulsa *Agregar* dos veces en el mismo producto con el selector en 1
- **THEN** el carrito muestra una sola línea con cantidad 2 y el total refleja el doble del precio

#### Scenario: El selector no baja de 1

- **WHEN** se pulsa − en el selector de un producto que marca 1
- **THEN** el selector sigue en 1

#### Scenario: El total sigue al carrito

- **WHEN** se agregan productos, se cambian cantidades en el panel y se quitan líneas
- **THEN** la barra inferior y el panel muestran en todo momento el número de unidades y el total vigentes

#### Scenario: Cambiar la cantidad desde el panel

- **WHEN** en el panel se pulsa + en una línea de cantidad 2 y después − dos veces
- **THEN** la línea pasa a 3, luego a 2 y luego a 1, y el total se recalcula en cada paso

#### Scenario: La cantidad de una línea no baja de 1

- **WHEN** en el panel se pulsa − en una línea de cantidad 1
- **THEN** la línea sigue en el carrito con cantidad 1

#### Scenario: Quitar una línea

- **WHEN** se quita una línea desde el panel
- **THEN** el total se recalcula y la línea desaparece

#### Scenario: Cobrar con el carrito vacío

- **WHEN** el carrito no tiene ninguna línea
- **THEN** *Ver carrito* no está disponible, y si el panel está abierto porque se quitó la última línea, *Registrar pedido* no está disponible

#### Scenario: Monto propuesto

- **WHEN** se abre el panel con un carrito de 115
- **THEN** el monto propuesto es 115 y se puede registrar sin escribir nada

#### Scenario: El monto propuesto sigue a los cambios del panel

- **WHEN** con el panel abierto y el monto sin editar, se sube una línea y el total pasa de 115 a 150
- **THEN** el monto propuesto pasa a 150

#### Scenario: Precio del momento

- **WHEN** se vende un producto y después cambia su precio en el catálogo
- **THEN** la venta conserva el precio unitario con el que se registró

### Requirement: Vuelta inmediata a la cuadrícula tras cada venta

Registrado el pedido, el sistema SHALL cerrar el panel y devolver la pantalla a la cuadrícula con el carrito vacío y todos los selectores de cantidad en 1 en menos de un segundo, sin ninguna pantalla intermedia y sin esperar la respuesta del servidor. SHALL mostrar un mensaje breve de éxito que no bloquea la cuadrícula ni exige cerrarlo, y que desaparece solo. Cuando la venta quedó en cola por falta de conexión, el mensaje SHALL decir que se enviará al recuperar la señal.

#### Scenario: Retorno sin pantallas intermedias

- **WHEN** se registra un pedido
- **THEN** el panel se cierra y la pantalla vuelve a la cuadrícula en menos de un segundo, con el carrito vacío y sin ninguna pantalla de resumen

#### Scenario: Mensaje de éxito

- **WHEN** se registra un pedido con conexión
- **THEN** aparece un mensaje breve de éxito que desaparece solo, sin que haya que cerrarlo

#### Scenario: Mensaje de éxito sin señal

- **WHEN** se registra un pedido sin conexión
- **THEN** el mensaje de éxito indica que la venta se enviará al recuperar la señal

#### Scenario: La vista queda limpia

- **WHEN** se deja un producto con el selector en 4 sin agregarlo y se registra un pedido de otros productos
- **THEN** al volver a la cuadrícula todos los selectores están en 1

#### Scenario: No se espera al servidor

- **WHEN** se registra un pedido con la red degradada
- **THEN** la interfaz vuelve a la cuadrícula sin bloquearse a la espera de la respuesta

#### Scenario: Venta siguiente inmediata

- **WHEN** se registra un pedido y se pulsa *Agregar* en un producto mientras el mensaje de éxito sigue a la vista
- **THEN** ese producto entra en un carrito nuevo, sin rastro del anterior

### Requirement: Línea y canal se eligen una vez por feria, no en cada venta

Al entrar al modo feria el sistema SHALL fijar la línea de negocio y el canal de venta de toda la sesión, y SHALL mantenerlos en cada venta sin volver a preguntarlos. Con la bandera «Venta rápida con todas las líneas» encendida, la línea elegida SHALL ser aquella en la que se registran los productos compartidos, y el paso de inicio SHALL decirlo así; los demás productos se registran en su propia línea. La línea SHALL preseleccionarse desde la línea activa; cuando la línea activa es «Todas», el sistema SHALL exigir elegir una antes de mostrar la cuadrícula. El canal SHALL preseleccionarse al primero por posición de la organización y SHALL poder cambiarse en ese mismo paso de inicio, nunca durante la venta. La elección SHALL sobrevivir a cerrar y reabrir la aplicación dentro de la misma feria.

#### Scenario: Línea activa preseleccionada

- **WHEN** se entra al modo feria con la línea Alfarería activa
- **THEN** la cuadrícula muestra los productos de Alfarería y toda venta de la sesión queda en esa línea

#### Scenario: «Todas» exige elegir línea

- **WHEN** se entra al modo feria con la línea activa en «Todas»
- **THEN** el sistema pide elegir una línea antes de mostrar la cuadrícula

#### Scenario: Canal preseleccionado

- **WHEN** se entra al modo feria y se registran tres ventas
- **THEN** las tres quedan con el mismo canal de venta, sin haberlo elegido en ninguna

#### Scenario: Cambiar el canal al iniciar la feria

- **WHEN** en el paso de inicio se elige un canal distinto del preseleccionado
- **THEN** todas las ventas de la sesión quedan con el canal elegido

#### Scenario: El canal no se pregunta durante la venta

- **WHEN** se registran ventas consecutivas
- **THEN** ninguna pide línea ni canal

#### Scenario: Reabrir dentro de la misma feria

- **WHEN** se cierra la aplicación en modo feria y se vuelve a abrir
- **THEN** la línea y el canal de la sesión siguen fijados y la cuadrícula aparece sin volver a preguntarlos

#### Scenario: Con la bandera, la línea de la feria recibe los compartidos

- **WHEN** la bandera está encendida, la feria se abrió en Alfarería y se vende una bolsa de regalo compartida
- **THEN** la venta de la bolsa queda en la línea Alfarería

### Requirement: Vender sin conexión no falla ni duplica

El modo feria SHALL permitir registrar ventas con el dispositivo sin red, encolándolas localmente y confirmando en la interfaz sin error. SHALL sostener al menos veinte ventas seguidas sin degradación perceptible del tiempo de respuesta. Al recuperar la conexión, las ventas encoladas SHALL enviarse y producir **exactamente un registro por venta**, con su hora real y su cobro, sin duplicados aunque un envío se reintente. Ninguna venta SHALL perderse en silencio.

#### Scenario: Veinte ventas sin red

- **WHEN** se registran veinte ventas seguidas con la red desconectada
- **THEN** las veinte se confirman en la interfaz sin error y sin degradación perceptible

#### Scenario: Reconexión sin duplicados

- **WHEN** se recupera la conexión tras esas veinte ventas
- **THEN** existen exactamente veinte ventas en la base de datos, cada una con sus líneas, su cobro y su hora real, y ninguna repetida

#### Scenario: Reintento por fallo de red

- **WHEN** el envío de una venta se reintenta dos veces por un fallo de red
- **THEN** existe un solo registro de esa venta y un solo cobro

#### Scenario: La aplicación se cierra con ventas pendientes

- **WHEN** se cierra la aplicación con ventas sin sincronizar y se vuelve a abrir
- **THEN** las ventas siguen en la cola y se envían al recuperar la conexión

#### Scenario: Fallo permanente visible

- **WHEN** una venta encolada falla de forma permanente
- **THEN** se muestra al usuario con la opción de reintentarla o descartarla, y no desaparece en silencio

### Requirement: El modo feria abre sin red desde el catálogo capturado

Al entrar al modo feria **con conexión**, el sistema SHALL capturar y guardar localmente el catálogo vendible de la línea —incluida la miniatura de la foto vigente de cada producto—, la línea y el canal de la sesión, y el instante de la captura. Abrir el modo feria **sin conexión** SHALL mostrar la cuadrícula a partir de esa captura, con las miniaturas guardadas, no una página de sin conexión. Una miniatura que no se pudo guardar SHALL mostrarse como el sustituto, sin impedir abrir la feria ni vender. Guardar las miniaturas SHALL NOT retrasar la aparición de la cuadrícula. La cuadrícula SHALL indicar en todo momento de cuándo es el catálogo que está mostrando. Sin conexión y sin ninguna captura previa, el sistema SHALL decir explícitamente que hay que abrir la feria una vez con señal, y SHALL NOT mostrar una cuadrícula vacía sin explicación. Volver a entrar con conexión SHALL renovar la captura.

#### Scenario: Entrar con red captura el catálogo

- **WHEN** se entra al modo feria con conexión
- **THEN** el catálogo vendible de la línea con las miniaturas de sus productos, la línea, el canal y la hora de la captura quedan guardados localmente

#### Scenario: Abrir sin red tras haber entrado con red

- **WHEN** se cierra la aplicación, se pierde la señal y se vuelve a abrir el modo feria
- **THEN** aparece la cuadrícula con los productos capturados y sus miniaturas, y se puede vender

#### Scenario: Las miniaturas no caducan durante la feria

- **WHEN** se vende sin señal desde una captura hecha hace seis horas
- **THEN** los productos que tenían foto al capturar siguen mostrando su miniatura

#### Scenario: Una miniatura que no se pudo guardar

- **WHEN** la descarga de la miniatura de un producto falla al capturar
- **THEN** ese producto aparece con el sustituto y la feria abre y vende con normalidad

#### Scenario: La antigüedad del catálogo está a la vista

- **WHEN** se vende desde una captura hecha hace seis horas
- **THEN** la pantalla indica de cuándo es el catálogo mostrado

#### Scenario: Sin red y sin captura previa

- **WHEN** se abre el modo feria sin conexión y sin ninguna captura anterior
- **THEN** el sistema explica que hay que abrir la feria una vez con señal, y no muestra una cuadrícula vacía

#### Scenario: Volver a entrar con red renueva la captura

- **WHEN** se cambia el precio de un producto y su foto, y después se entra al modo feria con conexión
- **THEN** la captura se renueva y la cuadrícula muestra el precio nuevo y la foto nueva con la hora nueva

#### Scenario: Un cambio hecho sin señal no altera la captura

- **WHEN** un producto se archiva, o se oculta de la venta rápida, desde otro dispositivo mientras la feria está sin señal
- **THEN** la cuadrícula sigue mostrando el catálogo capturado, con su hora, hasta que se renueve con conexión

### Requirement: Indicador de ventas pendientes de sincronizar

El modo feria SHALL mostrar de forma persistente cuántas ventas quedan por sincronizar, sin ocupar ningún control de venta. El indicador SHALL aumentar al confirmar una venta sin conexión, disminuir a medida que se envían y llegar a cero cuando no queda ninguna pendiente. Un registro que genera varias ventas —un carrito con productos de varias líneas— SHALL contar tantas ventas como genera.

#### Scenario: Sube al vender sin conexión

- **WHEN** se registran tres ventas con la red desconectada
- **THEN** el indicador muestra tres ventas pendientes

#### Scenario: Llega a cero al sincronizar

- **WHEN** se recupera la conexión y se envían las ventas pendientes
- **THEN** el indicador llega a cero

#### Scenario: Sin pendientes

- **WHEN** todas las ventas están sincronizadas
- **THEN** el indicador no reclama atención ni ocupa espacio de los controles de venta

#### Scenario: Solo cuenta ventas

- **WHEN** hay un pedido encolado desde otra pantalla y dos ventas de feria pendientes
- **THEN** el indicador del modo feria muestra dos, no tres

#### Scenario: Reintentar y descartar desde la feria

- **WHEN** una venta encolada falla y se abre el indicador
- **THEN** se puede reintentarla o descartarla sin salir del modo feria

#### Scenario: Un carrito de dos líneas cuenta dos ventas

- **WHEN** con la bandera encendida y sin conexión se registra un carrito con productos de Alfarería y de Sublimación
- **THEN** el indicador aumenta en dos

### Requirement: Aislamiento y roles en el modo feria

El ayudante SHALL poder registrar ventas directas y sus cobros, porque atender un puesto de feria es parte de su trabajo. Ninguna venta SHALL ser visible ni modificable desde otra organización. Las ventas directas SHALL archivarse, nunca borrarse.

#### Scenario: El ayudante vende

- **WHEN** un ayudante registra una venta directa con su cobro
- **THEN** la operación se acepta y la venta queda a su nombre

#### Scenario: Miembro de otra organización

- **WHEN** un miembro de otra organización consulta las ventas directas
- **THEN** no obtiene ninguna fila

#### Scenario: Intento de borrado

- **WHEN** se intenta borrar una venta directa
- **THEN** la operación se rechaza, porque no existe política de borrado

#### Scenario: La cuadrícula no cruza organizaciones

- **WHEN** se abre el modo feria
- **THEN** la cuadrícula solo ofrece productos de la organización activa

### Requirement: Con todas las líneas, cada producto se registra en su línea

Con la bandera «Venta rápida con todas las líneas» encendida, registrar un carrito SHALL crear **una venta directa por cada línea** presente en él: cada producto en la línea a la que pertenece, y los productos compartidos en la línea de la feria. Un carrito cuyos productos van todos a la misma línea SHALL crear una sola venta, como sin la bandera. Todas las ventas de un mismo registro SHALL compartir canal, hora real del hecho y método de pago.

El monto cobrado SHALL repartirse entre las ventas en proporción al subtotal de cada una, redondeado a centavos, con la última venta —en el orden en que aparecen sus líneas en el carrito— absorbiendo la diferencia de redondeo, de modo que la suma de los cobros sea exactamente el monto cobrado. Una venta cuya parte sea cero SHALL registrarse sin cobro.

Todas las ventas de un registro SHALL guardarse en **una única operación de base de datos**: si cualquiera falla, no SHALL persistir ninguna. Sin conexión, el registro SHALL viajar en la cola como una sola entrada; reenviarla SHALL NOT crear ninguna venta, línea ni cobro de más. La vuelta a la cuadrícula y el mensaje de éxito SHALL comportarse igual que con una sola venta.

#### Scenario: Un carrito de dos líneas crea dos ventas

- **WHEN** con la bandera encendida se registran 2 tazas de Sublimación a 45 y 1 maceta de Alfarería a 60, cobrando el total de 150
- **THEN** existen dos ventas directas: una en Sublimación de 90 con un cobro de 90 y otra en Alfarería de 60 con un cobro de 60

#### Scenario: Un carrito de una línea crea una venta

- **WHEN** con la bandera encendida se registra un carrito cuyos productos son todos de Sublimación
- **THEN** existe una sola venta directa, en Sublimación

#### Scenario: Los compartidos van a la línea de la feria

- **WHEN** con la bandera encendida y la feria abierta en Alfarería se registran una taza de Sublimación y una bolsa compartida
- **THEN** la taza queda en una venta de Sublimación y la bolsa en una venta de Alfarería

#### Scenario: Cobro parcial repartido en proporción

- **WHEN** se registra un carrito con 90 de Sublimación y 60 de Alfarería cobrando 100
- **THEN** la venta de Sublimación recibe un cobro de 60 y la de Alfarería uno de 40, con el mismo método de pago

#### Scenario: El redondeo no pierde centavos

- **WHEN** se registra un carrito con tres líneas de 10 cada una cobrando 10
- **THEN** los cobros son 3.33, 3.33 y 3.34, y suman exactamente 10

#### Scenario: Sin cobro

- **WHEN** se registra un carrito de dos líneas con monto 0
- **THEN** existen las dos ventas y ninguna tiene cobro

#### Scenario: Todo o nada

- **WHEN** al registrar un carrito de dos líneas falla el guardado de la segunda venta
- **THEN** no existe ninguna de las dos ventas, ni sus líneas, ni sus cobros

#### Scenario: Reenvío sin duplicados

- **WHEN** el registro de un carrito de dos líneas hecho sin conexión se reenvía dos veces al volver la señal
- **THEN** existen exactamente dos ventas, cada una con sus líneas y su cobro, y ninguna repetida

#### Scenario: Misma hora y canal

- **WHEN** se registra un carrito de dos líneas a las 15:40 con el canal Feria
- **THEN** las dos ventas tienen `occurred_at` 15:40 y el canal Feria

#### Scenario: Cuatro interacciones con varias líneas

- **WHEN** con la bandera encendida se pulsa *Agregar* en un producto de Sublimación y en uno de Alfarería, luego *Ver carrito* y *Registrar pedido*
- **THEN** quedan registradas las dos ventas con sus cobros, sin ninguna interacción adicional
