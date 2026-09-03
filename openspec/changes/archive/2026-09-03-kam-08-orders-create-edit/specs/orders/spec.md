> Origen: `specs/PRD/kamay-backlog.md` — KAM-08; `specs/PRD/kamay-especificacion-producto-v6.md` — V5 y §6.5; `specs/PRD/kamay-mapa-navegacion-ui.md` — §2.3 (pantalla completa móvil), §6 (Guardar / Guardar y crear otro), §8 (confirmación antes de descartar); `specs/PRD/kamay-esquema-base-de-datos-supabase.md` §2 (los precios históricos no se reescriben), §9, §13 (adjuntos); `specs/PRD/ARCHITECTURE.md` (convención 3: no se borra, se archiva; convención 4: nada derivado se almacena; convención 5: estados por `kind`; convención 9: UUID generables en el cliente).

## ADDED Requirements

### Requirement: Formulario de nuevo pedido (V5)

El sistema SHALL ofrecer una pantalla de nuevo pedido, como página con dirección propia, utilizable en móvil y en escritorio, con los campos: línea de negocio, cliente, líneas de pedido, fecha comprometida, canal de venta, modo de entrega (recojo o delivery), nota y adjuntos. La línea de negocio SHALL venir preseleccionada con la línea activa del selector global; cuando la línea activa es «Todas», el formulario SHALL NOT preseleccionar ninguna y SHALL exigir elegirla. El formulario SHALL ofrecer las acciones «Guardar» y «Guardar y crear otro». En móvil, el formulario SHALL ocupar la pantalla completa —sin la barra de navegación inferior— con las acciones fijas al pie, alcanzables sin desplazarse.

#### Scenario: Línea activa preseleccionada

- **WHEN** un usuario con la línea Sublimación activa abre el formulario de nuevo pedido
- **THEN** la línea de negocio aparece preseleccionada en Sublimación

#### Scenario: «Todas» exige elegir línea

- **WHEN** un usuario con «Todas» activa abre el formulario de nuevo pedido
- **THEN** ningún valor de línea está preseleccionado y el intento de guardar sin elegirla se impide señalando el campo

#### Scenario: Pantalla completa en móvil

- **WHEN** se abre el formulario en una pantalla de ancho móvil
- **THEN** la barra de navegación inferior no se muestra y las acciones «Guardar» y «Guardar y crear otro» están visibles al pie sin desplazar la página

#### Scenario: Ambos roles

- **WHEN** un ayudante abre el formulario de nuevo pedido
- **THEN** puede completarlo y guardarlo igual que el dueño

### Requirement: Mínimos obligatorios del pedido

Para guardar, el pedido SHALL tener un cliente y al menos una línea con cantidad mayor que cero y precio mayor o igual que cero. Fecha comprometida, canal, modo de entrega, nota y adjuntos SHALL ser opcionales. Si falta el cliente o no hay líneas válidas, el sistema SHALL impedir el guardado con un mensaje que señale el campo que falta, sin enviar nada al servidor. La misma regla SHALL aplicarse en la validación del servidor.

#### Scenario: Alta mínima

- **WHEN** el usuario elige un cliente, agrega una línea y guarda sin fecha, canal ni modo de entrega
- **THEN** el pedido se guarda y su detalle muestra esos tres datos como ausentes, sin error

#### Scenario: Sin cliente

- **WHEN** el usuario intenta guardar con una línea pero sin cliente
- **THEN** el guardado se impide y el mensaje señala el campo de cliente

#### Scenario: Sin líneas

- **WHEN** el usuario intenta guardar con cliente pero sin ninguna línea
- **THEN** el guardado se impide y el mensaje señala la sección de líneas

#### Scenario: Línea con cantidad cero

- **WHEN** el usuario intenta guardar con una línea cuya cantidad es cero
- **THEN** el guardado se impide y el mensaje señala la cantidad de esa línea

#### Scenario: El servidor no confía en el formulario

- **WHEN** llega al servidor una solicitud de alta sin cliente o sin líneas
- **THEN** el servidor la rechaza con un mensaje comprensible y no persiste nada

