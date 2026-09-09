# reports Specification

## Purpose

La pantalla V14 · Reportes: un periodo y una línea que gobiernan cinco informes —rentabilidad, en qué se va el dinero, qué se vende más, insumos por acabarse y comparativo entre líneas—, con cifras que cuadran entre sí, cada fila abriendo su registro de origen, exportación con contexto, y acceso exclusivo de la persona dueña impuesto en la base de datos.

> Origen: `specs/PRD/kamay-backlog.md` — KAM-20; `specs/PRD/kamay-especificacion-producto-v6.md` — §2 (las siete preguntas), V14, §16 (matriz de acceso); `specs/PRD/kamay-mapa-navegacion-ui.md` §4.1, §5 y § Adaptación móvil (V14 y sus destinos); `specs/PRD/ARCHITECTURE.md` (convención 1: ninguna consulta fuera de `services/`; convención 4: nada derivado se almacena).

## Requirements

### Requirement: Reportes es una página completa reservada a la persona dueña

El sistema SHALL ofrecer los reportes en `/reports` como página completa, cuya dirección se puede compartir. El acceso SHALL estar reservado a la persona dueña de la organización activa.

La entrada *Reportes* SHALL NOT aparecer en la navegación de un ayudante, ni en la barra superior de escritorio ni en el menú *Más* del móvil. Un ayudante que escriba la dirección directamente SHALL ser redirigido y SHALL NOT recibir del servidor ninguna cifra de ningún informe. El rol SHALL resolverse en el servidor antes del primer render: la pantalla SHALL NOT mostrar primero un informe y retirarlo después.

El recorte SHALL sostenerse también fuera de la aplicación: un ayudante que consulte directamente cualquiera de los derivados que alimentan los informes SHALL obtener cero filas.

#### Scenario: El ayudante no ve la entrada

- **WHEN** un ayudante abre la aplicación
- **THEN** *Reportes* no aparece en su barra superior ni en su menú *Más*

#### Scenario: El ayudante escribe la dirección

- **WHEN** un ayudante navega a `/reports`
- **THEN** es redirigido y ninguna cifra de ningún informe llega a su navegador

#### Scenario: El ayudante consulta el derivado a mano

- **WHEN** un ayudante consulta directamente el derivado que alimenta cualquiera de los cinco informes
- **THEN** obtiene cero filas

#### Scenario: La dueña entra por dirección directa

- **WHEN** una persona dueña abre `/reports` desde un enlace guardado
- **THEN** la pantalla se compone con el periodo por defecto y sus cinco informes

### Requirement: Un solo periodo gobierna los cinco informes

La pantalla SHALL ofrecer un selector de periodo con atajos —**este mes**, **mes anterior**, **últimos 3 meses**, **este año**— y un **rango libre** con fecha de inicio y fecha de fin. El periodo por defecto al abrir la pantalla sin indicación SHALL ser el mes en curso.

El periodo elegido SHALL aplicarse **a los cinco informes a la vez**: el sistema SHALL NOT permitir que dos informes de la misma pantalla se lean sobre rangos distintos. Al cambiar el periodo, los cinco SHALL recalcularse.

Los límites del periodo SHALL cortarse en la zona horaria de la organización, no en la del servidor ni en la del navegador. El rango SHALL incluir su día inicial y su día final completos.

El periodo activo SHALL quedar reflejado en la dirección, de modo que compartir el enlace reproduzca exactamente el mismo recorte. Un rango libre cuya fecha de fin sea anterior a la de inicio SHALL rechazarse con un mensaje, sin recalcular nada.

#### Scenario: Cambiar el periodo recalcula todo

- **WHEN** la persona dueña pasa de "este mes" a "mes anterior"
- **THEN** los cinco informes se recalculan sobre el mes anterior y ninguno conserva cifras del mes en curso

#### Scenario: Las cifras cuadran entre informes

- **WHEN** se compara el total de egresos del informe *en qué se va el dinero* con la columna de egresos del informe comparativo, sobre el mismo periodo
- **THEN** ambas cifras son iguales

#### Scenario: El corte respeta la zona horaria de la organización

- **WHEN** un cobro ocurre a las 21:00 del último día del mes en La Paz, hora que en UTC ya pertenece al mes siguiente
- **THEN** ese cobro cuenta en el mes que terminaba y no en el siguiente

#### Scenario: El enlace reproduce el recorte

- **WHEN** se comparte la dirección de la pantalla con un periodo de rango libre elegido
- **THEN** al abrirla se ve el mismo rango, sin volver al mes en curso

#### Scenario: Rango invertido

