## MODIFIED Requirements

### Requirement: Flujo de caja del periodo por línea

El sistema SHALL exponer, como derivado agregado por organización y línea de negocio dentro de **un rango de fechas arbitrario**, el **cobrado** —la suma de los movimientos de dirección `in` no archivados cuya fecha de ocurrencia cae dentro del rango— y el **pagado** —lo mismo para los de dirección `out`—. El agregado por mes calendario SHALL seguir estando disponible como caso particular, para el panel principal, que no elige periodo.

Los límites del rango SHALL evaluarse en la zona horaria de la organización, y SHALL incluir el día inicial y el día final completos. La línea de negocio de cada movimiento SHALL deducirse del pedido o del egreso al que apunta, ya que un movimiento de dinero no declara línea propia. El derivado SHALL calcularse en la lectura y SHALL NOT almacenarse en ninguna columna.

A diferencia de Por cobrar y Por pagar, este derivado SHALL ser legible **únicamente por la persona dueña**: un ayudante SHALL obtener cero filas al consultarlo, con cualquier rango, aunque pueda leer los cobros individuales que lo componen. El aislamiento por organización SHALL mantenerse en todo caso.

#### Scenario: Cobrado y pagado del mes

- **WHEN** una línea tiene en el mes dos cobros de 300 y 600 y un pago de 350, ninguno archivado
- **THEN** el derivado muestra 900 cobrado y 350 pagado para esa línea y ese mes

#### Scenario: Un rango que no empieza el día 1

- **WHEN** se pide el rango del 12 de marzo al 20 de abril y en él hay cobros por 1.200
- **THEN** el derivado devuelve esos 1.200, sin incluir los cobros del 1 al 11 de marzo ni los posteriores al 20 de abril

#### Scenario: Los extremos del rango se incluyen

- **WHEN** hay un cobro el primer día del rango y otro el último
- **THEN** ambos suman en el derivado

#### Scenario: Cada movimiento cae en el mes en que ocurrió

- **WHEN** un pedido registrado en enero se cobra en febrero
- **THEN** ese importe aparece en el mes de febrero y no en el de enero

#### Scenario: El movimiento anulado no suma

- **WHEN** uno de los cobros del mes se archiva
- **THEN** deja de sumar al cobrado de ese mes

#### Scenario: La línea la pone el destino

- **WHEN** se cobra un pedido de la línea Sublimación y se paga una compra de la línea Alfarería
- **THEN** el cobro suma en Sublimación y el pago en Alfarería

#### Scenario: El ayudante obtiene cero filas

- **WHEN** un ayudante consulta el derivado de flujo de caja de su organización, con cualquier rango
- **THEN** obtiene cero filas, aunque pueda leer individualmente los cobros que registró

#### Scenario: Ninguna organización ve a otra

- **WHEN** la persona dueña de una organización consulta el derivado
- **THEN** obtiene únicamente filas de su propia organización

#### Scenario: Un mes sin movimiento no inventa filas

- **WHEN** una línea no tuvo movimientos en un mes
- **THEN** el derivado no devuelve fila para esa combinación, y quien la consuma la presenta como cero
