## Purpose

La venta que no pasa por ningún pedido: feria y mostrador. Registra una venta directa con su cobro en menos de quince segundos, con o sin señal, en una pantalla donde ningún toque accidental puede sacar a quien vende del puesto.

## ADDED Requirements

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

La cuadrícula SHALL mostrar los ítems de tipo producto no archivados que pertenecen a la línea activa o que son compartidos y tienen precio de venta definido, cada uno con su foto —o un sustituto legible cuando no la tenga—, su nombre y su precio. SHALL ordenarlos por cantidad vendida en los últimos 90 días dentro de la línea, de mayor a menor, y colocar después, por nombre, los que no registran ventas. Los objetivos táctiles SHALL ser alcanzables con el pulgar en una pantalla de 390 px de ancho, sin desplazamiento horizontal.

#### Scenario: Orden por ventas recientes

- **WHEN** un producto vendió 30 unidades en los últimos 90 días y otro vendió 4
- **THEN** el primero aparece antes que el segundo en la cuadrícula

#### Scenario: Producto sin ventas

- **WHEN** un producto vendible no registra ninguna venta en los últimos 90 días
- **THEN** aparece después de todos los que sí registran ventas, ordenado por nombre

#### Scenario: Producto sin precio de venta

- **WHEN** un producto no tiene precio de venta definido
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

#### Scenario: Producto sin foto

- **WHEN** un producto vendible no tiene foto
- **THEN** aparece igualmente, con un sustituto que permite reconocerlo por su nombre

#### Scenario: Sin desplazamiento horizontal

- **WHEN** se abre el modo feria en una pantalla de 390 px de ancho
- **THEN** la cuadrícula y la barra inferior se completan sin desplazamiento horizontal

### Requirement: Carrito y cobro en cuatro interacciones o menos

Tocar un producto SHALL agregarlo al carrito e incrementar su cantidad si ya estaba, sin abrir ningún diálogo. Una barra inferior fija SHALL mostrar en todo momento el número de unidades y el total del carrito, y ofrecer *Cobrar*. La hoja de cobro SHALL proponer el total como monto por omisión, permitir editarlo, elegir método y elegir cliente de forma opcional, y confirmarse con un solo control. Una venta de dos productos distintos SHALL completarse en cuatro interacciones: producto, producto, *Cobrar*, *Confirmar*. El carrito SHALL permitir quitar una línea o vaciarse, sin que esas acciones formen parte del recorrido mínimo.

#### Scenario: Venta de dos productos en cuatro interacciones

- **WHEN** se tocan dos productos distintos, luego *Cobrar* y luego *Confirmar*
- **THEN** la venta queda registrada con sus dos líneas y su cobro, sin ninguna interacción adicional

#### Scenario: Tocar dos veces el mismo producto

- **WHEN** se toca el mismo producto dos veces
- **THEN** el carrito muestra una sola línea con cantidad 2 y el total refleja el doble del precio

#### Scenario: El total sigue al carrito

- **WHEN** se agregan y se quitan productos
- **THEN** la barra inferior muestra en todo momento el número de unidades y el total vigentes

#### Scenario: Cobrar con el carrito vacío

- **WHEN** el carrito no tiene ninguna línea
- **THEN** *Cobrar* no está disponible

#### Scenario: Monto propuesto

- **WHEN** se abre la hoja de cobro con un carrito de 115
- **THEN** el monto propuesto es 115 y se puede confirmar sin escribir nada

#### Scenario: Precio del momento

- **WHEN** se vende un producto y después cambia su precio en el catálogo
- **THEN** la venta conserva el precio unitario con el que se registró

#### Scenario: Quitar una línea

- **WHEN** se quita una línea del carrito
- **THEN** el total se recalcula y la línea desaparece

### Requirement: Vuelta inmediata a la cuadrícula tras cada venta