- **WHEN** se pide un rango libre cuya fecha de fin es anterior a la de inicio
- **THEN** la pantalla lo rechaza con un mensaje y mantiene el periodo anterior

### Requirement: El selector de línea filtra cuatro informes y el comparativo lo ignora

La pantalla SHALL ofrecer un selector de línea con la opción **Todas**, cuyo valor inicial SHALL ser la línea activa de la sesión.

Cuatro informes —rentabilidad, en qué se va el dinero, qué se vende más e insumos por acabarse— SHALL respetar ese selector. El **informe comparativo entre líneas** SHALL mostrar siempre todas las líneas no archivadas, con independencia de la línea seleccionada, porque su valor está justamente en verlas juntas; la pantalla SHALL indicarlo junto al informe para que la excepción no se lea como un fallo.

Cambiar la línea en este selector SHALL NOT cambiar la línea activa del resto de la aplicación.

#### Scenario: Cuatro informes se filtran

- **WHEN** se selecciona Alfarería
- **THEN** rentabilidad, en qué se va el dinero, qué se vende más e insumos por acabarse muestran solo datos de Alfarería

#### Scenario: El comparativo no se filtra

- **WHEN** se selecciona Alfarería
- **THEN** el informe comparativo sigue mostrando las tres líneas, y junto a él se lee que ese informe muestra siempre todas

#### Scenario: La selección no se propaga

- **WHEN** se selecciona Alfarería en reportes y después se navega al tablero de pedidos
- **THEN** el tablero conserva la línea que estaba activa antes de entrar a reportes

### Requirement: Informe de rentabilidad

El informe SHALL responder cuánto se gana realmente, en dos vistas conmutables: **por pedido** y **por producto**.

Por pedido, cada fila SHALL mostrar el pedido, su fecha, su línea, sus **ingresos**, su **costo de materiales**, su **margen** y su **porcentaje de margen**. Por producto, cada fila SHALL mostrar el ítem, las **unidades vendidas** y las mismas cuatro cifras agregadas.

El costo de materiales SHALL componerse de los **egresos asignados al pedido**, tomados por su total derivado. El sistema SHALL NOT deducir costo de ninguna receta ni de ninguna composición de producto, y SHALL NOT atribuir a un pedido los consumos de inventario registrados desde él: el consumo no declara a qué pedido pertenece, y adivinarlo desde su nota daría una cifra que nadie puede auditar.

Un pedido sin egresos asignados SHALL mostrar costo cero y SHALL señalarse como **sin costo registrado**. Esa marca SHALL ser visible en la fila, y SHALL poder filtrarse: como la mayoría de los pedidos no tendrá egreso asignado, distinguir «margen alto» de «costo no capturado» es la función principal del informe, no un detalle de presentación.

El margen SHALL poder ser negativo. El porcentaje de margen SHALL mostrarse vacío, y no cero ni error, cuando los ingresos de la fila sean cero.

#### Scenario: Margen de un pedido con costo

- **WHEN** un pedido ingresó 1.000 y tiene 400 de consumos y egresos asignados
- **THEN** la fila muestra 1.000 de ingresos, 400 de costo, 600 de margen y 60 % de margen

#### Scenario: Pedido sin costo registrado

- **WHEN** un pedido ingresó 500 y no tiene ningún consumo ni egreso asignado
- **THEN** la fila muestra 0 de costo y 100 % de margen, y se señala como sin costo registrado

#### Scenario: Margen negativo

- **WHEN** un pedido ingresó 200 y sus costos suman 300
- **THEN** la fila muestra un margen de −100 y se presenta como negativo, sin recortarse a cero

#### Scenario: Ingresos cero

- **WHEN** un pedido del periodo no registra ningún ingreso y sí 80 de costo
- **THEN** el margen es −80 y el porcentaje de margen aparece vacío, sin división por cero

#### Scenario: Un consumo de inventario no cuenta como costo del pedido

- **WHEN** se registra un consumo de insumos desde el detalle de un pedido y después se abre el informe de rentabilidad
- **THEN** ese consumo no suma al costo del pedido, y la fila sigue marcada como sin costo registrado si no tiene ningún egreso asignado

#### Scenario: Filtrar los pedidos sin costo capturado

- **WHEN** se filtra el informe por las filas marcadas sin costo registrado
- **THEN** se listan solo los pedidos sin ningún egreso asignado, separados de aquellos cuyo margen sí está respaldado

### Requirement: Informe de en qué se va el dinero

