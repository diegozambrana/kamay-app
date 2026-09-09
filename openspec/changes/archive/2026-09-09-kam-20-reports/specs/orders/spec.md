## ADDED Requirements

### Requirement: Ranking de productos vendidos dentro de un periodo, con unidades y margen

El sistema SHALL exponer, como derivado calculado en la lectura, el ranking de los ítems vendidos por una organización dentro de **un rango de fechas arbitrario**, con las **unidades vendidas**, los **ingresos**, el **costo de materiales atribuido** y el **margen** de cada ítem, más el **canal de venta** por el que más se vendió.

El **costo de materiales atribuido** a un ítem SHALL ser la parte de los egresos asignados a su pedido que le corresponde en proporción a su ingreso dentro de ese pedido, y SHALL ser cero cuando el pedido no tiene ningún egreso asignado. El derivado SHALL NOT atribuir consumos de inventario, que no declaran pedido.

El derivado SHALL incluir tanto los pedidos como las **ventas directas**, con el mismo criterio con el que las consultas de ingresos ya las incluyen. Los pedidos, las ventas y las líneas archivadas SHALL NOT sumar. Los límites del rango SHALL evaluarse en la zona horaria de la organización, incluyendo el día inicial y el día final completos. Los ingresos SHALL calcularse con el precio que se registró en la línea de venta, no con el precio que el catálogo tenga hoy.

Las **unidades** y el **margen** SHALL ser dos columnas independientes del mismo derivado, de modo que quien lo consuma pueda ordenar por cualquiera de las dos sin perder la otra. El derivado SHALL poder acotarse a una línea de negocio o devolverlas todas.

Este derivado SHALL NOT sustituir ni modificar el ranking de 90 días que alimenta la retícula del modo feria: aquél tiene su ventana fija por diseño y sigue sirviendo a esa pantalla.

El derivado SHALL ser legible **únicamente por la persona dueña**: expone margen, que la matriz de acceso niega al ayudante. Un ayudante SHALL obtener cero filas.

#### Scenario: Unidades y margen en la misma fila

- **WHEN** un ítem vendió 40 unidades en el periodo por 2.000, con 1.400 de costo atribuido
- **THEN** el derivado devuelve para ese ítem 40 unidades, 2.000 de ingresos, 1.400 de costo y 600 de margen

#### Scenario: Las ventas directas cuentan

- **WHEN** en el periodo un ítem se vendió 10 unidades en pedidos y 15 en ventas de feria
- **THEN** el derivado devuelve 25 unidades para ese ítem

#### Scenario: El costo se prorratea por ingreso dentro del pedido

- **WHEN** un pedido de 1.000 tiene dos ítems que aportan 600 y 400, y un egreso asignado de 300
- **THEN** el derivado atribuye 180 de costo al primero y 120 al segundo

#### Scenario: Un pedido sin egreso asignado no atribuye costo

- **WHEN** un ítem se vendió únicamente en pedidos sin ningún egreso asignado
- **THEN** su costo atribuido es cero y su margen es igual a sus ingresos

#### Scenario: El precio es el que se registró

- **WHEN** un ítem se vendió a 50 y después su precio de catálogo subió a 80
- **THEN** los ingresos de esa venta en el derivado siguen siendo 50 por unidad

#### Scenario: Lo archivado no suma

- **WHEN** una de las ventas del periodo se archiva
- **THEN** sus unidades y sus ingresos dejan de sumar en el ranking

#### Scenario: Un rango que no empieza el día 1

- **WHEN** se pide el rango del 12 de marzo al 20 de abril
- **THEN** el derivado agrega únicamente las ventas ocurridas dentro de esas fechas, ambas incluidas

#### Scenario: El ranking de feria no cambia

- **WHEN** se consulta la retícula del modo feria después de existir este derivado
- **THEN** sigue ordenándose por el ranking de 90 días que ya usaba

#### Scenario: El ayudante obtiene cero filas

- **WHEN** un ayudante consulta el ranking con margen de su organización
- **THEN** obtiene cero filas