Confirmada la venta, el sistema SHALL devolver la pantalla a la cuadrícula con el carrito vacío en menos de un segundo, sin ninguna pantalla intermedia de confirmación y sin esperar la respuesta del servidor. La confirmación al usuario SHALL ser una señal breve que no interrumpe la siguiente venta.

#### Scenario: Retorno sin pantallas intermedias

- **WHEN** se confirma una venta
- **THEN** la pantalla vuelve a la cuadrícula en menos de un segundo, con el carrito vacío y sin ninguna pantalla de resumen

#### Scenario: No se espera al servidor

- **WHEN** se confirma una venta con la red degradada
- **THEN** la interfaz vuelve a la cuadrícula sin bloquearse a la espera de la respuesta

#### Scenario: Venta siguiente inmediata

- **WHEN** se confirma una venta y se toca un producto en cuanto vuelve la cuadrícula
- **THEN** ese producto entra en un carrito nuevo, sin rastro del anterior

### Requirement: Línea y canal se eligen una vez por feria, no en cada venta

Al entrar al modo feria el sistema SHALL fijar la línea de negocio y el canal de venta de toda la sesión, y SHALL mantenerlos en cada venta sin volver a preguntarlos. La línea SHALL preseleccionarse desde la línea activa; cuando la línea activa es «Todas», el sistema SHALL exigir elegir una antes de mostrar la cuadrícula. El canal SHALL preseleccionarse al primero por posición de la organización y SHALL poder cambiarse en ese mismo paso de inicio, nunca durante la venta. La elección SHALL sobrevivir a cerrar y reabrir la aplicación dentro de la misma feria.

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

Al entrar al modo feria **con conexión**, el sistema SHALL capturar y guardar localmente el catálogo vendible de la línea, la línea y el canal de la sesión, y el instante de la captura. Abrir el modo feria **sin conexión** SHALL mostrar la cuadrícula a partir de esa captura, no una página de sin conexión. La cuadrícula SHALL indicar en todo momento de cuándo es el catálogo que está mostrando. Sin conexión y sin ninguna captura previa, el sistema SHALL decir explícitamente que hay que abrir la feria una vez con señal, y SHALL NOT mostrar una cuadrícula vacía sin explicación. Volver a entrar con conexión SHALL renovar la captura.

#### Scenario: Entrar con red captura el catálogo

- **WHEN** se entra al modo feria con conexión
- **THEN** el catálogo vendible de la línea, la línea, el canal y la hora de la captura quedan guardados localmente

#### Scenario: Abrir sin red tras haber entrado con red

- **WHEN** se cierra la aplicación, se pierde la señal y se vuelve a abrir el modo feria
- **THEN** aparece la cuadrícula con los productos capturados y se puede vender

#### Scenario: La antigüedad del catálogo está a la vista

- **WHEN** se vende desde una captura hecha hace seis horas
- **THEN** la pantalla indica de cuándo es el catálogo mostrado

#### Scenario: Sin red y sin captura previa

- **WHEN** se abre el modo feria sin conexión y sin ninguna captura anterior
- **THEN** el sistema explica que hay que abrir la feria una vez con señal, y no muestra una cuadrícula vacía

#### Scenario: Volver a entrar con red renueva la captura

- **WHEN** se cambia el precio de un producto y después se entra al modo feria con conexión
- **THEN** la captura se renueva y la cuadrícula muestra el precio nuevo con la hora nueva

#### Scenario: Un cambio hecho sin señal no altera la captura

- **WHEN** un producto se archiva desde otro dispositivo mientras la feria está sin señal
- **THEN** la cuadrícula sigue mostrando el catálogo capturado, con su hora, hasta que se renueve con conexión

### Requirement: Indicador de ventas pendientes de sincronizar

El modo feria SHALL mostrar de forma persistente cuántas ventas quedan por sincronizar, sin ocupar ningún control de venta. El indicador SHALL aumentar al confirmar una venta sin conexión, disminuir a medida que se envían y llegar a cero cuando no queda ninguna pendiente.

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
