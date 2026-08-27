# KAM-06 · Tareas

> Prerrequisito: KAM-04 fusionada — `items` referencia `business_lines` y `units`.
> Toda prueba crea su propia organización. Cada escenario del delta spec tiene al menos una prueba aquí.

## 1. Base de datos

- [x] 1.1 Migración `YYYYMMDDHHMMSS_catalog.sql`: extensiones `unaccent` y `pg_trgm` en el esquema `extensions`, y función `immutable_unaccent(text)` marcada `immutable`
- [x] 1.2 Tabla `contacts` con el DDL canónico §7, incluida la restricción `has_a_role` (`is_supplier or is_customer`)
- [x] 1.3 Tabla `items` con el DDL canónico §7 (`kind` con check `supply|product|asset`, `business_line_id` anulable = compartido, `unit_id`, `category`, `sale_price`, `min_stock`) — **sin ninguna columna derivada**
- [x] 1.4 Tabla `item_variants` con `attributes` jsonb, `sale_price` propio y `unique (item_id, name)`
- [x] 1.5 Índices: los canónicos (parciales por `organization_id` con `archived_at is null`, GIN `to_tsvector` en `contacts`) más los GIN de trigramas sobre `immutable_unaccent(lower(name))` en `items` y `contacts`
- [x] 1.6 Función genérica `enforce_archive_rules()` y trigger `before update` en las tres tablas: cambiar `archived_at` exige `is_owner()`; editar cualquier otra columna de una fila archivada se rechaza; ambos con `errcode` y mensaje comprensibles
- [x] 1.7 Trigger `audit` (`log_activity()`) en las tres tablas, en la misma migración
- [x] 1.8 RLS activo en las tres tablas: `select`, `insert` y `update` para `is_member(organization_id)`; **sin política `DELETE`**
- [x] 1.9 Semilla de Geeko Store en `supabase/seed.sql` con identificadores fijos: insumos (uno con tilde, "Taza para sublimación"), un producto con variantes '11oz' y '15oz', un activo, al menos un ítem compartido, y contactos proveedor / cliente / ambos
- [x] 1.10 `supabase db reset` sin error y regenerar el grafo (`graphify .`)

## 2. Pruebas pgTAP (`supabase/tests/catalog.test.sql`)

- [x] 2.1 Forma de las tablas: `kind` fuera del juego rechazado; variante duplicada en el mismo ítem rechazada; misma variante en ítems distintos aceptada
- [x] 2.2 Roles de contacto: contacto sin ningún rol rechazado; proveedor+cliente aceptado; quitar el último rol a un contacto existente rechazado
- [x] 2.3 Nada derivado: consulta a `information_schema.columns` que falla si `items` o `item_variants` ganan una columna de saldo, último costo, costo promedio o margen
- [x] 2.4 Archivado por rol, en las tres tablas: el ayudante no puede fijar ni limpiar `archived_at`; el dueño sí; ambos casos con mensaje comprensible
- [x] 2.5 Edición de archivados: actualizar cualquier columna de una fila archivada se rechaza; limpiar `archived_at` (desarchivar, como dueño) se acepta
- [x] 2.6 Escritura del ayudante: crea y edita ítems, variantes y contactos sin error
- [x] 2.7 Aislamiento y ausencia de borrado: cero filas de otra organización en las tres tablas; `DELETE` (incluido como dueño) afecta cero filas
- [x] 2.8 Auditoría: crear un contacto y cambiarle el teléfono deja evento de creación y de edición con los campos cambiados
- [x] 2.9 Búsqueda en la base: "sublimacion" encuentra "Taza para sublimación"; "sublimación" encuentra "Taza para sublimacion"; "TAZA" encuentra el ítem; un ítem archivado no aparece
- [x] 2.10 Referencia histórica: una fila que apunta a un ítem archivado conserva la referencia y puede leer su nombre
- [x] 2.11 Semilla: tras el reinicio existen ítems de los tres tipos, al menos uno compartido, al menos uno con variantes, y los tres casos de rol de contacto

## 3. Búsqueda, esquemas y servicios

