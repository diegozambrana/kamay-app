-- KAM-19 · assets: aislamiento y roles de `asset_details`.
-- Escenarios del delta spec `assets`, requisito "Activos solo para la persona
-- dueña, verificado en la base de datos": "El ayudante no lee los activos",
-- "El ayudante no escribe activos", "Ninguna organización ve a otra", "El alta
-- queda en la bitácora". El escenario "Nada se borra" vive en
-- `no_delete.test.sql`, que reúne esa comprobación para todas las tablas, y
-- "El ayudante tampoco lee la recuperación" en `asset_recovery.test.sql`,
-- junto al resto del derivado.
begin;

set search_path to public, extensions;

select plan(7);

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

-- ── Semilla propia (como postgres, sin RLS) ───────────────────────────────

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000018a1', 'owner-asa-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000018a2', 'assistant-asa-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000018b1', 'owner-asa-b@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-0000000018aa', 'Activos acceso A'),
  ('00000000-0000-0000-0000-0000000018bb', 'Activos acceso B');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000018aa', '00000000-0000-0000-0000-0000000018a1', 'owner'),
  ('00000000-0000-0000-0000-0000000018aa', '00000000-0000-0000-0000-0000000018a2', 'assistant'),
  ('00000000-0000-0000-0000-0000000018bb', '00000000-0000-0000-0000-0000000018b1', 'owner');

insert into business_lines (id, organization_id, name, is_shared, position) values
  ('00000000-0000-0000-0000-000000001811', '00000000-0000-0000-0000-0000000018aa', 'Impresión 3D', false, 1);

insert into items (id, organization_id, business_line_id, kind, name) values
  ('00000000-0000-0000-0000-000000001841', '00000000-0000-0000-0000-0000000018aa',
   '00000000-0000-0000-0000-000000001811', 'asset', 'Impresora 3D'),
  ('00000000-0000-0000-0000-000000001842', '00000000-0000-0000-0000-0000000018aa',
   '00000000-0000-0000-0000-000000001811', 'asset', 'Horno');

-- ── Scenario: El alta queda en la bitácora ────────────────────────────────
-- El alta la hace la persona dueña autenticada, no `postgres`: es la única
-- forma de que el evento tenga autor y de que la comprobación signifique algo.

select pg_temp.login('00000000-0000-0000-0000-0000000018a1');

insert into asset_details (item_id, organization_id, acquisition_cost, acquired_on)
values ('00000000-0000-0000-0000-000000001841',
        '00000000-0000-0000-0000-0000000018aa', 7000, date '2026-01-15');

select is(
  (select count(*) from activity_log
    where table_name = 'asset_details'
      and record_id = '00000000-0000-0000-0000-000000001841'
      and action = 'created'
      and actor_id = '00000000-0000-0000-0000-0000000018a1'),
  1::bigint,
  'El alta del activo queda en la bitácora con su autor');

select isnt(
  (select occurred_at from activity_log
    where table_name = 'asset_details'
      and record_id = '00000000-0000-0000-0000-000000001841'
      and action = 'created'),
  null,
  'Y con su fecha');

-- ── Scenario: la persona dueña sí lee sus activos ─────────────────────────

select is(
  (select count(*) from asset_details),
  1::bigint,
  'La persona dueña lee los activos de su organización');

select pg_temp.logout();

-- ── Scenario: El ayudante no lee los activos ──────────────────────────────

select pg_temp.login('00000000-0000-0000-0000-0000000018a2');

select is(
  (select count(*) from asset_details),
  0::bigint,
  'El ayudante obtiene cero filas de asset_details');

-- ── Scenario: El ayudante no escribe activos ──────────────────────────────

select throws_ok(
  $$insert into asset_details (item_id, organization_id, acquisition_cost, acquired_on)
    values ('00000000-0000-0000-0000-000000001842',
            '00000000-0000-0000-0000-0000000018aa', 3000, date '2026-02-01')$$,
  '42501',
  null,
  'El ayudante no puede registrar datos de un activo');

-- Editar no lanza: sin política de lectura, la fila no existe para él y la
-- actualización no alcanza ninguna. El efecto es el mismo —no escribe— y es
-- lo que hay que comprobar.
update asset_details set acquisition_cost = 1;

select pg_temp.logout();

select is(
  (select acquisition_cost from asset_details
    where item_id = '00000000-0000-0000-0000-000000001841'),
  7000::numeric(14,2),
  'La edición del ayudante no alcanza ninguna fila y el costo queda intacto');

-- ── Scenario: Ninguna organización ve a otra ──────────────────────────────

select pg_temp.login('00000000-0000-0000-0000-0000000018b1');

select is(
  (select count(*) from asset_details),
  0::bigint,
  'La persona dueña de otra organización no ve estos activos');

select pg_temp.logout();

select * from finish();
rollback;
