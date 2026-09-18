## Context

Motivación y alcance: ver `proposal.md`. Requisitos: los tres deltas en `specs/`.

Estado actual que condiciona el enfoque:

- **`items.category` es `text`** desde la migración del catálogo (`20260826120000_catalog.sql`), tal como lo define el esquema canónico §7. Hoy la escriben el formulario de ítem y la semilla, la leen el detalle, la exportación (`lib/export/tables.ts`) y la bitácora, que tiene la etiqueta «Categoría». Nada filtra ni agrupa por ella.
- **Configuración tiene un patrón hecho para entidades con nombre.**
  - `expense_categories`, `sales_channels` y `units` comparten la forma: `organization_id`, `name`, `archived_at`, RLS de lectura para miembros y escritura para la dueña, trigger `audit`.
  - Del lado del código comparten `ConfigTableService` (listar, insertar, renombrar, archivar y desarchivar) y `archiveConfigurationItem` / `unarchiveConfigurationItem` con una lista de entidades.
  - En pantalla comparten `ConfigTables` (tabla de activos y de archivados, con confirmaciones) y `ENTITY_COPY` para los textos.
- **El catálogo ya es por tipo**: pestañas con `?kind=`, el alta toma el tipo de la pestaña, y el tipo de un ítem no cambia al editar (`catalog-fields-by-kind`).
- **Las copias de Geeko que usan las e2e** (`e2e.clone_geeko()`) llaman a `e2e.seed_geeko(org)`, que siembra con identificadores derivados (`e2e.gid`). Sembrar las categorías ahí basta para que cada prueba tenga las suyas.
- **`items` tiene triggers de usuario al actualizar**: `audit` (bitácora) y el de las reglas de archivado, que impide editar un ítem archivado. Una conversión masiva desde la migración chocaría con los dos.
- **La prueba de manifiesto de KAM-23** (`tests/integration/export-manifest.test.ts`) compara la lista de tablas y columnas exportadas con el catálogo de la base. Una tabla o columna nueva que no se exporte rompe CI. Algo parecido hace `activity-fields-coverage.test.ts` con las etiquetas de la bitácora.

## Goals / Non-Goals

**Goals:**

- Una sola fuente de verdad de la categoría del ítem, con coherencia de organización y tipo garantizada en la base.
- Reutilizar el patrón de Configuración sin inventar otro. La única novedad son las pestañas por tipo.
- Una conversión de datos que no pierda valores ni ensucie la bitácora.

**Non-Goals:**

- Generalizar `ConfigTableService` para entidades con más dimensiones que la organización. Basta con que el servicio nuevo añada su filtro por tipo.
- Mostrar la categoría como columna del listado del catálogo.
- Categorías por línea, jerárquicas o con orden manual.

## Decisions

### D1 · Tabla `item_categories` con el tipo dentro y unicidad sin mayúsculas

```sql
create table item_categories (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  kind            text not null check (kind in ('supply','product','asset')),
  name            text not null check (name = btrim(name) and name <> ''),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  archived_at     timestamptz,
  unique (id, organization_id, kind)          -- destino de la clave compuesta (D2)
);
create unique index on item_categories (organization_id, kind, lower(name));
create index on item_categories (organization_id, kind) where archived_at is null;
```

La unicidad se compara en minúsculas: evitar «Sustratos» y «sustratos» es la razón de este cambio. Los espacios al borde los descarta el `check`, y la acción recorta el nombre antes de enviarlo, igual que el resto de esquemas Zod.

RLS, políticas, privilegios y trigger `audit` idénticos a los de `expense_categories`:

- `select` con `is_member`; `insert` y `update` con `is_owner`; ninguna política `delete`.
- Privilegios como en `20260820140000_configuration.sql`: `delete` revocado a todos, `insert` y `update` revocados a `anon` y a `service_role`, y `select` concedido a `service_role`.

Todo va en la misma migración que crea la tabla, como exige el procedimiento de la bitácora.

*Alternativa descartada: una tabla por tipo* (`supply_categories`…). Triplica políticas, servicios y secciones para distinguir un valor que cabe en una columna.

*Alternativa descartada: reutilizar `expense_categories` con una columna de ámbito.* Mezcla dos listas que la persona usuaria quiere separadas, y las consultas de egresos y reportes de gasto tendrían que filtrar el ámbito en todas partes.

