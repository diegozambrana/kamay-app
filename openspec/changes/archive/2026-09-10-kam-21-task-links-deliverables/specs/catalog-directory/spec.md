## MODIFIED Requirements

### Requirement: Pantalla de detalle de ítem (V11)

El detalle de un ítem SHALL mostrar sus datos generales —tipo, unidad, categoría, línea o "Compartido", precio de venta referencial, mínimo y descripción—, la lista de sus variantes con alta, edición y archivado, un bloque de **tareas relacionadas** con las tareas que referencian a ese ítem —con su estado actual y su fecha límite cuando la tenga, y con paso a su detalle—, y el historial de cambios leído de la bitácora. Para un ítem de tipo insumo SHALL mostrar además su saldo derivado, sus movimientos de inventario y la evolución de precios de compra, según define la capacidad de inventario; la evolución de precios SHALL ser solo para la persona dueña. Para un ítem de tipo activo, y solo ante la persona dueña, SHALL mostrar además sus datos de activo con la posibilidad de registrarlos y editarlos, y el acceso a la pantalla de activos. SHALL NOT mostrar proveedores habituales.

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
