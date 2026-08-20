-- KAM-03 · activity-log: el trigger genérico registra qué pasó, con quién, y
-- solo lo que cambió. Escenarios del delta spec `activity-log`.
begin;

set search_path to public, extensions;

select plan(18);

-- ── Helpers: simular usuarios autenticados ────────────────────────────────

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

create function pg_temp.logout() returns void
language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- ── Semilla (como postgres, sin RLS) ──────────────────────────────────────
-- Una organización por escenario: así los eventos de uno no contaminan al otro.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'owner2-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000000a4', 'invitado@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-000000000001', 'Org 1'),
  ('00000000-0000-0000-0000-000000000002', 'Org 2'),
  ('00000000-0000-0000-0000-000000000003', 'Org 3'),
  ('00000000-0000-0000-0000-000000000004', 'Org 4'),
  ('00000000-0000-0000-0000-000000000005', 'Org 5');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-0000000000a3', 'owner');

-- ── Scenario: Insert is logged with author, organization and content ──────

select pg_temp.login('00000000-0000-0000-0000-0000000000a1');

insert into memberships (id, organization_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000f1',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-0000000000a4', 'assistant');

select pg_temp.logout();

select is(
  (select count(*)::int from activity_log
    where table_name = 'memberships'
      and record_id = '00000000-0000-0000-0000-0000000000f1'),
  1, 'created: un INSERT auditado produce exactamente un evento');

select is(
  (select action from activity_log
    where record_id = '00000000-0000-0000-0000-0000000000f1'),
  'created', 'created: la acción registrada es created');

select is(
  (select actor_id from activity_log
    where record_id = '00000000-0000-0000-0000-0000000000f1'),
  '00000000-0000-0000-0000-0000000000a1'::uuid,
  'created: el autor es el usuario autenticado');

select is(
  (select organization_id from activity_log
    where record_id = '00000000-0000-0000-0000-0000000000f1'),
  '00000000-0000-0000-0000-000000000001'::uuid,
  'created: la organización es la del registro');

select is(
  (select changes->>'role' from activity_log
    where record_id = '00000000-0000-0000-0000-0000000000f1'),
  'assistant', 'created: changes guarda el contenido insertado');

-- ── Scenario: Single-field update stores only that field ──────────────────

select pg_temp.login('00000000-0000-0000-0000-0000000000a1');

update organizations set name = 'Org 1 renombrada'
  where id = '00000000-0000-0000-0000-000000000001';

select pg_temp.logout();

select is(
  (select count(*)::int
     from activity_log l, jsonb_object_keys(l.changes) k
    where l.table_name = 'organizations'
      and l.record_id = '00000000-0000-0000-0000-000000000001'
      and l.action = 'updated'),
  1, 'updated: changes contiene un solo campo');

select is(
  (select changes->'name'->>'antes' from activity_log
    where table_name = 'organizations'
      and record_id = '00000000-0000-0000-0000-000000000001'
      and action = 'updated'),
  'Org 1', 'updated: se guarda el valor anterior');

select is(
  (select changes->'name'->>'despues' from activity_log
    where table_name = 'organizations'
      and record_id = '00000000-0000-0000-0000-000000000001'
      and action = 'updated'),
  'Org 1 renombrada', 'updated: se guarda el valor nuevo');

-- ── Scenario: Touching only updated_at produces no event ──────────────────

select pg_temp.login('00000000-0000-0000-0000-0000000000a1');

update organizations set updated_at = updated_at + interval '1 hour'
  where id = '00000000-0000-0000-0000-000000000002';

select pg_temp.logout();

select is(
  (select count(*)::int from activity_log
    where table_name = 'organizations'
      and record_id = '00000000-0000-0000-0000-000000000002'
      and action = 'updated'),
  0, 'updated_at: tocar solo updated_at no genera evento');

-- ── Scenario: Archiving is logged as archived, not updated ────────────────
-- ── Scenario: Unarchiving is logged as unarchived ─────────────────────────

select pg_temp.login('00000000-0000-0000-0000-0000000000a1');

