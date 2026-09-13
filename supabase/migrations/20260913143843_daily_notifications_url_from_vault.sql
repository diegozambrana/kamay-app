-- KAM-23 · El resumen horario lee del Vault también **a quién llama**, no solo
-- con qué credencial (corrige `20260913113818_daily_notifications_pg_cron.sql`).
--
-- ── Por qué ───────────────────────────────────────────────────────────────
-- La migración anterior escribía la dirección a mano: `kamay-app.vercel.app`.
-- Ese subdominio no es de este proyecto —sirve otra aplicación—, así que al
-- cargar el secreto el trabajo le habría mandado el `Bearer` de producción a
-- un tercero cada hora, y el resumen no habría corrido nunca. Además, una
-- dirección escrita en una migración obliga a otra migración el día que la
-- aplicación estrene su dominio propio.
--
-- Ahora la dirección y la credencial viven juntas en el Vault, y el trabajo
-- **solo llama si están las dos**. Sin ellas —en local, o en producción antes
-- de activarlo— no se encola ninguna petición. Para activarlo en el proyecto
-- alojado, con la dirección real de producción (sin barra final) y el mismo
-- valor que `CRON_SECRET` en Vercel:
--
--   select vault.create_secret('https://<dominio de producción>', 'kamay_app_url');
--   select vault.create_secret('<el CRON_SECRET de producción>', 'kamay_cron_secret');
--
-- Para cambiar de dominio o rotar la credencial, `vault.update_secret()` sobre
-- el mismo nombre: el trabajo toma el valor nuevo en su siguiente pasada.
--
-- ── Lo que el `revoke` anterior no hizo ────────────────────────────────────
-- La migración anterior revocaba `net` a `anon` y `authenticated`, y no tuvo
-- efecto: ese permiso lo concede `supabase_admin`, y un `revoke` solo retira
-- lo que concedió quien lo ejecuta. Es la configuración de toda instancia de
-- Supabase y no se puede retirar desde `postgres`. No expone nada: `net` no
-- está en la Data API y la credencial vive en un Vault que esos roles no
-- alcanzan. `scheduled_notifications_cron.test.sql` comprueba eso último.
--
-- ── La espera ─────────────────────────────────────────────────────────────
-- `pg_net` deja de esperar la respuesta a los 5 s por omisión, y una pasada
-- sobre muchas organizaciones puede tardar más. Se le dan 60 s: la respuesta
-- queda en `net._http_response` y es la forma de vigilar el resultado.

-- `cron.schedule` es idempotente por nombre: reemplaza el trabajo anterior en
-- lugar de duplicarlo.
select cron.schedule(
  'kamay-daily-notifications',
  '0 * * * *',
  $job$
  select net.http_get(
    url := rtrim(app.decrypted_secret, '/') || '/api/notifications/daily',
    headers := jsonb_build_object('Authorization', 'Bearer ' || credential.decrypted_secret),
    timeout_milliseconds := 60000
  )
    from vault.decrypted_secrets app
    join vault.decrypted_secrets credential on credential.name = 'kamay_cron_secret'
   where app.name = 'kamay_app_url';
  $job$
);
