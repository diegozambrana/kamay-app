## Purpose

Registra y muestra el trabajo comprometido con clientes: un pedido atraviesa los estados de su línea de negocio durante días, y el tablero es donde el taller ve qué está en cola, qué se está haciendo y qué va retrasado. El total nunca se almacena y el flujo nunca se codifica: ambos se derivan.

> Origen: `specs/PRD/kamay-backlog.md` — KAM-07; `specs/PRD/kamay-esquema-base-de-datos-supabase.md` §9, §16, § Vistas derivadas, § Matriz de acceso; `specs/PRD/kamay-especificacion-producto-v6.md` — V3 y V4; `specs/PRD/kamay-mapa-navegacion-ui.md`; `specs/PRD/ARCHITECTURE.md` (convención 4: nada derivado se almacena; convención 5: los estados se comparan por `kind`).

## ADDED Requirements

### Requirement: Modelo de pedido con cliente obligatorio

El sistema SHALL almacenar los pedidos en la tabla `orders` según el esquema canónico, con `kind` restringido a `order` o `direct_sale`, `business_line_id` obligatorio, `status_id` obligatorio, y los campos opcionales `contact_id`, `sales_channel_id`, `delivery_mode` (`pickup` o `delivery`), `due_date`, `queued_at`, `notes` y `archived_at`. La restricción `order_needs_customer` SHALL exigir `contact_id` cuando `kind = 'order'`, dejándolo opcional para `direct_sale`.

#### Scenario: Pedido sin cliente

- **WHEN** se intenta guardar una fila con `kind = 'order'` y `contact_id` nulo
- **THEN** la base de datos rechaza la operación por la restricción `order_needs_customer`

#### Scenario: Venta directa sin cliente

- **WHEN** se guarda una fila con `kind = 'direct_sale'` y `contact_id` nulo
- **THEN** la operación se acepta

#### Scenario: Modo de entrega fuera del dominio

- **WHEN** se intenta guardar un pedido con `delivery_mode` distinto de `pickup` o `delivery`
- **THEN** la base de datos rechaza la operación

### Requirement: Numeración visible por organización sin duplicados

El sistema SHALL asignar a cada pedido un número visible `code` entero, único dentro de su organización, mediante un trigger `before insert` que toma el siguiente valor disponible en esa organización. Cada organización SHALL numerar desde 1 con independencia de las demás. La asignación SHALL resistir inserciones simultáneas sin producir dos pedidos con el mismo `code` en la misma organización.

#### Scenario: Primer pedido de una organización

- **WHEN** se inserta el primer pedido de una organización
- **THEN** su `code` es 1

#### Scenario: Numeración independiente entre organizaciones

- **WHEN** dos organizaciones distintas insertan su primer pedido
- **THEN** ambos reciben `code = 1` y ninguna restricción de unicidad se viola

#### Scenario: Inserciones simultáneas

- **WHEN** varias transacciones concurrentes insertan pedidos en la misma organización
- **THEN** cada uno recibe un `code` distinto y ninguna inserción falla por duplicado

#### Scenario: El número no se reutiliza

- **WHEN** el pedido con el `code` más alto de una organización se archiva y luego se crea un pedido nuevo
- **THEN** el pedido nuevo recibe un `code` mayor, no el del archivado

### Requirement: Líneas de pedido con precio propio

El sistema SHALL almacenar las líneas de un pedido en la tabla `order_items`, cada una con `quantity` mayor que cero, `unit_price` mayor o igual a cero, y opcionalmente `item_id`, `variant_id` y una `description` libre para la personalización. El `unit_price` SHALL quedar registrado en la línea del pedido, de modo que un cambio posterior en el precio del catálogo no altere ningún pedido ya registrado.

#### Scenario: Cantidad no positiva

- **WHEN** se intenta guardar una línea con `quantity` igual a cero o negativa
- **THEN** la base de datos rechaza la operación

#### Scenario: Precio negativo

- **WHEN** se intenta guardar una línea con `unit_price` negativo
- **THEN** la base de datos rechaza la operación

#### Scenario: El precio del catálogo cambia después

- **WHEN** cambia el precio de un ítem del catálogo que ya figuraba en un pedido registrado
- **THEN** la línea de ese pedido conserva el `unit_price` con el que se registró

### Requirement: El total del pedido se deriva, nunca se almacena

El sistema SHALL exponer el total de cada pedido a través de la vista `order_totals`, declarada con `security_invoker = true`, calculado como la suma de `quantity * unit_price` de sus líneas. Ninguna columna de `orders` SHALL almacenar total, saldo ni margen.

#### Scenario: Total de un pedido con líneas

- **WHEN** un pedido tiene dos líneas de 3 × 25 y 1 × 40
- **THEN** `order_totals` devuelve 115 como total de ese pedido

#### Scenario: Pedido sin líneas

- **WHEN** un pedido no tiene ninguna línea
- **THEN** `order_totals` devuelve 0 como total, no nulo

#### Scenario: Se agrega una línea

- **WHEN** se agrega una línea a un pedido existente
- **THEN** el total devuelto por `order_totals` refleja el cambio sin ninguna operación de recálculo

