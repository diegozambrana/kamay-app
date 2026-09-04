## MODIFIED Requirements

### Requirement: El alta es una sola operación y el estado inicial lo asigna la base

El pedido y sus líneas SHALL guardarse en una única operación de base de datos: si cualquier parte falla, no SHALL persistir ni el pedido ni ninguna línea. El estado inicial del pedido SHALL ser el estado de tipo `initial` del juego de estados resuelto para su línea y el flujo `order`, decidido por la base de datos; el formulario SHALL NOT elegir ni enviar el estado. La operación SHALL rechazar un alta sin líneas. Cada línea SHALL guardar el precio unitario tal como se registró. El identificador del pedido y el de cada línea SHALL poder generarse en el cliente.

La operación de alta SHALL ser idempotente respecto de ese identificador: invocarla de nuevo con el identificador de un pedido que ya existe SHALL NOT crear un segundo pedido, SHALL NOT consumir un número de pedido visible adicional, SHALL NOT duplicar ninguna línea y SHALL devolver el identificador del pedido existente. Si ese identificador pertenece a un pedido de otra organización, la operación SHALL rechazarse con un error y SHALL NOT modificar ni adoptar el pedido ajeno.

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

#### Scenario: El mismo pedido enviado dos veces

- **WHEN** se invoca el alta dos veces con el mismo identificador de pedido y las mismas líneas
- **THEN** existe un solo pedido, con un solo número visible y sin líneas duplicadas, y la segunda invocación devuelve el identificador del pedido ya existente

#### Scenario: El reenvío no ensucia la bitácora

- **WHEN** se reenvía un alta ya guardada
- **THEN** la bitácora sigue conteniendo un único evento de creación de ese pedido

#### Scenario: Identificador que pertenece a otra organización

- **WHEN** se invoca el alta con el identificador de un pedido de otra organización
- **THEN** la operación es rechazada con un error y el pedido ajeno queda intacto

### Requirement: Guardar y Guardar y crear otro

Al pulsar «Guardar», el sistema SHALL guardar el pedido y llevar al detalle del pedido creado. Al pulsar «Guardar y crear otro», el sistema SHALL guardar el pedido, mostrar una confirmación con su número, y dejar el formulario en blanco conservando únicamente la línea de negocio y el canal de venta elegidos, listo para el siguiente pedido.

Sin conexión, ambas acciones SHALL confirmar igualmente y SHALL NOT mostrar error: el pedido queda en la cola de registros pendientes. Como el número visible lo asigna la base de datos, un pedido aún no sincronizado SHALL presentarse como pendiente de sincronizar en lugar de con un número, y SHALL mostrar su número en cuanto llegue al servidor. Sin conexión, «Guardar» SHALL NOT navegar al detalle —que no se puede servir sin red— sino dejar el formulario listo para el registro siguiente, con la confirmación a la vista.

#### Scenario: Guardar lleva al detalle

- **WHEN** el usuario pulsa «Guardar» con un pedido válido
- **THEN** navega al detalle del pedido recién creado, que muestra su número y sus líneas

#### Scenario: Guardar y crear otro conserva línea y canal

- **WHEN** el usuario tiene línea Sublimación y canal WhatsApp, un cliente, dos líneas y una nota, y pulsa «Guardar y crear otro»
- **THEN** el pedido se guarda, se muestra su número, y el formulario queda sin cliente, sin líneas, sin nota, sin fecha y sin adjuntos, pero con Sublimación y WhatsApp aún seleccionados

#### Scenario: El pedido guardado existe

- **WHEN** el usuario pulsa «Guardar y crear otro» y luego abre el tablero
- **THEN** el pedido guardado aparece en la columna inicial de su línea

#### Scenario: Guardar sin conexión

- **GIVEN** un dispositivo sin red
- **WHEN** el usuario pulsa «Guardar» con un pedido válido
- **THEN** el pedido se confirma sin ningún error, se presenta como pendiente de sincronizar y sin número, el indicador de pendientes aumenta en uno, y el formulario queda listo para el registro siguiente en lugar de navegar a un detalle que la red no puede entregar

#### Scenario: Guardar y crear otro sin conexión

- **GIVEN** un dispositivo sin red
- **WHEN** el usuario pulsa «Guardar y crear otro»
- **THEN** la confirmación aparece sin número, el formulario queda listo para el siguiente pedido conservando línea y canal, y ambos pedidos quedan pendientes

#### Scenario: El número aparece al sincronizar

- **GIVEN** un pedido guardado sin red y presentado como pendiente de sincronizar
- **WHEN** se recupera la conexión y el pedido llega al servidor
- **THEN** el pedido muestra su número visible y deja de figurar como pendiente

### Requirement: Adjuntos del pedido

El formulario de alta y el de edición SHALL permitir adjuntar imágenes de referencia al pedido: hasta 20 por pedido y 5 MB por archivo, validado antes de enviar. Los adjuntos SHALL guardarse asociados al pedido una vez que el pedido existe; si la subida de un adjunto falla, el pedido SHALL quedar guardado y el sistema SHALL avisar qué adjunto falló. Quitar un adjunto SHALL archivarlo, nunca borrarlo, y SHALL estar disponible para cualquier miembro de la organización, igual que editar el pedido. Los adjuntos SHALL ser visibles solo para miembros de la organización del pedido.

Los adjuntos SHALL exigir conexión: no entran en la cola de registros pendientes. Sin red, el formulario SHALL informar de que las imágenes se añadirán con conexión, SHALL NOT impedir guardar el pedido y SHALL dejarlo guardado sin ellas, para que puedan añadirse después desde la edición.

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

#### Scenario: Adjuntar sin conexión

- **GIVEN** un dispositivo sin red
- **WHEN** el usuario intenta adjuntar una imagen al pedido
- **THEN** el formulario informa de que la imagen requiere conexión, el pedido se puede guardar igualmente y queda guardado sin ella
