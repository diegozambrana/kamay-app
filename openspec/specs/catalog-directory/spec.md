# catalog-directory Specification

## Purpose

Registra qué compra, qué vende y con quién trata la organización —ítems, variantes y contactos— como base común de toda operación posterior, sin que el catálogo almacene jamás un dato derivado ni pierda la historia al archivar.

> Origen: `specs/PRD/kamay-backlog.md` — KAM-06 y KAM-08 (creación al vuelo con teléfono); `specs/PRD/kamay-esquema-base-de-datos-supabase.md` §7, §16, § Matriz de acceso; `specs/PRD/kamay-especificacion-producto-v6.md` — V10, V11, V13 y §6.5 (archivado); `specs/PRD/kamay-mapa-navegacion-ui.md` — navegación base.

## Requirements

### Requirement: Tablas del catálogo y el directorio con la forma canónica

El sistema SHALL almacenar el catálogo y el directorio en tres tablas según el esquema canónico (§7): `contacts` (`name`, `phone`, `email`, `address`, `is_supplier`, `is_customer`, `notes`, `archived_at`), `items` (`business_line_id`, `kind`, `name`, `description`, `unit_id`, `category_id`, `sale_price`, `min_stock`, `archived_at`) e `item_variants` (`item_id`, `name`, `attributes`, `sale_price`, `archived_at`). Las tres SHALL llevar `organization_id` y SHALL admitir clave primaria generada por el cliente. `items.kind` SHALL estar restringido a `supply`, `product` o `asset`. El nombre de una variante SHALL ser único dentro de su ítem. `items.category_id` SHALL ser opcional y SHALL referenciar `item_categories` con una clave compuesta que incluya la organización y el tipo, de modo que un ítem solo apunte a una categoría de su organización y de su tipo. `items` SHALL NOT conservar una columna de categoría en texto libre.

#### Scenario: Tipo de ítem fuera del juego permitido

- **WHEN** se intenta guardar un ítem con un `kind` distinto de `supply`, `product` o `asset`
- **THEN** la base de datos rechaza la operación

#### Scenario: Variante duplicada dentro del mismo ítem

- **WHEN** se intenta crear una variante con un nombre que ya existe en ese ítem
- **THEN** la base de datos rechaza la inserción por la restricción de unicidad

#### Scenario: Mismo nombre de variante en ítems distintos

- **WHEN** se crea la variante "11oz" en dos ítems diferentes
- **THEN** ambas se aceptan, porque la unicidad es por ítem

#### Scenario: La categoría ya no es texto libre

- **WHEN** se inspeccionan las columnas de `items`
- **THEN** existe `category_id` referenciando `item_categories` y no existe la columna `category`

#### Scenario: Los textos de categoría existentes se conservan

- **WHEN** se aplica la migración sobre una organización con insumos cuya categoría en texto era «Sustratos», «sustratos » y «Embalaje»
- **THEN** existen para esa organización las categorías de insumo «Sustratos» y «Embalaje», una sola por nombre sin distinguir mayúsculas ni espacios al borde, y cada insumo queda enlazado con la suya

#### Scenario: La conversión no deja rastro falso en la bitácora

- **WHEN** se aplica la migración
- **THEN** la bitácora no registra una edición de cada ítem enlazado, porque nadie los editó

#### Scenario: La conversión también enlaza los ítems archivados

- **WHEN** se aplica la migración sobre un ítem archivado que tenía categoría en texto
- **THEN** el ítem queda enlazado con su categoría y sigue archivado

### Requirement: Un ítem declara su tipo, su unidad y su alcance de línea

El sistema SHALL guardar todo ítem —sea insumo, producto o activo— con su tipo, su unidad de medida y su alcance de línea. El alcance SHALL expresarse en `business_line_id`: un valor lo asigna a esa línea; `null` lo marca como compartido entre todas las líneas. La interfaz SHALL presentar ese `null` al usuario como "Compartido" y no como un campo vacío.

Un ítem de tipo activo SHALL seguir aceptándose sin costo de adquisición ni fecha: esos datos son propios de la capacidad de activos y se declaran aparte, antes o después, sin que su ausencia invalide el ítem en el catálogo.

#### Scenario: Ítem de una línea concreta

- **WHEN** el usuario guarda un insumo indicando tipo, unidad y la línea Sublimación
- **THEN** el ítem queda registrado con esos tres datos y los listados lo etiquetan con esa línea

