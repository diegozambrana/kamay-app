-- KAM-26 · El registro de administradores de la plataforma.
-- Escenarios del delta `platform-administration` → *Platform admins are
-- registered above organizations*.
begin;

set search_path to public, extensions;

select plan(12);

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

-- ── Semilla ───────────────────────────────────────────────────────────────

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000fa01', 'pa-activo@kamay.test'),
  ('00000000-0000-0000-0000-00000000fa02', 'pa-revocado@kamay.test'),
  ('00000000-0000-0000-0000-00000000fa03', 'pa-duena@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-00000000fa0a', 'Org PA');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000fa0a', '00000000-0000-0000-0000-00000000fa03', 'owner');

insert into platform_admins (user_id, archived_at) values
  ('00000000-0000-0000-0000-00000000fa01', null),
  ('00000000-0000-0000-0000-00000000fa02', now());

-- ── La tabla ──────────────────────────────────────────────────────────────

select ok(
  (select relrowsecurity from pg_class where oid = 'public.platform_admins'::regclass),
  'platform_admins: RLS activo');

-- Scenario: An active row makes a platform admin
select pg_temp.login('00000000-0000-0000-0000-00000000fa01');
select ok(is_platform_admin(), 'una fila activa hace super admin');

-- Scenario: A revoked row grants nothing
select pg_temp.login('00000000-0000-0000-0000-00000000fa02');
select ok(not is_platform_admin(), 'una fila archivada no hace super admin');

select pg_temp.login('00000000-0000-0000-0000-00000000fa03');
select ok(not is_platform_admin(), 'una dueña sin fila no es super admin');

-- Scenario: Other admins are not listed through the table
select pg_temp.login('00000000-0000-0000-0000-00000000fa01');
select is(
  (select array_agg(user_id) from platform_admins),
  array['00000000-0000-0000-0000-00000000fa01'::uuid],
  'el super admin lee solo su propia fila');

select pg_temp.login('00000000-0000-0000-0000-00000000fa03');
select is((select count(*)::int from platform_admins), 0,
  'una dueña no lee ninguna fila');

-- Scenario: No one promotes themselves
select pg_temp.login('00000000-0000-0000-0000-00000000fa03');
select throws_ok(
  $$insert into platform_admins (user_id) values ('00000000-0000-0000-0000-00000000fa03')$$,
  '42501', null,
  'una dueña no puede nombrarse super admin');

select pg_temp.login('00000000-0000-0000-0000-00000000fa01');
select throws_ok(
  $$insert into platform_admins (user_id) values ('00000000-0000-0000-0000-00000000fa03')$$,
  '42501', null,
  'un super admin tampoco puede nombrar a otro');

select throws_ok(
  $$update platform_admins set archived_at = null
     where user_id = '00000000-0000-0000-0000-00000000fa02'$$,
  '42501', null,
  'nadie con sesión reactiva a un super admin revocado');

select throws_ok(
  $$delete from platform_admins where user_id = '00000000-0000-0000-0000-00000000fa01'$$,
  '42501', null,
  'nadie con sesión borra filas del registro');

select pg_temp.logout();

select is(
  (select archived_at is not null from platform_admins
    where user_id = '00000000-0000-0000-0000-00000000fa02'),
  true,
  'el revocado sigue en la tabla, archivado');

-- Ni el service role borra: revocar es archivar.
select ok(
  not has_table_privilege('service_role', 'public.platform_admins', 'DELETE'),
  'el service role no tiene DELETE sobre platform_admins');

select * from finish();
rollback;
