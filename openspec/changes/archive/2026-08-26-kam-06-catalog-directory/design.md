# KAM-06 · Diseño

## Context

Motivación en `proposal.md` — *Why*. Requisitos en `specs/catalog-directory/spec.md`.

Lo que ya existe y condiciona el diseño: `organizations`, `memberships` con `is_member()`/`is_owner()`, `business_lines` y `units` (KAM-04), el trigger genérico `log_activity()` con el patrón `create trigger audit after insert or update` (KAM-03), y el selector global de línea con su store (`business-line-context`). El patrón de RLS de KAM-04 es *miembro lee / dueño escribe*; el catálogo es la primera excepción documentada: la matriz de acceso del esquema canónico da al ayudante **leer, crear y editar** sobre `contacts`, `items` e `item_variants`, y reserva solo el archivado al dueño.

Tres restricciones marcan el resto: la clave primaria debe poder generarse en el cliente (convención nº 9, requisito del modo sin conexión de KAM-11), nada derivado puede almacenarse (nº 4), y el DDL de las tres tablas ya está fijado en el esquema canónico §7 — este diseño lo implementa, no lo redefine.

## Goals / Non-Goals

**Goals:**
- Traducir el DDL canónico §7 a una migración con RLS, auditoría y semilla, sin inventar columnas.
- Resolver de forma verificable en la base de datos el permiso partido "cualquiera edita, solo el dueño archiva".
- Dar una búsqueda por nombre tolerante a acentos que dé el **mismo** resultado en la base de datos y en el filtrado del cliente.
- Dejar el buscador de contactos con creación al vuelo como componente reutilizable, porque KAM-08 y KAM-09 lo consumirán tal cual.

**Non-Goals:**
- Vistas derivadas (`item_last_cost`, `item_stock`): son de KAM-18, aunque su ausencia se prueba aquí.
- `asset_details` y la barra de recuperación: KAM-19.
- Adjuntos de ítem y de contacto: llegan con el módulo de adjuntos.
- Paginación en servidor: los volúmenes previstos son de cientos de filas (§ Volúmenes de la especificación de producto); se resuelve con búsqueda y filtros, no con paginación.

## Decisions

### 1. El permiso partido se implementa con trigger, no con política

Una política `UPDATE` de RLS evalúa la fila anterior en `USING` y la nueva en `WITH CHECK`, pero no puede comparar ambas: no hay forma de escribir "acepta este UPDATE salvo que cambie `archived_at`". Se implementa entonces con un trigger `before update` compartido por las tres tablas:

```
if new.archived_at is distinct from old.archived_at and not is_owner(new.organization_id)
then raise exception ... using errcode = '42501'
```

Las políticas quedan simples: `select`/`insert`/`update` para `is_member(organization_id)`, sin política `DELETE`. El trigger recorta el caso concreto.

*Alternativas descartadas:* (a) revocar `UPDATE` sobre la columna con `grant update (col1, col2, ...)` — obliga a enumerar columnas y se rompe en silencio al añadir una; (b) confiar solo en la Server Action — la convención exige que el permiso sea verificable en la base y las pruebas pgTAP del proyecto lo comprueban directamente contra Postgres, sin pasar por la aplicación.

El mismo trigger cubre archivar y desarchivar, porque la condición es "cambió `archived_at`" en cualquier dirección.

### 2. La edición de archivados se bloquea en el mismo trigger

"Un registro archivado no se edita sin desarchivarlo" (regla § 6.5 del producto) también es una comparación de fila vieja contra nueva. Se añade al mismo trigger: si `old.archived_at is not null` y el UPDATE cambia algo que no sea `archived_at`, se rechaza. Así la interfaz puede limitarse a poner los campos en solo lectura, sin ser la única defensa.

### 3. Acentos: `unaccent` en la base, la misma normalización en el cliente

Se habilita `unaccent` en el esquema `extensions` (mismo patrón que `pgtap`). Como `unaccent()` no es inmutable, no puede indexarse directamente; se declara un envoltorio inmutable y sobre él los índices:

- `items` y `contacts` llevan una columna generada `search_name` (`generated always as (immutable_unaccent(lower(name))) stored`) e índice GIN de trigramas sobre ella. Trigramas y no `to_tsvector` porque la búsqueda del catálogo es por subcadena mientras se teclea ("subli" debe encontrar "sublimación"), y el índice de texto completo del DDL canónico solo acierta palabras completas. Requiere `pg_trgm`, que se habilita junto con `unaccent`.
- La columna generada existe porque PostgREST no sabe filtrar por una expresión indexada: sin ella, el servicio tendría que pasar por una función RPC propia y perdería la composición con los demás filtros (tipo, línea, archivados) y el orden. No es un dato derivado del negocio en el sentido de la convención nº 4 —es la misma cadena preparada para comparar—, y al generarse en la base el cliente no puede desincronizarla.
- El índice GIN de `to_tsvector('simple', name)` sobre `contacts` que declara el esquema canónico se mantiene tal cual, y se le añade el de trigramas normalizados por la razón de arriba.

La consulta de servicio filtra con `like` sobre `search_name`, y la normalización del término la hace `lib/search/normalize.ts` (`String.prototype.normalize("NFD")` + eliminación de diacríticos + minúsculas). Esa función es también la que filtra en el cliente, de modo que ambos lados coinciden por construcción; es lo que verifica la prueba unitaria de "normalización de búsqueda" que pide el backlog.

