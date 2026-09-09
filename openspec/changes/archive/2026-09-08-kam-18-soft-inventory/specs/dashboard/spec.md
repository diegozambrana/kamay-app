## ADDED Requirements

### Requirement: Tarjeta de insumos bajo mínimo

El panel SHALL presentar, en la ranura que ocupaba su marcador, la lista de insumos cuyo saldo derivado está por debajo de su mínimo declarado, ordenados por lo lejos que están de él. Cada elemento SHALL mostrar el nombre del insumo, su saldo y su mínimo con su unidad, y SHALL conducir al detalle de ese insumo. La pieza SHALL responder al selector de línea como el resto del panel y SHALL estar presente en las dos composiciones de rol, porque no contiene ningún importe monetario. Cuando ningún insumo esté por debajo de su mínimo, la pieza SHALL presentar su mensaje de lista sin contenido, nunca un cero suelto ni una tarjeta en blanco.

#### Scenario: Los insumos por debajo del mínimo aparecen

- **WHEN** una persona dueña abre el panel con dos insumos por debajo de su mínimo
- **THEN** ambos aparecen en la tarjeta, con su saldo y su mínimo, el más alejado de su mínimo primero

#### Scenario: El ayudante también la ve

- **WHEN** un ayudante abre el panel
- **THEN** ve la tarjeta de insumos bajo mínimo con su contenido, sin ninguna cifra monetaria

#### Scenario: De la tarjeta al insumo

- **WHEN** se activa un insumo de la tarjeta
- **THEN** se abre el detalle de ese insumo

#### Scenario: La tarjeta respeta la línea activa

- **WHEN** el selector de línea está en Sublimación
- **THEN** la tarjeta lista los insumos bajo mínimo de esa línea y los compartidos, y ninguno exclusivo de otra línea

#### Scenario: Nada por debajo del mínimo

- **WHEN** ningún insumo de la organización está por debajo de su mínimo
- **THEN** la tarjeta muestra su mensaje de lista sin contenido, sin cifras ni espacios en blanco

## MODIFIED Requirements

### Requirement: El panel es la puerta de entrada de escritorio y se compone según el rol

El sistema SHALL ofrecer el panel principal en `/dashboard` para todo miembro autenticado de la organización activa, y SHALL resolver el rol en el servidor antes del primer render. La persona dueña SHALL recibir la composición completa; el ayudante SHALL recibir la variante descrita en este documento. Ninguna de las dos composiciones SHALL obtenerse ocultando piezas de la otra en el cliente: el servidor SHALL enviar únicamente las piezas que corresponden al rol. Ninguna pieza del panel SHALL ser ya un marcador de posición: todas SHALL presentar contenido real.

#### Scenario: La persona dueña recibe la composición completa

- **WHEN** una persona dueña abre `/dashboard`
- **THEN** ve las tarjetas de indicadores, el comparativo por línea, las entregas próximas, la tarjeta de pendientes, la de insumos bajo mínimo y los últimos movimientos de la bitácora, todas con contenido real

#### Scenario: El ayudante recibe su propia composición

- **WHEN** un ayudante abre `/dashboard`
- **THEN** ve su propia composición y no recibe del servidor ningún dato de las piezas de dinero ni de bitácora

#### Scenario: El rol se decide antes de pintar

- **WHEN** un ayudante abre `/dashboard`
- **THEN** la primera respuesta ya viene compuesta para su rol, sin que la pantalla muestre primero piezas del dueño y las retire después

#### Scenario: Ningún marcador de posición sobrevive

- **WHEN** se abre el panel con cualquiera de los dos roles
- **THEN** ninguna pieza lleva una leyenda de no disponible ni ocupa su ranura sin contenido

## REMOVED Requirements

### Requirement: Marcador de posición de insumos bajo mínimo

**Reason**: Era el último marcador del panel, y existía solo mientras el inventario no pudiera darle contenido. Este cambio construye `item_balances`, así que la ranura pasa a la tarjeta real descrita en *Tarjeta de insumos bajo mínimo*. KAM-17 ya retiró el de pendientes por el mismo motivo.

**Migration**: Ninguna para quien usa el producto: la pieza ocupa la misma ranura y cambia su leyenda por su contenido. En el código, el componente de marcador queda sin usuarios y se retira con la constante que lo describía.
