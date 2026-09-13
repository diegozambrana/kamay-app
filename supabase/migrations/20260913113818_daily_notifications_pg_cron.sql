-- KAM-23 · El resumen diario lo dispara Supabase Cron; la retención se queda
-- en el Cron de Vercel (spec `production-operations` → *Scheduled jobs run in
-- production and only for whoever holds their secret*; design D7; riesgo «El
-- plan de Vercel puede limitar la frecuencia del Cron», tarea 10.4).
--
-- ── El problema ───────────────────────────────────────────────────────────
-- El resumen diario necesita una pasada **cada hora**: filtra por la hora
-- local de cada organización, y así una sola entrada sirve a cualquier zona
-- horaria sin crecer con cada zona nueva (KAM-17). El plan Hobby de Vercel
-- solo admite trabajos **diarios**: el despliegue se rechaza con «Hobby
-- accounts are limited to daily cron jobs» antes de compilar nada, incluso en
-- una vista previa. La frecuencia no es negociable sin degradar el reparto.
--
-- ── La salida ─────────────────────────────────────────────────────────────
-- La pasada horaria pasa a `pg_cron`, que no tiene ese límite, y llama al
-- mismo punto de entrada con la misma credencial: la ruta, su autorización y
-- sus pruebas no cambian. La retención mensual se queda en `vercel.json`,
-- donde una vez al mes cabe de sobra.
--
-- ── El secreto no se escribe aquí ─────────────────────────────────────────
-- Esta migración se comitea, así que el secreto vive en el Vault y el trabajo
-- lo lee en cada ejecución. Mientras no exista, el `from` no devuelve ninguna
-- fila y **no se llama a nadie**: por eso en local, donde no hay secreto, la
-- pasada es inerte y nunca toca el dominio de producción. En el proyecto
-- alojado se carga una sola vez, con el mismo valor que `CRON_SECRET`:
--
--   select vault.create_secret('<el CRON_SECRET de producción>', 'kamay_cron_secret');
--
-- Para rotarlo, `vault.update_secret()` sobre ese mismo nombre; el trabajo
-- toma el valor nuevo en su siguiente pasada, sin volver a agendarse.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Ni el programador ni el cliente HTTP son parte de la API: nadie que llegue
-- por PostgREST tiene por qué verlos ni llamarlos.
revoke all on schema cron from public, anon, authenticated;
revoke all on schema net from public, anon, authenticated;

-- `cron.schedule` es idempotente por nombre: repetir el nombre reemplaza el
-- trabajo en lugar de duplicarlo.
select cron.schedule(
  'kamay-daily-notifications',
  '0 * * * *',
  $job$
  select net.http_get(
    url := 'https://kamay-app.vercel.app/api/notifications/daily',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v.decrypted_secret)
  )
    from vault.decrypted_secrets v
   where v.name = 'kamay_cron_secret';
  $job$
);