#### Scenario: Ítem compartido entre líneas

- **WHEN** el usuario guarda un ítem sin asignarle línea
- **THEN** el ítem queda con `business_line_id` nulo y los listados lo etiquetan como "Compartido"

#### Scenario: Activo registrado como ítem

- **WHEN** el usuario guarda un ítem de tipo activo
- **THEN** se acepta con su tipo, unidad y línea, sin exigir costo de adquisición ni fecha (esos datos llegan con los activos)

#### Scenario: Un activo sin datos declarados sigue siendo un ítem válido

- **WHEN** existe un ítem de tipo activo al que nadie ha declarado costo ni fecha
- **THEN** el catálogo lo lista con normalidad en su pestaña, sin marcarlo como incompleto ni bloquear su edición

### Requirement: Los campos de un ítem dependen de su tipo

Cada tipo de ítem SHALL capturar y mostrar solo los campos que usa:

| Campo | Insumo | Producto | Activo |
|---|---|---|---|
| Nombre, línea, unidad, categoría, descripción y fotografía | sí | sí | sí |
| Precio de venta referencial del ítem y de sus variantes | no | sí | no |
| Mínimo | sí | no | no |

La regla SHALL aplicarse igual en el formulario de alta y edición, en el listado del catálogo, en el detalle del ítem y en la gestión de sus variantes. El servidor SHALL aplicarla también. Al crear o editar un ítem o una variante, todo campo que no corresponda al tipo del ítem SHALL guardarse vacío (`null`), aunque la petición traiga un valor. Si el campo ya tenía un valor guardado, ese valor SHALL vaciarse la siguiente vez que se guarde el ítem o la variante, y la bitácora SHALL registrar el cambio como cualquier otra edición.

#### Scenario: Un insumo no pide precio de venta

- **WHEN** el usuario abre el formulario de alta o de edición de un insumo
- **THEN** el formulario ofrece el mínimo y no ofrece el precio de venta referencial

#### Scenario: Un producto no pide mínimo

- **WHEN** el usuario abre el formulario de alta o de edición de un producto
- **THEN** el formulario ofrece el precio de venta referencial y no ofrece el mínimo

#### Scenario: Un activo no pide precio de venta ni mínimo

- **WHEN** el usuario abre el formulario de alta o de edición de un activo
- **THEN** el formulario no ofrece el precio de venta referencial ni el mínimo

#### Scenario: El servidor descarta un precio de venta en un insumo

- **WHEN** llega una petición para crear un insumo que trae un precio de venta de 45
- **THEN** el insumo se crea con el precio de venta vacío

#### Scenario: El servidor descarta un mínimo en un producto

- **WHEN** llega una petición para editar un producto que trae un mínimo de 10
- **THEN** el producto se guarda con el mínimo vacío

#### Scenario: Un valor antiguo que ya no corresponde se vacía al editar

- **WHEN** el usuario edita y guarda un insumo que tenía un precio de venta guardado de antes
- **THEN** el insumo queda con el precio de venta vacío y la bitácora registra ese cambio

#### Scenario: La variante de un insumo no lleva precio de venta

- **WHEN** llega una petición para crear o editar una variante de un insumo o de un activo que trae un precio de venta
- **THEN** la variante se guarda con el precio de venta vacío

#### Scenario: La variante de un producto conserva su precio

- **WHEN** el usuario crea la variante "15oz" de un producto con precio de venta 55
- **THEN** la variante se guarda con ese precio y el pedido lo toma al elegirla

### Requirement: El tipo de un ítem se fija al crearlo

El tipo de un ítem SHALL decidirse al crearlo y SHALL NOT cambiar después. En el catálogo, el tipo de un ítem nuevo SHALL ser el de la pestaña activa, y el formulario SHALL NOT mostrar un selector de tipo, ni al crear ni al editar. Al editar, el servidor SHALL conservar el tipo guardado aunque la petición traiga otro.

#### Scenario: El alta toma el tipo de la pestaña

- **WHEN** el usuario está en la pestaña de insumos, pulsa «Nuevo insumo» y guarda el formulario
- **THEN** el ítem se crea como insumo y aparece en la pestaña de insumos

#### Scenario: El formulario no ofrece elegir el tipo

