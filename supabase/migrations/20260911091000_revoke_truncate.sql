-- KAM-23 · Revocar `TRUNCATE` en todo el esquema (anexo de esquema §20).
--
-- ── El hallazgo ───────────────────────────────────────────────────────────
-- La verificación del anexo encontró que `anon`, `authenticated` y
-- `service_role` conservan `TRUNCATE` sobre las tablas de `public`, incluida
-- `activity_log`. Lo concede el arranque de Supabase a todo lo que se crea en
-- el esquema, y las migraciones solo revocaron `insert`, `update` y `delete`.
--
-- `TRUNCATE` no pasa por RLS: comprobado en local, una sesión `authenticated`
-- vacía `activity_log` entera —todas las organizaciones— de una sola orden.
-- Hoy no hay camino desde la aplicación hasta esa orden (PostgREST no expone
-- `TRUNCATE` y ninguna función ejecuta SQL arbitrario), pero dos puntos del
-- anexo lo prohíben igual: «`activity_log` tiene los permisos revocados para
-- `authenticated` y `anon`» y «ninguna tabla tiene política `DELETE`», cuyo
-- sentido es que nada se borra. Una garantía que depende de que no exista un
-- camino es una garantía que se pierde el día que alguien lo abre.
--
-- KAM-19 ya lo había encontrado para `asset_details`
-- (20260909140000_assets_revoke_delete.sql) y lo corrigió solo allí. Esta
-- migración lo resuelve para todas, y para las que vengan.
--
-- `DELETE` no se toca: sigue frenado por la ausencia de política, y
-- `no_delete.test.sql` fija ese comportamiento —cero filas, sin error— como el
-- contrato de `tenant-isolation`. `TRUNCATE` es distinto porque no hay
-- política que lo frene.

revoke truncate on all tables in schema public from anon, authenticated, service_role;

-- Y para las tablas que creen las migraciones futuras, que corren como
-- `postgres`: sin esto, la tabla número veintinueve volvería a nacer con el
-- privilegio.
alter default privileges for role postgres in schema public
  revoke truncate on tables from anon, authenticated, service_role;
