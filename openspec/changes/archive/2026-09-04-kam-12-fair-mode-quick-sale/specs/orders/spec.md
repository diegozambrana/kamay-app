## ADDED Requirements

### Requirement: Las consultas de ingresos incluyen las ventas directas

Toda consulta de ingresos SHALL leer pedidos y ventas directas de la **misma** fuente derivada, `order_totals`, sin unir dos orígenes distintos ni distinguir por `kind` salvo cuando el propósito de la consulta sea precisamente separarlos. El ingreso de una venta directa SHALL sumar exactamente igual que el de un pedido del mismo importe.

#### Scenario: Ingresos de la línea

- **WHEN** una línea tiene un pedido de 200 y una venta directa de 115 en el mismo periodo
- **THEN** el ingreso de la línea en ese periodo es 315

#### Scenario: Una sola fuente

- **WHEN** se calcula el ingreso de una organización
- **THEN** se obtiene de `order_totals` sin unir ninguna otra tabla de ventas

#### Scenario: El cobrado también suma

- **WHEN** una venta directa se cobra en el acto y un pedido tiene un anticipo
- **THEN** ambos aportan su `paid` al total cobrado, sin distinción por `kind`

#### Scenario: La venta directa archivada no suma

- **WHEN** una venta directa se archiva
- **THEN** deja de aparecer en `order_totals` y su ingreso deja de sumar

## MODIFIED Requirements

### Requirement: El alta es una sola operación y el estado inicial lo asigna la base

El pedido y sus líneas SHALL guardarse en una única operación de base de datos: si cualquier parte falla, no SHALL persistir ni el pedido ni ninguna línea. El estado inicial del pedido SHALL ser el estado de tipo `initial` del juego de estados resuelto para su línea y el flujo `order`, decidido por la base de datos; el formulario SHALL NOT elegir ni enviar el estado. La operación SHALL rechazar un alta sin líneas. Cada línea SHALL guardar el precio unitario tal como se registró. El identificador del pedido y el de cada línea SHALL poder generarse en el cliente.

La operación de alta SHALL ser idempotente respecto de ese identificador: invocarla de nuevo con el identificador de un pedido que ya existe SHALL NOT crear un segundo pedido, SHALL NOT consumir un número de pedido visible adicional, SHALL NOT duplicar ninguna línea y SHALL devolver el identificador del pedido existente. Si ese identificador pertenece a un pedido de otra organización, la operación SHALL rechazarse con un error y SHALL NOT modificar ni adoptar el pedido ajeno.

Esta operación SHALL ser exclusiva de los pedidos: SHALL crear siempre filas con `kind = 'order'` y SHALL NOT aceptar el `kind` como parámetro. La venta directa SHALL entrar por su propia operación, que nace en un estado de tipo `final` y no exige cliente. Las dos vías SHALL permanecer separadas, de modo que un cambio en el alta de pedidos no pueda alterar el alta de ventas de feria ni al revés.

#### Scenario: Nace en el estado inicial de su línea

- **WHEN** se guarda un pedido de una línea cuyo juego tiene como estado de tipo `initial` uno llamado «Registrado»
- **THEN** el pedido queda en ese estado y aparece en esa columna del tablero

#### Scenario: Renombrar el estado inicial no cambia el comportamiento

- **WHEN** el dueño renombra el estado de tipo `initial` de la línea y luego se guarda un pedido nuevo
- **THEN** el pedido queda igualmente en el estado de tipo `initial`, ahora con su nombre nuevo

#### Scenario: Un fallo deja todo como estaba

- **WHEN** la operación de alta falla al guardar una de las líneas
- **THEN** no existe ningún pedido nuevo ni ninguna línea nueva, y no se consumió ningún número de pedido visible

#### Scenario: La base rechaza el alta sin líneas

- **WHEN** se invoca la operación de alta con la lista de líneas vacía
- **THEN** la base de datos rechaza la operación con un mensaje comprensible

#### Scenario: Alta registrada en la bitácora

- **WHEN** se guarda un pedido con dos líneas
- **THEN** la bitácora contiene un evento de creación del pedido y uno por cada línea, y el detalle muestra el pedido como «Registrado» en su historial

#### Scenario: El mismo pedido enviado dos veces

- **WHEN** se invoca el alta dos veces con el mismo identificador de pedido y las mismas líneas
- **THEN** existe un solo pedido, con un solo número visible y sin líneas duplicadas, y la segunda invocación devuelve el identificador del pedido ya existente

#### Scenario: El reenvío no ensucia la bitácora

- **WHEN** se reenvía un alta ya guardada
- **THEN** la bitácora sigue conteniendo un único evento de creación de ese pedido

#### Scenario: Identificador que pertenece a otra organización

- **WHEN** se invoca el alta con el identificador de un pedido de otra organización
- **THEN** la operación es rechazada con un error y el pedido ajeno queda intacto

#### Scenario: El alta de pedidos no crea ventas directas

- **WHEN** se invoca la operación de alta de pedidos intentando indicar `kind = 'direct_sale'`
- **THEN** la fila creada tiene `kind = 'order'` y queda sujeta a la exigencia de cliente, o la operación se rechaza

#### Scenario: El alta de pedidos exige cliente

- **WHEN** se invoca la operación de alta de pedidos sin cliente
- **THEN** la operación se rechaza, aunque la venta directa sí lo admita

### Requirement: Vistas alternativas y filtros del tablero

El sistema SHALL ofrecer, sobre el mismo conjunto de pedidos, una vista de lista y una vista de calendario ordenada por fecha comprometida, además del tablero. SHALL permitir filtrar los pedidos mostrados y SHALL ofrecer un filtro "Ver archivados" que, desactivado, oculta los pedidos archivados y, activado, los muestra. El cambio de vista SHALL conservar los filtros aplicados.

Las tres vistas SHALL mostrar únicamente pedidos —filas con `kind = 'order'`— y SHALL excluir siempre las ventas directas, que no tienen ciclo de producción que recorrer. Esta exclusión SHALL NOT depender de ningún filtro que el usuario pueda desactivar, ni siquiera de "Ver archivados".

#### Scenario: Pedido archivado oculto por defecto

- **WHEN** se abre el tablero sin activar "Ver archivados"
- **THEN** los pedidos con `archived_at` no aparecen en ninguna de las tres vistas

#### Scenario: Ver archivados

- **WHEN** se activa el filtro "Ver archivados"
- **THEN** los pedidos archivados aparecen, distinguidos de los activos

#### Scenario: Vista de calendario

- **WHEN** se cambia a la vista de calendario
- **THEN** los pedidos aparecen ubicados por su fecha comprometida y los que no tienen fecha se muestran aparte

#### Scenario: Los filtros sobreviven al cambio de vista

- **WHEN** se aplica un filtro en el tablero y se cambia a la vista de lista
- **THEN** el filtro sigue aplicado

#### Scenario: La venta directa no aparece en el tablero

- **WHEN** se registra una venta directa en una línea y se abre su tablero
- **THEN** la venta no aparece en ninguna columna, ni en la de estado final

#### Scenario: La venta directa tampoco aparece en lista ni calendario

- **WHEN** se cambia a la vista de lista y a la de calendario
- **THEN** la venta directa no aparece en ninguna de las dos

#### Scenario: Ver archivados no la trae de vuelta

- **WHEN** se activa "Ver archivados" en cualquiera de las tres vistas
- **THEN** las ventas directas siguen sin aparecer, archivadas o no