#### Scenario: Ninguna columna almacena el derivado

- **WHEN** se inspecciona la definición de la tabla `orders`
- **THEN** no existe ninguna columna de total, saldo, cobrado ni margen

### Requirement: Las columnas del tablero salen del juego de estados de la línea

El tablero de pedidos SHALL construir sus columnas resolviendo el juego de estados aplicable a la línea activa para el flujo `order`, en el orden declarado por ese juego. El tablero SHALL NOT contener ninguna lista de estados fija ni condicional por línea escrita en el código.

#### Scenario: Línea con juego propio de seis estados

- **WHEN** se abre el tablero con la línea Sublimación activa, cuyo juego propio tiene seis estados
- **THEN** el tablero muestra exactamente esos seis estados, en el orden declarado

#### Scenario: Línea con juego propio de tres estados

- **WHEN** se abre el tablero con la línea Alfarería activa, cuyo juego propio tiene tres estados
- **THEN** el tablero muestra exactamente esos tres, sin ninguna columna del juego de Sublimación

#### Scenario: Línea sin juego propio

- **WHEN** se abre el tablero con una línea que no tiene juego propio
- **THEN** el tablero muestra las columnas del juego de la organización

#### Scenario: Un estado se renombra

- **WHEN** el dueño renombra un estado del juego de una línea
- **THEN** la columna correspondiente del tablero pasa a mostrar el nombre nuevo sin ningún cambio de código

### Requirement: Mover un pedido de estado

El sistema SHALL permitir cambiar el estado de un pedido arrastrando su tarjeta a otra columna del tablero. La interfaz SHALL reflejar el movimiento de inmediato, sin esperar la confirmación del servidor, y SHALL revertir la tarjeta a su columna anterior mostrando el error si la operación falla. Todo cambio de estado SHALL quedar registrado en la bitácora.

#### Scenario: Arrastre exitoso

- **WHEN** se arrastra un pedido a otra columna y el servidor confirma
- **THEN** el pedido queda en el estado de la columna destino y la bitácora registra el cambio con su estado anterior y el nuevo

#### Scenario: La tarjeta no espera al servidor

- **WHEN** se suelta un pedido en otra columna
- **THEN** la tarjeta aparece en la columna destino antes de que llegue la respuesta del servidor

#### Scenario: El servidor rechaza el movimiento

- **WHEN** se arrastra un pedido y la operación falla
- **THEN** la tarjeta vuelve a su columna original y se muestra un mensaje de error comprensible

#### Scenario: Destino fuera del juego de la línea

- **WHEN** se intenta asignar a un pedido un estado que no pertenece al juego resuelto de su línea para el flujo `order`
- **THEN** la operación se rechaza con un mensaje comprensible

### Requirement: La columna en cola se ordena por llegada y muestra posición

En toda columna cuyo estado tenga `is_queue = true`, el sistema SHALL ordenar los pedidos por `queued_at` ascendente —momento de entrada a la cola— y SHALL mostrar en cada tarjeta su número de posición consecutivo empezando en 1. El orden SHALL NOT depender de la fecha comprometida ni de la fecha de creación.

#### Scenario: Tres pedidos en cola

- **WHEN** tres pedidos entran a la columna en cola en un orden y tienen fechas comprometidas en el orden inverso
- **THEN** aparecen numerados 1, 2 y 3 por orden de entrada, no por fecha comprometida

#### Scenario: Entrada a la cola

- **WHEN** un pedido pasa a un estado con `is_queue = true`
- **THEN** se registra su `queued_at` con ese momento y aparece al final de la cola

#### Scenario: Salida y regreso a la cola

- **WHEN** un pedido sale de la columna en cola y más tarde vuelve a entrar
- **THEN** su `queued_at` se actualiza al nuevo momento de entrada y aparece al final de la cola, no en su posición anterior

#### Scenario: Columna que no es cola

- **WHEN** se ve una columna cuyo estado tiene `is_queue = false`
- **THEN** sus tarjetas no muestran número de posición

### Requirement: Reordenar la cola renumera al resto

El sistema SHALL permitir mover un pedido a otra posición dentro de la columna en cola. Tras el movimiento, las posiciones visibles de todos los pedidos de esa columna SHALL ser consecutivas desde 1, sin huecos ni repeticiones, y el orden resultante SHALL persistir al recargar.

#### Scenario: Se adelanta un pedido

- **WHEN** el pedido en posición 3 se mueve a la posición 1
- **THEN** pasa a mostrarse como 1 y los que ocupaban 1 y 2 pasan a 2 y 3

#### Scenario: Se retrasa un pedido

- **WHEN** el pedido en posición 1 se mueve al final de una cola de tres
- **THEN** pasa a mostrarse como 3 y los otros dos avanzan a 1 y 2

#### Scenario: El orden persiste

- **WHEN** se recarga el tablero después de reordenar la cola
- **THEN** las posiciones son las mismas que quedaron tras el reordenamiento

### Requirement: La alerta de retraso se decide por el tipo de estado