### D2 · `items.category_id` con clave foránea compuesta

```sql
alter table items add column category_id uuid;
alter table items add constraint items_category_fk
  foreign key (category_id, organization_id, kind)
  references item_categories (id, organization_id, kind);
create index on items (organization_id, category_id) where archived_at is null;
```

Con `MATCH SIMPLE` (el valor por defecto), un `category_id` nulo no se comprueba: «Sin categoría» sigue siendo válido. Si tiene valor, la base exige que la categoría sea de la misma organización **y del mismo tipo** que el ítem. Así se cumplen dos escenarios del delta sin un solo trigger. Además protege el tipo de ambos lados: una categoría con ítems no puede cambiar de tipo (`on update no action`), y un ítem con categoría tampoco.

Para que el tipo de una categoría sin ítems tampoco cambie, `ItemCategoryService` no escribe `kind` al renombrar, y la acción no lo acepta (escenario *The kind of a category cannot change*). Es la misma decisión que tomó `catalog-fields-by-kind` con el tipo del ítem: la regla vive en el servicio, y la base la refuerza donde la clave compuesta llega.

*Alternativa descartada: trigger que valide organización y tipo.* Es más código que mantener y hace lo mismo que una restricción declarativa, que además aparece en el catálogo del esquema.

### D3 · La conversión fusiona variantes, enlaza sin triggers y quita la columna

En la misma migración, después de crear la tabla y la columna:

1. Por cada `(organization_id, kind, lower(btrim(category)))` con texto no vacío se crea una categoría. De sus variantes de escritura gana la más frecuente; si empatan, la que lleva mayúscula (orden `collate "C"`: la collation de la base pondría la minúscula delante). Así, «Sustratos», «Sustratos» y «sustratos » quedan en «Sustratos».
2. Se enlaza cada ítem con su categoría con `alter table items disable trigger user` alrededor del `update`, y se vuelven a activar al terminar. Hay dos motivos:
   - El trigger de archivado rechazaría actualizar un ítem archivado, y los archivados también deben quedar enlazados (escenario del delta).
   - El trigger `audit` escribiría una «edición» sin autor por cada ítem. Una migración de esquema no es un cambio que alguien hizo (escenario *La conversión no deja rastro falso en la bitácora*).

   `disable trigger user` no desactiva los triggers internos de las claves foráneas, así que la clave compuesta sí se comprueba.
3. Las categorías creadas por la conversión tampoco pasan por `audit`: se crean con el trigger de `item_categories` desactivado del mismo modo. Nadie las creó a mano, y la bitácora ya conserva los textos en los eventos antiguos de cada ítem.
4. `alter table items drop column category`.

**La conversión vive en una función para poder probarla.** Una migración ya aplicada no se puede volver a ejecutar desde pgTAP. Por eso los pasos 1 a 3 van en una función interna `backfill_item_categories(p_rows jsonb)`:

- Recibe pares `{item_id, category}`, crea las categorías fusionadas, enlaza los ítems y desactiva y reactiva los triggers alrededor.
- La migración la llama con `jsonb_agg` de los textos existentes y después quita la columna.
- La pgTAP la llama con filas propias de una organización de prueba para comprobar la fusión, los archivados y la bitácora.
- Queda sin `execute` para `authenticated`, `anon` ni `service_role`: solo `postgres` la invoca.

La migración es un solo archivo nuevo (convención nº 6). Queda irreversible en cuanto a la columna, pero el valor se conserva: basta un `join` para reconstruir el texto.

*Alternativa descartada: conservar `items.category` sin uso.* Serían dos fuentes de verdad para lo mismo, y la exportación seguiría sacando una columna muerta.

*Alternativa descartada: no fusionar mayúsculas.* La migración crearía justo los duplicados que la unicidad nueva prohíbe, y fallaría.

### D4 · Servicio y acciones siguen el patrón de configuración

- **`services/configuration/item-category-service.ts`**: `ItemCategoryService extends ConfigTableService` con `table = "item_categories"` y `orderBy` por nombre.
  - Añade `listByKind(org, kind, { includeArchived })`, porque el listado base no conoce el tipo.
  - `create(org, { kind, name })` escribe el tipo; `rename(org, id, { name })` no.
