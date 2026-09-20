## ADDED Requirements

### Requirement: Añadir una línea sin tocar las demás

El sistema SHALL ofrecer una operación que añada **una sola línea** a un pedido existente, con las mismas reglas que cualquier línea —producto del catálogo o descripción libre, cantidad mayor que cero, precio no negativo, identificador generado en el cliente—, y que SHALL NOT modificar ni archivar ninguna de las otras líneas del pedido. La operación SHALL ejecutarse con la sesión de la persona, dentro de su organización, y SHALL respetar los mismos permisos y rechazos que la edición del pedido: un pedido archivado o fuera del alcance de la persona SHALL rechazarla con un mensaje entendible. La línea añadida SHALL quedar registrada en la bitácora como una creación y SHALL entrar en el total derivado del pedido.

#### Scenario: La línea se suma a las existentes

- **WHEN** un pedido tiene dos líneas y se le añade una tercera por esta operación
- **THEN** el pedido tiene tres líneas vigentes, las dos primeras están intactas, y el total derivado incluye la tercera

#### Scenario: No pisa lo que otra persona acaba de añadir

- **WHEN** dos personas añaden cada una una línea al mismo pedido casi al mismo tiempo
- **THEN** el pedido conserva las dos líneas nuevas

#### Scenario: Línea libre sin descripción

- **WHEN** se intenta añadir una línea sin producto y sin descripción
- **THEN** se rechaza con el mismo mensaje que en el formulario del pedido

#### Scenario: Pedido archivado

- **WHEN** se intenta añadir una línea a un pedido archivado
- **THEN** se rechaza y el pedido no cambia

#### Scenario: Pedido de otra organización

- **WHEN** una persona de la organización B intenta añadir una línea a un pedido de la organización A
- **THEN** se rechaza y el pedido de A no cambia

#### Scenario: Queda en la bitácora

- **WHEN** se añade una línea por esta operación
- **THEN** el historial del pedido muestra la creación de la línea

### Requirement: El detalle del pedido ofrece las acciones de las herramientas activas

El detalle de un pedido SHALL ofrecer una acción por cada herramienta que esté en el registro, esté activa para la organización, declare el enganche del detalle del pedido y pueda ser usada por el rol de la persona. Cuando no haya ninguna, el detalle SHALL verse exactamente como sin herramientas, sin menú ni bloque vacío. Un pedido archivado SHALL NOT ofrecer estas acciones.

#### Scenario: Sin herramientas activas

- **WHEN** una organización sin herramientas activas abre el detalle de un pedido
- **THEN** el detalle no muestra ninguna acción ni bloque de herramientas

#### Scenario: Con la calculadora activa

- **WHEN** la dueña abre el detalle de un pedido con la calculadora de impresión 3D activa
- **THEN** el detalle ofrece la acción de la calculadora

#### Scenario: El rol filtra

- **WHEN** un ayudante abre el detalle de un pedido y la única herramienta activa exige el rol `owner`
- **THEN** el detalle no ofrece ninguna acción de herramientas

#### Scenario: Pedido archivado

- **WHEN** la dueña abre el detalle de un pedido archivado con la calculadora activa
- **THEN** el detalle no ofrece la acción
