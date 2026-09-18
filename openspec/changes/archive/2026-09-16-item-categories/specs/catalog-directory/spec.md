## ADDED Requirements

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

## MODIFIED Requirements

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
