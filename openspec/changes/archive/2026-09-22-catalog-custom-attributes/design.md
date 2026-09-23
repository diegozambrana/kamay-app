## Context

Motivación y alcance: ver `proposal.md`. Requisitos: los cuatro deltas en `specs/`.

Estado actual que condiciona el enfoque:

- **Los valores tienen dónde vivir a medias.** `item_variants.attributes jsonb not null default '{}'` existe desde KAM-06. Solo la semilla lo escribe (`{"capacidad":"11oz"}`, con el nombre como clave) y la bitácora lo declara oculto. `items` no tiene columna de atributos. `ItemVariant.attributes` ya viaja como `Record<string, unknown>` en `types/index.ts`.
- **Los campos por tipo ya tienen una fuente única.** `lib/catalog/fields.ts` (`ITEM_KIND_FIELDS`) la leen formulario, listado, detalle, variantes y servidor. Es el patrón a seguir: la definición de atributos se interpreta en un solo módulo de `lib/catalog/`.
- **La escritura del catálogo pasa por un solo camino.** `actions/catalog.ts` valida con los esquemas de `lib/catalog/schema.ts` y ya consulta `ItemCategoryService` para la regla de la categoría archivada. La regla «un valor archivado se conserva si no cambia» está resuelta ahí para la categoría y se repite aquí para las opciones.
- **Configuración tiene su patrón.** `ConfigTables` dibuja activos y archivados con un menú «⋯» fijo de Editar y Archivar. `archiveConfigurationItem` y `unarchiveConfigurationItem` trabajan con una lista de entidades. La sección de categorías de ítem navega por `?kind=`.
- **Los saldos.** `item_balances` agrupa por ítem y la leen `MovementService.balances` y `balanceFor`, la tarjeta del panel y `report_low_stock`. El trigger de compra ya copia `variant_id` de la línea al movimiento. Los diálogos de consumo y conteo no piden variante, aunque sus esquemas (`lib/inventory/schema.ts`) aceptan `variantId` opcional.
- **Nada en la base impide que un movimiento apunte a la variante de otro ítem.** `inventory_movements.variant_id` y `expense_items.variant_id` referencian solo `item_variants(id)`, y `create_expense` inserta la variante que le llega sin compararla con el ítem.
- **Los consumos sin conexión se reenvían por las mismas acciones** (`features/sync/operations.ts` llama a `registerConsumption` y `registerCountAdjustment`). Una regla nueva en la acción alcanza también lo encolado.
- **La base local es compartida.** Una migración se aplica con `psql -1 -f` y `e2e.seed_geeko` se recrea a mano después (ver el procedimiento de `item-categories`, tarea 2.4).

## Goals / Non-Goals

**Goals:**

- Que «qué atributos tiene este ítem y qué valores admiten» se interprete en un solo módulo, leído por formulario, detalle, lista de variantes, filtro y servidor.
- Que ningún valor guardado se pierda por renombrar, archivar, quitar una opción o cambiar de categoría.
- Que el saldo por variante sea exactamente la suma de sus movimientos, y que la suma de las variantes sea el saldo del ítem.
- Migración puramente aditiva: ninguna consulta existente cambia de forma.

**Non-Goals:**

- Validar los valores por tipo en la base de datos (ver D3).
- Cambiar `item_balances`, la tarjeta del panel o `report_low_stock`.
- Validar en la base que la variante de una línea de compra sea de su ítem. Se protege el movimiento (D6), que es lo que el saldo lee.
- Índice sobre `items.attributes` para el filtro.

## Decisions

### D1 · Tabla `item_category_attributes`, hija de la categoría

```sql
alter table item_categories
  add constraint item_categories_id_org_key unique (id, organization_id);

create table item_category_attributes (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  category_id     uuid not null,
  name            text not null check (name = btrim(name) and name <> ''),
  type            text not null check (type in ('text','number','list')),
  unit            text check (unit is null or (unit = btrim(unit) and unit <> '')),
  options         jsonb not null default '[]'::jsonb,
  required        boolean not null default false,
  scope           text not null check (scope in ('item','variant')),
  position        integer not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  archived_at     timestamptz,
  foreign key (category_id, organization_id)
    references item_categories (id, organization_id),
  constraint options_match_type check (
    jsonb_typeof(options) = 'array'
    and ((type = 'list') = (jsonb_array_length(options) > 0))
  ),
  constraint unit_only_for_numbers check (unit is null or type = 'number')
);
create unique index item_category_attributes_name_key
  on item_category_attributes (category_id, lower(name));
create index on item_category_attributes (organization_id, category_id)
  where archived_at is null;
```