El informe SHALL desglosar los egresos del periodo por **categoría de gasto** y por **línea**, distinguiendo compras de gastos, y SHALL mostrar para cada fila su importe y su **peso relativo** sobre el total de egresos del periodo.

Las compras, que no llevan categoría de gasto, SHALL agruparse bajo una entrada propia y explícita, y SHALL NOT mezclarse con una categoría de gasto real ni desaparecer del total.

El informe SHALL ordenarse por importe descendente de forma predeterminada, y SHALL poder ordenarse por nombre.

#### Scenario: Desglose por categoría

- **WHEN** el periodo tiene 600 en Insumos, 300 en Servicios y 100 en Transporte
- **THEN** el informe muestra las tres categorías ordenadas de mayor a menor, con pesos de 60 %, 30 % y 10 %

#### Scenario: Las compras tienen su propia entrada

- **WHEN** el periodo tiene 400 en compras a proveedores y 600 en gastos por categoría
- **THEN** las compras aparecen como entrada propia por 400, el total del periodo es 1.000 y ninguna categoría de gasto las absorbe

#### Scenario: Un periodo sin egresos

- **WHEN** el periodo no tiene ningún egreso
- **THEN** el informe se muestra vacío con una leyenda, sin filas inventadas y sin error de porcentaje

### Requirement: Informe de qué se vende más, ordenable por unidades y por margen

El informe SHALL listar los productos vendidos en el periodo, con **unidades vendidas**, **ingresos**, **margen** y **canal de venta** predominante, y SHALL permitir ordenarlo tanto por unidades como por margen.

Ambas columnas SHALL estar visibles simultáneamente en las dos ordenaciones: el propósito declarado del informe es distinguir el producto que vende mucho y deja poco, y ocultar una de las dos columnas al ordenar por la otra lo haría imposible.

Las **ventas directas** SHALL contar en este informe igual que los pedidos.

#### Scenario: Ordenar por unidades

- **WHEN** se ordena por unidades
- **THEN** el producto de más unidades encabeza la lista y su margen sigue visible en su fila

#### Scenario: Ordenar por margen

- **WHEN** se ordena por margen
- **THEN** el producto de mayor margen encabeza la lista y sus unidades siguen visibles en su fila

#### Scenario: El que vende mucho y deja poco

- **WHEN** un producto lidera en unidades y ocupa el último lugar en margen
- **THEN** ambas posiciones son visibles en la misma tabla sin cambiar de informe

#### Scenario: Las ventas de feria cuentan

- **WHEN** el periodo incluye ventas directas de feria de un producto
- **THEN** esas unidades y ese margen suman en la fila de ese producto

### Requirement: Informe de insumos por acabarse

El informe SHALL listar los insumos cuyo saldo está por debajo de su nivel mínimo, con **saldo actual**, **mínimo**, **faltante**, **último costo conocido** y **proveedor habitual**.

El informe SHALL derivarse del saldo vivo de inventario y SHALL NOT recortarse por el periodo: "estoy por quedarme sin esto" es una pregunta sobre hoy, no sobre un rango. La pantalla SHALL indicarlo junto al informe, para que su indiferencia al selector de periodo no se lea como un fallo.

Cada fila SHALL ofrecer **crear una tarea de reposición**, que SHALL abrir el alta de tarea prellenada con el insumo, su faltante y la línea correspondiente.

Un insumo sin mínimo declarado SHALL NOT aparecer nunca en este informe.

#### Scenario: Insumo bajo mínimo

- **WHEN** un insumo tiene saldo 3 y mínimo 10
- **THEN** aparece en el informe con faltante 7, su último costo y su proveedor habitual

#### Scenario: Insumo sin mínimo declarado

- **WHEN** un insumo tiene saldo 0 y no tiene mínimo declarado
- **THEN** no aparece en el informe

#### Scenario: El periodo no lo recorta

- **WHEN** se cambia el periodo a un trimestre pasado
- **THEN** el informe sigue mostrando los insumos que están bajo mínimo hoy, y lo indica junto al informe

#### Scenario: Tarea de reposición

- **WHEN** se pulsa crear tarea de reposición en la fila de un insumo
- **THEN** se abre el alta de tarea prellenada con ese insumo, su faltante y su línea

### Requirement: Informe comparativo entre líneas

El informe SHALL mostrar **todas** las líneas de negocio no archivadas de la organización, cada una con sus **ingresos**, sus **egresos** y su **margen** del periodo, más una fila de **total**.

Los egresos de cada línea SHALL incluir la parte que le corresponde de los gastos de la línea compartida, según la regla de reparto vigente, y el informe SHALL mostrar la regla aplicada junto al resultado. La línea compartida SHALL NOT aparecer como una fila más: sus gastos ya están repartidos entre las demás.

