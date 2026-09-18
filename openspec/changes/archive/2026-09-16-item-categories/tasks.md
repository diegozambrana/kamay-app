## 1. Documentos de producto

- [x] 1.1 `specs/PRD/kamay-esquema-base-de-datos-supabase.md`:
  - §6: tabla `item_categories` junto a `expense_categories`.
  - §7: `items.category text` pasa a `category_id uuid` con la clave compuesta `(category_id, organization_id, kind)`.
  - Matriz de acceso: `item_categories` junto a las demás tablas de configuración.
- [x] 1.2 `specs/PRD/kamay-especificacion-producto-v6.md`: V15 suma «categorías de ítem (por tipo)» a su lista. En el catálogo, la categoría se describe como elegida de una lista definida por la organización.
- [x] 1.3 `specs/PRD/kamay-mapa-navegacion-ui.md`: V15 suma la sección «Categorías de ítem», y «Categorías» pasa a «Categorías de gasto».

## 2. Base de datos

- [x] 2.1 Antes de escribir la migración, buscar `category` en `services/`, `lib/`, `features/`, `app/`, `supabase/seed*.sql`, `supabase/seeds/`, `supabase/tests/` y `tests/`, y anotar aquí cada lectura o escritura de `items.category` que no marque el compilador (SQL, manifiestos, pruebas).
  - *Hecho:* fuera de TypeScript, solo lo leen o escriben:
    - `lib/export/tables.ts` (manifiesto) y `lib/activity/fields.ts` (etiqueta; se conserva para los eventos antiguos).
    - La función `e2e.seed_geeko` de `supabase/seed.sql`, que también está viva en la base compartida. Al aplicar la migración hay que volver a crearla, o las copias de las e2e fallan.
    - Ninguna vista depende de la columna (consultado en `pg_depend`), ninguna otra función SQL la usa, y `supabase/seeds/performance.sql` no la escribe.
  - Los factories de prueba con `category: null` (`catalog-screen`, `item-detail`, `purchase-form`, `purchase-lines-table`, `consumption-dialog`, `count-dialog`, `order-form`, `order-lines-editor`, `window`, `lines`, `catalog-service`) los marcará el compilador.
  - Datos en la base local: 1.488 organizaciones (casi todas copias de Geeko) tienen ítems con categoría en texto.
- [x] 2.2 Migración nueva `supabase/migrations/<timestamp>_item_categories.sql` (design D1–D3):
  - Tabla `item_categories` con el `check` de nombre, `unique (id, organization_id, kind)`, índice único `(organization_id, kind, lower(name))` e índice parcial de vigentes.
  - Trigger `audit`, `grant`/`revoke` y políticas de lectura para miembros y escritura para la dueña, calcados de `expense_categories`.
  - `items.category_id`, la clave compuesta `items_category_fk` y su índice.
  - La función `backfill_item_categories(p_rows jsonb)` (fusión por `lower(btrim())` quedándose con la escritura más frecuente, y `disable`/`enable trigger user` en `items` e `item_categories`), sin `execute` para `authenticated`, `anon` ni `service_role`.
  - La llamada con los textos existentes y `drop column category`.
- [x] 2.3 `supabase/tests/item_categories.test.sql` (pgTAP, con su propia organización; `throws_ok` de cuatro argumentos):
  - **Forma**:
    - `items` tiene `category_id` y no `category` («La categoría ya no es texto libre»).
    - Un `kind` fuera del juego se rechaza («An item category outside the allowed kinds is rejected»).
    - `sustratos` junto a `Sustratos` del mismo tipo se rechaza («An item category name differing only in case is rejected», «Duplicate name in the same kind ignores case and spaces», nivel de base).
    - El mismo nombre en dos tipos se acepta («The same name in two kinds», nivel de base).
  - **Clave compuesta**: un insumo que apunta a una categoría de producto se rechaza («La base rechaza una categoría de otro tipo»), y uno que apunta a una categoría de otra organización también («La base rechaza una categoría de otra organización»).
  - **RLS y privilegios**:
    - El ayudante lee («Assistant reads configuration»).
    - El ayudante no inserta ni actualiza («Assistant cannot write configuration»).
    - Otra organización ve cero filas («Configuration of another organization is invisible»).
    - `delete` no borra («No one can delete configuration»).
  - **Bitácora**: el alta hecha por la dueña deja un evento `created` con su autoría («Creating a configuration row is logged»).
  - **Conversión**, con `backfill_item_categories` sobre ítems propios:
    - «Sustratos», «sustratos » y «Embalaje» quedan en dos categorías y cada ítem enlazado con la suya («Los textos de categoría existentes se conservan»).
    - Un ítem archivado queda enlazado y sigue archivado («La conversión también enlaza los ítems archivados»).
    - El número de eventos de `activity_log` de esos ítems no cambia («La conversión no deja rastro falso en la bitácora»).
    - Al terminar, `audit` y `enforce_archive` de `items` están activos.