El sistema SHALL mostrar alerta de retraso en un pedido cuya `due_date` ya pasó **solo si** el `kind` de su estado es `initial` o `in_progress`. Un pedido vencido cuyo estado sea de tipo `waiting`, `final` o `cancelled` SHALL NOT mostrar alerta. La decisión SHALL compararse contra `kind`, nunca contra el nombre del estado.

#### Scenario: Vencido y en espera

- **WHEN** un pedido con fecha comprometida vencida está en un estado de tipo `waiting`
- **THEN** no muestra alerta de retraso

#### Scenario: Vencido y en proceso

- **WHEN** un pedido con fecha comprometida vencida está en un estado de tipo `in_progress`
- **THEN** muestra alerta de retraso

#### Scenario: Vencido y terminado

- **WHEN** un pedido con fecha comprometida vencida está en un estado de tipo `final` o `cancelled`
- **THEN** no muestra alerta de retraso

#### Scenario: Sin fecha comprometida

- **WHEN** un pedido sin `due_date` está en un estado de tipo `in_progress`
- **THEN** no muestra alerta de retraso

#### Scenario: Ninguna comparación por nombre

- **WHEN** se renombra el estado de espera de una línea a cualquier otro texto
- **THEN** el comportamiento de la alerta no cambia

### Requirement: Tarjeta del tablero

Cada tarjeta del tablero SHALL mostrar el número del pedido, el cliente, un resumen de lo pedido, la fecha comprometida, el modo de entrega distinguible entre recojo y delivery, el color de su línea de negocio y, cuando corresponda, la alerta de retraso y el número de posición en cola.

#### Scenario: Pedido con modo de entrega

- **WHEN** un pedido tiene `delivery_mode = 'delivery'`
- **THEN** su tarjeta lo distingue visualmente de uno con `pickup`

#### Scenario: Datos opcionales ausentes

- **WHEN** un pedido no tiene fecha comprometida ni modo de entrega
- **THEN** la tarjeta se muestra sin esos elementos y sin error

#### Scenario: Abrir el detalle

- **WHEN** se activa una tarjeta del tablero
- **THEN** se abre el detalle de ese pedido

### Requirement: Vistas alternativas y filtros del tablero

El sistema SHALL ofrecer, sobre el mismo conjunto de pedidos, una vista de lista y una vista de calendario ordenada por fecha comprometida, además del tablero. SHALL permitir filtrar los pedidos mostrados y SHALL ofrecer un filtro "Ver archivados" que, desactivado, oculta los pedidos archivados y, activado, los muestra. El cambio de vista SHALL conservar los filtros aplicados.

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

### Requirement: Detalle del pedido

El detalle de un pedido SHALL mostrar su número, cliente, línea de negocio, canal de venta, modo de entrega, sus líneas con cantidad y precio unitario, el total derivado, la fecha comprometida y la fecha del hecho, las notas, las imágenes de referencia y el historial del pedido leído de la bitácora. El detalle SHALL permitir cambiar el estado del pedido y navegar al cliente.

#### Scenario: Pedido completo

- **WHEN** se abre el detalle de un pedido con líneas, notas e imágenes
- **THEN** se muestran todos sus datos y el total calculado desde sus líneas

#### Scenario: Historial

- **WHEN** un pedido ha cambiado de estado dos veces
- **THEN** su historial muestra ambos cambios en orden cronológico, leídos de la bitácora

#### Scenario: Cambio de estado desde el detalle

- **WHEN** se cambia el estado del pedido desde su detalle
- **THEN** el estado cambia, el historial lo registra y el tablero refleja el cambio al volver

#### Scenario: Imagen de referencia

- **WHEN** un pedido tiene una imagen de referencia adjunta
- **THEN** se muestra en el detalle y solo es accesible para miembros de la organización del pedido

### Requirement: Aislamiento, roles y archivado de pedidos

Las tablas `orders` y `order_items` SHALL tener RLS activo con el patrón del proyecto: los miembros de la organización leen, crean y editan; ninguna SHALL tener política `DELETE`. Un pedido SHALL retirarse marcando `archived_at`, nunca eliminándose. El ayudante SHALL poder leer, crear y editar pedidos y sus líneas, y SHALL NOT poder archivarlos.

#### Scenario: Miembro de otra organización

- **WHEN** un usuario consulta pedidos de una organización a la que no pertenece
- **THEN** no obtiene ninguna fila

#### Scenario: Intento de borrado

- **WHEN** un usuario autenticado intenta eliminar un pedido o una de sus líneas
- **THEN** la operación se rechaza porque no existe política `DELETE`

#### Scenario: El ayudante edita

- **WHEN** un ayudante cambia el estado de un pedido de su organización
- **THEN** la operación se acepta y la bitácora la registra

#### Scenario: El ayudante intenta archivar

- **WHEN** un ayudante intenta archivar un pedido
- **THEN** la operación se rechaza con un mensaje comprensible

#### Scenario: El pedido archivado conserva su historia

- **WHEN** se archiva un pedido
- **THEN** desaparece de las vistas activas del tablero pero sigue consultable con "Ver archivados", con sus líneas, su historial y su número intactos