Una línea sin ningún movimiento en el periodo SHALL aparecer igualmente, con ceros, y no SHALL omitirse: su ausencia de la tabla y su ausencia de actividad son dos lecturas distintas.

#### Scenario: Las tres líneas presentes

- **WHEN** se abre el comparativo de un periodo en el que Alfarería no vendió nada
- **THEN** las tres líneas aparecen, y Alfarería aparece con ceros en lugar de desaparecer

#### Scenario: Los gastos compartidos ya están dentro

- **WHEN** el periodo tiene 500 de gastos en General y el reparto vigente los distribuye
- **THEN** cada línea muestra sus egresos con su parte incluida, no hay fila General, y la regla aplicada se lee junto al resultado

#### Scenario: El total cuadra

- **WHEN** se suman los ingresos, los egresos y los márgenes de todas las filas
- **THEN** cada suma coincide con la fila de total, y el margen total es la resta de los otros dos

### Requirement: Cada fila abre su registro de origen

Toda fila de todo informe SHALL abrir el registro del que sale. Una fila de rentabilidad por pedido SHALL abrir el detalle del pedido; una fila por producto y una fila de insumos SHALL abrir el detalle del ítem; una fila de egresos SHALL abrir el detalle del egreso; una fila del ranking SHALL abrir el detalle del ítem.

El sistema SHALL NOT presentar filas que no abran nada: si una fila agrega varios registros, SHALL abrir el listado ya filtrado por el mismo criterio y periodo con el que se compuso la fila.

#### Scenario: Fila de un pedido

- **WHEN** se abre una fila del informe de rentabilidad por pedido
- **THEN** se llega al detalle de ese pedido

#### Scenario: Fila de una categoría de gasto

- **WHEN** se abre la fila de la categoría Insumos del informe de egresos
- **THEN** se llega a la bandeja de egresos ya filtrada por esa categoría y por el mismo periodo del informe

#### Scenario: Fila de un insumo

- **WHEN** se abre una fila del informe de insumos por acabarse
- **THEN** se llega al detalle de ese ítem

### Requirement: Exportación de cualquier informe con sus filtros y su contexto

El sistema SHALL permitir exportar cualquiera de los cinco informes a un archivo de hoja de cálculo, **con los filtros y la ordenación aplicados en pantalla** y no con el informe completo sin filtrar.

El archivo exportado SHALL contener, además de las filas, el **periodo** y la **línea** con los que se compuso, y —cuando el informe aplique reparto— la **leyenda de la regla**. Las cifras SHALL exportarse como números sin formato de moneda, para que quien siga calculando no tenga que limpiarlas.

El nombre del archivo SHALL identificar el informe y el periodo.

#### Scenario: Exporta lo que se ve

- **WHEN** se exporta el ranking ordenado por margen y filtrado por Sublimación
- **THEN** el archivo contiene exactamente esas filas, en ese orden, y ninguna de otra línea

#### Scenario: El archivo se explica solo

- **WHEN** se abre el archivo exportado del comparativo fuera de la aplicación
- **THEN** se lee en él el periodo, la línea y la regla de reparto aplicada

#### Scenario: Cifras utilizables

- **WHEN** se abre el archivo exportado en una hoja de cálculo
- **THEN** las columnas de importe se pueden sumar sin limpiar símbolos de moneda ni separadores

### Requirement: La pantalla responde dentro de su presupuesto

Con doce meses de movimientos sembrados, la pantalla completa con sus cinco informes SHALL responder en **menos de 3 segundos** desde la petición hasta que los cinco están pintados con sus cifras definitivas.

La medición SHALL hacerse sobre la carga completa de la ruta, no sobre una pintura parcial ni sobre un esqueleto de carga.

#### Scenario: Doce meses de datos

- **WHEN** una persona dueña abre `/reports` con un periodo de doce meses sobre la semilla ampliada
- **THEN** los cinco informes quedan pintados con sus cifras en menos de 3 segundos

### Requirement: Los informes se adaptan al móvil

En pantallas estrechas la pantalla SHALL mostrar **un informe por vez**, con los dos selectores en la cabecera y un conmutador entre informes, en lugar de apilar los cinco.

Las tablas SHALL seguir siendo legibles y ordenables en esa disposición, y la exportación SHALL seguir disponible.

#### Scenario: Un informe por pantalla

- **WHEN** se abre `/reports` en un ancho de 390 px
- **THEN** se ve un informe con los selectores arriba y un conmutador para pasar a los otros cuatro