- [x] 2.4 Aplicar la migración en la base local compartida con `psql "$DB_URL" -1 -f` (sin `db reset`) y anotar aquí cuántas categorías creó la conversión en cada organización. Avisar antes de aplicarla: las ramas que aún lean `items.category` fallarán contra esta base.
  - *Hecho (con aviso previo y el visto bueno de la persona usuaria):*
    - La conversión creó 7 categorías (3 de insumo y 4 de producto) en cada una de las 1.488 organizaciones con texto (casi todas copias de Geeko), y enlazó los 14.881 ítems que tenían categoría. No quedó ninguno sin enlazar.
    - `e2e.seed_geeko` se recreó en la base con la definición nueva, y una copia (`e2e.clone_geeko()`) sale con sus categorías enlazadas.
    - *Hallazgo:* el primer intento falló porque la llamada leía `items` en la misma sentencia que la función que apaga sus triggers. La transacción lo deshizo entero. Ahora los textos se leen antes, en un bloque `do`.
- [x] 2.5 `supabase/seed.sql` · `e2e.seed_geeko`:
  - Sembrar categorías con `e2e.gid`. De insumo: «Sustratos», «Materia prima» y «Embalaje». De producto: «Regalos», «Decoración», «Vajilla» y «Embalaje».
  - Los ítems pasan de `category` a `category_id`.
  - Revisar `supabase/seeds/performance.sql` y el resto de `seed.sql` por si escriben `category`.
- [x] 2.6 `supabase/tests/seed_geeko.test.sql`: Geeko tiene categorías de insumo y de producto, «Embalaje» en los dos tipos, y cada ítem sembrado con categoría apunta a una de su tipo («Categorías de la semilla por tipo»).
- [x] 2.7 Correr `supabase test db` completo y `graphify update .`.

## 3. Tipos, servicios y acciones

- [x] 3.1 `types/index.ts`: `ItemCategory` (`id`, `organizationId`, `kind`, `name`, `archivedAt`). En `Item`, `category` pasa a `categoryId: string | null`. Corregir cada error de compilación que salga.
- [x] 3.2 `services/configuration/item-category-service.ts`: `ItemCategoryService extends ConfigTableService`, con `listByKind(org, kind, { includeArchived })`, `create(org, { kind, name })` y `rename(org, id, { name })`, que no escribe `kind` (design D4).
- [x] 3.3 Pruebas del servicio en `services/configuration/config-table-service.test.ts` o en un archivo propio, con `FakeClient`:
  - `listByKind` filtra por organización y tipo, y esconde lo archivado salvo que se pida.
  - `create` escribe el tipo.
  - La carga de `rename` no incluye `kind` («The kind of a category cannot change», nivel de servicio).
- [x] 3.4 `services/catalog/item-service.ts`: `COLUMNS` y escrituras con `category_id`, y filtro `categoryId: string | "none" | null` en `list()`. Ampliar `services/catalog/catalog-service.test.ts`:
  - Un id añade `.eq("category_id", id)`; `"none"` añade `.is("category_id", null)` («Filtrar por categoría», «Filtrar los ítems sin categoría», nivel de servicio).
  - `create` y `update` escriben `category_id`.
- [x] 3.5 `actions/configuration.ts`:
  - `createItemCategory({ kind, name })` y `updateItemCategory({ id, name })`, con `getOwnerContext`, nombre recortado de 1 a 80 caracteres y el mensaje de duplicado.
  - La entidad `"itemCategory"` en archivar y desarchivar.
  - La revalidación también de `/catalog`. *Hecho sin línea nueva:* `revalidateConfiguration()` ya revalida el layout raíz (`revalidatePath("/", "layout")`), que alcanza `/catalog`. Queda anotado junto a las acciones nuevas.
