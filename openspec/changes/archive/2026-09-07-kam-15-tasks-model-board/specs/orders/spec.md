## MODIFIED Requirements

### Requirement: Detalle del pedido

El detalle de un pedido SHALL mostrar su número, cliente, línea de negocio, canal de venta, modo de entrega, sus líneas vigentes con cantidad y precio unitario, el total derivado, la fecha comprometida y la fecha del hecho, las notas, las imágenes de referencia y el historial del pedido leído de la bitácora. El detalle SHALL incluir además un bloque de **cobros y saldo** con la lista de cobros registrados, el saldo pendiente derivado, el estado de pago y la acción *Registrar cobro*. El detalle SHALL permitir cambiar el estado del pedido, navegar al cliente, abrir la edición del pedido y cancelarlo. El detalle SHALL ofrecer además la acción *Crear tarea para este pedido*, que abre el formulario de alta de tarea prellenado desde el pedido y deja la decisión de crearla en manos de la persona.

Ningún cambio de estado del pedido SHALL crear, mover ni cerrar una tarea: la acción explícita SHALL ser la única vía por la que un pedido origina una tarea.

#### Scenario: Pedido completo

- **WHEN** se abre el detalle de un pedido con líneas, notas e imágenes
- **THEN** se muestran todos sus datos y el total calculado desde sus líneas

#### Scenario: Bloque de cobros y saldo

- **WHEN** se abre el detalle de un pedido con dos cobros registrados
- **THEN** el bloque de cobros lista ambos con su importe, método y fecha, y muestra el saldo pendiente derivado

#### Scenario: Pedido sin cobros

- **WHEN** se abre el detalle de un pedido sin ningún cobro
- **THEN** el bloque muestra el saldo pendiente igual al total y ofrece la acción *Registrar cobro*

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

#### Scenario: Crear tarea para este pedido

- **WHEN** se activa *Crear tarea para este pedido* en el detalle de un pedido
- **THEN** se abre el formulario de alta de tarea prellenado desde ese pedido

#### Scenario: Cambiar de estado no crea ninguna tarea

- **WHEN** se cambia el estado de un pedido desde su detalle
- **THEN** no se crea ninguna tarea, y el número de tareas de la organización no varía
