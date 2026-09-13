-- KAM-23 · Las exportaciones de la purga: solo la persona dueña de la
-- organización las lee, y nadie las escribe ni las borra.
--
-- Escenarios del delta `data-export` → *The export includes the activity
-- detail already purged by retention* → «Another organization's purge exports
-- are unreachable», «An assistant cannot read purge exports» (y la lectura
-- propia de la que depende «Purged detail travels with the export»).
begin;

set search_path to public, extensions;

select plan(6);

create function pg_temp.login(uid uuid) returns void
language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;
end;
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000023e1', 'owner-exp-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000023e2', 'helper-exp-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000023e3', 'owner-exp-b@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-00000000023e', 'Exportaciones A'),
  ('00000000-0000-0000-0000-00000000023f', 'Exportaciones B');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000023e', '00000000-0000-0000-0000-0000000023e1', 'owner'),
  ('00000000-0000-0000-0000-00000000023e', '00000000-0000-0000-0000-0000000023e2', 'assistant'),
  ('00000000-0000-0000-0000-00000000023f', '00000000-0000-0000-0000-0000000023e3', 'owner');

-- Lo que la rutina de retención dejaría, con la ruta que ella usa.
insert into storage.objects (bucket_id, name) values
  ('activity-exports', '00000000-0000-0000-0000-00000000023e/2026-09-01-bitacora-hasta-2025-09-01.csv');

-- ── La dueña de A lee la purga de su organización ─────────────────────────
select pg_temp.login('00000000-0000-0000-0000-0000000023e1');

select is(
  (select count(*)::int from storage.objects where bucket_id = 'activity-exports'),
  1, 'la dueña lee las exportaciones de la purga de su organización');

-- Leer no es escribir: la purga la escribe el sistema.
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('activity-exports', '00000000-0000-0000-0000-00000000023e/intruso.csv') $$,
  '42501', null,
  'ni la dueña escribe en el bucket de la purga');

select throws_ok(
  $$ delete from storage.objects where bucket_id = 'activity-exports' $$,
  '42501', null,
  'ni la dueña borra una exportación de la purga');

-- ── El ayudante de A no la lee ────────────────────────────────────────────
select pg_temp.login('00000000-0000-0000-0000-0000000023e2');

select is(
  (select count(*)::int from storage.objects where bucket_id = 'activity-exports'),
  0, 'el ayudante no lee la purga, igual que no lee la bitácora');

-- ── La dueña de B no alcanza la de A ──────────────────────────────────────
select pg_temp.login('00000000-0000-0000-0000-0000000023e3');

select is(
  (select count(*)::int from storage.objects where bucket_id = 'activity-exports'),
  0, 'la dueña de otra organización no lista la purga ajena');

select is(
  (select count(*)::int from storage.objects
    where bucket_id = 'activity-exports'
      and name = '00000000-0000-0000-0000-00000000023e/2026-09-01-bitacora-hasta-2025-09-01.csv'),
  0, 'conocer la ruta exacta no basta para leerla');

select * from finish();
rollback;
