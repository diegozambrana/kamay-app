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

---

## Trabajos programados

### Retención de la bitácora (KAM-22)

`purge_activity_detail(p_organization, p_cutoff)` suelta el detalle (`changes`)
de los eventos de una organización anteriores al corte. **No borra ninguna fila
y no toca ninguna otra columna**: quién hizo qué, sobre qué registro y cuándo es
permanente. Tiene `execute` revocado a `public`, `authenticated` y `anon`, y
concedido solo a `service_role`; ni el dueño puede purgar su propia bitácora.

**Nunca se llama directamente.** La rutina completa es
`RetentionService.run(organizationId)` en `services/activity/retention-service.ts`,
que lee el plazo de la organización, exporta los eventos vencidos al bucket
privado `activity-exports`, **vuelve a descargar el archivo y comprueba que
está completo**, y solo entonces llama a la función. Si la exportación falla o
no supera la verificación, no se vacía nada.

#### No está agendada, y es a propósito

KAM-22 dejó la rutina construida y probada; encender el reloj pertenece a
**KAM-23 · Endurecimiento y puesta en producción**, junto con las copias de
seguridad y el resto de trabajos programados. Mientras tanto la bitácora crece
con todo su detalle, que es el estado que ya tenía.

Para agendarla en producción hace falta:

1. Habilitar `pg_cron` en el proyecto de Supabase.
2. Un punto de entrada que corra `RetentionService.run()` por organización con
   el cliente de service role — una ruta protegida como
   `app/api/notifications/daily/route.ts`, o una Edge Function.
3. Agendar la llamada mensual, por ejemplo:

   ```sql
   select cron.schedule('kamay-log-retention', '0 3 1 * *', $$
     select net.http_post(
       url := '<origen>/api/activity/retention',
       headers := jsonb_build_object('Authorization', 'Bearer <secreto>')
     );
   $$);
   ```

   El `cron.schedule` que el anexo de esquema propone —un `update` directo sobre
   `activity_log`— **no sirve**: la especificación exige exportar y verificar
   antes de vaciar, y Postgres no escribe en Storage sin `pg_net` y sin guardar
   una clave dentro de la base.
4. Vigilar el resultado: `describeRun()` produce el resumen con cuántos eventos
   se exportaron, cuántos se vaciaron y dónde quedó el archivo.