- **`actions/configuration.ts`**:
  - `createItemCategory({ kind, name })` y `updateItemCategory({ id, name })`, con `getOwnerContext`, Zod (nombre recortado, 1–80) y el mensaje de duplicado de siempre.
  - La lista `entities` de archivar y desarchivar suma `"itemCategory"`.
  - La revalidación añade `/catalog` además del layout: el filtro y el formulario del catálogo leen estas categorías.
- **`actions/catalog.ts`**: `createItem` y `updateItem` reciben `categoryId`.
  - Si viene uno, se lee la categoría. Tiene que existir, ser de la organización y ser del tipo que decide la acción (el de la pestaña al crear, el guardado al editar).
  - Si está archivada, solo se acepta cuando es la que el ítem ya tenía.
  - La clave compuesta vuelve a comprobar organización y tipo en la base. La regla de la categoría archivada solo la puede aplicar la acción, porque depende del valor anterior.

### D5 · La sección de Configuración usa pestañas por tipo, como el catálogo

`app/(app)/settings/item-categories/page.tsx`:

- Resuelve el contexto de dueña él mismo (escenario *The Item categories section guards itself*).
- Lee `?kind=` con `itemKindSchema`, y el valor por defecto es `supply`.
- Carga `listByKind(org, kind, { includeArchived: true })`.

`features/settings/item-categories-section.tsx` pinta:

- Un `ToggleGroup` Insumos / Productos / Activos que navega con `?kind=`.
- El botón «Nueva categoría».
- `ConfigTables` con la entidad nueva.

El diálogo reutiliza `NamedItemDialog`, con título por tipo («Nueva categoría de insumo»…). Los textos por tipo van en un mapa, como `ITEM_KIND_COPY`.

`ENTITY_COPY` y `ConfigEntity` suman `itemCategory`. El texto de su vacío depende del tipo, así que la sección pasa a `ConfigTables` los textos de su pestaña en lugar de leerlos de `ENTITY_COPY` directamente. Si `ConfigTables` no admite hoy textos por instancia, se le añade un `copy` opcional que tiene prioridad, sin cambiar lo que ven las demás secciones.

En `settings-nav.tsx`, «Categorías» pasa a «Categorías de gasto» y se añade «Categorías de ítem» justo después, con `ownerOnly: true` y un icono distinto (`ShapesIcon`) para que no se confundan.

*Alternativa descartada: una sola tabla con columna «Tipo» y el tipo como campo del diálogo.* Mezcla tres listas que se consultan por separado y reabre la pregunta de si el tipo se puede cambiar al editar. Las pestañas repiten lo que la persona ya conoce del catálogo.

### D6 · El formulario de ítem recibe las categorías del tipo y la actual

`ItemFormDialog` recibe:

- `categories: ItemCategory[]`: las vigentes del tipo.
- `currentCategory?: ItemCategory | null`: la del ítem, vigente o archivada.
- `canManageCategories: boolean`: rol dueña, para el enlace.

El `Select` controlado ofrece «Sin categoría» (`none`), las vigentes y, si la actual está archivada, esa también, rotulada «(archivada)». Sin categorías vigentes, la descripción del campo dice «Aún no hay categorías de insumo. Se definen en Configuración › Categorías de ítem», con enlace solo para la dueña.

- La página del catálogo ya carga por tipo, así que añade `ItemCategoryService.listByKind(org, kind, { includeArchived: true })`. Las vigentes van al formulario y al filtro, y el mapa completo sirve para resolver la categoría actual de una fila que se edita.
- El detalle carga las del tipo del ítem de la misma forma y muestra el nombre con un `Badge` «Archivada» si corresponde.

### D7 · El filtro del catálogo viaja en `?category=` y respeta la ventana

- **La página**:
  - Lee `category`. `none` pide los ítems sin categoría; un id solo cuenta si es una categoría del tipo de la pestaña. Si no, se trata como «todas», igual que hoy se trata una línea desconocida.
  - Pasa `categoryId: string | "none" | null` a `ItemService.list()`, que añade `.eq("category_id", id)` o `.is("category_id", null)`.
- **La pantalla**:
  - Suma el `Select` junto a *Línea* y añade `"category"` a `CATALOG_FILTERS`, así «Quitar filtros» también lo limpia.
  - Al cambiar de pestaña navega con `{ kind, category: null }`.
- **`joinsCatalogWindow`** suma `categoryFilter` a `CatalogScope`. Un ítem recién creado solo se añade a la ventana si su categoría coincide con el filtro vigente.