- La clave compuesta hace que un atributo solo cuelgue de una categoría de su organización, sin trigger. Es la misma decisión que D2 de `item-categories`. La restricción `unique (id, organization_id)` es redundante con la clave primaria, pero es el destino que la clave compuesta necesita.
- RLS, privilegios y trigger `audit` calcados de `item_categories`: lee todo miembro, escribe solo la dueña, nadie borra, `service_role` solo lee.
- La unicidad de opciones sin espacios ni repeticiones la valida Zod (D3). La base solo garantiza la forma.
- `position` la asigna el servicio al crear, como el máximo de la categoría más uno, contando los archivados. No es única: dos altas simultáneas podrían empatar, y el desempate por `created_at` basta.

**Tipo, alcance y categoría no cambian después de creados.** Un trigger `before update` rechaza el cambio de `type`, `scope` o `category_id`. Aquí no alcanza con que el servicio no los escriba, como se hizo con el tipo de la categoría. Allí la clave compuesta de `items` protegía la categoría en uso. Aquí nada protege los valores: pasar «Temperatura» de número a lista, o de ítem a variante, dejaría valores guardados sin sentido en otra columna.

*Alternativa descartada: definición en un `jsonb` dentro de `item_categories`.* El atributo archivado, la bitácora por atributo y la unicidad de nombres tendrían que reimplementarse sobre un documento. La exportación sacaría un blob.

*Alternativa descartada: una tabla de valores (EAV).* Duplicaría cada ítem en N filas y obligaría a unir para leer un ítem. La columna `item_variants.attributes` ya existe y la tarea pide usarla.

### D2 · Valores en `jsonb`, con el id del atributo como clave

```sql
alter table items
  add column attributes jsonb not null default '{}'::jsonb
  constraint items_attributes_is_object check (jsonb_typeof(attributes) = 'object');

alter table item_variants
  add constraint item_variants_attributes_is_object check (jsonb_typeof(attributes) = 'object');
```

- El valor se guarda como `{"<id del atributo>": <valor>}`: texto como cadena, número como número JSON, lista como la cadena de la opción. Renombrar un atributo no toca ningún ítem.
- `add column ... default` es un cambio de catálogo en Postgres 11+ y no reescribe filas. No dispara `audit`, así que no hay eventos falsos en la bitácora.
- Las claves que no son el id de un atributo conocido, como `capacidad` de la semilla antigua, se muestran en el bloque de datos que ya no se piden, con la clave como etiqueta. La semilla nueva deja las dos tazas con `{}`. El nombre de la variante ya dice «11oz».

### D3 · `lib/catalog/attributes.ts` interpreta la definición; la base solo guarda la forma

Un módulo sin dependencias de Supabase, con cuatro funciones puras:

- `attributeFieldsFor(definitions, categoryId, scope)`: los campos vigentes de esa categoría y ese alcance, por posición.
- `attributesSchema(fields, stored)`: un esquema Zod por campo.
  - `text`: recorta, vacío es ausencia.
  - `number`: acepta número o texto numérico, rechaza lo demás, vacío es ausencia.
  - `list`: exige una opción vigente, o el valor igual al guardado (la opción retirada que no se toca).
  - Un campo obligatorio no admite ausencia.
- `mergeAttributes(stored, parsed, fields)`: parte de lo guardado, reemplaza solo las claves de los campos ofrecidos y quita las que quedaron vacías. Las demás claves —atributos archivados, de otra categoría, desconocidos— pasan intactas.
- `describeAttributes(stored, definitions, categoryId, scope)`: para el detalle. Devuelve los rotulados actuales, con unidad, y los retirados, con su etiqueta o su clave.

Los formularios nombran cada campo `attr:<id>` y la acción recibe `attributes: Record<string, string>`. El formulario y la acción usan el mismo `attributesSchema`, así que no pueden discrepar.

**Por qué no validar en la base.** La validación depende de la definición vigente y del valor anterior. Un trigger tendría que leer la definición en cada escritura de `items`, duplicar el esquema Zod en PL/pgSQL y resolver la excepción de la opción retirada. `catalog-fields-by-kind` tomó la misma decisión (su D4) con los campos por tipo. La acción es el único camino de escritura desde la aplicación, y el requisito pide el rechazo en el servidor, no en la base.

