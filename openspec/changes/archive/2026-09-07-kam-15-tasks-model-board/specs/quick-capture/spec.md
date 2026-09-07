## MODIFIED Requirements

### Requirement: La pantalla de registro rápido ofrece seis destinos

El sistema SHALL ofrecer en `/quick` una retícula de seis destinos de registro —Venta rápida, Pedido, Compra, Gasto, Consumo y Tarea— presentados como botones grandes, todos con el mismo tamaño y jerarquía visual. La retícula SHALL disponerse en dos columnas y SHALL caber completa, sin desplazamiento horizontal, en un ancho de 390 px. Cada destino SHALL declarar visiblemente su indisponibilidad cuando la pantalla a la que conduce todavía no existe, en lugar de desaparecer o de conducir a una ruta inexistente.

El destino **Tarea** SHALL abrir el formulario de alta de tarea. El único destino que SHALL seguir declarándose no disponible es **Consumo**, cuya pantalla aún no existe.

#### Scenario: Los seis destinos están presentes

- **WHEN** una persona dueña abre `/quick`
- **THEN** la retícula ofrece los seis destinos: Venta rápida, Pedido, Compra, Gasto, Consumo y Tarea

#### Scenario: Destinos disponibles hoy

- **WHEN** se activa el destino Venta rápida, Pedido, Compra, Gasto o Tarea
- **THEN** se abre respectivamente el modo feria, el alta de pedido, el alta de compra, el alta de gasto o el alta de tarea

#### Scenario: Destinos aún no construidos

- **WHEN** se abre `/quick` y se observa el destino Consumo
- **THEN** aparece en su ranura, no accionable y con la indicación de que aún no está disponible

#### Scenario: La retícula cabe en un teléfono

- **WHEN** se abre `/quick` en un viewport de 390 px de ancho
- **THEN** los seis destinos son visibles y accionables sin ningún desplazamiento horizontal
