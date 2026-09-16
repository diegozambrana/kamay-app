## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Pantalla de catálogo (V10)

El catálogo SHALL ser una página completa con pestañas por tipo de ítem —insumos, productos y activos—, filtro por línea de negocio, búsqueda por nombre y filtro "Ver archivados". Cada fila SHALL mostrar el nombre, la unidad y la etiqueta de la línea o "Compartido", y SHALL abrir el detalle del ítem. Solo en la pestaña de productos, la fila SHALL mostrar además el precio de venta referencial. En las pestañas de insumos y de activos, el listado SHALL NOT tener columna de precio de venta. La fila de un insumo cuyo saldo esté por debajo de su mínimo declarado SHALL llevar un distintivo de bajo mínimo. La pantalla SHALL estar disponible para ambos roles y SHALL NOT mostrar saldo de inventario ni último costo: el distintivo SHALL ser una señal binaria, sin cifra.

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