*Alternativa descartada:* normalizar solo en el cliente, guardando el nombre tal cual y filtrando en memoria. Funciona con cientos de filas, pero deja la base sin búsqueda utilizable para los buscadores de KAM-08/09 y para el modo feria.

*Nota:* el DDL canónico no habla de acentos y el criterio nº 6 del backlog los exige; añadir índices sin cambiar columnas respeta ambos.

### 4. Un solo servicio por tabla, sin lógica de negocio en las acciones

`services/catalog/item-service.ts`, `item-variant-service.ts` y `contact-service.ts`, clases con `SupabaseClient` inyectado como el resto del proyecto. Toda consulta filtra por `organization_id` explícitamente aunque RLS ya lo haga (convención nº 2). Las Server Actions de `actions/catalog.ts` y `actions/contacts.ts` verifican sesión, organización y rol, validan con el Zod de `lib/catalog/schema.ts` —el mismo que usa el formulario— y hacen `revalidatePath`.

La regla `has_a_role` vive por triplicado a propósito: restricción en la base, refinamiento Zod compartido, y aviso en el formulario. Es la prueba unitaria de "validación de roles de contacto" del backlog.

### 5. El buscador de contactos es un componente, no una pantalla

`features/contacts/contact-combobox.tsx` recibe el rol que le interesa (`supplier`, `customer` o ambos), busca contra el servicio y, cuando lo tecleado no coincide con nada, ofrece "Crear «X»" con un mini-formulario de nombre y rol. Devuelve el `id` ya seleccionado. Se estrena en V13 —donde crear al vuelo es redundante pero permite probarlo de extremo a extremo— y queda listo para los formularios de pedido y de compra. El `id` se genera en el cliente (`crypto.randomUUID()`), como pide la convención nº 9, de modo que el componente ya funcione cuando llegue el modo sin conexión.

### 6. Las tres pantallas son páginas delgadas sobre un `DataTable` común

V10 y V13 comparten el patrón de listado (búsqueda, filtros, "Ver archivados") ya previsto en `components/DataTable/` por ARCHITECTURE.md; V13 lo envuelve en dos paneles con el detalle a la derecha, resuelto con estado de interfaz y no con ruta anidada, para que el panel no recargue la lista. V11 sí es ruta propia (`/catalog/[id]`), porque el mapa de navegación exige que el detalle de ítem sea enlazable desde reportes, avisos y líneas de pedido.

El historial de V11 lee `activity_log` filtrando por `entity = 'items'` y el `id` del ítem — la convención nº 7 prohíbe cualquier otra fuente de historial. La bitácora solo es legible por el dueño, así que para el ayudante la sección de historial simplemente no se renderiza.

### 7. La semilla vive en `supabase/seed.sql`

Igual que en KAM-04 y KAM-05, la semilla de Geeko Store va en `supabase/seed.sql` con identificadores fijos, no en la migración: `supabase db reset` la aplica después de las migraciones, así que CI y desarrollo producen el mismo estado y las pruebas pgTAP pueden apoyarse en ella (como ya hace `seed_geeko.test.sql`). Contenido mínimo: insumos con tilde ("Taza para sublimación", que es el caso del criterio nº 6), un producto con variantes ('11oz', '15oz'), un activo, al menos un ítem compartido (`business_line_id is null`), y tres contactos que cubran proveedor, cliente y ambos.

## Risks / Trade-offs

- **El trigger de archivado se olvida en la próxima tabla archivable** → se escribe como función genérica reutilizable (`enforce_archive_rules()`), se aplica a las tres tablas en esta migración y la prueba pgTAP la ejerce por tabla, no una sola vez.
- **`pg_trgm` y `unaccent` añaden dos extensiones al proyecto** → ambas vienen con Postgres y están disponibles en Supabase; el coste real es un índice GIN por tabla, aceptable con volúmenes de cientos de filas y a cambio de la única búsqueda que el usuario considera correcta.
- **La tentación de añadir "último costo" al catálogo volverá en KAM-18** → la prueba pgTAP que enumera las columnas de `items` falla si alguien lo hace; es una prueba deliberadamente rígida.
- **`kind = 'asset'` sin `asset_details` deja activos a medias hasta KAM-19** → la pestaña de activos de V10 los lista con sus datos generales; costo de adquisición y recuperación aparecen allí. Se acepta el hueco porque el backlog lo declara fuera de alcance.
- **Buscar con `like '%…%'` sobre trigramas es rápido pero no ordena por relevancia** → con cientos de ítems el orden alfabético basta; si la escala cambia, el índice de trigramas ya soporta `similarity()` sin migrar datos.
- **El detalle de contacto en panel no es enlazable** → el mapa de navegación (V13) lo describe así deliberadamente; los enlaces entrantes desde pedidos apuntan a `/contacts?id=…`, que la pantalla resuelve preseleccionando.

## Migration Plan

Una sola migración nueva `YYYYMMDDHHMMSS_catalog.sql`, en este orden: extensiones (`unaccent`, `pg_trgm`) → `immutable_unaccent()` → `contacts`, `items`, `item_variants` → índices (los canónicos más los de trigramas) → `enforce_archive_rules()` y sus tres triggers → triggers `audit` → RLS y políticas (sin `DELETE`). La semilla de Geeko Store se añade aparte, en `supabase/seed.sql`. No se edita ninguna migración existente (convención nº 6). Tras aplicarla, `supabase db reset`, `supabase test db` y `graphify .`.

Sin plan de reversión: no hay datos en producción y el proyecto no ha desplegado. Si la migración resultara equivocada, se corrige con una migración nueva, nunca editando esta.