### Requirement: El alta es una sola operación y el estado inicial lo asigna la base

El pedido y sus líneas SHALL guardarse en una única operación de base de datos: si cualquier parte falla, no SHALL persistir ni el pedido ni ninguna línea. El estado inicial del pedido SHALL ser el estado de tipo `initial` del juego de estados resuelto para su línea y el flujo `order`, decidido por la base de datos; el formulario SHALL NOT elegir ni enviar el estado. La operación SHALL rechazar un alta sin líneas. Cada línea SHALL guardar el precio unitario tal como se registró. El identificador del pedido y el de cada línea SHALL poder generarse en el cliente.

#### Scenario: Nace en el estado inicial de su línea

- **WHEN** se guarda un pedido de una línea cuyo juego tiene como estado de tipo `initial` uno llamado «Registrado»
- **THEN** el pedido queda en ese estado y aparece en esa columna del tablero

#### Scenario: Renombrar el estado inicial no cambia el comportamiento

- **WHEN** el dueño renombra el estado de tipo `initial` de la línea y luego se guarda un pedido nuevo
- **THEN** el pedido queda igualmente en el estado de tipo `initial`, ahora con su nombre nuevo

#### Scenario: Un fallo deja todo como estaba

- **WHEN** la operación de alta falla al guardar una de las líneas
- **THEN** no existe ningún pedido nuevo ni ninguna línea nueva, y no se consumió ningún número de pedido visible

#### Scenario: La base rechaza el alta sin líneas

- **WHEN** se invoca la operación de alta con la lista de líneas vacía
- **THEN** la base de datos rechaza la operación con un mensaje comprensible

#### Scenario: Alta registrada en la bitácora

- **WHEN** se guarda un pedido con dos líneas
- **THEN** la bitácora contiene un evento de creación del pedido y uno por cada línea, y el detalle muestra el pedido como «Registrado» en su historial

### Requirement: Cliente creado al vuelo desde el pedido

El buscador de cliente del formulario de pedido SHALL ofrecer crear el contacto cuando el nombre escrito no existe, pidiendo nombre y teléfono (el teléfono opcional), sin abandonar el formulario. El contacto creado SHALL quedar marcado como cliente, seleccionado en el campo, y el resto del formulario SHALL conservar lo que ya tenía.

#### Scenario: Creación con nombre y teléfono

- **WHEN** el usuario escribe un nombre inexistente, elige crearlo e indica un teléfono
- **THEN** el contacto se crea con ese nombre y ese teléfono, queda seleccionado como cliente del pedido y el usuario sigue en el formulario

#### Scenario: El formulario conserva lo escrito

- **WHEN** el usuario ya había agregado dos líneas y una nota y crea el cliente al vuelo
- **THEN** las dos líneas y la nota siguen en el formulario tras la creación

#### Scenario: El contacto es un cliente

- **WHEN** se crea un contacto desde el buscador del pedido
- **THEN** aparece en el directorio con el rol de cliente marcado

### Requirement: Líneas desde el catálogo con precio prellenado y editable

El formulario SHALL permitir agregar líneas eligiendo un producto vigente del catálogo, limitado a los productos de la línea del pedido y a los compartidos entre líneas, con búsqueda por nombre tolerante a acentos y mayúsculas. Si el producto tiene variantes vigentes, SHALL exigir elegir una. La cantidad SHALL iniciar en 1 y el precio SHALL prellenarse desde la variante elegida o, si no la hay, desde el producto; ambos SHALL ser editables. El formulario SHALL permitir además una línea libre, con descripción y sin producto, y una descripción opcional en cualquier línea. SHALL mostrar el total como suma de cantidad por precio de las líneas, recalculado al editar; ese total SHALL NOT enviarse ni guardarse.

#### Scenario: Elegir un producto prellena el precio

- **WHEN** el usuario elige un producto sin variantes con precio de venta 45
- **THEN** se agrega una línea con cantidad 1 y precio 45, ambos editables

#### Scenario: Producto con variantes

- **WHEN** el usuario elige un producto que tiene variantes vigentes
- **THEN** debe elegir una variante antes de que la línea quede agregada, y el precio se prellena desde esa variante

