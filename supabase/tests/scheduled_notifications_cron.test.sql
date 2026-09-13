-- KAM-23 · El resumen horario agendado con `pg_cron`
-- (`20260913113818_daily_notifications_pg_cron.sql` y su corrección
-- `20260913143843_daily_notifications_url_from_vault.sql`).
--
-- Spec `production-operations` → *Scheduled jobs run in production and only
-- for whoever holds their secret*. Lo que se comprueba:
--   · el trabajo existe, activo, una vez por hora;
--   · no lleva ninguna dirección escrita: la lee del Vault;
--   · sin dirección o sin credencial no se encola ninguna petición —así es
--     inerte en local y en producción antes de activarlo—;
--   · con las dos, pide `GET /api/notifications/daily` con el `Bearer` y una
--     espera de 60 s;
--   · ni el programador ni la credencial son alcanzables desde la API.
--
-- La transacción se revierte al final: las peticiones que se encolan aquí no
-- las procesa nunca el trabajador de `pg_net`, que solo ve lo confirmado.
begin;
select plan(12);

select has_extension('pg_cron', 'pg_cron está habilitado');
select has_extension('pg_net', 'pg_net está habilitado');

select is(
  (select schedule from cron.job where jobname = 'kamay-daily-notifications'),
  '0 * * * *',
  'el resumen corre una vez por hora');

select ok(
  (select active from cron.job where jobname = 'kamay-daily-notifications'),
  'el trabajo está activo');

select is(
  (select count(*)::int from cron.job where jobname = 'kamay-daily-notifications'),
  1,
  'un solo trabajo con ese nombre: la corrección lo reemplazó, no lo duplicó');

select ok(
  (select command not like '%vercel.app%' and command not like '%https://%'
     from cron.job where jobname = 'kamay-daily-notifications'),
  'el trabajo no lleva ninguna dirección escrita');

-- Ejecutar el trabajo tal como lo haría el programador.
create function pg_temp.run_job() returns void language plpgsql as $$
begin
  execute (select command from cron.job where jobname = 'kamay-daily-notifications');
end;
$$;

-- Sin nada en el Vault: inerte.
select pg_temp.run_job();
select is(
  (select count(*)::int from net.http_request_queue where url like '%/api/notifications/daily'),
  0,
  'sin dirección ni credencial no se llama a nadie');

-- Con la credencial pero sin dirección: sigue inerte.
select vault.create_secret('secreto-de-prueba-largo', 'kamay_cron_secret');
select pg_temp.run_job();
select is(
  (select count(*)::int from net.http_request_queue where url like '%/api/notifications/daily'),
  0,
  'con la credencial pero sin dirección tampoco');

-- Con las dos: una petición, al punto de entrada, con su credencial.
select vault.create_secret('https://kamay.example/', 'kamay_app_url');
select pg_temp.run_job();

select is(
  (select url from net.http_request_queue where url like '%/api/notifications/daily'),
  'https://kamay.example/api/notifications/daily',
  'llama al punto de entrada de la dirección del Vault, sin doble barra');

select is(
  (select headers ->> 'Authorization' from net.http_request_queue
    where url like '%/api/notifications/daily'),
  'Bearer secreto-de-prueba-largo',
  'con la credencial del Vault');

select is(
  (select timeout_milliseconds from net.http_request_queue
    where url like '%/api/notifications/daily'),
  60000,
  'y espera la respuesta hasta 60 s');

-- Lo que hay que proteger es la credencial. `pg_net` sí es ejecutable por
-- `anon` y `authenticated` —lo concede `supabase_admin` en toda instancia de
-- Supabase y `postgres` no puede retirarlo—, pero `net` no está expuesto en la
-- Data API (`[api] schemas`), y lo que el trabajo lleva de secreto vive en un
-- Vault que esos roles no alcanzan.
select ok(
  not has_schema_privilege('anon', 'cron', 'USAGE')
  and not has_schema_privilege('authenticated', 'cron', 'USAGE')
  and not has_schema_privilege('anon', 'vault', 'USAGE')
  and not has_schema_privilege('authenticated', 'vault', 'USAGE')
  and not has_table_privilege('anon', 'vault.decrypted_secrets', 'SELECT')
  and not has_table_privilege('authenticated', 'vault.decrypted_secrets', 'SELECT'),
  'ni anon ni authenticated alcanzan el programador ni la credencial del Vault');

select * from finish();
rollback;