- **WHEN** el usuario abre el formulario de alta o de edición de un ítem de cualquier tipo
- **THEN** el formulario no contiene ningún control para elegir o cambiar el tipo

#### Scenario: Editar no cambia el tipo

- **WHEN** llega una petición para editar un insumo que trae el tipo producto
- **THEN** el ítem se guarda con sus demás datos y sigue siendo un insumo

### Requirement: Un ítem se clasifica con una categoría de su tipo

Un ítem SHALL poder llevar como máximo una categoría, elegida de las categorías de ítem que su organización definió para su tipo (capacidad `org-configuration`). La categoría SHALL ser opcional: «Sin categoría» es un valor válido y no marca el ítem como incompleto.

El formulario de alta y edición SHALL presentar la categoría como un selector con «Sin categoría» y las categorías vigentes del tipo del ítem, ordenadas por nombre. SHALL NOT ofrecer categorías de otro tipo, de otra organización ni archivadas. Cuando el ítem ya tiene una categoría archivada, el selector SHALL mostrarla como valor actual, rotulada como archivada, y guardar sin tocarla SHALL conservarla. Cuando el tipo aún no tiene ninguna categoría vigente, el campo SHALL decirlo y SHALL indicar que se definen en Configuración, con un enlace a la sección solo para la persona dueña.

La base de datos SHALL rechazar que un ítem apunte a una categoría de otra organización o de otro tipo. El servidor SHALL rechazar que se asigne una categoría archivada a un ítem que no la tenía ya. Ambos roles SHALL poder elegir la categoría de un ítem; solo la persona dueña gestiona las categorías.

El detalle del ítem (V11) SHALL mostrar el nombre de su categoría, o «Sin categoría», y marcarla como archivada cuando lo esté.

#### Scenario: El selector ofrece solo las categorías del tipo

- **WHEN** el usuario abre el formulario de alta de un insumo en una organización con las categorías de insumo «Sustratos» y «Embalaje» y la categoría de producto «Vajilla»
- **THEN** el selector de categoría ofrece «Sin categoría», «Embalaje» y «Sustratos», y no ofrece «Vajilla»

#### Scenario: Un ítem sin categoría es válido

- **WHEN** el usuario guarda un producto con «Sin categoría»
- **THEN** el producto se guarda sin categoría y el detalle muestra «Sin categoría»

#### Scenario: El ayudante elige una categoría

- **WHEN** un ayudante crea un insumo y le elige la categoría «Sustratos»
- **THEN** el insumo se guarda con esa categoría

#### Scenario: La base rechaza una categoría de otro tipo

- **WHEN** se intenta guardar un insumo que apunta a una categoría de producto
- **THEN** la base de datos rechaza la operación

#### Scenario: La base rechaza una categoría de otra organización

- **WHEN** se intenta guardar un ítem de la organización A que apunta a una categoría de la organización B
- **THEN** la base de datos rechaza la operación

#### Scenario: Una categoría archivada no se ofrece

- **WHEN** la persona dueña archiva la categoría de insumo «Embalaje» y alguien abre después el formulario de alta de un insumo
- **THEN** el selector no ofrece «Embalaje»

#### Scenario: Un ítem conserva su categoría archivada

- **WHEN** el usuario edita el nombre de un insumo cuya categoría «Embalaje» está archivada y guarda sin tocar la categoría
- **THEN** el selector la mostraba como valor actual rotulada como archivada, y el insumo se guarda conservándola

#### Scenario: El servidor no asigna una categoría archivada de nuevo

- **WHEN** llega una petición para asignar la categoría archivada «Embalaje» a un insumo que no la tenía
- **THEN** la operación se rechaza con un mensaje comprensible y el insumo conserva su categoría anterior

#### Scenario: El detalle muestra la categoría archivada

- **WHEN** el usuario abre el detalle de un insumo cuya categoría está archivada
- **THEN** los datos generales muestran el nombre de la categoría con la marca de archivada

#### Scenario: Un tipo sin categorías lo dice

- **WHEN** la persona dueña abre el formulario de alta de un activo en una organización sin categorías de activo
- **THEN** el selector ofrece solo «Sin categoría» y el campo indica que las categorías se definen en Configuración, con un enlace a la sección

#### Scenario: El ayudante no recibe el enlace a Configuración

