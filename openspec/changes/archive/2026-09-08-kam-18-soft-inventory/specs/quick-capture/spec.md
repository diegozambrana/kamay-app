## MODIFIED Requirements

### Requirement: La pantalla de registro rápido ofrece seis destinos

El sistema SHALL ofrecer en `/quick` una retícula de seis destinos de registro —Venta rápida, Pedido, Compra, Gasto, Consumo y Tarea— presentados como botones grandes, todos con el mismo tamaño y jerarquía visual. La retícula SHALL disponerse en dos columnas y SHALL caber completa, sin desplazamiento horizontal, en un ancho de 390 px. Cada destino SHALL declarar visiblemente su indisponibilidad cuando la pantalla a la que conduce todavía no existe, en lugar de desaparecer o de conducir a una ruta inexistente.

El destino **Consumo** SHALL abrir el diálogo de registro de consumo sobre la propia pantalla, sin cambiar de dirección. Con ello los seis destinos SHALL estar disponibles y ninguno SHALL declararse pendiente. Un destino SHALL poder resolverse como diálogo o como pantalla sin que eso cambie su presentación en la retícula: los seis SHALL seguir teniendo el mismo tamaño y la misma jerarquía visual.

#### Scenario: Los seis destinos están presentes

- **WHEN** una persona dueña abre `/quick`
- **THEN** la retícula ofrece los seis destinos: Venta rápida, Pedido, Compra, Gasto, Consumo y Tarea

#### Scenario: Destinos disponibles hoy

- **WHEN** se activa el destino Venta rápida, Pedido, Compra, Gasto, Consumo o Tarea
- **THEN** se abre respectivamente el modo feria, el alta de pedido, el alta de compra, el alta de gasto, el diálogo de consumo o el alta de tarea

#### Scenario: Destinos aún no construidos

- **WHEN** se abre `/quick` y se observan los seis destinos
- **THEN** todos son accionables y ninguno lleva la indicación de no estar disponible

#### Scenario: El destino que es diálogo no cambia de pantalla

- **WHEN** se activa el destino Consumo desde `/quick`
- **THEN** el diálogo se abre sobre la misma pantalla y la dirección no cambia

#### Scenario: La retícula cabe en un teléfono

- **WHEN** se abre `/quick` en un viewport de 390 px de ancho
- **THEN** los seis destinos son visibles y accionables sin ningún desplazamiento horizontal
