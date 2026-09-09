## Purpose

El reparto de los egresos de la línea General/Compartido entre las líneas concretas: las tres reglas que puede elegir la organización, su aplicación en la lectura y nunca reescribiendo el egreso, y la obligación de que la regla aplicada se muestre junto a todo resultado que la use.

## ADDED Requirements

### Requirement: La organización elige una regla de reparto entre tres

El sistema SHALL permitir a la organización elegir exactamente una regla de reparto de los egresos de su línea compartida, entre estas tres y ninguna otra:

- **Proporcional a los ingresos** (`revenue`): cada línea no compartida recibe la fracción del gasto compartido que representan sus ingresos del periodo sobre el total de ingresos del periodo de todas las líneas no compartidas.
- **Partes iguales** (`equal`): el gasto compartido se divide entre las líneas no compartidas y no archivadas, a partes iguales.
- **Manual** (`manual`): cada línea no compartida recibe el porcentaje fijo que la organización declaró para ella.

La regla SHALL guardarse en la configuración de la organización, SHALL ser única para toda la organización —no por línea, no por informe, no por periodo— y su valor por defecto SHALL ser `revenue`.

#### Scenario: Valor por defecto de una organización nueva

- **WHEN** se crea una organización y nadie ha tocado la configuración de reparto
- **THEN** su regla de reparto es la proporcional a los ingresos

#### Scenario: Una regla desconocida se rechaza

- **WHEN** se intenta guardar una regla cuyo identificador no es `revenue`, `equal` ni `manual`
- **THEN** la operación falla y la regla vigente no cambia

### Requirement: El reparto se aplica en la lectura y jamás reescribe el egreso

El sistema SHALL calcular el reparto en el momento de leer un informe. El egreso SHALL conservar en todo momento la línea compartida como su `business_line_id`, y el sistema SHALL NOT crear egresos derivados, SHALL NOT duplicar filas y SHALL NOT modificar ninguna fila de `expenses` como consecuencia de un reparto.

Cambiar la regla SHALL cambiar el resultado de todos los informes, incluidos los de periodos ya transcurridos, porque ninguna cifra repartida está almacenada.

#### Scenario: El egreso no se mueve de línea

- **WHEN** un gasto de 300 registrado en la línea General se reparte en el informe comparativo
- **THEN** la fila del gasto en la bandeja de egresos sigue mostrando la línea General y su `business_line_id` sigue siendo el de la línea compartida

#### Scenario: Cambiar la regla recalcula lo pasado

- **WHEN** la organización cambia de reparto proporcional a partes iguales y vuelve a abrir el informe de un trimestre anterior
- **THEN** las cifras repartidas de ese trimestre cambian según la nueva regla

#### Scenario: El reparto no crea filas nuevas

- **WHEN** se lee cualquier informe que aplica reparto
- **THEN** el número de filas de `expenses` es el mismo antes y después de la lectura

### Requirement: Reparto proporcional a los ingresos

Con la regla `revenue`, el sistema SHALL asignar a cada línea no compartida la fracción del total de gastos compartidos del periodo igual a sus ingresos del periodo divididos entre la suma de los ingresos del periodo de todas las líneas no compartidas.

Cuando esa suma de ingresos sea cero, el sistema SHALL repartir a partes iguales entre las líneas no compartidas y no archivadas, y SHALL indicarlo en la leyenda, en lugar de dividir entre cero, omitir el gasto o dejarlo sin repartir.

#### Scenario: Reparto proporcional con ingresos desiguales

- **WHEN** en el periodo Sublimación ingresó 6.000, Impresión 3D 3.000, Alfarería 1.000 y hay 500 de gastos en General
- **THEN** el reparto asigna 300 a Sublimación, 150 a Impresión 3D y 50 a Alfarería

#### Scenario: Ninguna línea tuvo ingresos en el periodo

- **WHEN** el periodo no registra ingresos en ninguna línea y hay 300 de gastos en General
- **THEN** los 300 se reparten a partes iguales entre las líneas no compartidas activas, sin error, y la leyenda dice que se repartió a partes iguales por no haber ingresos en el periodo

#### Scenario: Una sola línea activa

- **WHEN** la organización tiene una única línea no compartida y hay 500 de gastos en General
- **THEN** esa línea recibe los 500 completos