#### Scenario: El precio editado es el que se guarda

- **WHEN** el usuario cambia el precio prellenado de 45 a 40 y guarda
- **THEN** la línea del pedido queda con precio 40 y el precio del producto en el catálogo sigue siendo 45

#### Scenario: Línea libre

- **WHEN** el usuario agrega una línea libre con descripción «Pieza a medida», cantidad 1 y precio 120
- **THEN** el pedido se guarda con esa línea sin producto asociado y el detalle la muestra con su descripción

#### Scenario: Productos fuera de alcance no se ofrecen

- **WHEN** el usuario busca productos para un pedido de Alfarería
- **THEN** el buscador no ofrece productos archivados ni productos asignados exclusivamente a otra línea, y sí ofrece los compartidos

#### Scenario: El total en pantalla sigue a las líneas

- **WHEN** el formulario tiene una línea de 3 × 45 y el usuario cambia la cantidad a 4
- **THEN** el total mostrado pasa de 135 a 180 sin guardar nada

### Requirement: Fecha comprometida con atajos

El campo de fecha comprometida SHALL ofrecer los atajos «Hoy», «Mañana», «En 3 días» y «En una semana», además de un selector de fecha libre. Los atajos SHALL calcularse a partir de «hoy» en la zona horaria de la organización, no en la del navegador. La fecha SHALL poder quedar vacía y SHALL poder borrarse una vez elegida.

#### Scenario: Atajo «Mañana»

- **WHEN** el usuario pulsa «Mañana»
- **THEN** la fecha comprometida queda en el día siguiente a «hoy» según la zona horaria de la organización

#### Scenario: Sin fecha

- **WHEN** el usuario guarda sin tocar la fecha comprometida
- **THEN** el pedido se guarda sin fecha y no muestra alerta de retraso

#### Scenario: Borrar la fecha

- **WHEN** el usuario había elegido una fecha y la borra antes de guardar
- **THEN** el pedido se guarda sin fecha comprometida

### Requirement: Guardar y Guardar y crear otro

Al pulsar «Guardar», el sistema SHALL guardar el pedido y llevar al detalle del pedido creado. Al pulsar «Guardar y crear otro», el sistema SHALL guardar el pedido, mostrar una confirmación con su número, y dejar el formulario en blanco conservando únicamente la línea de negocio y el canal de venta elegidos, listo para el siguiente pedido.

#### Scenario: Guardar lleva al detalle

- **WHEN** el usuario pulsa «Guardar» con un pedido válido
- **THEN** navega al detalle del pedido recién creado, que muestra su número y sus líneas

#### Scenario: Guardar y crear otro conserva línea y canal

- **WHEN** el usuario tiene línea Sublimación y canal WhatsApp, un cliente, dos líneas y una nota, y pulsa «Guardar y crear otro»
- **THEN** el pedido se guarda, se muestra su número, y el formulario queda sin cliente, sin líneas, sin nota, sin fecha y sin adjuntos, pero con Sublimación y WhatsApp aún seleccionados

#### Scenario: El pedido guardado existe

- **WHEN** el usuario pulsa «Guardar y crear otro» y luego abre el tablero
- **THEN** el pedido guardado aparece en la columna inicial de su línea

### Requirement: Confirmación antes de descartar

Si el formulario tiene datos escritos y el usuario intenta salir sin guardar —cancelar, volver, o abandonar la página— el sistema SHALL pedir confirmación antes de descartar. Si el formulario no tiene cambios, SHALL salir sin preguntar. Tras un guardado exitoso, la salida SHALL NOT pedir confirmación.

#### Scenario: Salir con datos escritos

- **WHEN** el usuario escribió una nota y pulsa «Cancelar»
- **THEN** se muestra una confirmación; al rechazarla sigue en el formulario con la nota intacta, y al aceptarla vuelve a la pantalla anterior sin guardar

#### Scenario: Salir sin cambios

- **WHEN** el usuario abre el formulario y pulsa «Cancelar» sin escribir nada
- **THEN** vuelve a la pantalla anterior sin ninguna confirmación

#### Scenario: Salir tras guardar

