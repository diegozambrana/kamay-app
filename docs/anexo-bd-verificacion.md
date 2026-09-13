# Verificación de la lista del anexo de base de datos

Resultado de comprobar, punto por punto, la **§20 · Lista de verificación antes de producción** de `specs/PRD/kamay-esquema-base-de-datos-supabase.md`. Es el criterio 8 de KAM-23.

Cada punto dice cómo se verifica. Los que son propiedades del catálogo se comprueban con pgTAP **recorriendo el catálogo**, no enumerando tablas: una tabla o vista nueva queda sujeta a la regla el mismo día en que se crea, y la integración continua falla si la incumple. Los que exigen juicio sobre el significado de una columna se revisaron a mano, y aquí queda la evidencia.

- **Fecha de la verificación:** 2026-09-11
- **Esquema verificado:** todas las migraciones hasta `20260911091000_revoke_truncate.sql` (KAM-01 a KAM-23).
- **Ejecución:** `supabase test db` → 59 archivos, 895 aserciones, todas en verde.

## Resultado

| # | Punto del anexo | Resultado | Cómo se verifica |
|---|---|---|---|
| 1 | Toda tabla tiene `organization_id` y RLS activo. | ✅ | `preproduction_checklist.test.sql`, sobre el catálogo. Única excepción: `organizations`, cuyo `id` *es* el identificador de organización. |
| 2 | Ninguna tabla tiene política `DELETE`. | ✅ · **con hallazgo** | `preproduction_checklist.test.sql` (ninguna política `DELETE` ni `ALL` en `public` ni en `storage`) y `no_delete.test.sql` (comportamiento, tabla por tabla). **Hallazgo:** `TRUNCATE` estaba concedido a los roles de la API y no pasa por RLS. Corregido; ver abajo. |
| 3 | Toda vista declara `security_invoker = true`. | ✅ | `views_security.test.sql`, sobre `pg_class.reloptions`. La prueba crea dentro de su transacción una vista sin la opción y comprueba que la detecta por su nombre. |
| 4 | `activity_log` tiene los permisos revocados para `authenticated` y `anon`. | ✅ · **con hallazgo** | `activity_immutable.test.sql` (`insert`, `update` y `delete` rechazados con 42501) y `preproduction_checklist.test.sql` (sin `TRUNCATE`). El mismo hallazgo del punto 2: `TRUNCATE` seguía concedido. |
| 5 | Los disparadores de auditoría están en **todas** las tablas auditables. | ✅ | `preproduction_checklist.test.sql`, sobre `pg_trigger`. Exclusiones, cada una con su motivo en la prueba: `activity_log` (es la bitácora), `notifications` y `notification_preferences` (un aviso no es un hecho del negocio, KAM-17), `task_tags` (tabla de unión sin `id`, fuera del canon §14, KAM-15). |
| 6 | Ninguna columna guarda un valor que pueda calcularse. | ✅ | Automático para los nombres que el anexo cita: ninguna tabla tiene `current_stock`, `stock`, `balance`, `total`, `last_cost`, `margin`, `outstanding`, `paid` ni `collected` (`preproduction_checklist.test.sql`). A mano para el resto: ver *Revisión manual*. |
| 7 | Los montos son `numeric`, nunca `float` ni `real`. | ✅ | `preproduction_checklist.test.sql`: ninguna columna del esquema usa `real`, `double precision` ni `money`, y toda columna cuyo nombre indica importe es `numeric`. |
| 8 | Las rutas de Storage empiezan con el `organization_id` y sus políticas lo verifican. | ✅ | `preproduction_checklist.test.sql`: toda política de `storage.objects` decide por `storage.foldername(name)[1]`, y un objeto bajo la carpeta de A es inalcanzable desde B en **los cinco buckets**. `attachments_storage.test.sql` lo prueba a fondo para `attachments`. |
| 9 | Un usuario de la organización A no obtiene ni una fila de B, en ninguna tabla ni vista. | ✅ | `views_security.test.sql` siembra la organización B, comprueba que la siembra llega a las diez vistas y afirma que un miembro de A ve cero filas de B **en toda vista y en toda tabla** con `organization_id`. Las tablas que esa siembra no alcanza las cubren las pruebas de acceso de su dominio: `rls_isolation`, `task_access`, `notifications`, `task_deliverables`, `task_links`, `invitations`, `attachments_storage`. |
| 10 | Un ayudante consulta `expenses`, `asset_details` e `item_last_cost` y obtiene cero filas. | ✅ | `expense_access.test.sql` (líneas 99 y 105: `expenses` e `item_last_cost`), `asset_access.test.sql` (línea 105: `asset_details`), reforzado por `inventory_access.test.sql` y `task_links.test.sql`. |
| 11 | Reenviar dos veces la misma venta de feria produce una sola fila. | ✅ | `direct_sale_entry.test.sql` § «Reintento por fallo de red»: el reenvío devuelve el mismo identificador y no duplica la venta, sus líneas, su cobro ni sus eventos de bitácora. `order_idempotency.test.sql` lo cubre para pedidos. |
| 12 | Los índices cubren los filtros reales de la interfaz: línea, estado, fecha de vencimiento, cola. | ✅ · **con hallazgo** | `preproduction_checklist.test.sql` comprueba, para cada filtro real de la interfaz, que su columna forma parte de algún índice. **Hallazgo:** `tasks` no tenía índice por línea. Corregido; ver abajo. |

