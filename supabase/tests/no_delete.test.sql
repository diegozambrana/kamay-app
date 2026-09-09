-- KAM-02 · tenant-isolation: ningún usuario autenticado puede ejecutar DELETE.
-- Escenario "DELETE affects zero rows" del delta spec `tenant-isolation`.
begin;

set search_path to public, extensions;

select plan(8);

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

-- `payments` va un paso más allá que el resto: además de no tener política
-- `DELETE`, tiene el privilegio revocado, así que el borrado ni siquiera
-- llega a ejecutarse. Un movimiento de dinero no se borra jamás (KAM-10).
select throws_ok(
  $$ delete from payments $$,
  '42501', null,
  'payments: DELETE ni se ejecuta — el privilegio está revocado');

-- Las cinco tablas de KAM-15 siguen el mismo criterio que `payments`: el
-- privilegio revocado, no solo la política ausente. Una tarea, su etiqueta y
-- su vínculo se archivan o se quedan; no se borran.
select throws_ok(
  $$ delete from tasks $$,
  '42501', null,
  'tasks/tags/task_tags/task_links/membership_lines: DELETE revocado (KAM-15)');

-- `inventory_movements` sigue el mismo criterio, y por la misma razón que
-- `payments`: un movimiento de existencias no se borra ni se edita jamás. Una
-- corrección es siempre un movimiento nuevo (KAM-18, criterio nº 7).
select throws_ok(
  $$ delete from inventory_movements $$,
  '42501', null,
  'inventory_movements: DELETE revocado (KAM-18)');

-- Y tampoco se edita: el privilegio de UPDATE tampoco se concedió. Es la
-- diferencia entre este documento y el resto del esquema, donde editar sí es
-- normal.
select throws_ok(
  $$ update inventory_movements set quantity = 1 $$,
  '42501', null,
  'inventory_movements: UPDATE revocado (KAM-18)');

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