- **WHEN** un ayudante abre el formulario de alta de un activo en una organización sin categorías de activo
- **THEN** el campo indica que la persona dueña define las categorías, sin enlace a Configuración

### Requirement: Todo contacto tiene al menos un rol

El sistema SHALL rechazar todo contacto que no sea proveedor, cliente o ambos. La regla SHALL vivir en la base de datos como restricción (`is_supplier or is_customer`), además de validarse en el formulario antes de enviar.

#### Scenario: Contacto sin ningún rol

- **WHEN** se intenta guardar un contacto con `is_supplier` y `is_customer` ambos en falso
- **THEN** la operación falla y el contacto no se crea

#### Scenario: Contacto que es proveedor y cliente a la vez

- **WHEN** se guarda un contacto marcado como proveedor y como cliente
- **THEN** se acepta y aparece en los buscadores de proveedores y en los de clientes

#### Scenario: Quitar el último rol de un contacto existente

- **WHEN** el usuario desmarca el único rol que le quedaba a un contacto y guarda
- **THEN** la operación falla con un mensaje comprensible y el contacto conserva su rol anterior

### Requirement: El catálogo no almacena nada derivado

Ninguna columna de `items` ni de `item_variants` SHALL almacenar saldo de inventario, último costo, costo promedio ni margen. Esos valores son derivados y SHALL obtenerse de vistas sobre los documentos que los originan. La ausencia SHALL verificarse con una prueba automática que falle si alguien añade una columna así.

#### Scenario: Inspección de las columnas del catálogo

- **WHEN** se inspeccionan las columnas de `items` e `item_variants`
- **THEN** no existe ninguna columna de saldo, último costo, costo promedio ni margen

### Requirement: Archivar retira de listados y buscadores sin borrar la historia

Archivar un ítem, una variante o un contacto SHALL fijar `archived_at` y SHALL retirarlo de los listados vigentes y de todos los buscadores y selectores. El registro SHALL seguir existiendo y SHALL permanecer visible en cualquier documento histórico que lo referencie: ninguna referencia existente se rompe ni se sustituye. Ninguna de las tres tablas SHALL tener política `DELETE`.

#### Scenario: Ítem archivado fuera de los listados

- **WHEN** el dueño archiva un ítem y luego abre el catálogo sin activar "Ver archivados"
- **THEN** el ítem no aparece en la lista ni en los buscadores que ofrecen ítems

#### Scenario: La referencia histórica sobrevive al archivado

- **WHEN** un registro histórico apunta a un ítem o contacto que después se archiva
- **THEN** ese registro sigue mostrando el ítem o contacto archivado con su nombre, y la referencia sigue siendo válida

#### Scenario: Nadie borra

- **WHEN** un usuario autenticado —incluido el dueño— ejecuta `DELETE` sobre `items`, `item_variants` o `contacts`
- **THEN** no se elimina ninguna fila

### Requirement: Desarchivar devuelve el registro intacto

Ambos listados SHALL ofrecer un filtro "Ver archivados" desde el que un registro archivado por error SHALL poder desarchivarse. Al desarchivar, el registro SHALL volver a los listados y buscadores con todos sus datos y sus variantes tal como estaban, sin pérdida ni duplicación.

#### Scenario: Desarchivar desde el filtro

- **WHEN** el dueño activa "Ver archivados", elige un ítem archivado y lo desarchiva
- **THEN** el ítem vuelve a la lista vigente con sus datos y sus variantes intactos

#### Scenario: El filtro no mezcla

- **WHEN** el filtro "Ver archivados" está desactivado
- **THEN** el listado muestra solo registros vigentes; al activarlo, muestra también los archivados, distinguidos visiblemente

### Requirement: Un registro archivado no se edita sin desarchivarlo

El sistema SHALL impedir la edición de un ítem, variante o contacto archivado. La única acción disponible sobre un registro archivado SHALL ser desarchivarlo.

#### Scenario: Intento de editar un registro archivado

- **WHEN** el usuario abre un ítem archivado
- **THEN** los campos no son editables y solo se ofrece la acción de desarchivar

### Requirement: El ayudante crea y edita, pero no archiva

Conforme a la matriz de acceso, cualquier miembro activo SHALL poder leer, crear y editar ítems, variantes y contactos de su organización. Archivar y desarchivar SHALL quedar reservados al dueño, verificado en la base de datos y no solo ocultando el botón. El ayudante SHALL no ver ofrecidas esas acciones.