## Hallazgos y correcciones

### `TRUNCATE` concedido a los roles de la API (puntos 2 y 4)

El arranque de Supabase concede a `anon`, `authenticated` y `service_role` todos los privilegios sobre lo que se crea en `public`, y las migraciones solo revocaron `insert`, `update` y `delete` donde hacía falta. `TRUNCATE` quedó concedido en todas las tablas, y **no pasa por RLS**. En local, una sesión `authenticated` vació `activity_log` entera, de todas las organizaciones, con una sola orden.

Hoy no hay camino desde la aplicación hasta esa orden: PostgREST no expone `TRUNCATE` y ninguna función ejecuta SQL arbitrario. Pero la garantía no puede depender de que ese camino no exista. KAM-19 ya lo había encontrado para `asset_details` y lo corrigió solo ahí.

**Corrección:** `20260911091000_revoke_truncate.sql` revoca `TRUNCATE` en todas las tablas de `public` y en los privilegios por defecto del rol `postgres`, que es con el que corren las migraciones. Así las tablas futuras nacen sin él. `DELETE` no se toca: sigue frenado por la ausencia de política, que es el contrato que `no_delete.test.sql` fija.

**Prueba:** `preproduction_checklist.test.sql` comprueba con `has_table_privilege()` que ningún rol de la API conserva `TRUNCATE` en ninguna tabla. Además crea una tabla dentro de su transacción y comprueba que nace sin ese privilegio.

### `tasks` sin índice por línea (punto 12)

Pedidos, egresos e ítems tenían índice por línea desde su creación; `tasks` no. El tablero y la lista de tareas filtran por la línea activa del selector global y ordenan por creación (`TaskService.list()`).

**Corrección:** `20260911090000_tasks_line_index.sql` añade `tasks (organization_id, business_line_id, created_at desc) where archived_at is null`, con el mismo criterio parcial que el resto de índices de `tasks`.

## Revisión manual

### Punto 6 · Ninguna columna guarda un valor calculable

Se revisaron las columnas de las 28 tablas buscando cualquiera cuyo valor pueda obtenerse de otras filas. No se encontró ninguna. Las que podrían parecerlo y no lo son:

- **`tasks.closed_at`**: registra el momento de un hecho, cuándo la tarea entró en un estado final. No es un cálculo: una vez que el estado cambia, el momento ya no se puede reconstruir desde el estado actual. Lo fija un disparador (`task_closed_at.test.sql`).
- **`orders.code`**: es un identificador asignado una vez (`order_numbering.test.sql`), no un cálculo que dependa de otras filas.
- **`items.sale_price` y `item_variants.sale_price`**: son el precio de lista vigente, un dato que se declara. El precio de cada venta queda congelado en `order_items.unit_price`, así que los precios históricos no se reescriben.
- **`asset_details.acquisition_cost`**: es el costo declarado al dar de alta el activo. Su recuperación se deriva en la vista `asset_recovery`.
- **`items.min_stock`**: es un umbral que se configura. La existencia se deriva en `item_balances`, y `below_min` también.

Saldos, totales, último costo, existencias, márgenes y recuperación de inversión viven en las diez vistas derivadas, todas con `security_invoker` (punto 3).

### Punto 12 · Qué filtros tiene la interfaz

La lista de filtros que la prueba exige salió de recorrer los servicios que consultan las pantallas:

- **Línea:** el selector global afecta a pedidos (`OrderService.list`), tareas (`TaskService.list`), egresos, ítems e informes, y la bitácora la filtra en V23.
- **Estado:** tableros de pedidos y de tareas. La **cola** es un estado con `is_queue`, así que la cubre el índice por estado.
- **Fecha de vencimiento:** `orders.due_date` (entregas próximas del panel) y `tasks.due_at` (*Mis pendientes*, avisos de vencimiento).

Las búsquedas por texto de contactos e ítems ya tienen índices trigram (`search_name gin_trgm_ops`), y la bitácora tiene los suyos por acción, autor, línea y registro desde KAM-22.
