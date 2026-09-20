## Purpose

Calcula cuánto cuesta producir una pieza impresa en 3D y sugiere a cuánto venderla, con las tarifas de cada taller como parámetros y un margen que baja a medida que sube el costo de producción, para que una pieza barata no se regale y una cara no se vuelva invendible. Es la primera herramienta del registro y reemplaza la hoja de cálculo con la que el taller cotizaba.

> Origen: `specs/PRD/kamay-backlog-sprint-01.md` — KAM-27; hoja «Calculadora 3D» del taller (columnas Filamento, Tiempo, Unidades, Cantidad AMS, Llavero, Armado, Clicker y sus derivadas); `specs/PRD/ARCHITECTURE.md` (convención 4: nada derivado se almacena).

## ADDED Requirements

### Requirement: La calculadora es una herramienta del registro, reservada a la dueña

La calculadora SHALL estar en el registro con el identificador `print-cost-3d`, SHALL declarar los dos puntos de enganche (página propia y acción en el detalle del pedido), SHALL declarar que no sale a internet y que no guarda credenciales, y SHALL exigir el rol `owner`, porque muestra costos y márgenes, que en Kamay son solo de la dueña.

#### Scenario: Aparece en el catálogo

- **WHEN** la dueña abre el catálogo de herramientas
- **THEN** ve «Calculadora de impresión 3D» con su descripción y sus capacidades

#### Scenario: El ayudante no la usa

- **WHEN** la calculadora está activa y un ayudante abre `/extensions/print-cost-3d`
- **THEN** obtiene «no encontrada»

### Requirement: Entradas del cálculo

Un cálculo SHALL recibir, referidos a **una placa de impresión**: los gramos de filamento (cero o más), el tiempo de impresión en tres campos —días, horas y minutos, cada uno cero o más—, las unidades que salen de la placa (entero, uno o más), la cantidad de colores (entero, uno o más), la cantidad de armados por unidad (cero o más) y, por cada insumo extra configurado, cuántos lleva cada unidad (cero o más). Las unidades y los colores SHALL valer uno por omisión; todo lo demás, cero. Una entrada fuera de esos límites SHALL rechazarse con un mensaje junto al campo y SHALL NOT producir ningún resultado.

El tiempo de impresión SHALL entrar en la fórmula como un solo número de minutos: días × 1440 + horas × 60 + minutos. Dos escrituras del mismo tiempo SHALL dar el mismo resultado.

#### Scenario: El tiempo en días, horas y minutos

- **WHEN** la persona escribe 1 día, 2 horas y 30 minutos
- **THEN** la calculadora cuenta 1590 minutos de impresión y lo dice junto a los campos

#### Scenario: El mismo tiempo escrito de otra forma

- **WHEN** se calcula la misma placa con 11 horas y con 660 minutos
- **THEN** el costo y los precios son idénticos

#### Scenario: Horas negativas

- **WHEN** la persona escribe un número negativo de horas
- **THEN** la calculadora marca ese campo, no marca los otros dos y no muestra resultados

#### Scenario: Unidades en cero

- **WHEN** la persona escribe cero unidades por placa
- **THEN** la calculadora no muestra resultados y explica que tiene que salir al menos una unidad

#### Scenario: Gramos negativos

- **WHEN** la persona escribe una cantidad negativa de gramos
- **THEN** la calculadora no muestra resultados y marca el campo

#### Scenario: Placa vacía

- **WHEN** los gramos y el tiempo son cero y no hay armados ni insumos
- **THEN** el costo y todos los precios son cero, sin error

### Requirement: Parámetros del taller

La calculadora SHALL tomar de los parámetros de la organización: el precio del filamento por kilo (por defecto 175), el costo por hora de máquina (por defecto 2,75), el recargo por cada color adicional al primero (por defecto 15 %), el costo de un armado (por defecto 0,50), la lista de insumos extra con su nombre y su costo unitario (por defecto vacía), el fondo de fallos como porcentaje del costo (por defecto 0 %), la curva de margen unitario (por defecto 10 → 250 %, 50 → 175 %, 70 → 157 %, 80 → 150 %), la proporción del margen por mayor respecto del unitario (por defecto 80 %), el descuento por docena (por defecto 5 %) y el redondeo de los precios (sin redondeo, a 0,50 o a la unidad; por defecto a la unidad). Los importes SHALL expresarse en la moneda de la organización. Ninguna tarifa SHALL estar escrita dentro de la fórmula.

Cuando los parámetros guardados no cumplan el esquema vigente —por ejemplo, porque vienen de una versión anterior—, los campos que falten SHALL tomar su valor por defecto; si aun así no son válidos, la calculadora SHALL NOT calcular y SHALL pedir a la dueña que revise los parámetros.

#### Scenario: Recién activada

