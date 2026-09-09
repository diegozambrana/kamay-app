## MODIFIED Requirements

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

### Requirement: Pantalla de detalle de ítem (V11)

El detalle de un ítem SHALL mostrar sus datos generales —tipo, unidad, categoría, línea o "Compartido", precio de venta referencial, mínimo y descripción—, la lista de sus variantes con alta, edición y archivado, y el historial de cambios leído de la bitácora. Para un ítem de tipo insumo SHALL mostrar además su saldo derivado, sus movimientos de inventario y la evolución de precios de compra, según define la capacidad de inventario; la evolución de precios SHALL ser solo para la persona dueña. Para un ítem de tipo activo, y solo ante la persona dueña, SHALL mostrar además sus datos de activo con la posibilidad de registrarlos y editarlos, y el acceso a la pantalla de activos. SHALL NOT mostrar proveedores habituales ni tareas relacionadas.

#### Scenario: Variantes gestionadas desde el detalle

- **WHEN** el usuario añade una variante "11oz" a un ítem y guarda
- **THEN** la variante aparece en la lista del detalle y queda disponible donde se elijan variantes

#### Scenario: Historial en el detalle

- **WHEN** el usuario abre el historial de un ítem que fue editado
- **THEN** ve cada cambio con su autor y su fecha, leído de la bitácora

#### Scenario: Secciones de inventario en un insumo

- **WHEN** la persona dueña abre el detalle de un insumo
- **THEN** ve las secciones de saldo, movimientos y evolución de precios de compra

#### Scenario: Sin secciones de inventario ni costos

- **WHEN** el usuario abre el detalle de un ítem de tipo producto o activo
- **THEN** no existen secciones de saldo, movimientos ni evolución de precios de compra

#### Scenario: Sin proveedores habituales ni tareas relacionadas

- **WHEN** el usuario abre el detalle de un ítem
- **THEN** no existen secciones de proveedores habituales ni de tareas relacionadas

#### Scenario: Los datos de activo en el detalle de un activo

- **WHEN** la persona dueña abre el detalle de un ítem de tipo activo
- **THEN** ve sus datos de activo, puede registrarlos o editarlos, y tiene acceso a la pantalla de activos

#### Scenario: El ayudante no ve los datos de activo

- **WHEN** un ayudante abre el detalle de un ítem de tipo activo
- **THEN** el detalle no contiene sección de datos de activo, ni vacía ni rotulada

### Requirement: Semilla de catálogo y directorio de Geeko Store

Tras reiniciar la base de datos local, la organización de ejemplo SHALL contar con ítems de los tres tipos —al menos un insumo, un producto y un activo—, con al menos uno compartido entre líneas, al menos un ítem con variantes, y contactos que cubran los tres casos de rol (solo proveedor, solo cliente, ambos). Al menos dos de los ítems de tipo activo SHALL contar con sus datos de activo declarados, en líneas distintas. La semilla SHALL bastar para ejercitar las tres pantallas sin capturar datos a mano.

#### Scenario: Semilla presente tras el reinicio

- **WHEN** se reinicia la base de datos local
- **THEN** existen ítems de tipo insumo, producto y activo, al menos uno compartido, al menos uno con variantes, y contactos proveedor, cliente y ambos

#### Scenario: Activos de la semilla con sus datos

- **WHEN** se reinicia la base de datos local
- **THEN** al menos dos ítems de tipo activo tienen costo de adquisición y fecha declarados, en líneas distintas

#### Scenario: La búsqueda de la semilla tolera acentos

- **WHEN** se busca "sublimacion" sobre los datos de la semilla
- **THEN** aparece al menos un ítem cuyo nombre lleva tilde