### Requirement: Reparto a partes iguales

Con la regla `equal`, el sistema SHALL dividir el total de gastos compartidos del periodo entre el número de líneas **no compartidas y no archivadas** de la organización, con independencia de que hayan tenido movimiento en el periodo.

#### Scenario: Tres líneas activas

- **WHEN** hay 900 de gastos en General y tres líneas no compartidas activas
- **THEN** cada línea recibe 300, incluida la que no tuvo ningún movimiento en el periodo

#### Scenario: Una línea archivada no participa

- **WHEN** una de las cuatro líneas no compartidas está archivada y hay 900 de gastos en General
- **THEN** el reparto es entre las tres activas, a 300 cada una

### Requirement: Reparto manual con porcentajes que suman 100

Con la regla `manual`, el sistema SHALL asignar a cada línea no compartida el porcentaje declarado para ella. Los porcentajes SHALL sumar exactamente 100. El sistema SHALL rechazar guardar un conjunto de porcentajes que no sume 100, y SHALL rechazar un porcentaje negativo.

Cuando se crea una línea nueva y la regla vigente es `manual`, el sistema SHALL tratar su porcentaje como 0 hasta que la organización lo declare, y SHALL avisar en la pantalla de configuración de que hay una línea sin porcentaje asignado.

#### Scenario: Porcentajes declarados

- **WHEN** la regla manual declara 50 % Sublimación, 30 % Impresión 3D y 20 % Alfarería, y hay 1.000 de gastos en General
- **THEN** el reparto asigna 500, 300 y 200 respectivamente

#### Scenario: Los porcentajes no suman 100

- **WHEN** se intenta guardar 50 %, 30 % y 10 %
- **THEN** la operación falla con un mensaje que dice cuánto suma y cuánto falta, y la configuración anterior no cambia

#### Scenario: Una línea nueva bajo regla manual

- **WHEN** existe una regla manual completa y se crea una cuarta línea de negocio
- **THEN** esa línea recibe 0 en el reparto y la pantalla de configuración avisa de que le falta porcentaje

### Requirement: Ningún resultado repartido se muestra sin su regla

Toda pantalla, tabla, gráfico y exportación que presente una cifra a la que se le aplicó reparto SHALL mostrar junto a ella, de forma legible y sin necesidad de abrir nada, qué regla se aplicó. La leyenda SHALL nombrar la regla y SHALL indicar las proporciones resultantes del periodo mostrado.

Cuando un informe **no** aplica reparto, el sistema SHALL NOT mostrar la leyenda: una leyenda presente donde no hubo reparto es tan engañosa como su ausencia donde sí lo hubo.

#### Scenario: Leyenda en el comparativo

- **WHEN** se abre el informe comparativo entre líneas con reparto proporcional
- **THEN** junto al resultado se lee la regla aplicada y la proporción con la que cada línea absorbió los gastos compartidos

#### Scenario: Leyenda en la exportación

- **WHEN** se exporta un informe que aplicó reparto
- **THEN** el archivo exportado contiene la misma leyenda, de modo que se explica solo fuera de la aplicación

#### Scenario: Un informe sin reparto no lleva leyenda

- **WHEN** se abre el informe de insumos por acabarse, que no reparte nada
- **THEN** no aparece ninguna leyenda de reparto

### Requirement: El reparto no altera el total

La suma de lo repartido entre las líneas SHALL ser igual al total de gastos compartidos del periodo, con cualquiera de las tres reglas. El sistema SHALL asignar la diferencia de redondeo a la línea de mayor importe repartido, de modo que la suma cuadre al céntimo y ninguna cifra se pierda ni se invente.

Los egresos de la línea compartida SHALL contarse **una sola vez**: una vez repartidos, SHALL NOT aparecer además como egresos propios de la línea compartida en el mismo informe.

#### Scenario: Redondeo que no cuadra

- **WHEN** se reparten 100 a partes iguales entre tres líneas
- **THEN** el reparto asigna 33,34 / 33,33 / 33,33 y su suma es exactamente 100

#### Scenario: Sin doble conteo

- **WHEN** el informe comparativo aplica el reparto de 500 de gastos de General
- **THEN** la suma de los egresos de las líneas incluye esos 500 una sola vez y la línea General no aparece además con 500 propios
