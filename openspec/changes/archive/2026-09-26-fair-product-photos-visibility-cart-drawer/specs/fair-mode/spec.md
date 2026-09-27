## MODIFIED Requirements

### Requirement: Cuadrícula de productos vendibles ordenada por más vendidos

La cuadrícula SHALL mostrar los ítems de tipo producto no archivados, con el ajuste «Mostrar en venta rápida» activado, que pertenecen a la línea activa o que son compartidos y tienen precio de venta definido. Cada producto SHALL mostrarse en una tarjeta con su foto vigente como miniatura a la izquierda —o un sustituto del mismo tamaño cuando no la tenga o no se pueda cargar—, y a la derecha su nombre, su precio, un selector de cantidad y el botón *Agregar*. La foto vigente de un producto SHALL ser la más reciente de las suyas no archivadas. SHALL ordenarlos por cantidad vendida en los últimos 90 días dentro de la línea, de mayor a menor, y colocar después, por nombre, los que no registran ventas. Los objetivos táctiles SHALL ser alcanzables con el pulgar en una pantalla de 390 px de ancho, sin desplazamiento horizontal. Cuando la línea no tiene ningún producto que mostrar, la cuadrícula SHALL explicar que hacen falta productos con precio de venta y con «Mostrar en venta rápida» activado.

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
