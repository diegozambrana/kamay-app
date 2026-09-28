## MODIFIED Requirements

### Requirement: Tablas del catálogo y el directorio con la forma canónica

El sistema SHALL almacenar el catálogo y el directorio en tres tablas según el esquema canónico (§7): `contacts` (`name`, `phone`, `email`, `address`, `is_supplier`, `is_customer`, `notes`, `archived_at`), `items` (`business_line_id`, `kind`, `name`, `description`, `unit_id`, `category_id`, `attributes`, `sale_price`, `min_stock`, `show_in_fair`, `archived_at`) e `item_variants` (`item_id`, `name`, `attributes`, `sale_price`, `archived_at`). Las tres SHALL llevar `organization_id` y SHALL admitir clave primaria generada por el cliente. `items.kind` SHALL estar restringido a `supply`, `product` o `asset`. El nombre de una variante SHALL ser único dentro de su ítem. `items.category_id` SHALL ser opcional y SHALL referenciar `item_categories` con una clave compuesta que incluya la organización y el tipo, de modo que un ítem solo apunte a una categoría de su organización y de su tipo. `items` SHALL NOT conservar una columna de categoría en texto libre. `items.attributes` e `item_variants.attributes` SHALL ser objetos JSON no nulos, vacíos por omisión. `items.show_in_fair` SHALL ser un booleano no nulo, verdadero por omisión.

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

#### Scenario: Los ítems existentes quedan con atributos vacíos

- **WHEN** se aplica la migración que añade `items.attributes`
- **THEN** cada ítem existente tiene un objeto vacío, no nulo, y la bitácora no registra una edición por ello

#### Scenario: Los atributos no admiten algo que no sea un objeto

- **WHEN** se intenta guardar en `items.attributes` o en `item_variants.attributes` un arreglo, un texto o un nulo
- **THEN** la base de datos rechaza la operación

#### Scenario: Los ítems existentes quedan visibles en la venta rápida

- **WHEN** se aplica la migración que añade `items.show_in_fair`
- **THEN** cada ítem existente queda con `show_in_fair` verdadero y la bitácora no registra una edición por ello

#### Scenario: El ajuste de venta rápida no admite nulo

- **WHEN** se intenta guardar un ítem con `show_in_fair` nulo
- **THEN** la base de datos rechaza la operación

## ADDED Requirements

### Requirement: Un producto declara si se muestra en la venta rápida

Todo producto SHALL tener el ajuste «Mostrar en venta rápida», activado por omisión al crearlo. El formulario de alta y de edición de un producto SHALL ofrecerlo como un interruptor, y el detalle del producto (V11) SHALL mostrar su estado. El formulario de insumos y de activos SHALL NOT ofrecerlo, y su detalle SHALL NOT mostrarlo. El servidor SHALL aplicar la misma regla: al crear o editar un insumo o un activo, el valor recibido SHALL ignorarse y el ítem SHALL quedar con el ajuste activado. Cambiar el ajuste SHALL quedar en la bitácora como cualquier otra edición. El ajuste SHALL afectar solo a la cuadrícula del modo feria: un producto con el ajuste desactivado SHALL seguir apareciendo en el catálogo, en los buscadores de pedidos, en los reportes y en cualquier otro listado donde aparecía.

Cuando el producto no tiene precio de venta, el interruptor SHALL indicar que el producto no aparecerá en la venta rápida hasta que tenga precio.

#### Scenario: Un producto nuevo se muestra por omisión

- **WHEN** el usuario crea un producto sin tocar el ajuste
- **THEN** el producto queda con «Mostrar en venta rápida» activado

#### Scenario: Ocultar un producto de la venta rápida

- **WHEN** el usuario edita un producto, desactiva «Mostrar en venta rápida» y guarda
- **THEN** el producto queda con el ajuste desactivado, el detalle lo muestra así y la bitácora registra el cambio

#### Scenario: Volver a mostrarlo

- **WHEN** el usuario edita un producto oculto, activa el ajuste y guarda
- **THEN** el producto queda con el ajuste activado

#### Scenario: Insumos y activos no ofrecen el ajuste

- **WHEN** el usuario abre el formulario de alta o de edición de un insumo o de un activo
- **THEN** el formulario no ofrece «Mostrar en venta rápida»

#### Scenario: El servidor ignora el ajuste en un insumo

- **WHEN** llega una petición para crear un insumo con «Mostrar en venta rápida» desactivado
- **THEN** el insumo se crea con el ajuste activado

#### Scenario: Oculto en la feria, presente en el resto

- **WHEN** un producto tiene el ajuste desactivado
- **THEN** sigue apareciendo en el listado del catálogo y en el buscador de productos al crear un pedido

#### Scenario: Aviso de producto sin precio

- **WHEN** el usuario edita un producto sin precio de venta con el ajuste activado
- **THEN** el formulario indica que no aparecerá en la venta rápida hasta que tenga precio