### D4 · Acciones del catálogo: validar contra la categoría que decide la acción

- `createItem` y `updateItem`:
  - Resuelven la categoría efectiva: la nueva si cambia, la guardada si no.
  - Leen sus atributos vigentes de alcance `item` con `ItemCategoryAttributeService.listActive(org, categoryId)`.
  - Validan con `attributesSchema` y escriben `mergeAttributes(stored, parsed, fields)`. Al crear, lo guardado es `{}`.
- `createItemVariant` y `updateItemVariant` hacen lo mismo con la categoría del ítem y el alcance `variant`.
- Un ítem sin categoría no ofrece campos: la carga de atributos se ignora y lo guardado se conserva.

### D5 · Configuración: ruta propia para los atributos de una categoría

- **Ruta nueva** `app/(app)/settings/item-categories/[categoryId]/page.tsx`, con su `loading.tsx` y su `error.tsx` (guarda `route-states`).
  - Se guarda a sí misma con `getOwnerContext()` y redirige como las demás secciones de dueña.
  - Carga la categoría (404 si no es de la organización) y sus atributos con archivados.
  - La entrada «Categorías de ítem» del menú lateral sigue marcada. La vuelta atrás navega a `/settings/item-categories?kind=<tipo de la categoría>`.
- **`ConfigTables` acepta `extraActions`**: acciones de fila que van entre «Editar» y el separador de «Archivar». Solo las categorías de ítem la usan, para «Atributos». Las demás secciones no cambian.
- **La tabla de atributos reutiliza `ConfigTables`** con la entidad nueva `itemCategoryAttribute`: columnas nombre, tipo, obligatorio y alcance, textos en `ENTITY_COPY`, y el efecto de archivar que dice que los valores se conservan.
- **Diálogo propio** `features/settings/attribute-dialog.tsx`. `NamedItemDialog` solo pide nombre, y este necesita tipo, unidad, opciones, obligatorio y alcance, con campos que aparecen según el tipo. En edición no se dibujan tipo ni alcance.
- **Acciones** en `actions/configuration.ts`:
  - `createItemCategoryAttribute({ categoryId, name, type, unit, options, required, scope })` y `updateItemCategoryAttribute({ id, name, unit, options, required })`.
  - El esquema de edición no tiene tipo ni alcance, y el trigger de D1 lo refuerza.
  - La entidad `itemCategoryAttribute` se suma a archivar y desarchivar.
  - Revalida el layout raíz, que alcanza `/catalog`.
- **Servicio** `services/configuration/item-category-attribute-service.ts` sobre `ConfigTableService`, con `listForCategory`, `listActiveForCategories(org, categoryIds)` y `create`, que calcula `position`.

### D6 · `item_variant_balances`, y el movimiento no puede apuntar a una variante ajena

```sql
alter table item_variants
  add constraint item_variants_id_item_key unique (id, item_id);

alter table inventory_movements
  add constraint inventory_movements_variant_of_item_fk
  foreign key (variant_id, item_id) references item_variants (id, item_id);

create view item_variant_balances with (security_invoker = true) as
select i.id as item_id, i.organization_id,
       v.id as variant_id, v.name as variant_name, v.archived_at as variant_archived_at,
       coalesce(sum(m.quantity), 0) as balance
from items i
join item_variants v on v.item_id = i.id
left join inventory_movements m on m.item_id = i.id and m.variant_id = v.id
where i.kind = 'supply'
group by i.id, v.id
union all
select i.id, i.organization_id, null, null, null, sum(m.quantity)
from items i
join inventory_movements m on m.item_id = i.id and m.variant_id is null
where i.kind = 'supply'
group by i.id;
```