#### Scenario: El ayudante crea y edita

- **WHEN** un usuario con rol ayudante crea un ítem y luego edita su nombre y su precio de venta
- **THEN** ambas operaciones se aceptan

#### Scenario: El ayudante intenta archivar

- **WHEN** un usuario con rol ayudante intenta fijar `archived_at` sobre un ítem o un contacto
- **THEN** la base de datos rechaza la operación con un mensaje comprensible

#### Scenario: El ayudante intenta desarchivar

- **WHEN** un usuario con rol ayudante intenta limpiar `archived_at` de un registro archivado
- **THEN** la base de datos rechaza la operación

#### Scenario: El dueño archiva

- **WHEN** el dueño archiva un contacto
- **THEN** la operación se acepta y queda registrada en la bitácora

### Requirement: La búsqueda por nombre tolera acentos y mayúsculas

La búsqueda por nombre de ítems y de contactos SHALL encontrar coincidencias con independencia de acentos, mayúsculas y minúsculas, tanto si el acento falta en lo escrito como si falta en lo almacenado. La normalización SHALL aplicarse por igual en la base de datos y en cualquier filtrado del cliente, de modo que ambos den el mismo resultado.

#### Scenario: Buscar sin tilde lo que está con tilde

- **WHEN** el usuario busca "sublimacion" en el catálogo
- **THEN** el resultado incluye "Taza para sublimación"

#### Scenario: Buscar con tilde lo que está sin tilde

- **WHEN** el usuario busca "sublimación" y el ítem se guardó como "Taza para sublimacion"
- **THEN** el resultado lo incluye igualmente

#### Scenario: Mayúsculas indiferentes

- **WHEN** el usuario busca "TAZA"
- **THEN** el resultado incluye "Taza para sublimación"

#### Scenario: La búsqueda no devuelve archivados

- **WHEN** el usuario busca un término que coincide con un ítem archivado, sin "Ver archivados" activo
- **THEN** ese ítem no aparece entre los resultados

### Requirement: Aislamiento entre organizaciones del catálogo y el directorio

Las tres tablas SHALL tener RLS activo con el patrón del proyecto: solo los miembros de la organización leen y escriben sus filas, y toda consulta SHALL filtrar además por `organization_id` explícitamente. Las tres SHALL registrar sus altas y cambios en la bitácora mediante el trigger de auditoría, en la misma migración que las crea.

#### Scenario: Otra organización no ve nada

- **WHEN** un usuario de la organización A consulta `items`, `item_variants` o `contacts`
- **THEN** obtiene cero filas de la organización B

#### Scenario: Alta y cambio quedan en la bitácora

- **WHEN** se crea un contacto y después se le cambia el teléfono
- **THEN** la bitácora conserva un evento de creación y otro de edición con los campos que cambiaron

### Requirement: Pantalla de catálogo (V10)

El catálogo SHALL ser una página completa con pestañas por tipo de ítem —insumos, productos y activos—, filtro por línea de negocio, filtro por categoría, búsqueda por nombre y filtro "Ver archivados". Cada fila SHALL mostrar el nombre, la unidad y la etiqueta de la línea o "Compartido", y SHALL abrir el detalle del ítem. Solo en la pestaña de productos, la fila SHALL mostrar además el precio de venta referencial. En las pestañas de insumos y de activos, el listado SHALL NOT tener columna de precio de venta. La fila de un insumo cuyo saldo esté por debajo de su mínimo declarado SHALL llevar un distintivo de bajo mínimo. La pantalla SHALL estar disponible para ambos roles y SHALL NOT mostrar saldo de inventario ni último costo: el distintivo SHALL ser una señal binaria, sin cifra.

El filtro por categoría SHALL ofrecer «Todas las categorías», «Sin categoría» y las categorías vigentes del tipo de la pestaña activa, ordenadas por nombre. SHALL viajar en la dirección como los demás filtros, SHALL contar como filtro activo para el vacío con «Quitar filtros», y SHALL descartarse al cambiar de pestaña, porque cada tipo tiene sus propias categorías. Una categoría en la dirección que no sea del tipo de la pestaña SHALL tratarse como «Todas las categorías».

