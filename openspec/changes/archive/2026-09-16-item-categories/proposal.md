# Categorías de ítem definidas por la organización

## Why

La categoría de un ítem es hoy texto libre (`items.category`, esquema canónico §7). Cada quien la escribe como le sale: «Sustratos», «sustrato» y «Sustrato » quedan como tres categorías distintas. Tampoco hay forma de definir la lista una vez ni de filtrar el catálogo por ella. La persona usuaria quiere definir las categorías en un solo lugar, ligadas a su organización, y elegirlas de una lista al registrar un ítem. En Configuración ya existe «Categorías», pero es de **gasto** (`expense_categories`) y no tiene nada que ver con el catálogo; el nombre lleva a confusión.

## What Changes

- **Una lista nueva de categorías de ítem por organización y por tipo.** Cada categoría pertenece a Insumos, Productos o Activos. «Embalaje» puede existir como categoría de insumo y como categoría de producto. El nombre no se repite dentro del mismo tipo de la misma organización, sin distinguir mayúsculas ni espacios al borde.
- **Una sección nueva, «Categorías de ítem», en Configuración** (grupo *Organización*, solo la dueña), con el mismo patrón que las demás secciones: tabla con menú «⋯», alta y edición en un diálogo, archivado confirmado y tabla «Archivados». Las pestañas Insumos / Productos / Activos eligen el tipo, como en el catálogo. La categoría se crea en la pestaña activa y su tipo no cambia después. La entrada actual «Categorías» pasa a llamarse **«Categorías de gasto»**.
- **El formulario de ítem cambia el texto libre por un selector.** Ofrece «Sin categoría» y las categorías vigentes del tipo del ítem. Una categoría archivada que el ítem ya tenía se sigue mostrando como su valor actual y se conserva al guardar, pero no se ofrece para asignarla de nuevo. Si el tipo aún no tiene categorías, el campo lo dice y señala dónde se definen.
- **El catálogo (V10) gana un filtro «Categoría»** junto a *Línea*. Ofrece «Todas las categorías», «Sin categoría» y las categorías vigentes de la pestaña. El filtro viaja en la dirección (`?category=`), cuenta como filtro para el vacío con «Quitar filtros» y se descarta al cambiar de pestaña.
- **La base garantiza la coherencia.** Un ítem solo puede apuntar a una categoría de su misma organización y de su mismo tipo. Si la petición no viene de la interfaz, la base la rechaza igual.
- **BREAKING (esquema): `items.category` (texto) se sustituye por `items.category_id`**, que referencia `item_categories`. La migración crea las categorías a partir de los textos que ya existen, por organización y tipo, fusionando las variantes de mayúsculas y espacios, y enlaza cada ítem con la suya antes de quitar la columna. No se pierde ningún valor.
- **Solo la dueña gestiona las categorías**, igual que el resto de Configuración. El ayudante las lee y las elige en el formulario, pero no las crea ni las archiva.

## Capabilities

### New Capabilities

_Ninguna._ Las categorías de ítem son configuración de la organización y el catálogo las usa. Encajan en capacidades que ya existen.

### Modified Capabilities

- `org-configuration`:
  - Las tablas de configuración pasan de cuatro a cinco, con `item_categories`, y la matriz de lectura y escritura las cubre.
  - La pantalla de configuración suma la sección «Categorías de ítem» y renombra «Categorías» a «Categorías de gasto».
  - Requisito nuevo: las categorías de ítem se definen por tipo.
- `settings-interaction`: la sección «Categorías de ítem» entra en el patrón de tabla con menú, tabla de archivados, diálogo de alta y edición, y menú lateral. «Categories» pasa a «Expense categories» en esas tablas de requisitos.
- `catalog-directory`:
  - `items` pasa a llevar `category_id`, requisito de la forma canónica.
  - Requisito nuevo: el ítem se clasifica con una categoría de su tipo.
  - V10 suma el filtro por categoría.
  - La semilla de Geeko Store define categorías por tipo y enlaza sus ítems.

## Impact

- **Base de datos**: una migración nueva con la tabla `item_categories` (RLS de configuración, trigger de auditoría, índices) y `items.category_id` con clave foránea compuesta `(category_id, organization_id, kind)`. Hace la conversión de los textos existentes y quita `items.category`. Lleva su pgTAP. Hay que actualizar `supabase/seed.sql` (`e2e.seed_geeko`, que también alimenta las copias de las pruebas e2e) y `supabase/tests/seed_geeko.test.sql`.
- **Servicios y acciones**:
  - Servicio nuevo `services/configuration/item-category-service.ts`, sobre `ConfigTableService`.
  - `services/catalog/item-service.ts` (`category_id`, filtro por categoría).
  - `actions/configuration.ts`: alta, edición, archivado y desarchivado de categorías de ítem.
  - `actions/catalog.ts`: valida que la categoría sea vigente y del tipo del ítem.
- **UI**:
  - Página nueva `app/(app)/settings/item-categories/page.tsx` y su sección en `features/settings/`, más la entrada en `settings-nav.tsx`.
  - `features/catalog/item-form-dialog.tsx` (selector), `catalog-screen.tsx` (filtro) e `item-detail.tsx` (nombre de la categoría, con marca de archivada).
  - Las páginas `app/(app)/catalog/page.tsx` y `catalog/[id]/page.tsx` cargan las categorías.
- **Transversales**:
  - `lib/export/tables.ts`: tabla nueva y la columna nueva de `items`. La prueba de manifiesto de KAM-23 falla si faltan.
  - Bitácora: etiquetas de campos y de tablas, resolución del nombre de la categoría, y desarchivar desde la bitácora (`lib/activity/fields.ts`, `describe.ts`, `unarchive.ts`, `services/activity/label-service.ts`, `app/(app)/activity/page.tsx`).
  - `lib/catalog/window.ts`, para que el ítem recién creado respete el filtro.
  - `types/index.ts`.
- **Documentos de producto**: `specs/PRD/kamay-esquema-base-de-datos-supabase.md` §7 (tabla nueva y columna) y `kamay-especificacion-producto-v6.md` (V15 suma categorías de ítem). La categoría del ítem ya figura en la especificación («ítems con tipo, unidad, categoría…»); lo nuevo es que sea una lista definida, no un concepto nuevo.
- **Pruebas**: pgTAP de la migración (forma, RLS, clave compuesta, unicidad sin mayúsculas, conversión de textos). Unitarias de servicio, acciones, sección de configuración, formulario, filtro y detalle. E2E: la dueña define una categoría y la asigna; el ayudante no ve la sección; el filtro del catálogo.
- **Fuera de alcance**:
  - Una columna «Categoría» en el listado del catálogo.
  - Categorías jerárquicas (subcategorías) y categorías por línea de negocio.
  - Informes o totales por categoría.
  - Que el ayudante cree categorías al vuelo desde el formulario.
  - Categorías de ítem por defecto al crear una organización nueva.
  - Reordenar las categorías (se listan por nombre).
  - Tocar la función de entregables de tarea, que crea ítems sin categoría.