update organizations set archived_at = now()
  where id = '00000000-0000-0000-0000-000000000003';

update organizations set archived_at = null
  where id = '00000000-0000-0000-0000-000000000003';

select pg_temp.logout();

select is(
  (select count(*)::int from activity_log
    where table_name = 'organizations'
      and record_id = '00000000-0000-0000-0000-000000000003'
      and action = 'archived'),
  1, 'archived: archivar registra la acción archived');

select is(
  (select count(*)::int from activity_log
    where table_name = 'organizations'
      and record_id = '00000000-0000-0000-0000-000000000003'
      and action = 'unarchived'),
  1, 'unarchived: desarchivar registra la acción unarchived');

select is(
  (select count(*)::int from activity_log
    where table_name = 'organizations'
      and record_id = '00000000-0000-0000-0000-000000000003'
      and action = 'updated'),
  0, 'archived: archivar no se registra como updated');

-- ── Scenario: Two edits within five minutes produce one event ─────────────

select pg_temp.login('00000000-0000-0000-0000-0000000000a1');

update organizations set name = 'Org 4 v2'
  where id = '00000000-0000-0000-0000-000000000004';

select pg_temp.logout();

-- Envejecer el evento 2 minutos: dentro de la ventana de fusión, pero no
-- simultáneo. (now() es constante dentro de la transacción de prueba.)
update activity_log set occurred_at = occurred_at - interval '2 minutes'
  where table_name = 'organizations'
    and record_id = '00000000-0000-0000-0000-000000000004'
    and action = 'updated';

select pg_temp.login('00000000-0000-0000-0000-0000000000a1');

update organizations set currency = 'USD'
  where id = '00000000-0000-0000-0000-000000000004';

-- Tercera edición sobre un campo ya fusionado: el "antes" original se conserva.
update organizations set name = 'Org 4 v3'
  where id = '00000000-0000-0000-0000-000000000004';

select pg_temp.logout();

select is(
  (select count(*)::int from activity_log
    where table_name = 'organizations'
      and record_id = '00000000-0000-0000-0000-000000000004'
      and action = 'updated'),
  1, 'fusión: ediciones sucesivas del mismo autor producen un solo evento');

select is(
  (select count(*)::int
     from activity_log l, jsonb_object_keys(l.changes) k
    where l.table_name = 'organizations'
      and l.record_id = '00000000-0000-0000-0000-000000000004'
      and l.action = 'updated'),
  2, 'fusión: el evento reúne los campos de ambas ediciones');

select is(
  (select changes->'name'->>'antes' from activity_log
    where table_name = 'organizations'
      and record_id = '00000000-0000-0000-0000-000000000004'
      and action = 'updated'),
  'Org 4', 'fusión: conserva el valor anterior más antiguo');

select is(
  (select changes->'name'->>'despues' from activity_log
    where table_name = 'organizations'
      and record_id = '00000000-0000-0000-0000-000000000004'
      and action = 'updated'),
  'Org 4 v3', 'fusión: conserva el valor nuevo más reciente');

select is(
  (select changes->'currency'->>'despues' from activity_log
    where table_name = 'organizations'
      and record_id = '00000000-0000-0000-0000-000000000004'
      and action = 'updated'),
  'USD', 'fusión: el campo de la segunda edición también queda registrado');

-- ── Scenario: Edits by different users are not merged ─────────────────────

select pg_temp.login('00000000-0000-0000-0000-0000000000a1');

update organizations set name = 'Org 5 por a1'
  where id = '00000000-0000-0000-0000-000000000005';

select pg_temp.login('00000000-0000-0000-0000-0000000000a3');

update organizations set currency = 'USD'
  where id = '00000000-0000-0000-0000-000000000005';

select pg_temp.logout();

select is(
  (select count(*)::int from activity_log
    where table_name = 'organizations'
      and record_id = '00000000-0000-0000-0000-000000000005'
      and action = 'updated'),
  2, 'fusión: ediciones de autores distintos no se fusionan');

select * from finish();

rollback;
