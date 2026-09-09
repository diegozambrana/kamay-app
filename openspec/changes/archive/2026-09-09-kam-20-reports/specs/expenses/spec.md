## ADDED Requirements

### Requirement: Agregación de egresos por categoría y línea dentro de un periodo

El sistema SHALL exponer, como derivado calculado en la lectura, el total de egresos de una organización dentro de **un rango de fechas arbitrario**, agrupado por **categoría de gasto** y por **línea de negocio**, distinguiendo los de tipo `purchase` de los de tipo `expense`.

El total de cada grupo SHALL ser el mismo que devuelve el total derivado de cada egreso, de modo que la suma de los grupos sea igual a la suma de los egresos del periodo. Los egresos archivados SHALL NOT sumar. Los límites del rango SHALL evaluarse en la zona horaria de la organización, incluyendo el día inicial y el día final completos.

Las compras no llevan categoría de gasto: el derivado SHALL agruparlas bajo una entrada propia identificable, y SHALL NOT atribuirlas a ninguna categoría de gasto real ni dejarlas fuera del total.

El derivado SHALL ser legible **únicamente por la persona dueña**, que es quien ya puede leer los egresos fila a fila; un ayudante SHALL obtener cero filas. Ninguna cifra del derivado SHALL almacenarse en columna alguna.

#### Scenario: Agrupación por categoría

- **WHEN** el periodo tiene tres gastos de 200 en la categoría Insumos y uno de 300 en Servicios
- **THEN** el derivado devuelve 600 para Insumos y 300 para Servicios

#### Scenario: Las compras van aparte

- **WHEN** el periodo tiene 400 en compras a proveedores y 600 en gastos con categoría
- **THEN** el derivado devuelve las compras como grupo propio por 400, y la suma de todos los grupos es 1.000

#### Scenario: La suma cuadra con los egresos

- **WHEN** se suman todos los grupos del periodo
- **THEN** el resultado es igual a la suma de los totales derivados de los egresos no archivados de ese periodo

#### Scenario: El egreso archivado no suma

- **WHEN** uno de los gastos del periodo se archiva
- **THEN** deja de sumar en su grupo y el total del periodo baja en su importe

#### Scenario: Un rango que no empieza el día 1

- **WHEN** se pide el rango del 12 de marzo al 20 de abril
- **THEN** el derivado agrega únicamente los egresos ocurridos dentro de esas fechas, ambas incluidas

#### Scenario: El ayudante obtiene cero filas

- **WHEN** un ayudante consulta el derivado de egresos agregados de su organización
- **THEN** obtiene cero filas

#### Scenario: Ninguna organización ve a otra

- **WHEN** la persona dueña consulta el derivado
- **THEN** obtiene únicamente grupos de su propia organización
