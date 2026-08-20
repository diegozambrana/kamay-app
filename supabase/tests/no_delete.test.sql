-- KAM-02 · tenant-isolation: ningún usuario autenticado puede ejecutar DELETE.
-- Escenario "DELETE affects zero rows" del delta spec `tenant-isolation`.
begin;

set search_path to public, extensions;

select plan(4);

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

-- Semilla (como postgres, sin RLS)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner-b@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-00000000000a', 'Org A'),
  ('00000000-0000-0000-0000-00000000000b', 'Org B');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'owner');

-- Incluso el dueño de la organización: DELETE se ejecuta pero afecta cero filas.
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');

select lives_ok(
  $$ delete from memberships $$,
  'memberships: DELETE del dueño no falla, pero no tiene política');

select lives_ok(
  $$ delete from organizations $$,
  'organizations: DELETE del dueño no falla, pero no tiene política');

select pg_temp.logout();

select is(
  (select count(*)::int from memberships
    where organization_id in ('00000000-0000-0000-0000-00000000000a',
                              '00000000-0000-0000-0000-00000000000b')),
  2, 'memberships: cero filas eliminadas');

select is(
  (select count(*)::int from organizations
    where id in ('00000000-0000-0000-0000-00000000000a',
                 '00000000-0000-0000-0000-00000000000b')),
  2, 'organizations: cero filas eliminadas');

select * from finish();

rollback;
