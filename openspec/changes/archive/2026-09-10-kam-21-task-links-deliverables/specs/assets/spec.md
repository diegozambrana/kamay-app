## MODIFIED Requirements

### Requirement: Detalle del activo en panel

Activar una tarjeta SHALL abrir el detalle del activo en un panel lateral, con sus datos —costo, fecha, proveedor enlazado a su ficha si lo tiene, notas—, la lista de sus egresos de mantenimiento con fecha e importe, el egreso de adquisición si está vinculado, el desglose del costo total, un bloque de **tareas relacionadas** con las tareas que referencian a ese activo —con su estado actual y su fecha límite cuando la tenga, y con paso a su detalle— y el historial leído de la bitácora. Cada egreso listado SHALL llevar a su detalle. El detalle SHALL permitir editar los datos del activo y vincular un egreso de mantenimiento.

#### Scenario: Detalle con sus gastos

- **WHEN** se activa la tarjeta de un activo con dos gastos de mantenimiento vinculados
- **THEN** el panel muestra los dos con su fecha e importe, y el costo total desglosado

#### Scenario: Del gasto a su egreso

- **WHEN** se activa uno de los gastos listados en el panel
- **THEN** se abre el detalle de ese egreso

#### Scenario: Historial del activo

- **WHEN** un activo se registró y luego se corrigió su costo
- **THEN** su historial muestra ambos eventos en orden cronológico, leídos de la bitácora

#### Scenario: Tareas relacionadas del activo

- **WHEN** se activa la tarjeta de un activo que dos tareas referencian
- **THEN** el panel lista ambas con su estado actual y lleva al detalle de cada una

#### Scenario: Activo sin tareas relacionadas

- **WHEN** se activa la tarjeta de un activo que ninguna tarea referencia
- **THEN** el bloque de tareas relacionadas se rinde con su mensaje de lista sin contenido

### Requirement: Un activo es un destino vinculable válido para una tarea

La validación de vínculos de tarea SHALL aceptar `entity_type = 'asset'` cuando el identificador corresponde a un activo existente, y SHALL seguir rechazando el vínculo cuando no corresponde a ninguno. El buscador de vínculos de una tarea SHALL ofrecer activos como destino, y SHALL hacerlo únicamente ante la persona dueña; un vínculo a un activo SHALL NOT rendirse ante un ayudante, según define la capacidad de vínculos y entregables.

#### Scenario: Vínculo a un activo existente

- **WHEN** se guarda un vínculo de tarea con `entity_type = 'asset'` apuntando a un activo de la organización
- **THEN** la base de datos lo acepta

#### Scenario: Vínculo a un activo inexistente

- **WHEN** se guarda un vínculo de tarea con `entity_type = 'asset'` cuyo identificador no corresponde a ningún activo
- **THEN** la base de datos rechaza la operación

#### Scenario: El vínculo a un activo se crea desde la tarea

- **WHEN** la persona dueña elige un activo en el buscador de vínculos de una tarea
- **THEN** el vínculo queda registrado con `entity_type = 'asset'` y aparece en la lista de vínculos de la tarea