El botón de alta y la acción del vacío inicial SHALL nombrar el tipo de la pestaña activa: «Nuevo insumo», «Nuevo producto» o «Nuevo activo», y «Crear el primer insumo», «Crear el primer producto» o «Crear el primer activo». Ambos SHALL abrir el formulario de alta de ese tipo, titulado igual que el botón («Nuevo insumo»…) y con los campos que ese tipo usa. El formulario de edición SHALL titularse «Editar insumo», «Editar producto» o «Editar activo», según el tipo del ítem.

#### Scenario: Pestañas por tipo

- **WHEN** el usuario abre la pestaña de insumos
- **THEN** la lista muestra únicamente ítems de tipo insumo, sin productos ni activos

#### Scenario: Sin columnas de inventario ni costo

- **WHEN** el usuario abre el catálogo
- **THEN** ninguna columna muestra saldo de inventario ni último costo

#### Scenario: Precio de venta solo en productos

- **WHEN** el usuario abre la pestaña de productos
- **THEN** cada fila muestra su precio de venta referencial

#### Scenario: Insumos y activos sin columna de precio de venta

- **WHEN** el usuario abre la pestaña de insumos o la de activos
- **THEN** el listado no tiene columna de precio de venta

#### Scenario: Filtrar por categoría

- **WHEN** el usuario elige la categoría «Sustratos» en el filtro de la pestaña de insumos
- **THEN** la lista muestra solo los insumos de esa categoría y la dirección lleva la categoría elegida

#### Scenario: Filtrar los ítems sin categoría

- **WHEN** el usuario elige «Sin categoría» en el filtro
- **THEN** la lista muestra solo los ítems de la pestaña que no tienen categoría

#### Scenario: El filtro ofrece las categorías de la pestaña

- **WHEN** el usuario abre el filtro de categoría en la pestaña de productos
- **THEN** ofrece «Todas las categorías», «Sin categoría» y las categorías vigentes de producto, sin categorías de insumo ni de activo

#### Scenario: Cambiar de pestaña descarta la categoría

- **WHEN** el usuario tiene filtrada la categoría «Sustratos» en insumos y cambia a la pestaña de productos
- **THEN** la dirección ya no lleva la categoría y la lista de productos no está filtrada por categoría

#### Scenario: Quitar filtros incluye la categoría

- **WHEN** ningún insumo coincide con la categoría y la búsqueda elegidas, y el usuario pulsa «Quitar filtros»
- **THEN** la categoría, la búsqueda y la línea vuelven a su valor inicial y la lista muestra todos los insumos

#### Scenario: El botón de alta nombra el tipo de la pestaña

- **WHEN** el usuario abre la pestaña de insumos
- **THEN** el botón de alta dice «Nuevo insumo»; en la pestaña de productos dice «Nuevo producto» y en la de activos, «Nuevo activo»

#### Scenario: El formulario de alta corresponde a la pestaña

- **WHEN** el usuario pulsa «Nuevo insumo» en la pestaña de insumos
- **THEN** se abre el formulario titulado «Nuevo insumo», sin selector de tipo y sin precio de venta referencial

#### Scenario: El vacío inicial nombra el tipo

- **WHEN** el usuario abre la pestaña de activos de una organización que aún no tiene activos
- **THEN** el vacío inicial ofrece «Crear el primer activo», que abre el formulario de alta de activo

#### Scenario: El formulario de edición nombra el tipo

- **WHEN** el usuario elige «Editar» en la fila de un producto
- **THEN** se abre el formulario titulado «Editar producto» con los datos del ítem

#### Scenario: Distintivo de insumo bajo mínimo

- **WHEN** el usuario abre el catálogo con un insumo cuyo saldo está por debajo de su mínimo
- **THEN** su fila lleva el distintivo de bajo mínimo, sin mostrar la cifra del saldo

#### Scenario: Insumo sin mínimo declarado

- **WHEN** el usuario abre el catálogo con un insumo sin mínimo y saldo cero
- **THEN** su fila no lleva ningún distintivo

#### Scenario: Fila que abre el detalle

- **WHEN** el usuario elige una fila del catálogo
- **THEN** navega al detalle de ese ítem

### Requirement: Pantalla de detalle de ítem (V11)

