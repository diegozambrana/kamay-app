## ADDED Requirements

### Requirement: Tablero con todas las líneas agrupado por tipo de estado

Cuando la línea activa es «Todas», el tablero de pedidos SHALL mostrar los pedidos de todas las líneas activas —con los mismos filtros, exclusiones y ventana de cerrados que las vistas de lista y calendario— en columnas comunes, una por **tipo** de estado, en este orden: `initial`, `in_progress`, `waiting`, `final`, `cancelled`. Cada pedido SHALL aparecer en la columna del tipo de su estado actual. El tablero SHALL NOT pedir elegir una línea para mostrar pedidos. Los títulos de estas columnas SHALL ser fijos por tipo (Por empezar, En curso, En espera, Terminados, Cancelados) y cada tarjeta SHALL mostrar además el nombre de su estado real y el color de su línea.

Mover un pedido a una columna SHALL asignarle el primer estado —en el orden declarado— de ese tipo dentro del juego resuelto de **su** línea para el flujo `order`. Si ese juego no tiene ningún estado de ese tipo, la columna SHALL NOT aceptar el pedido —ni por arrastre ni en el menú «Mover a…»— y la tarjeta SHALL quedarse donde estaba. Mover un pedido a la columna de su propio tipo SHALL NOT cambiar su estado. En este modo SHALL NOT ofrecerse el reordenamiento de colas ni la numeración de posición en cola, que siguen disponibles con una línea concreta activa. Las reglas de «Mover un pedido de estado» (reflejo inmediato, reversión con error, bitácora) SHALL aplicarse igual.

Con una línea concreta activa, el tablero SHALL seguir construyendo sus columnas desde el juego de estados de esa línea, sin cambios.

#### Scenario: «Todas» muestra los pedidos de todas las líneas

- **GIVEN** un pedido de Sublimación en un estado de tipo `in_progress` y uno de Alfarería en un estado de tipo `initial`
- **WHEN** se abre el tablero con «Todas» activa
- **THEN** ambos pedidos aparecen, el de Sublimación en la columna «En curso» y el de Alfarería en «Por empezar», cada uno con el nombre de su estado y el color de su línea

#### Scenario: Las columnas son los tipos, no los estados

- **WHEN** se abre el tablero con «Todas» activa en una organización cuyas líneas tienen juegos de seis y de tres estados
- **THEN** el tablero muestra exactamente cinco columnas, una por tipo, en el orden `initial`, `in_progress`, `waiting`, `final`, `cancelled`

#### Scenario: Mover al primer estado de ese tipo en la línea del pedido

- **GIVEN** la línea Sublimación con dos estados de tipo `in_progress`, «Diseño» y luego «Impresión»
- **WHEN** con «Todas» activa se arrastra un pedido de Sublimación en estado `initial` a la columna «En curso»
- **THEN** el pedido pasa a «Diseño» y la bitácora registra el cambio

#### Scenario: La línea del pedido no tiene ese tipo

- **GIVEN** la línea Alfarería sin ningún estado de tipo `waiting`
- **WHEN** con «Todas» activa se intenta mover un pedido de Alfarería a la columna «En espera»
- **THEN** el menú «Mover a…» de esa tarjeta no ofrece «En espera», el arrastre no cambia el estado y el pedido sigue en su columna

#### Scenario: Soltar en la misma columna no cambia nada

- **GIVEN** un pedido en «Impresión», de tipo `in_progress`
- **WHEN** con «Todas» activa se suelta en la columna «En curso»
- **THEN** su estado sigue siendo «Impresión» y no se registra ningún cambio

#### Scenario: Sin reordenamiento de cola con «Todas»

- **WHEN** se abre el tablero con «Todas» activa
- **THEN** las tarjetas no muestran número de posición en cola y soltar una tarjeta sobre otra de la misma columna no reordena nada

#### Scenario: Una línea concreta conserva su tablero

- **WHEN** se elige Sublimación en el selector estando en el tablero
- **THEN** el tablero vuelve a mostrar las columnas del juego de Sublimación, con su cola ordenable

### Requirement: Guardar vuelve a la lista y Guardar y crear otro sigue en el formulario

Al pulsar «Guardar» en el alta, el sistema SHALL guardar el pedido y volver a la pantalla de pedidos —con la vista y los filtros con que se abrió el formulario, o la vista por omisión si no se llegó desde allí— mostrando una confirmación con el número del pedido guardado. Al pulsar «Guardar y crear otro», el sistema SHALL guardar el pedido, mostrar una confirmación con su número, y dejar el formulario en blanco conservando únicamente la línea de negocio y el canal de venta elegidos, listo para el siguiente pedido.