- [x] 3.6 `actions/configuration.test.ts` (ampliar):
  - Crear llama al servicio con el tipo y el nombre recortado.
  - Editar no pasa `kind` aunque la petición lo traiga («The kind of a category cannot change», nivel de acción).
  - Sin contexto de dueña, no se llama al servicio.
  - El duplicado devuelve «Ya existe un registro con ese nombre.».
- [x] 3.7 `actions/catalog.ts` · `createItem` y `updateItem`: validar `categoryId` con `ItemCategoryService`. Tiene que existir, ser del tipo que decide la acción y estar vigente, salvo que sea la que el ítem ya tenía (design D4).
- [x] 3.8 `actions/catalog.test.ts` (ampliar):
  - Como ayudante, un insumo se crea con una categoría de insumo vigente («El ayudante elige una categoría», nivel de acción).
  - Asignar una categoría archivada a un insumo que no la tenía devuelve un error y no escribe («El servidor no asigna una categoría archivada de nuevo»).
  - Editar un insumo que ya tiene su categoría archivada, sin cambiarla, guarda («Un ítem conserva su categoría archivada», nivel de acción).
  - Una categoría de otro tipo se rechaza antes de llegar a la base.

## 4. Sección «Categorías de ítem» en Configuración

- [x] 4.1 `features/settings/config-list.tsx`: `ConfigEntity` y `ENTITY_COPY` suman `itemCategory`. `ConfigTables` acepta un `copy` opcional que tiene prioridad sobre `ENTITY_COPY`, para los textos que dependen del tipo (design D5). Las demás secciones no cambian.
- [x] 4.2 `lib/catalog/labels.ts` (o junto a la sección): textos por tipo de las categorías.
  - Vacío: «Aún no hay categorías de insumo».
  - Títulos del diálogo: «Nueva categoría de insumo» y «Editar categoría de insumo».
  - Texto del efecto de archivar.
  - Lo mismo para producto y activo.
- [x] 4.3 `features/settings/item-categories-section.tsx`: `ToggleGroup` Insumos / Productos / Activos que navega con `?kind=`, botón «Nueva categoría», `ConfigTables` con la entidad `itemCategory` y `NamedItemDialog` con el título por tipo. Crear llama a `createItemCategory` con el tipo de la pestaña.
- [x] 4.4 `app/(app)/settings/item-categories/page.tsx`:
  - Resuelve el contexto de dueña él mismo y redirige a cualquier otra persona.
  - Lee `?kind=` con `itemKindSchema` (por defecto `supply`).
  - Carga `listByKind(..., { includeArchived: true })`.
  - Añadir también su `loading.tsx` y su `error.tsx`, como las demás secciones (KAM-23).
- [x] 4.5 `features/settings/settings-nav.tsx`: «Categorías» pasa a «Categorías de gasto». Se añade «Categorías de ítem» (`/settings/item-categories`, grupo *Organización*, `ownerOnly: true`, icono distinto) justo después. `app/(app)/settings/categories/page.tsx` ya se titula «Categorías de gasto».
- [x] 4.6 `features/settings/item-categories-section.test.tsx`, con `actions/configuration` simuladas:
  - La fila «Sustratos» ofrece «Editar» y «Archivar» en su «⋯» y ningún otro botón («An item category row offers its actions from the menu»).
  - Sin categorías en Activos, se ve «Aún no hay categorías de activo» y ninguna tabla vacía («A kind without categories shows its empty state»).
  - «Nueva categoría» en Productos abre «Nueva categoría de producto», solo con *Nombre*; enviar llama a `createItemCategory` con `kind: "product"` y cierra («Owner creates an item category in the selected tab», «A category is created in the selected tab», nivel unitario).
  - Con `{ error }` de duplicado, el diálogo sigue abierto con el nombre escrito («Duplicate name in the same kind ignores case and spaces», nivel de interfaz).
  - «Restaurar» en un archivado pide confirmación y llama a `unarchiveConfigurationItem` con `entity: "itemCategory"` («Restoring an item category», nivel unitario).
  - La pestaña elegida navega con `?kind=`.
