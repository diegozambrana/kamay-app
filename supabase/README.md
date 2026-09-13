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

#### Agendada con el Cron de Vercel (KAM-23)

La rutina corre **sola, el día 1 de cada mes a las 04:00 UTC**, desde la entrada
de `vercel.json` que llama a `GET /api/activity/retention`
(`app/api/activity/retention/route.ts`). La ruta:

1. Rechaza con 401 toda llamada sin `Authorization: Bearer $CRON_SECRET`, y
   **todas** si `CRON_SECRET` no está configurado —incluida la del propio
   programador—: sin credencial no se construye ni el cliente de service role.
2. Recorre las organizaciones vivas con el cliente de service role (la
   convención nº 2 lo reserva a los trabajos programados) y llama a
   `RetentionService.run()` **una por una, cada una en su propio `try`**
   (`services/activity/retention-job.ts`). Una organización cuya exportación
   falla no deja sin retención a las demás, y tampoco pierde nada: `run()` no
   vacía ningún detalle si la exportación no se escribió y verificó.
3. Reporta cada fallo con `reportError()` —el trabajo y la organización, nunca
   el contenido de la bitácora— y responde **500** si alguna organización
   falló, aunque las demás se hayan procesado.

### El resumen diario lo agenda Supabase Cron (KAM-23)

El resumen diario de avisos (`GET /api/notifications/daily`) sigue el mismo
camino y la misma credencial, pero lo dispara **`pg_cron`, cada hora**, desde
`supabase/migrations/20260913113818_daily_notifications_pg_cron.sql` (con la
dirección corregida en `20260913143843_daily_notifications_url_from_vault.sql`). Los dos
puntos de entrada responden a `GET` porque es el método con el que llaman sus
programadores.

**Por qué dos programadores.** El resumen diario necesita la pasada horaria:
filtra por la hora local de cada organización, y así una sola entrada sirve a
cualquier zona horaria sin crecer con cada zona nueva (KAM-17). El plan Hobby
de Vercel solo admite trabajos **diarios** y rechaza el despliegue completo
—incluso una vista previa— con «Hobby accounts are limited to daily cron jobs».
Bajar la frecuencia degradaría el reparto por zona; `pg_cron` no tiene ese
límite. La retención se queda en `vercel.json` porque una vez al mes cabe de
sobra, y porque es el trabajo que necesita el service role y la lógica de
`RetentionService`, no SQL: el `cron.schedule` que el anexo de esquema propone
—un `update` directo sobre `activity_log`— no sirve, ya que la especificación
exige exportar y verificar antes de vaciar.

**La dirección y el secreto viven en el Vault, no en la migración**, que se
comitea. El trabajo solo llama si están los dos. **Se activa después del
primer despliegue**, cuando se conoce la dirección real de producción —la
primera versión la escribía a mano y apuntaba a un `vercel.app` ajeno—. En el
proyecto alojado se cargan una sola vez: la dirección sin barra final y el
mismo valor que `CRON_SECRET` en Vercel.

```sql
select vault.create_secret('https://<dominio de producción>', 'kamay_app_url');
select vault.create_secret('<el CRON_SECRET de producción>', 'kamay_cron_secret');
```

Mientras falte cualquiera de los dos, el cuerpo del trabajo no devuelve ninguna
fila y **no llama a nadie**: en local la pasada horaria es inerte. Para cambiar
de dominio o rotar la credencial, `vault.update_secret()` sobre el mismo
nombre; la siguiente pasada toma el valor nuevo sin volver a agendarse. Lo
comprueba `supabase/tests/scheduled_notifications_cron.test.sql`.

**Cómo vigilar su resultado.**

- *Vercel → Project → Settings → Cron Jobs*: la última ejecución de la
  retención y su código de respuesta. Un 500 significa que al menos una
  organización falló; el cuerpo de la respuesta lista cuáles (`failed`) y el
  resumen de cada una que sí se procesó (`succeeded`, con el texto de
  `describeRun()`: eventos exportados, vaciados y dónde quedó el archivo).
- *Dashboard → Integrations → Cron*, o `cron.job_run_details`: cada pasada del
  resumen diario, con su estado y su duración. La respuesta del endpoint no
  llega ahí —`net.http_get` es asíncrono—, así que el código de respuesta se
  mira en los registros de la función:

  ```sql
  select status, return_message, start_time
    from cron.job_run_details d
    join cron.job j on j.jobid = d.jobid
   where j.jobname = 'kamay-daily-notifications'
   order by start_time desc
   limit 10;
  ```
- *Logs de la función* `/api/activity/retention`: cada fallo aparece como
  `[kamay] { job: 'activity-retention', organizationId }` junto al error, y va
  al monitoreo de errores en cuanto esté conectado (`lib/monitoring/report-error.ts`).
- *Storage → `activity-exports`*: un archivo por organización y corte con lo
  exportado antes de vaciar; la persona dueña lo recibe también dentro de la
  exportación completa de V15 (`bitacora-purgada/`).

Una organización que falló se reintenta sola el mes siguiente. Para no esperar,
se puede llamar a mano con el secreto de producción:

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<dominio>/api/activity/retention
```

El Cron de Vercel solo dispara en el despliegue de **producción**: en local y en
las vistas previas la rutina no corre sola, y la bitácora sigue con todo su
detalle, que es un estado consistente. El de `pg_cron` vive en el proyecto
alojado y llama siempre al dominio de producción, de modo que una vista previa
tampoco genera avisos por su cuenta; en local no llama a nadie, porque el
secreto no está en el Vault.