Sin conexión, ambas acciones SHALL confirmar igualmente y SHALL NOT mostrar error: el pedido queda en la cola de registros pendientes. Como el número visible lo asigna la base de datos, un pedido aún no sincronizado SHALL presentarse como pendiente de sincronizar en lugar de con un número, y SHALL mostrar su número en cuanto llegue al servidor. Sin conexión, «Guardar» SHALL NOT navegar a otra pantalla —que no se puede servir sin red— sino dejar el formulario listo para el registro siguiente, con la confirmación a la vista.

Si el pedido se guardó pero alguna imagen no pudo subirse, el formulario SHALL quedarse abierto con el aviso, como hasta ahora, para que la persona decida.

#### Scenario: Guardar vuelve a la lista

- **WHEN** el usuario pulsa «Guardar» con un pedido válido
- **THEN** navega a la pantalla de pedidos, que muestra la confirmación con el número del pedido recién creado y el pedido entre los listados

#### Scenario: Guardar conserva la vista de origen

- **WHEN** el usuario abre «Nuevo pedido» desde la vista de lista con un filtro de búsqueda aplicado y pulsa «Guardar»
- **THEN** vuelve a la vista de lista con el mismo filtro aplicado

#### Scenario: Guardar sin vista de origen

- **WHEN** el usuario abre `/orders/new` directamente, sin venir de la pantalla de pedidos, y pulsa «Guardar»
- **THEN** navega a la pantalla de pedidos en su vista por omisión

#### Scenario: Guardar y crear otro conserva línea y canal

- **WHEN** el usuario tiene línea Sublimación y canal WhatsApp, un cliente, dos líneas y una nota, y pulsa «Guardar y crear otro»
- **THEN** el pedido se guarda, se muestra su número, y el formulario queda sin cliente, sin líneas, sin nota, sin fecha y sin adjuntos, pero con Sublimación y WhatsApp aún seleccionados

#### Scenario: El pedido guardado existe

- **WHEN** el usuario pulsa «Guardar y crear otro» y luego abre el tablero
- **THEN** el pedido guardado aparece en la columna inicial de su línea

#### Scenario: Guardar sin conexión

- **GIVEN** un dispositivo sin red
- **WHEN** el usuario pulsa «Guardar» con un pedido válido
- **THEN** el pedido se confirma sin ningún error, se presenta como pendiente de sincronizar y sin número, el indicador de pendientes aumenta en uno, y el formulario queda listo para el registro siguiente en lugar de navegar a una pantalla que la red no puede entregar

#### Scenario: Guardar y crear otro sin conexión

- **GIVEN** un dispositivo sin red
- **WHEN** el usuario pulsa «Guardar y crear otro»
- **THEN** la confirmación aparece sin número, el formulario queda listo para el siguiente pedido conservando línea y canal, y ambos pedidos quedan pendientes

#### Scenario: El número aparece al sincronizar

- **GIVEN** un pedido guardado sin red y presentado como pendiente de sincronizar
- **WHEN** se recupera la conexión y el pedido llega al servidor
- **THEN** el pedido muestra su número visible y deja de figurar como pendiente

## MODIFIED Requirements

### Requirement: Confirmación antes de descartar

Si el formulario tiene datos escritos y el usuario intenta salir sin guardar —cancelar, volver, seguir una miga de pan, o abandonar la página— el sistema SHALL pedir confirmación antes de descartar. Si el formulario no tiene cambios, SHALL salir sin preguntar. Tras un guardado exitoso, la salida SHALL NOT pedir confirmación.

#### Scenario: Salir con datos escritos

- **WHEN** el usuario escribió una nota y pulsa «Cancelar»
- **THEN** se muestra una confirmación; al rechazarla sigue en el formulario con la nota intacta, y al aceptarla vuelve a la pantalla anterior sin guardar

#### Scenario: Seguir una miga de pan con datos escritos

- **WHEN** el usuario escribió una nota y pulsa la miga «Pedidos»
- **THEN** se muestra la misma confirmación; al aceptarla navega a la lista sin guardar

#### Scenario: Salir sin cambios

- **WHEN** el usuario abre el formulario y pulsa «Cancelar» sin escribir nada
- **THEN** vuelve a la pantalla anterior sin ninguna confirmación