### D8 · Transversales: bitácora, exportación, tipos, documentos

- **Bitácora**:
  - `lib/activity/fields.ts` suma `item_categories` (`name`, `kind` con etiqueta «Tipo») y `items.category_id` como referencia a `item_categories`. Conserva `items.category` en texto para leer los eventos anteriores a la migración.
  - `services/activity/label-service.ts` resuelve `item_categories` por `name`.
  - `describe.ts` la nombra «la categoría de ítem». `app/(app)/activity/page.tsx` la ofrece como tipo de registro («Categoría de ítem»).
  - `lib/activity/unarchive.ts` suma `item_categories`, para poder desarchivarla desde la bitácora como las demás de configuración.
- **Exportación**: `lib/export/tables.ts` suma `item_categories` (archivo `categorias-item`, `ownerOnly: false`, porque ambos roles la leen). En `items` sustituye `category` por `category_id`.
- **Tipos**: `ItemCategory` en `types/index.ts`. En `Item`, `category: string | null` pasa a `categoryId: string | null`, y el compilador marca cada sitio que leía el texto.
- **Documentos de producto**:
  - Esquema canónico §7: tabla nueva, `items.category_id` y quitar `category`.
  - Especificación V15: la lista de Configuración suma «categorías de ítem (por tipo)».
  - Mapa de navegación: V15 suma la sección.

## Risks / Trade-offs

- **[Riesgo] Quitar `items.category` rompe todo lo que lo lea.** → El cambio de tipo en `Item` hace que el compilador señale cada lectura. Antes de la migración se busca `category` en `services/`, `lib/export/`, `supabase/seed*.sql` y `supabase/tests/`, y las pruebas de manifiesto y de etiquetas de bitácora cubren lo que el compilador no ve.
- **[Riesgo] Desactivar triggers dentro de una migración.** Si la migración fallara a mitad, los triggers quedarían desactivados. → Toda la migración corre en una sola transacción (`psql -1`, y `supabase db push` también lo hace por archivo), así que un fallo deshace también el `disable`. La pgTAP comprueba al final que `audit` y el trigger de archivado de `items` están activos.
- **[Riesgo] La base local compartida.** La memoria del proyecto dice que no se hace `db reset`: la migración se aplica con `psql … -1 -f`. → Así lo dice la tarea. Las demás sesiones verán la columna nueva en cuanto se aplique, y el código viejo que lea `items.category` fallará en su rama. Se avisa antes de aplicarla.
- **[Trade-off] Las categorías que crea la conversión no tienen evento de alta en la bitácora.** → Es deliberado (D3). La historia anterior sigue en los eventos de cada ítem, con el texto original.
- **[Trade-off] El ayudante no puede crear una categoría que falte.** Tiene que pedírsela a la dueña o dejar el ítem sin categoría. → Es la decisión de la persona usuaria. El campo lo dice en lugar de dejar un selector vacío sin explicación.
- **[Riesgo] Nombres de producción que solo difieren en tildes** («Decoracion» y «Decoración») quedan como dos categorías, porque la unicidad no quita acentos. → Es aceptable: la dueña puede archivar una y reasignar. Quitar acentos en la unicidad exigiría `immutable_unaccent` en el índice y cambiaría qué nombres se consideran iguales sin que nadie lo pidiera.

## Migration Plan

1. Migración nueva `YYYYMMDDHHMMSS_item_categories.sql` (tabla, políticas, trigger, columna, clave compuesta, conversión, quitar columna), con su pgTAP `supabase/tests/item_categories.test.sql`.
2. En local, aplicarla con `psql "$DB_URL" -1 -f` sobre la base compartida, sin `db reset`, y actualizar `supabase/seed.sql` para que un reinicio futuro produzca lo mismo.
3. En producción se aplica con el despliegue normal de migraciones. La conversión trabaja sobre los datos reales.
4. **Reversión:** una migración inversa (añadir `category text`, rellenarla desde `item_categories` por `category_id`, quitar la clave y la columna nueva, y dejar la tabla archivada o eliminarla) devuelve el esquema anterior sin perder valores. No se escribe por adelantado. Se documenta en la tarea por si hiciera falta.

## Open Questions

- ~~El icono de «Categorías de ítem» en el menú.~~ *Resuelta al implementar:* `ShapesIcon`, distinto del `TagsIcon` de las categorías de gasto.
