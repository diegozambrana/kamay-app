# KAM-06 · Catálogo y directorio

## Why

Kamay todavía no sabe **qué compra, qué vende ni con quién trata**: hay organización, líneas y estados, pero ninguna operación puede registrarse porque no existe a qué ni a quién apuntar. Los pedidos (KAM-07/08) y los egresos (KAM-09) referencian `items`, `item_variants` y `contacts` desde su primera línea; sin esas tres tablas no hay ciclo del dinero que empezar. Este cambio instala la base de datos del negocio y sus tres pantallas antes de la primera operación, y lo hace con la disciplina que hizo inmantenible a la versión anterior cuando se rompió: **ninguna columna derivada** en `items` —ni saldo, ni último costo, ni margen— aunque el catálogo sea el lugar donde más tienta guardarlos.

## What Changes

- Nuevas tablas según el esquema canónico (§7 Directorio y catálogo):
  - `contacts` — proveedor, cliente o ambos, con la restricción `has_a_role` (`is_supplier or is_customer`) en la base de datos, no solo en el formulario.
  - `items` — insumos, productos y activos en una sola tabla distinguidos por `kind` (`supply | product | asset`), con `unit_id`, `category`, `sale_price` referencial, `min_stock` y `business_line_id` (`null` = compartido entre líneas).
  - `item_variants` — variantes de un ítem ('11oz', 'Negro', 'XL') con `attributes` jsonb, `sale_price` propio opcional y unicidad `(item_id, name)`.
- **`items` no lleva `last_cost` ni `current_stock`.** La convención nº 4 se verifica aquí con una prueba pgTAP explícita que falla si alguien añade una columna derivada.
- Búsqueda por nombre tolerante a acentos: extensión `unaccent`, envoltorio inmutable e índices GIN sobre el nombre normalizado, más una función `lib/` de normalización compartida por el cliente.
- Archivado con `archived_at` en las tres tablas, filtro *Ver archivados* en ambos listados, desarchivado que devuelve el registro intacto, y la regla de que **un registro archivado no se puede editar sin desarchivarlo primero**.
- Permisos según la matriz de acceso del esquema: el ayudante **lee, crea y edita** ítems, variantes y contactos, pero **no archiva ni desarchiva**; eso lo reserva un trigger para el dueño, porque RLS filtra filas y no distingue "cambió `archived_at`" en una política `UPDATE`.
- Pantallas nuevas:
  - **V10 · Catálogo** — página con pestañas por tipo (insumos · productos · activos), filtro por línea, etiqueta de línea o "compartido", precio de venta, búsqueda y *Ver archivados*. Las columnas de saldo y último costo **no se muestran** en esta tarea.
  - **V11 · Detalle de ítem** — datos generales, variantes e historial de cambios leído de `activity_log`. Sin secciones de inventario, costos ni tareas.
  - **V13 · Contactos** — directorio en dos paneles: lista buscable a la izquierda, detalle a la derecha, con rol, datos de contacto y notas.
- **Creación al vuelo de contactos**: un componente buscador reutilizable que, cuando el nombre tecleado no existe, ofrece crearlo sin salir del formulario. Se estrena en V13 y queda disponible para KAM-08 y KAM-09.
- Entradas de navegación base *Catálogo* y *Contactos*, visibles para ambos roles.
- Semilla de Geeko Store: unidades ya existentes reutilizadas, más un conjunto mínimo de ítems y contactos reales para que las pantallas se puedan probar de extremo a extremo.

**Fuera de alcance** (copiado literal del backlog):
- Saldos de inventario y último costo (KAM-18); en esta tarea el detalle de ítem no muestra esas secciones.
- Activos y su recuperación (KAM-19) — se acepta `kind = 'asset'` en `items`, pero la tabla `asset_details` y la barra de recuperación llegan allí.
- Tareas relacionadas (KAM-15).
- Códigos de barras, ubicaciones de almacén, lotes.

## Capabilities

### New Capabilities

- `catalog-directory`: la base de datos del negocio — `contacts` con rol obligatorio, `items` por `kind` con línea o compartido, `item_variants`; búsqueda tolerante a acentos; archivado y desarchivado que preservan la historia; el ayudante crea y edita pero no archiva; pantallas V10, V11 y V13; creación de contactos al vuelo; y la prohibición verificada de almacenar saldo, último costo o margen en el catálogo.

### Modified Capabilities

_(ninguna — `activity-log` ya obliga a auditar toda tabla nueva, `tenant-isolation` ya exige RLS sin política `DELETE`, y `business-line-context` ya define cómo la línea activa preselecciona los formularios; las tres tablas nuevas se limitan a cumplir requisitos que ya existen)_

## Impact

- **Base de datos:** una migración nueva `YYYYMMDDHHMMSS_catalog.sql` (extensión `unaccent`, las tres tablas, índices —incluidos los GIN de búsqueda—, trigger `audit`, trigger de archivado solo para el dueño, RLS sin `DELETE`, semilla). No se edita ninguna migración existente.
- **Código de aplicación:** `services/catalog/` (`ItemService`, `ItemVariantService`, `ContactService`), Server Actions en `actions/`, `lib/search/` con la normalización, `features/catalog/` y `features/contacts/`, rutas delgadas en `app/(app)/catalog`, `app/(app)/catalog/[id]` y `app/(app)/contacts`, y el buscador reutilizable de contactos en `components/`.
- **Pruebas:** unitarias (normalización de búsqueda, validación de roles de contacto, servicios); pgTAP `catalog_rls.test.sql` (RLS, ausencia de `DELETE`, archivado solo del dueño, `has_a_role`, ausencia de columnas derivadas); e2e `archive-restore.spec.ts`.
- **Grafo:** regenerar `graphify .` tras la migración (convención nº 6).
- **Dependencias:** requiere KAM-04 (líneas de negocio y `units`) fusionada, ya que `items` referencia ambas. No depende de KAM-05.