- **La unión es por ítem y variante**, no solo por variante. Así la lectura de un ítem usa el índice `(item_id, occurred_at)` de KAM-18 en vez de recorrer todos los movimientos. Se añade además un índice parcial sobre `variant_id` para quien filtre por variante. *Hallazgo de la implementación:* la primera versión unía solo por `variant_id`, sin índice, y bajo RLS tardaba 2 s por lectura en la base compartida (≈40.000 movimientos); lo corrige la migración `20260921110000_item_variant_balances_index.sql`, con las mismas columnas y filas.
- **La clave compuesta** garantiza en la base que la variante de un movimiento sea de su ítem. Con `MATCH SIMPLE` un movimiento sin variante no se comprueba. Sin ella, un movimiento cruzado sumaría a la variante de otro ítem y rompería la igualdad entre la suma de variantes y el saldo del ítem.
- Cubre también el trigger de compra: una línea con una variante ajena hace fallar la compra entera con un error de clave. La interfaz nunca envía esa combinación, y la acción de egresos suma la comprobación para devolver un mensaje comprensible en vez del error de la base.
- **La fila «Sin variante»** aparece siempre que haya movimientos sin variante, tenga o no variantes el ítem. Así la igualdad vale para todo insumo. El detalle solo dibuja la tabla por variante cuando el ítem tiene variantes, y para un ítem sin variantes la fila es igual a su saldo y no se muestra.
- La vista es de solo lectura con `security_invoker`. El ayudante la lee como lee `item_balances`.
- `item_balances` no se toca, así que el panel, el catálogo y los reportes siguen iguales. Un color agotado con el ítem sobre su mínimo no alerta, como pide el delta de inventario.

*Alternativa descartada: añadir `variant_id` al `group by` de `item_balances`.* Cambiaría el grano de una vista que leen cuatro consumidores, y `below_min` perdería sentido por fila.

### D7 · Consumo y conteo exigen variante en la acción, y el detalle los ofrece por fila

- **`actions/inventory.ts`**: `registerConsumption` y `registerCountAdjustment` leen las variantes del ítem.
  - Con variantes vigentes, sin `variantId`: error «Elige la variante».
  - Con un `variantId` que no es del ítem o está archivado: error.
  - La fila «Sin variante» se cuenta con `variantId: null` y **origen de la fila**: el conteo trae `countsUnassigned: true`, y solo así se acepta sin variante en un ítem que las tiene. El consumo no tiene esa excepción.
- **Lo encolado sin conexión** pasa por las mismas acciones. Un consumo sin variante encolado antes de que el ítem tuviera variantes se rechaza al sincronizar y queda en el estado de error de la cola, con el mensaje.
- **`ConsumptionDialog`** recibe `variant?` puesta, o muestra un `ToggleGroup` con las variantes vigentes del ítem elegido. Un toque es una interacción: el conteo del delta sale de ahí. Los insumos que recibe desde el registro rápido tienen que traer sus variantes: `ItemService` ya tiene la consulta con `item_variants(...)` que usa el formulario de compra.
- **`CountDialog`** recibe el saldo de la variante y la variante. `countAdjustment` no cambia.
- **`BalanceSection`** suma, si hay variantes, una tabla de saldo por variante con «Registrar consumo» y «Ajustar» por fila. El ajuste del ítem completo se oculta. `MovementsSection` muestra el nombre de la variante.
- **Servicio** `services/inventory/variant-balance-service.ts` con `forItem(org, itemId)`.

### D8 · Filtro del catálogo por atributo de lista del ítem

- Un parámetro por atributo: `attr_<id>=<opción>`. La página lee los parámetros cuyo id es un atributo vigente de tipo lista y alcance ítem de la categoría elegida, e ignora los demás.
- `ItemService.list()` recibe `attributes: Record<id, value>` y aplica `.contains("attributes", { [id]: value })`, que es `@>` en Postgres.
- `joinsCatalogWindow` respeta los mismos filtros, para que un ítem recién creado no aparezca en una ventana que no le corresponde.
- `catalog-screen.tsx` calcula la lista de filtros activos con los `attr_` presentes, además de `CATALOG_FILTERS`. Cambiar de categoría o de pestaña navega quitando todos los `attr_`.
- Sin índice: el catálogo de un taller cabe en una consulta. Si crece, un GIN sobre `items.attributes` se añade sin cambiar nada más.

### D9 · Bitácora, exportación y tipos

- **`lib/activity/fields.ts`**:
  - `items.attributes` va oculto, como el de variantes, con su línea en `HIDDEN_REASON`.
  - `item_category_attributes` declara `category_id` como referencia, `name`, `type` y `scope` como enum, `unit`, `required`, `options` y `position` ocultos, y `archived_at`.
  - `describe.ts` suma «el atributo de categoría». `label-service.ts` usa `name`. `unarchive.ts` suma la tabla. La página de actividad suma el tipo de registro.
- **`lib/export/tables.ts`**:
  - Tabla nueva `item_category_attributes`, archivo `atributos-categoria`, `ownerOnly: false`.
  - `items.attributes` va **al final** de las columnas de `items`: una columna añadida con `alter table` queda última en el catálogo, y la prueba del manifiesto compara por posición.