- **WHEN** la dueña activa la calculadora y la abre sin tocar los parámetros
- **THEN** calcula con los valores por defecto

#### Scenario: Cambiar una tarifa cambia el resultado

- **WHEN** la dueña sube el precio del filamento por kilo y repite el mismo cálculo
- **THEN** el costo de material sube en la misma proporción

#### Scenario: Parámetros guardados sin un campo nuevo

- **WHEN** los parámetros guardados no traen el fondo de fallos
- **THEN** la calculadora usa 0 % para ese campo y calcula

#### Scenario: Parámetros inservibles

- **WHEN** los parámetros guardados tienen una curva de margen inválida
- **THEN** la calculadora no muestra ningún precio y enlaza a la edición de parámetros

### Requirement: Costo de producción por unidad

El costo SHALL calcularse así, y cada paso SHALL mostrarse en el desglose:

- **material** = gramos × precio por kilo ÷ 1000;
- **máquina** = minutos de impresión × costo por hora ÷ 60;
- **impresión por unidad** = (material + máquina) ÷ unidades × (1 + recargo por color × (colores − 1));
- **armado** = armados × costo de un armado;
- **fondo de fallos** = (impresión por unidad + armado) × porcentaje de fallos;
- **costo por unidad** = impresión por unidad + armado + fondo de fallos.

Con los parámetros por defecto, el costo SHALL coincidir con el de la hoja de cálculo del taller para los mismos datos.

#### Scenario: Caso de referencia con varios colores y varias unidades

- **WHEN** se calcula una placa de 143 g, 660 min, 6 unidades, 2 colores y sin armados, con los parámetros por defecto
- **THEN** el costo por unidad es 10,594375

#### Scenario: Caso de referencia con armado

- **WHEN** se calcula una placa de 175 g, 484 min, 9 unidades, 2 colores y 1 armado, con los parámetros por defecto
- **THEN** el costo por unidad es 7,247731 (redondeado a seis decimales)

#### Scenario: Un solo color no recarga

- **WHEN** se calcula una placa de 175 g, 420 min, 1 unidad y 1 color
- **THEN** el costo por unidad es 49,875, igual a material más máquina

#### Scenario: Fondo de fallos

- **WHEN** el fondo de fallos es 20 % y el costo sin fondo es 10
- **THEN** el costo por unidad es 12

### Requirement: El margen unitario varía con el costo según una curva de anclas

El margen SHALL salir de una lista de anclas «costo → margen», ordenadas por costo. Para un costo igual o menor que el de la primera ancla SHALL usarse el margen de la primera; para uno igual o mayor que el de la última, el de la última; entre dos anclas, el margen SHALL interpolarse linealmente. El margen aplicado SHALL mostrarse junto al precio.

#### Scenario: Pieza barata

- **WHEN** el costo por unidad es 5 con la curva por defecto
- **THEN** el margen es 250 % y el precio antes de insumos y redondeo es 12,50

#### Scenario: Ancla exacta

- **WHEN** el costo por unidad es 50 con la curva por defecto
- **THEN** el margen es 175 % y el precio antes de insumos y redondeo es 87,50

#### Scenario: Entre dos anclas

- **WHEN** el costo por unidad es 30 con la curva por defecto
- **THEN** el margen es 212,5 % y el precio antes de insumos y redondeo es 63,75

#### Scenario: El ejemplo de la dueña

- **WHEN** el costo por unidad es 70 con la curva por defecto
- **THEN** el margen es 157 % y el precio sugerido redondeado a la unidad es 110

#### Scenario: Pieza cara

- **WHEN** el costo por unidad es 120 con la curva por defecto
- **THEN** el margen es 150 %

### Requirement: Una curva de margen nunca hace bajar el precio al subir el costo

Una curva SHALL aceptarse solo si tiene al menos una ancla, sus costos son positivos y estrictamente crecientes, sus márgenes son de 100 % o más y no crecen de un ancla a la siguiente, y **el precio resultante —costo × margen— no disminuye en ningún punto al aumentar el costo**. Una curva que no lo cumpla SHALL rechazarse al guardar los parámetros, diciendo entre qué anclas ocurre la caída. Para toda curva aceptada y todo par de costos, el de mayor costo SHALL tener un precio igual o mayor.

#### Scenario: Curva que invierte los precios

- **WHEN** la dueña intenta guardar las anclas 10 → 250 % y 12 → 150 %
- **THEN** los parámetros no se guardan y se le dice que entre 10 y 12 el precio bajaría

#### Scenario: Margen por debajo del costo

- **WHEN** la dueña intenta guardar un ancla con margen de 90 %
- **THEN** los parámetros no se guardan

#### Scenario: Una sola ancla es un margen fijo

- **WHEN** la curva tiene una única ancla 10 → 250 %
- **THEN** todo costo se multiplica por 2,5, como en la hoja de cálculo original

