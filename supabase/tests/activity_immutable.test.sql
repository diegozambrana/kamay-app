-- KAM-03 · activity-log: la bitácora es inalterable y solo el dueño la lee.
-- Escenario "The activity log is immutable and owner-readable only".
begin;

set search_path to public, extensions;

select plan(6);

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
-- Los propios INSERT de la semilla generan los eventos que luego se consultan.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'assistant-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner-b@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-00000000000a', 'Org A'),
  ('00000000-0000-0000-0000-00000000000b', 'Org B');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 'assistant'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'owner');

-- ── Scenario: Owner cannot alter the log ──────────────────────────────────

select pg_temp.login('00000000-0000-0000-0000-0000000000a1');

select throws_ok(
  $$ update activity_log set action = 'created' $$,
  '42501'::char(5), null::text,
  'inmutable: ni el dueño puede hacer UPDATE sobre activity_log');

select throws_ok(
  $$ delete from activity_log $$,
  '42501'::char(5), null::text,
  'inmutable: ni el dueño puede hacer DELETE sobre activity_log');

-- ── Scenario: Direct insert by a user is rejected ─────────────────────────

select throws_ok(
  $$ insert into activity_log (organization_id, table_name, record_id, action)
     values ('00000000-0000-0000-0000-00000000000a', 'organizations',
             '00000000-0000-0000-0000-00000000000a', 'created') $$,
  '42501'::char(5), null::text,
  'inmutable: un autenticado no puede insertar eventos a mano');

-- ── El dueño sí lee su propia bitácora ────────────────────────────────────

select cmp_ok(
  (select count(*)::int from activity_log
    where organization_id = '00000000-0000-0000-0000-00000000000a'),
  '>', 0, 'lectura: el dueño lee los eventos de su organización');

-- ── Scenario: Assistant reads zero rows ───────────────────────────────────

select pg_temp.login('00000000-0000-0000-0000-0000000000a2');

select is(
  (select count(*)::int from activity_log),
  0, 'lectura: el ayudante obtiene cero filas');

-- ── Un no miembro tampoco ve nada ─────────────────────────────────────────

select pg_temp.login('00000000-0000-0000-0000-0000000000b1');

select is(
  (select count(*)::int from activity_log
    where organization_id = '00000000-0000-0000-0000-00000000000a'),
  0, 'lectura: un dueño de otra organización obtiene cero filas');

select pg_temp.logout();

select * from finish();

rollback;