- **WHEN** el usuario guarda con éxito
- **THEN** la navegación al detalle ocurre sin confirmación de descarte

### Requirement: Adjuntos del pedido

El formulario de alta y el de edición SHALL permitir adjuntar imágenes de referencia al pedido: hasta 20 por pedido y 5 MB por archivo, validado antes de enviar. Los adjuntos SHALL guardarse asociados al pedido una vez que el pedido existe; si la subida de un adjunto falla, el pedido SHALL quedar guardado y el sistema SHALL avisar qué adjunto falló. Quitar un adjunto SHALL archivarlo, nunca borrarlo, y SHALL estar disponible para cualquier miembro de la organización, igual que editar el pedido. Los adjuntos SHALL ser visibles solo para miembros de la organización del pedido.

#### Scenario: Alta con imagen de referencia

- **WHEN** el usuario adjunta una imagen y guarda el pedido
- **THEN** el detalle del pedido muestra esa imagen entre sus imágenes de referencia

#### Scenario: Archivo demasiado pesado

- **WHEN** el usuario intenta adjuntar una imagen de más de 5 MB
- **THEN** el formulario la rechaza con un mensaje antes de enviar nada

#### Scenario: La subida falla pero el pedido queda

- **WHEN** el pedido se guarda y la subida de la imagen falla
- **THEN** el pedido existe con sus líneas y el usuario ve un aviso de que la imagen no se guardó

#### Scenario: Quitar un adjunto desde la edición

- **WHEN** un ayudante quita una imagen de referencia al editar un pedido
- **THEN** la imagen deja de mostrarse en el detalle, su registro queda archivado y no se elimina ningún archivo

### Requirement: Edición de pedido

El sistema SHALL ofrecer una página de edición del pedido con los mismos campos que el alta —cliente, líneas, fecha comprometida, canal, modo de entrega, nota y adjuntos— salvo la línea de negocio, que SHALL mostrarse pero SHALL NOT poder cambiarse. El estado SHALL NOT editarse desde este formulario. Las líneas SHALL poder agregarse, modificarse en cantidad, precio y descripción, y quitarse. Los mismos mínimos obligatorios del alta SHALL aplicarse. Los cambios del pedido y de sus líneas SHALL guardarse en una única operación. Un pedido archivado SHALL NOT poder editarse: la página lo informa y no ofrece guardar. Todo cambio SHALL quedar en la bitácora.

#### Scenario: Cambiar fecha y agregar una línea

- **WHEN** el usuario cambia la fecha comprometida y agrega una línea de 2 × 60 a un pedido cuyo total era 190, y guarda
- **THEN** el detalle muestra la fecha nueva, la línea nueva y un total de 310

#### Scenario: Quitar una línea

- **WHEN** el usuario quita una línea de 1 × 55 de un pedido con total 190 y guarda
- **THEN** el detalle ya no muestra esa línea y el total es 135

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
- **THEN** el pedido conserva todos sus datos y líneas anteriores, sin cambios parciales

### Requirement: Las líneas de pedido se archivan, nunca se borran

Las líneas de pedido SHALL tener una marca de archivado (`archived_at`). Quitar una línea al editar SHALL fijar esa marca, nunca eliminar la fila. La tabla de líneas SHALL seguir sin política `DELETE`. Las líneas archivadas SHALL excluirse del total del pedido, de la lista de líneas del detalle y del resumen de la tarjeta del tablero, pero SHALL seguir existiendo con su historia en la bitácora.

#### Scenario: Quitar fija la marca

- **WHEN** se quita una línea al editar un pedido
- **THEN** la fila de esa línea sigue existiendo con `archived_at` fijado y la bitácora registra el archivado

#### Scenario: El total excluye las archivadas

- **WHEN** un pedido tiene una línea vigente de 3 × 45 y una archivada de 1 × 55
- **THEN** el total del pedido es 135

#### Scenario: El detalle y la tarjeta no las muestran

- **WHEN** se abre el detalle y el tablero de un pedido con una línea archivada
- **THEN** ni la lista de líneas del detalle ni el resumen de la tarjeta la incluyen

#### Scenario: Nadie borra líneas

