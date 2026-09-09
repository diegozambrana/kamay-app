## ADDED Requirements

### Requirement: Movimiento de caja con su línea y su activo

El sistema SHALL exponer, como derivado de nivel de movimiento, cada movimiento de dinero no archivado con su **organización**, su **línea de negocio**, su **fecha de ocurrencia**, su **dirección**, su **importe** y el **activo al que pertenece** cuando el egreso pagado pertenece a uno. Un movimiento cuyo pedido o cuyo egreso de destino está archivado SHALL NOT aparecer. La línea de negocio SHALL deducirse del pedido o del egreso al que apunta el movimiento, ya que el dinero no declara línea propia.

Este derivado SHALL ser la única fuente de la que se calcule "qué dinero entró y salió de una línea": el agregado mensual de flujo de caja SHALL derivarse de él en lugar de repetir por su cuenta el empalme con pedidos y egresos, de modo que las dos lecturas no puedan discrepar. El derivado SHALL calcularse en la lectura y SHALL NOT almacenarse.

Como el agregado que de él se deriva, SHALL ser legible **únicamente por la persona dueña**: un ayudante SHALL obtener cero filas al consultarlo, aunque pueda leer los cobros individuales que lo componen.

#### Scenario: Un movimiento por fila con su línea

- **WHEN** se cobra un pedido de la línea Sublimación y se paga una compra de la línea Alfarería
- **THEN** el derivado devuelve dos filas, una por movimiento, cada una con la línea de su destino

#### Scenario: El activo del pago aparece en la fila

- **WHEN** se paga un egreso que pertenece a un activo
- **THEN** la fila de ese pago identifica ese activo

#### Scenario: Un pago corriente no señala ningún activo

- **WHEN** se paga un egreso que no pertenece a ningún activo
- **THEN** la fila de ese pago no identifica ningún activo

#### Scenario: Lo archivado no aparece

- **WHEN** se archiva un cobro, o se archiva el pedido al que apunta
- **THEN** ese movimiento desaparece del derivado

#### Scenario: El agregado mensual coincide con el detalle

- **WHEN** se suman por línea y por mes las filas del derivado de movimientos
- **THEN** el resultado coincide exactamente con el agregado mensual de flujo de caja

#### Scenario: El ayudante obtiene cero filas

- **WHEN** un ayudante consulta el derivado de movimientos de caja de su organización
- **THEN** obtiene cero filas

#### Scenario: Ninguna organización ve a otra

- **WHEN** la persona dueña de una organización consulta el derivado
- **THEN** obtiene únicamente filas de su propia organización