- [x] 3.1 `lib/search/normalize.ts`: normalización NFD + eliminación de diacríticos + minúsculas, usada por el cliente y para construir la consulta del servidor
- [x] 3.2 Prueba unitaria de normalización: acento ausente en la consulta, acento ausente en el dato, mayúsculas, cadena vacía y espacios sobrantes
- [x] 3.3 `lib/catalog/schema.ts` con los Zod compartidos de ítem, variante y contacto, incluido el refinamiento "al menos un rol"
- [x] 3.4 Prueba unitaria de los esquemas: contacto sin rol inválido, proveedor+cliente válido, `kind` fuera del juego inválido, ítem sin línea válido (compartido)
- [x] 3.5 `services/catalog/item-service.ts`, `item-variant-service.ts` y `contact-service.ts`: clases con `SupabaseClient` inyectado, filtro explícito por `organization_id`, listados con y sin archivados, búsqueda por nombre normalizado, alta, edición, archivar y desarchivar
- [x] 3.6 Pruebas unitarias de los tres servicios con cliente simulado: el filtro de archivados se aplica por defecto, la búsqueda pasa el término normalizado, y toda consulta lleva `organization_id`

## 4. Server Actions

- [x] 4.1 `actions/catalog.ts`: crear, editar, archivar y desarchivar ítems y variantes, con verificación de sesión, organización y rol, Zod compartido y `revalidatePath`
- [x] 4.2 `actions/contacts.ts`: lo mismo para contactos, más la creación al vuelo (nombre + rol, `id` recibido del cliente)
- [x] 4.3 Traducción de los errores del trigger de archivado y de `has_a_role` a mensajes en español, con prueba unitaria del mapeo

## 5. Pantalla V10 · Catálogo (`features/catalog/` + `app/(app)/catalog/`)

- [x] 5.1 Ruta delgada accesible a ambos roles y entradas *Catálogo* y *Contactos* en la navegación de escritorio y móvil
- [x] 5.2 Listado con pestañas por tipo (insumos · productos · activos), filtro por línea, búsqueda y filtro "Ver archivados" con los archivados distinguidos visiblemente
- [x] 5.3 Fila con nombre, unidad, precio de venta y etiqueta de línea o "Compartido", que abre el detalle — **sin columnas de saldo ni de último costo**
- [x] 5.4 Alta y edición de ítem en formulario con `react-hook-form` + Zod, `id` generado en el cliente, línea activa preseleccionada
- [x] 5.5 Archivar y desarchivar visibles solo para el dueño; el ayudante no ve las acciones
- [x] 5.6 Pruebas unitarias de los componentes con lógica: la pestaña filtra por tipo, el filtro de archivados alterna el listado, y el ayudante no recibe las acciones de archivado

## 6. Pantalla V11 · Detalle de ítem (`app/(app)/catalog/[id]/`)

- [x] 6.1 Datos generales del ítem, con "Compartido" en lugar de línea vacía, y campos en solo lectura cuando está archivado (única acción: desarchivar)
- [x] 6.2 Lista de variantes con alta, edición y archivado
- [x] 6.3 Sección de historial leída de `activity_log` por entidad e `id`, no renderizada para el ayudante
- [x] 6.4 Verificar que no existen secciones de saldo, último costo, evolución de precios, proveedores habituales ni tareas relacionadas
- [x] 6.5 Pruebas unitarias: ítem sin línea se muestra como "Compartido", ítem archivado no ofrece edición, variante duplicada muestra el error del servidor

## 7. Pantalla V13 · Contactos y buscador reutilizable (`features/contacts/`)

- [x] 7.1 Página de dos paneles: lista buscable con filtro por rol y "Ver archivados" a la izquierda; detalle editable en el sitio a la derecha, sin recargar la lista al cambiar de contacto
- [x] 7.2 Preselección por `?id=…` para los enlaces entrantes
- [x] 7.3 `contact-combobox.tsx`: buscador reutilizable que ofrece "Crear «X»" cuando lo tecleado no existe, pide nombre y al menos un rol, genera el `id` en el cliente y deja el contacto seleccionado
- [x] 7.4 Pruebas unitarias: el filtro por rol incluye a los que son proveedor y cliente a la vez; el buscador ofrece crear cuando no hay coincidencia; el contacto creado queda seleccionado y el formulario en curso conserva sus valores

## 8. E2E y cierre

- [x] 8.1 `tests/e2e/archive-restore.spec.ts`: como dueño, crear ítem y contacto, archivarlos, comprobar que desaparecen de listados y buscadores, desarchivarlos desde "Ver archivados" y comprobar que vuelven intactos con sus variantes
- [x] 8.2 En la misma suite: como ayudante, crear y editar un ítem y un contacto, y comprobar que las acciones de archivado no se ofrecen
- [x] 8.3 En la misma suite: buscar "sublimacion" y encontrar "Taza para sublimación" en el catálogo
- [x] 8.4 CI completa en verde (`lint → typecheck → test:unit → test:integration → build → test:e2e`)
- [x] 8.5 Actualizar el grafo y dejar el cambio listo para archivar (`openspec archive`)