- **WHEN** un usuario autenticado intenta eliminar una línea de pedido
- **THEN** la operación se rechaza porque no existe política `DELETE`

### Requirement: Cancelación de pedido

El detalle del pedido SHALL ofrecer la acción «Cancelar pedido», que tras una confirmación SHALL mover el pedido al estado de tipo `cancelled` del juego resuelto de su línea para el flujo `order`. La decisión SHALL compararse por `kind`, nunca por el nombre del estado. Si el juego de la línea no tiene ningún estado de tipo `cancelled`, la acción SHALL NOT ofrecerse. Si el pedido ya está en un estado de tipo `cancelled`, la acción SHALL NOT ofrecerse. Cancelar SHALL NOT archivar el pedido: el pedido cancelado sigue visible en su columna. El cambio SHALL quedar en la bitácora como cambio de estado.

#### Scenario: Cancelar con confirmación

- **WHEN** el usuario pulsa «Cancelar pedido» y confirma
- **THEN** el pedido pasa al estado de tipo `cancelled` de su línea, sigue visible en el tablero en esa columna, y el historial registra el cambio de estado

#### Scenario: Rechazar la confirmación

- **WHEN** el usuario pulsa «Cancelar pedido» y no confirma
- **THEN** el pedido conserva su estado

#### Scenario: Línea sin estado de cancelación

- **WHEN** el juego de estados de la línea no tiene ningún estado de tipo `cancelled`
- **THEN** el detalle no ofrece la acción «Cancelar pedido»

#### Scenario: Ya cancelado

- **WHEN** el pedido ya está en un estado de tipo `cancelled`
- **THEN** el detalle no ofrece la acción «Cancelar pedido»

#### Scenario: Renombrar el estado no cambia la cancelación

- **WHEN** el dueño renombra el estado de tipo `cancelled` de la línea a otro texto
- **THEN** «Cancelar pedido» sigue moviendo el pedido a ese estado

### Requirement: Entradas al alta y a la edición

El tablero de pedidos (V3) SHALL ofrecer la acción «Nuevo pedido» a ambos roles. El detalle (V4) SHALL ofrecer «Editar» a ambos roles. Volver desde el formulario sin guardar SHALL devolver a la pantalla anterior conservando sus filtros y su vista.

#### Scenario: Desde el tablero

- **WHEN** el usuario pulsa «Nuevo pedido» en el tablero
- **THEN** se abre el formulario de nuevo pedido con la línea activa preseleccionada

#### Scenario: Desde el detalle

- **WHEN** el usuario pulsa «Editar» en el detalle de un pedido
- **THEN** se abre el formulario de edición con todos los datos y líneas de ese pedido cargados

#### Scenario: Volver conserva la vista

- **WHEN** el usuario llega al formulario desde la vista de lista con un filtro aplicado y vuelve sin guardar
- **THEN** regresa a la vista de lista con el mismo filtro

## MODIFIED Requirements

### Requirement: El total del pedido se deriva, nunca se almacena

El sistema SHALL exponer el total de cada pedido a través de la vista `order_totals`, declarada con `security_invoker = true`, calculado como la suma de `quantity * unit_price` de sus líneas vigentes —las que no tienen `archived_at`—. Ninguna columna de `orders` SHALL almacenar total, saldo ni margen.

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

#### Scenario: Ninguna columna almacena el derivado

- **WHEN** se inspecciona la definición de la tabla `orders`
- **THEN** no existe ninguna columna de total, saldo, cobrado ni margen

### Requirement: Detalle del pedido

El detalle de un pedido SHALL mostrar su número, cliente, línea de negocio, canal de venta, modo de entrega, sus líneas vigentes con cantidad y precio unitario, el total derivado, la fecha comprometida y la fecha del hecho, las notas, las imágenes de referencia y el historial del pedido leído de la bitácora. El detalle SHALL permitir cambiar el estado del pedido, navegar al cliente, abrir la edición del pedido y cancelarlo.

#### Scenario: Pedido completo

- **WHEN** se abre el detalle de un pedido con líneas, notas e imágenes
- **THEN** se muestran todos sus datos y el total calculado desde sus líneas

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