#### Scenario: Salir tras guardar

- **WHEN** el usuario guarda con éxito
- **THEN** la navegación a la lista (alta) o al detalle (edición) ocurre sin confirmación de descarte

### Requirement: Edición de pedido

El sistema SHALL ofrecer una página de edición del pedido con los mismos campos que el alta —cliente, líneas, fecha comprometida, canal, modo de entrega, nota y adjuntos— salvo la línea de negocio, que SHALL mostrarse pero SHALL NOT poder cambiarse. El estado SHALL NOT editarse desde este formulario. Las líneas SHALL poder agregarse, modificarse en cantidad, precio y descripción, y quitarse. Los mismos mínimos obligatorios del alta SHALL aplicarse. Los cambios del pedido y de sus líneas SHALL guardarse en una única operación. Un pedido archivado SHALL NOT poder editarse: la página lo informa y no ofrece guardar. Todo cambio SHALL quedar en la bitácora.

Al pulsar «Guardar» con conexión, el sistema SHALL llevar al detalle del pedido y el detalle SHALL mostrar los cambios guardados. Esto SHALL cumplirse también cuando el envío tarda más que la espera corta con que el formulario confirma los registros: con conexión, el formulario SHALL esperar el resultado del envío antes de navegar, mostrando que está guardando, en lugar de quedarse en el formulario con el aviso de pendiente. Si el envío falla, el formulario SHALL quedarse abierto con el error y los datos escritos. Sin conexión, el formulario SHALL confirmar la edición como pendiente de sincronizar y SHALL NOT navegar, como en el alta. Si alguna imagen no pudo subirse, el formulario SHALL quedarse abierto con el aviso.

#### Scenario: Cambiar fecha y agregar una línea

- **WHEN** el usuario cambia la fecha comprometida y agrega una línea de 2 × 60 a un pedido cuyo total era 190, y guarda
- **THEN** navega al detalle, que muestra la fecha nueva, la línea nueva y un total de 310

#### Scenario: Quitar una línea

- **WHEN** el usuario quita una línea de 1 × 55 de un pedido con total 190 y guarda
- **THEN** el detalle ya no muestra esa línea y el total es 135

#### Scenario: Guardar con un envío lento lleva igual al detalle

- **GIVEN** un dispositivo con conexión en el que el envío de la edición tarda más que la espera corta del formulario
- **WHEN** el usuario cambia la nota y pulsa «Guardar»
- **THEN** el formulario indica que está guardando, y al confirmarse el envío navega al detalle, que muestra la nota nueva, sin aviso de pendiente de sincronizar

#### Scenario: Editar sin conexión

- **GIVEN** un dispositivo sin red
- **WHEN** el usuario cambia la nota y pulsa «Guardar»
- **THEN** la edición se confirma como pendiente de sincronizar, sin error, y el formulario sigue abierto

#### Scenario: La línea de negocio no se cambia

- **WHEN** el usuario abre la edición de un pedido de Sublimación
- **THEN** la línea de negocio se muestra como Sublimación y no es un campo editable

#### Scenario: No se puede dejar sin líneas

- **WHEN** el usuario quita todas las líneas e intenta guardar
- **THEN** el guardado se impide y el mensaje señala la sección de líneas

#### Scenario: El pedido archivado no se edita

- **WHEN** el usuario abre la edición de un pedido archivado
- **THEN** la página informa que está archivado, no ofrece guardar, y cualquier intento de escritura es rechazado por la base

#### Scenario: El ayudante edita

- **WHEN** un ayudante cambia la nota y la cantidad de una línea de un pedido de su organización
- **THEN** ambos cambios se guardan y la bitácora registra la edición

#### Scenario: Un fallo deja el pedido como estaba

- **WHEN** la operación de edición falla al guardar una de las líneas
- **THEN** el pedido conserva todos sus datos y líneas anteriores, sin cambios parciales, y el formulario sigue abierto con el error

## REMOVED Requirements

### Requirement: Guardar y Guardar y crear otro

**Reason**: «Guardar» en el alta deja de llevar al detalle del pedido creado y vuelve a la pantalla de pedidos con la vista de origen; el escenario «Guardar lleva al detalle» ya no describe el sistema.

**Migration**: Reemplazado por «Guardar vuelve a la lista y Guardar y crear otro sigue en el formulario», que conserva sin cambios «Guardar y crear otro», el comportamiento sin conexión y la sincronización del número.