#### Scenario: La curva por defecto es válida

- **WHEN** se valida la curva por defecto
- **THEN** se acepta

### Requirement: Precios sugeridos

A partir del costo y del margen, la calculadora SHALL entregar:

- **insumos por unidad** = suma de cantidad × costo de cada insumo extra, que se suma **sin margen**;
- **precio unitario** = costo × margen + insumos;
- **precio por mayor** = costo × margen × proporción por mayor + insumos;
- **precio por docena** = precio por mayor × (1 − descuento por docena) × 12;
- **precio de la placa** = precio por mayor × unidades.

El redondeo configurado SHALL aplicarse solo a estos cuatro precios, cada uno calculado desde valores sin redondear; el desglose del costo SHALL mostrarse con dos decimales y sin redondeo comercial.

#### Scenario: Reproduce la hoja con margen fijo

- **WHEN** se calcula la placa de 143 g, 660 min, 6 unidades, 2 colores con un insumo de 0,50 por unidad, una curva de una sola ancla de 250 %, proporción por mayor de 80 % y sin redondeo
- **THEN** el precio unitario es 26,985938, el precio por mayor 21,68875 y el precio por docena 247,25175

#### Scenario: Los insumos no llevan margen

- **WHEN** el costo es 7,247731, el margen 250 % y cada unidad lleva un insumo de 3,00
- **THEN** el precio unitario sin redondeo es 21,119329

#### Scenario: Redondeo a la unidad

- **WHEN** el precio unitario sin redondeo es 26,87 y el redondeo es a la unidad
- **THEN** el precio unitario mostrado es 27

#### Scenario: Redondeo a cincuenta centavos

- **WHEN** el precio unitario sin redondeo es 3,35 y el redondeo es a 0,50
- **THEN** el precio unitario mostrado es 3,50

### Requirement: Nada de lo calculado se guarda

Ni el costo, ni el margen aplicado, ni ningún precio, ni las entradas de un cálculo SHALL almacenarse. Lo único persistente de la calculadora SHALL ser sus parámetros. Cada resultado SHALL recalcularse en el momento de usarse.

#### Scenario: Salir y volver

- **WHEN** la persona calcula una placa, sale de la página y vuelve
- **THEN** la calculadora está vacía y no existe ningún registro del cálculo anterior

#### Scenario: Un cálculo no deja rastro en la base

- **WHEN** la persona hace un cálculo en la página de la calculadora
- **THEN** ninguna tabla cambia y la bitácora no registra nada

### Requirement: La página de la calculadora

La página `/extensions/print-cost-3d` SHALL ofrecer las entradas, recalcular al cambiarlas, y mostrar el desglose del costo, el margen aplicado y los cuatro precios. SHALL nombrar las tarifas con las que está calculando y enlazar a la edición de parámetros. SHALL funcionar en un celular sin desplazamiento horizontal.

#### Scenario: Cálculo en vivo

- **WHEN** la dueña escribe gramos, tiempo y unidades
- **THEN** el desglose y los precios aparecen sin enviar ningún formulario

#### Scenario: De dónde salen los números

- **WHEN** la dueña mira el resultado
- **THEN** ve el precio del filamento y el costo por hora que se usaron, y un enlace para cambiarlos

### Requirement: Desde un pedido, el resultado se vuelve una línea

Con la calculadora activa, la dueña SHALL poder abrirla desde el detalle de un pedido, calcular, elegir entre el precio unitario y el precio por mayor, ajustar la descripción, la cantidad y el precio, y confirmar. Al confirmar SHALL añadirse al pedido **una línea libre** con esa descripción, esa cantidad y ese precio, por la operación del núcleo que añade una línea, sin tocar las demás líneas. La línea SHALL NOT guardar el costo ni el margen. Si el pedido no admite cambios, SHALL mostrarse el rechazo del núcleo y no SHALL añadirse nada.

#### Scenario: Añadir la línea

- **WHEN** la dueña abre la calculadora desde un pedido, calcula un precio unitario de 27, deja la descripción «Llavero calavera», cantidad 6, y confirma
- **THEN** el pedido tiene una línea nueva «Llavero calavera» de 6 × 27, sus otras líneas siguen igual, el total del pedido sube 162 y la bitácora registra la creación de la línea

#### Scenario: Precio ajustado a mano

- **WHEN** la dueña cambia el precio sugerido de 27 a 25 antes de confirmar
- **THEN** la línea se añade con 25

#### Scenario: Pedido archivado

- **WHEN** la dueña confirma sobre un pedido que fue archivado mientras calculaba
- **THEN** ve el mensaje de rechazo y el pedido no cambia

#### Scenario: Calculadora desactivada

- **WHEN** la calculadora no está activa
- **THEN** el detalle del pedido no ofrece la acción