El detalle de un ítem SHALL mostrar sus datos generales —tipo, unidad, categoría, línea o "Compartido" y descripción, más el precio de venta referencial si es un producto y el mínimo si es un insumo—, la lista de sus variantes con alta, edición y archivado, un bloque de **tareas relacionadas** con las tareas que referencian a ese ítem —con su estado actual y su fecha límite cuando la tenga, y con paso a su detalle—, y el historial de cambios leído de la bitácora. La lista de variantes y su formulario SHALL mostrar el precio de venta de cada variante solo cuando el ítem es un producto. Para un ítem de tipo insumo SHALL mostrar además su saldo derivado, sus movimientos de inventario y la evolución de precios de compra, según define la capacidad de inventario; la evolución de precios SHALL ser solo para la persona dueña. Para un ítem de tipo activo, y solo ante la persona dueña, SHALL mostrar además sus datos de activo con la posibilidad de registrarlos y editarlos, y el acceso a la pantalla de activos. SHALL NOT mostrar proveedores habituales.

#### Scenario: Variantes gestionadas desde el detalle

- **WHEN** el usuario añade una variante "11oz" a un ítem y guarda
- **THEN** la variante aparece en la lista del detalle y queda disponible donde se elijan variantes

#### Scenario: Datos generales de un insumo

- **WHEN** el usuario abre el detalle de un insumo
- **THEN** los datos generales incluyen el mínimo y no incluyen el precio de venta referencial

#### Scenario: Datos generales de un producto

- **WHEN** el usuario abre el detalle de un producto
- **THEN** los datos generales incluyen el precio de venta referencial y no incluyen el mínimo

#### Scenario: Datos generales de un activo

- **WHEN** el usuario abre el detalle de un activo
- **THEN** los datos generales no incluyen el precio de venta referencial ni el mínimo

#### Scenario: Variantes de un insumo sin precio de venta

- **WHEN** el usuario abre el detalle de un insumo con variantes, o el formulario para añadirle una
- **THEN** ni la lista de variantes ni el formulario muestran precio de venta

#### Scenario: Variantes de un producto con precio de venta

- **WHEN** el usuario abre el detalle de un producto con variantes
- **THEN** la lista de variantes muestra el precio de venta de cada una y su formulario lo ofrece

#### Scenario: Historial en el detalle

- **WHEN** el usuario abre el historial de un ítem que fue editado
- **THEN** ve cada cambio con su autor y su fecha, leído de la bitácora

#### Scenario: Secciones de inventario en un insumo

- **WHEN** la persona dueña abre el detalle de un insumo
- **THEN** ve las secciones de saldo, movimientos y evolución de precios de compra

#### Scenario: Sin secciones de inventario ni costos

- **WHEN** el usuario abre el detalle de un ítem de tipo producto o activo
- **THEN** no existen secciones de saldo, movimientos ni evolución de precios de compra

#### Scenario: Sin proveedores habituales

- **WHEN** el usuario abre el detalle de un ítem
- **THEN** no existe ninguna sección de proveedores habituales

#### Scenario: Los datos de activo en el detalle de un activo

- **WHEN** la persona dueña abre el detalle de un ítem de tipo activo
- **THEN** ve sus datos de activo, puede registrarlos o editarlos, y tiene acceso a la pantalla de activos

#### Scenario: El ayudante no ve los datos de activo

- **WHEN** un ayudante abre el detalle de un ítem de tipo activo
- **THEN** el detalle no contiene sección de datos de activo, ni vacía ni rotulada

#### Scenario: Tareas relacionadas en el detalle

- **WHEN** el usuario abre el detalle de un ítem que dos tareas referencian
- **THEN** el bloque de tareas relacionadas las lista con su estado actual y lleva al detalle de cada una

#### Scenario: Ítem sin tareas relacionadas

- **WHEN** el usuario abre el detalle de un ítem que ninguna tarea referencia
- **THEN** el bloque de tareas relacionadas se rinde con su mensaje de lista sin contenido

### Requirement: Pantalla de contactos (V13)

Los contactos SHALL presentarse como una página de dos paneles: a la izquierda la lista buscable con filtro por rol y filtro "Ver archivados"; a la derecha el detalle del contacto seleccionado, con sus roles, sus datos y sus notas, editable en el sitio, y un bloque de **tareas relacionadas** con las tareas que referencian a ese contacto —con su estado actual y su fecha límite cuando la tenga, y con paso a su detalle—. Elegir un contacto SHALL actualizar el panel derecho sin abandonar la página, incluido su bloque de tareas relacionadas.