- **`types/index.ts`**: `ItemCategoryAttribute`, `Item.attributes`, `VariantBalance`.

### D11 · Tipo `color`: hex normalizado, selector nativo más campo de texto

*Añadido el 2026-09-22 a pedido de la persona usuaria.* La exploración había decidido modelar el color como lista de nombres; ahora se suma un tipo propio. La lista sigue siendo válida para quien prefiera nombres, y la semilla la conserva.

- **Base:** una migración nueva (`20260922100000_attribute_type_color.sql`) reemplaza `item_category_attributes_type_check` para admitir `color`. `options_match_type` y `unit_only_for_numbers` ya dejan a un color sin opciones ni unidad.
- **Valor:** `#RRGGBB` en mayúsculas. `attributesSchema` acepta tres o seis dígitos hex, con o sin `#`, expande los de tres (`#abc` → `#AABBCC`) y rechaza lo demás con «tiene que ser un color en hex, como #1A1A1A». Normalizar evita que `#c62828` y `#C62828` parezcan valores distintos.
- **Formulario:** `<input type="color">` nativo y un campo de texto con el nombre `attr:<id>`, sincronizados: el selector escribe el hex en el campo, y un hex válido escrito mueve el selector. El selector nativo siempre tiene un valor (`#000000`), así que lo que se envía es el campo de texto, que puede quedar vacío.
- **Presentación:** `describeAttributes` y `formatAttributeValue` devuelven el hex como texto; `DescribedAttribute` suma `swatch` con el hex cuando el atributo es de color, y un componente `ColorSwatch` pinta el cuadrito en el detalle y en la lista de variantes. Un valor guardado que no es un hex válido se muestra como texto, sin muestra.
- **Filtro:** un atributo de color no filtra (D8), como los de texto y número.

*Alternativa descartada: una librería de selector de color.* El selector nativo cumple en escritorio y en celular, y no suma dependencias.

### D10 · Semilla

En `e2e.seed_geeko`, con identificadores `e2e.gid`:

- La categoría de insumo «Filamento».
- Sus cinco atributos, en el orden y con los tipos del delta.
- El insumo «PLA Sunlu», de la línea Impresión 3D, en kilos, con marca Sunlu, 190 °C, 220 °C y 60 mm/s.
- Las variantes «Negro» y «Rojo» con su color.

Sin compras sembradas: las pruebas que miden saldos crean las suyas sobre una copia.

## Risks / Trade-offs

- [Un movimiento o una compra existente ya cruza variante e ítem, y la clave compuesta de D6 no se puede crear] → Antes de aplicar, se consulta la base compartida por filas que crucen. Si aparecen, se anotan y se corrigen a mano antes de la migración. La semilla no las tiene.
- [La validación de valores no vive en la base: una escritura directa con credenciales de la dueña puede guardar un valor fuera de tipo] → Es el mismo límite aceptado en `catalog-fields-by-kind`. `describeAttributes` muestra cualquier valor como texto sin fallar, y la siguiente edición desde la aplicación lo valida.
- [Consumos encolados sin conexión se rechazan si el ítem ganó variantes mientras tanto] → Caso raro. La cola ya muestra los rechazos, y el mensaje dice qué falta.
- [El registro rápido cuesta cuatro interacciones para un ítem con variantes] → Queda escrito en el delta y medido en la e2e. El camino frecuente, desde la fila de la variante, sigue en tres.
- [`position` puede empatar con dos altas simultáneas] → Desempate por `created_at`. Una sola persona gestiona los atributos.
- [Formularios con muchos atributos crecen en el diálogo] → El diálogo ya hace scroll. Un corte posterior podría agrupar los atributos si hace falta.

## Migration Plan

1. Consultar la base compartida por movimientos y líneas de compra que crucen variante e ítem (tarea 2.1).
2. Aplicar la migración nueva con `psql "$DB_URL" -1 -f`, sin `db reset`. Es aditiva: ninguna rama que no conozca los atributos se rompe.
3. Recrear `e2e.seed_geeko` en la base desde `supabase/seed.sql`, extrayendo hasta su delimitador `$geeko$;`. Las copias existentes de Geeko no tendrán «Filamento», pero las nuevas sí.
4. Correr `supabase test db`, `npm run test:integration` y `graphify update .`.

Reversión: quitar la vista, la clave compuesta, las restricciones de objeto, la columna `items.attributes` y la tabla nueva. Se pierden solo los datos creados con esta funcionalidad.
