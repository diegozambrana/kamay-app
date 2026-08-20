# Migraciones

Reglas de la constitución del proyecto (`openspec/project.md`, convención nº 6):

- Solo archivos nuevos, nombrados `YYYYMMDDHHMMSS_<nombre>.sql`. **Nunca se edita una migración existente**, ni siquiera para corregir un error: se corrige con una migración nueva.
- Cada migración lleva su prueba pgTAP en `supabase/tests/`. Ninguna se fusiona sin ella.
- Tras cualquier cambio de esquema, regenerar el grafo: `graphify .`.
- No existen políticas `DELETE`. Se archiva con `archived_at`.
- RLS activo en toda tabla, sin excepción, y `organization_id` en toda tabla de negocio.

## Cómo auditar una tabla nueva

Todo lo que muestre "qué pasó aquí" lee de `activity_log` (convención nº 7). El historial no se reconstruye hacia atrás: una tabla que recibe filas antes de tener su trigger pierde ese tramo para siempre.

Por eso el trigger **se adjunta en la misma migración que crea la tabla**, nunca en una posterior:

```sql
create table orders (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  -- …
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  archived_at     timestamptz
);

create trigger audit after insert or update on orders
  for each row execute function log_activity();
```

`log_activity()` es genérica: no conoce la tabla. Deduce sola la acción y el contenido a partir de las columnas que encuentre.

- La organización sale de `organization_id`; en `organizations` es la fila misma.
- `archived_at` pasando de nulo a valor (o al revés) se registra como `archived` / `unarchived`.
- Un cambio de `status_id` se registra como `status_changed`.
- Cualquier otro cambio efectivo es `updated`, y guarda **solo** los campos que cambiaron. `created_at` y `updated_at` nunca cuentan como cambio.
- La línea de negocio sale de `business_line_id` si la tabla la tiene.

No hace falta ninguna configuración adicional ni registrar la tabla en ningún sitio.

### Qué se audita y qué no

Se audita toda tabla cuyo historial le importe al usuario: pedidos, egresos, pagos, contactos, ítems, tareas, estados, líneas de negocio, membresías, configuración. No se auditan las tablas puramente derivadas ni las vistas (no tienen historial propio) ni `activity_log` misma.

### Prueba obligatoria

La prueba pgTAP de la migración incluye al menos un assert de que la tabla queda auditada:

```sql
select is(
  (select count(*)::int from activity_log
    where table_name = 'orders' and record_id = '…'),
  1, 'orders: el INSERT queda registrado en la bitácora');
```

Los escenarios generales del trigger (diff de un campo, archivado, fusión, inmutabilidad) ya están cubiertos en `supabase/tests/audit_trigger.test.sql` y `supabase/tests/activity_immutable.test.sql`; no hace falta repetirlos por tabla.
