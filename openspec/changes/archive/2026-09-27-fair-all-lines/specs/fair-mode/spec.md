## MODIFIED Requirements

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

## ADDED Requirements

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