- [x] 4.7 Actualizar `features/settings/settings-nav.test.tsx`:
  - Aparecen «Categorías de gasto» y «Categorías de ítem» y ninguna entrada dice solo «Categorías» («The two kinds of categories are named apart»).
  - En `/settings/item-categories`, esa entrada lleva `aria-current="page"` («Item categories is marked when open»).

## 5. Catálogo: formulario, filtro y detalle

- [x] 5.1 `features/catalog/item-form-dialog.tsx`:
  - Sustituye el `Input` de *Categoría* por un `Select` controlado. Ofrece «Sin categoría», las vigentes del tipo y la actual archivada rotulada «(archivada)».
  - Recibe `categories`, `currentCategory` y `canManageCategories`.
  - Sin categorías vigentes, el campo lo explica, con enlace a `/settings/item-categories?kind=<tipo>` solo si `canManageCategories`.
  - Envía `categoryId` (design D6).
- [x] 5.2 Ampliar `features/catalog/item-form-dialog.test.tsx`:
  - Con categorías de insumo y de producto, un insumo solo ofrece «Sin categoría» y las de insumo, por nombre («El selector ofrece solo las categorías del tipo»).
  - Guardar con «Sin categoría» envía `categoryId: null` («Un ítem sin categoría es válido», nivel de formulario).
  - Una archivada que no es la actual no se ofrece («Una categoría archivada no se ofrece»).
  - Editar un ítem cuya categoría está archivada la muestra rotulada «(archivada)», y guardar sin tocarla la envía igual («Un ítem conserva su categoría archivada», nivel de formulario).
  - Sin categorías del tipo, la dueña ve el enlace a Configuración («Un tipo sin categorías lo dice») y el ayudante ve el texto sin enlace («El ayudante no recibe el enlace a Configuración»).
- [x] 5.3 `app/(app)/catalog/page.tsx`:
  - Carga `ItemCategoryService.listByKind(org, kind, { includeArchived: true })`.
  - Lee `?category=` (`none`, o un id del tipo; otro valor cuenta como todas) y lo pasa a `ItemService.list()` y a `joinsCatalogWindow`.
  - Entrega a la pantalla las categorías vigentes y el mapa completo.
- [x] 5.4 `lib/catalog/window.ts`: `CatalogScope` suma `categoryFilter`, y `joinsCatalogWindow` lo respeta. Ampliar `lib/catalog/window.test.ts`: un ítem recién creado con otra categoría no entra en la ventana filtrada, y uno sin categoría entra con `none`.
- [x] 5.5 `features/catalog/catalog-screen.tsx`:
  - Añade el `Select` «Categoría» junto a *Línea*, con «Todas las categorías», «Sin categoría» y las vigentes.
  - `CATALOG_FILTERS` suma `"category"`.
  - Al cambiar de pestaña navega con `category: null`.
  - Pasa las categorías y la actual a los dos `ItemFormDialog`.
- [x] 5.6 Ampliar `features/catalog/catalog-screen.test.tsx`:
  - Elegir «Sustratos» navega con `category=<id>` («Filtrar por categoría», nivel de pantalla).
  - Elegir «Sin categoría» navega con `category=none` («Filtrar los ítems sin categoría», nivel de pantalla).
  - En la pestaña de productos, el filtro ofrece solo las categorías que recibe («El filtro ofrece las categorías de la pestaña»).
  - Cambiar de pestaña navega sin `category` («Cambiar de pestaña descarta la categoría»).
  - Con la categoría en la dirección y sin filas, «Quitar filtros» limpia `category`, `q` y `line` («Quitar filtros incluye la categoría»).
- [x] 5.7 `app/(app)/catalog/[id]/page.tsx` y `features/catalog/item-detail.tsx`:
  - La página carga las categorías del tipo del ítem.
  - *Datos generales* muestra el nombre de la categoría o «Sin categoría», con `Badge` «Archivada» si lo está.
  - El diálogo de edición recibe las categorías y la actual.
- [x] 5.8 Ampliar `features/catalog/item-detail.test.tsx`:
  - Un ítem sin categoría muestra «Sin categoría» («Un ítem sin categoría es válido», nivel de detalle).
  - Uno con categoría archivada muestra su nombre con «Archivada» («El detalle muestra la categoría archivada»).

## 6. Bitácora y exportación

