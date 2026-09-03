# catalog-directory Specification

## Purpose

Registra qué compra, qué vende y con quién trata la organización —ítems, variantes y contactos— como base común de toda operación posterior, sin que el catálogo almacene jamás un dato derivado ni pierda la historia al archivar.

> Origen: `specs/PRD/kamay-backlog.md` — KAM-06 y KAM-08 (creación al vuelo con teléfono); `specs/PRD/kamay-esquema-base-de-datos-supabase.md` §7, §16, § Matriz de acceso; `specs/PRD/kamay-especificacion-producto-v6.md` — V10, V11, V13 y §6.5 (archivado); `specs/PRD/kamay-mapa-navegacion-ui.md` — navegación base.

## Requirements

### Requirement: Tablas del catálogo y el directorio con la forma canónica

El sistema SHALL almacenar el catálogo y el directorio en tres tablas según el esquema canónico (§7): `contacts` (`name`, `phone`, `email`, `address`, `is_supplier`, `is_customer`, `notes`, `archived_at`), `items` (`business_line_id`, `kind`, `name`, `description`, `unit_id`, `category`, `sale_price`, `min_stock`, `archived_at`) e `item_variants` (`item_id`, `name`, `attributes`, `sale_price`, `archived_at`). Las tres SHALL llevar `organization_id` y SHALL admitir clave primaria generada por el cliente. `items.kind` SHALL estar restringido a `supply`, `product` o `asset`. El nombre de una variante SHALL ser único dentro de su ítem.

#### Scenario: Tipo de ítem fuera del juego permitido

- **WHEN** se intenta guardar un ítem con un `kind` distinto de `supply`, `product` o `asset`
- **THEN** la base de datos rechaza la operación

#### Scenario: Variante duplicada dentro del mismo ítem

- **WHEN** se intenta crear una variante con un nombre que ya existe en ese ítem
- **THEN** la base de datos rechaza la inserción por la restricción de unicidad

#### Scenario: Mismo nombre de variante en ítems distintos

- **WHEN** se crea la variante "11oz" en dos ítems diferentes
- **THEN** ambas se aceptan, porque la unicidad es por ítem

### Requirement: Un ítem declara su tipo, su unidad y su alcance de línea

El sistema SHALL guardar todo ítem —sea insumo, producto o activo— con su tipo, su unidad de medida y su alcance de línea. El alcance SHALL expresarse en `business_line_id`: un valor lo asigna a esa línea; `null` lo marca como compartido entre todas las líneas. La interfaz SHALL presentar ese `null` al usuario como "Compartido" y no como un campo vacío.

#### Scenario: Ítem de una línea concreta

- **WHEN** el usuario guarda un insumo indicando tipo, unidad y la línea Sublimación
- **THEN** el ítem queda registrado con esos tres datos y los listados lo etiquetan con esa línea

#### Scenario: Ítem compartido entre líneas

- **WHEN** el usuario guarda un ítem sin asignarle línea
- **THEN** el ítem queda con `business_line_id` nulo y los listados lo etiquetan como "Compartido"

#### Scenario: Activo registrado como ítem

- **WHEN** el usuario guarda un ítem de tipo activo
- **THEN** se acepta con su tipo, unidad y línea, sin exigir costo de adquisición ni fecha (esos datos llegan con los activos)

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

El catálogo SHALL ser una página completa con pestañas por tipo de ítem —insumos, productos y activos—, filtro por línea de negocio, búsqueda por nombre y filtro "Ver archivados". Cada fila SHALL mostrar el nombre, la unidad, el precio de venta referencial y la etiqueta de la línea o "Compartido", y SHALL abrir el detalle del ítem. La pantalla SHALL estar disponible para ambos roles y SHALL NOT mostrar saldo de inventario ni último costo.

#### Scenario: Pestañas por tipo

- **WHEN** el usuario abre la pestaña de insumos
- **THEN** la lista muestra únicamente ítems de tipo insumo, sin productos ni activos

#### Scenario: Sin columnas de inventario ni costo

- **WHEN** el usuario abre el catálogo
- **THEN** ninguna columna muestra saldo de inventario ni último costo

#### Scenario: Fila que abre el detalle

- **WHEN** el usuario elige una fila del catálogo
- **THEN** navega al detalle de ese ítem

### Requirement: Pantalla de detalle de ítem (V11)

El detalle de un ítem SHALL mostrar sus datos generales —tipo, unidad, categoría, línea o "Compartido", precio de venta referencial, mínimo y descripción—, la lista de sus variantes con alta, edición y archivado, y el historial de cambios leído de la bitácora. SHALL NOT mostrar secciones de saldo, evolución de costos, proveedores habituales ni tareas relacionadas.

#### Scenario: Variantes gestionadas desde el detalle

- **WHEN** el usuario añade una variante "11oz" a un ítem y guarda
- **THEN** la variante aparece en la lista del detalle y queda disponible donde se elijan variantes

#### Scenario: Historial en el detalle

- **WHEN** el usuario abre el historial de un ítem que fue editado
- **THEN** ve cada cambio con su autor y su fecha, leído de la bitácora

#### Scenario: Sin secciones de inventario ni costos

- **WHEN** el usuario abre el detalle de un insumo
- **THEN** no existen secciones de saldo, último costo ni evolución de precios de compra

### Requirement: Pantalla de contactos (V13)

Los contactos SHALL presentarse como una página de dos paneles: a la izquierda la lista buscable con filtro por rol y filtro "Ver archivados"; a la derecha el detalle del contacto seleccionado, con sus roles, sus datos y sus notas, editable en el sitio. Elegir un contacto SHALL actualizar el panel derecho sin abandonar la página.

#### Scenario: Selección sin abandonar la pantalla

- **WHEN** el usuario elige un contacto de la lista
- **THEN** el panel derecho muestra su detalle y la lista permanece visible

#### Scenario: Filtro por rol

- **WHEN** el usuario filtra por proveedores
- **THEN** la lista muestra solo contactos marcados como proveedor, incluidos los que además son clientes

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

Tras reiniciar la base de datos local, la organización de ejemplo SHALL contar con ítems de los tres tipos —al menos un insumo, un producto y un activo—, con al menos uno compartido entre líneas, al menos un ítem con variantes, y contactos que cubran los tres casos de rol (solo proveedor, solo cliente, ambos). La semilla SHALL bastar para ejercitar las tres pantallas sin capturar datos a mano.

#### Scenario: Semilla presente tras el reinicio

- **WHEN** se reinicia la base de datos local
- **THEN** existen ítems de tipo insumo, producto y activo, al menos uno compartido, al menos uno con variantes, y contactos proveedor, cliente y ambos

#### Scenario: La búsqueda de la semilla tolera acentos

- **WHEN** se busca "sublimacion" sobre los datos de la semilla
- **THEN** aparece al menos un ítem cuyo nombre lleva tilde