#### Scenario: Selección sin abandonar la pantalla

- **WHEN** el usuario elige un contacto de la lista
- **THEN** el panel derecho muestra su detalle y la lista permanece visible

#### Scenario: Filtro por rol

- **WHEN** el usuario filtra por proveedores
- **THEN** la lista muestra solo contactos marcados como proveedor, incluidos los que además son clientes

#### Scenario: Tareas relacionadas en el panel

- **WHEN** el usuario elige un contacto que una tarea referencia
- **THEN** el panel derecho muestra esa tarea en su bloque de tareas relacionadas

#### Scenario: El bloque sigue al contacto elegido

- **WHEN** el usuario cambia de contacto en la lista
- **THEN** el bloque de tareas relacionadas pasa a mostrar las del contacto recién elegido

### Requirement: Creación de contactos al vuelo

Todo buscador de contactos de la aplicación SHALL permitir crear el contacto sin abandonar el formulario en curso cuando el nombre escrito no existe. La creación al vuelo SHALL exigir el nombre y al menos un rol, SHALL admitir el teléfono como dato opcional en ese mismo paso, SHALL dejar el contacto recién creado seleccionado, y el resto de sus datos SHALL poder completarse después desde el directorio.

#### Scenario: Nombre inexistente ofrece crearlo

- **WHEN** el usuario escribe un nombre que no existe en un buscador de contactos
- **THEN** el buscador ofrece crear ese contacto con ese nombre

#### Scenario: El contacto creado queda seleccionado

- **WHEN** el usuario crea el contacto desde el buscador indicando su rol
- **THEN** el contacto se guarda, queda seleccionado en el campo y el formulario en curso conserva lo que ya tenía

#### Scenario: Con teléfono

- **WHEN** el usuario crea el contacto desde el buscador indicando además un teléfono
- **THEN** el contacto se guarda con ese teléfono y aparece así en el directorio

#### Scenario: Sin teléfono

- **WHEN** el usuario crea el contacto desde el buscador sin indicar teléfono
- **THEN** el contacto se guarda igualmente, con el teléfono vacío

### Requirement: Catálogo y contactos accesibles desde la navegación base

La navegación de la aplicación SHALL ofrecer las entradas *Catálogo* y *Contactos* a ambos roles, en la barra superior de escritorio y en la navegación móvil.

#### Scenario: El ayudante llega al catálogo

- **WHEN** un usuario con rol ayudante abre la navegación
- **THEN** ve las entradas *Catálogo* y *Contactos*, y ambas lo llevan a sus pantallas

### Requirement: Semilla de catálogo y directorio de Geeko Store

Tras reiniciar la base de datos local, la organización de ejemplo SHALL contar con ítems de los tres tipos —al menos un insumo, un producto y un activo—, con al menos uno compartido entre líneas, al menos un ítem con variantes, y contactos que cubran los tres casos de rol (solo proveedor, solo cliente, ambos). Al menos dos de los ítems de tipo activo SHALL contar con sus datos de activo declarados, en líneas distintas. La organización SHALL tener categorías de ítem de insumo y de producto, con al menos un nombre repetido entre los dos tipos, y sus insumos y productos SHALL estar enlazados con ellas. La semilla SHALL bastar para ejercitar las tres pantallas y el filtro por categoría sin capturar datos a mano.

#### Scenario: Semilla presente tras el reinicio

- **WHEN** se reinicia la base de datos local
- **THEN** existen ítems de tipo insumo, producto y activo, al menos uno compartido, al menos uno con variantes, y contactos proveedor, cliente y ambos

#### Scenario: Activos de la semilla con sus datos

- **WHEN** se reinicia la base de datos local
- **THEN** al menos dos ítems de tipo activo tienen costo de adquisición y fecha declarados, en líneas distintas

#### Scenario: La búsqueda de la semilla tolera acentos

- **WHEN** se busca "sublimacion" sobre los datos de la semilla
- **THEN** aparece al menos un ítem cuyo nombre lleva tilde

#### Scenario: Categorías de la semilla por tipo

- **WHEN** se reinicia la base de datos local
- **THEN** Geeko Store tiene categorías de insumo y de producto, entre ellas «Embalaje» en ambos tipos, y cada insumo y producto sembrado con categoría apunta a una de su tipo