- [x] 6.1 `lib/activity/fields.ts`:
  - `item_categories` con `name` y `kind` («Tipo»).
  - `items.category_id` como referencia a `item_categories`.
  - `items.category` se conserva en texto para leer los eventos antiguos.
- [x] 6.2 `services/activity/label-service.ts` (`item_categories: "name"`), `lib/activity/describe.ts` («la categoría de ítem»), `app/(app)/activity/page.tsx` (tipo de registro «Categoría de ítem») y `lib/activity/unarchive.ts` (`item_categories`), con sus pruebas unitarias ampliadas donde ya las haya.
- [x] 6.3 `lib/export/tables.ts`: tabla `item_categories` (archivo `categorias-item`, `ownerOnly: false`, sus columnas) y `items.category` pasa a `category_id`. Correr `tests/integration/export-manifest.test.ts` y `tests/integration/activity-fields-coverage.test.ts`.

## 7. Pruebas e2e

- [x] 7.1 `tests/e2e/item-categories.spec.ts` (nuevo, sobre `geeko()`):
  - La dueña abre «Categorías de ítem», crea «Tintas» en Insumos y comprueba que no aparece en Productos («A category is created in the selected tab», e2e).
  - Crea «Embalaje» en Activos, aunque ya existe en Insumos y Productos («The same name in two kinds», e2e).
  - Crea un insumo con «Tintas» desde el catálogo.
  - Filtra el catálogo por «Tintas» y ve solo ese insumo («Filtrar por categoría», e2e).
  - Archiva «Tintas»: el detalle del insumo sigue mostrándola con «Archivada», y el formulario de un insumo nuevo ya no la ofrece («Archiving a category keeps it on its items»).
- [x] 7.2 Mismo archivo, bloque del ayudante:
  - Crea un insumo eligiendo «Sustratos» («El ayudante elige una categoría», e2e).
  - No ve «Categorías de ítem» en ningún menú.
- [x] 7.3 `tests/e2e/assistant-permissions.spec.ts`: sumar `/settings/item-categories` a `OWNER_ONLY` («The Item categories section guards itself»).
- [x] 7.4 `tests/e2e/settings.spec.ts`: la lista de secciones usa «Categorías de gasto» y suma «Categorías de ítem». Buscar en `tests/e2e/` cualquier otro uso de «Categorías» como nombre de sección, o de un campo de texto *Categoría* en el formulario de ítem, y ajustarlo.
- [x] 7.5 Correr `npm run lint`, `npm run typecheck`, `npm run test:unit`, los archivos e2e tocados y, al final, la suite e2e completa. Si hay fallos, repetirlos aislados con `--last-failed --workers=2` antes de darlos por regresión (base compartida).
  - *Hecho:*
    - Lint y tipos limpios. Unitarias: 256 archivos, 2.416 pruebas. Integración: 16 archivos, 99 pruebas. pgTAP: 70 archivos, 1.037 aserciones.
    - E2E tocadas (`item-categories`, `settings`, `assistant-permissions`): en verde. La única falla de esa corrida, «Target page… has been closed», pasó al repetirla.
    - Suite e2e completa: 332 pasaron y 28 fallaron, con fallos repartidos por inventario, pedidos, plataforma, permisos y también las dos de `item-categories` en móvil.
    - Repetidas con `--last-failed --workers=2` pasaron 27 de 28. La restante, `inventory.spec.ts:256` en móvil, pasó 3 de 3 sola (`--repeat-each=3`).
    - Todo apunta a carga sobre la base compartida, con otro `next dev` activo en el puerto 3009, no a una regresión.

## 8. Documentación

- [x] 8.1 `docs/manual-de-uso.md`:
  - Sección nueva «Categorías de ítem» en Configuración (pestañas por tipo, crear, editar, archivar, restaurar; solo la dueña).
  - En el alta de ítem, «Categoría» se elige de la lista del tipo.
  - En el catálogo, el filtro «Categoría».
  - «Categorías» pasa a «Categorías de gasto».
- [x] 8.2 `docs/manual-de-pruebas.md`: casos CAT para el selector de categoría (incluida una categoría archivada) y el filtro, y un caso de configuración para «Categorías de ítem» (mismo nombre en dos tipos, duplicado sin mayúsculas, ayudante sin acceso).
- [x] 8.3 `graphify update .` al terminar.
