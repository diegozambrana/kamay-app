-- KAM-14 · Lectura acotada de la bitácora que alimenta el panel.
-- Escenarios del delta spec `activity-log` § Recent activity is read through
--   one bounded, owner-only query: "Newest first, capped", "Restricted to one
--   business line", "Assistant still reads nothing", "Another organization's
--   events never appear".
--
-- La consulta vive en `services/activity/activity-service.ts`; lo que aquí se
-- comprueba es que la base la respalda: que el orden y el recorte por línea
-- son posibles sobre los datos reales, y que el recorte por rol no depende de
-- ninguna decisión de la aplicación.
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

-- ── Semilla propia ────────────────────────────────────────────────────────

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000015a1', 'owner-log@kamay.test'),
  ('00000000-0000-0000-0000-0000000015a2', 'helper-log@kamay.test'),
  ('00000000-0000-0000-0000-0000000015a3', 'owner-log-b@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-0000000015b0', 'Bitácora A'),
  ('00000000-0000-0000-0000-0000000015b9', 'Bitácora B');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000015b0', '00000000-0000-0000-0000-0000000015a1', 'owner'),
  ('00000000-0000-0000-0000-0000000015b0', '00000000-0000-0000-0000-0000000015a2', 'assistant'),
  ('00000000-0000-0000-0000-0000000015b9', '00000000-0000-0000-0000-0000000015a3', 'owner');

-- Las líneas generan sus propios eventos (`business_lines` está auditada), de
-- modo que la semilla de la bitácora no se inserta a mano: se provoca. Un
-- `insert` directo en `activity_log` sería además imposible —ningún rol tiene
-- ese privilegio— y probaría algo que no ocurre en producción.
insert into business_lines (id, organization_id, name, position) values
  ('00000000-0000-0000-0000-0000000015c1', '00000000-0000-0000-0000-0000000015b0', 'Sublimación', 1),
  ('00000000-0000-0000-0000-0000000015c2', '00000000-0000-0000-0000-0000000015b0', 'Alfarería',   2),
  ('00000000-0000-0000-0000-0000000015c9', '00000000-0000-0000-0000-0000000015b9', 'Sublimación', 1);

insert into contacts (id, organization_id, name, is_customer) values
  ('00000000-0000-0000-0000-0000000015d1', '00000000-0000-0000-0000-0000000015b0', 'Cliente', true);

insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-0000000015e1', '00000000-0000-0000-0000-0000000015b0', '00000000-0000-0000-0000-0000000015c1', 'order', 'Registrado', 'initial', 1),
  ('00000000-0000-0000-0000-0000000015e2', '00000000-0000-0000-0000-0000000015b0', '00000000-0000-0000-0000-0000000015c2', 'order', 'Registrado', 'initial', 1);

-- Seis pedidos: cuatro de Sublimación y dos de Alfarería, cada uno con su
-- evento `created`. Más que el tope de cinco del panel, a propósito.
insert into orders (id, organization_id, business_line_id, kind, contact_id, status_id) values
  ('00000000-0000-0000-0000-000000015101', '00000000-0000-0000-0000-0000000015b0', '00000000-0000-0000-0000-0000000015c1', 'order', '00000000-0000-0000-0000-0000000015d1', '00000000-0000-0000-0000-0000000015e1'),
  ('00000000-0000-0000-0000-000000015102', '00000000-0000-0000-0000-0000000015b0', '00000000-0000-0000-0000-0000000015c1', 'order', '00000000-0000-0000-0000-0000000015d1', '00000000-0000-0000-0000-0000000015e1'),
  ('00000000-0000-0000-0000-000000015103', '00000000-0000-0000-0000-0000000015b0', '00000000-0000-0000-0000-0000000015c1', 'order', '00000000-0000-0000-0000-0000000015d1', '00000000-0000-0000-0000-0000000015e1'),
  ('00000000-0000-0000-0000-000000015104', '00000000-0000-0000-0000-0000000015b0', '00000000-0000-0000-0000-0000000015c1', 'order', '00000000-0000-0000-0000-0000000015d1', '00000000-0000-0000-0000-0000000015e1'),
  ('00000000-0000-0000-0000-000000015105', '00000000-0000-0000-0000-0000000015b0', '00000000-0000-0000-0000-0000000015c2', 'order', '00000000-0000-0000-0000-0000000015d1', '00000000-0000-0000-0000-0000000015e2'),
  ('00000000-0000-0000-0000-000000015106', '00000000-0000-0000-0000-0000000015b0', '00000000-0000-0000-0000-0000000015c2', 'order', '00000000-0000-0000-0000-0000000015d1', '00000000-0000-0000-0000-0000000015e2');

-- ── Requirement: Recent activity is read through one bounded, owner-only query

select pg_temp.login('00000000-0000-0000-0000-0000000015a1');

-- Scenario: Newest first, capped
select is(
  (select count(*) from (
     select id from activity_log
     where organization_id = '00000000-0000-0000-0000-0000000015b0'
     order by occurred_at desc, id desc
     limit 5
   ) recientes),
  5::bigint,
  'Scenario: Newest first, capped — con más eventos que el tope, devuelve exactamente el tope'
);

select ok(
  (select bool_and(ordenado) from (
     select id <= lag(id) over (order by occurred_at desc, id desc) as ordenado
     from (
       select id, occurred_at from activity_log
       where organization_id = '00000000-0000-0000-0000-0000000015b0'
       order by occurred_at desc, id desc
       limit 5
     ) top5
   ) comprobacion
   where ordenado is not null),
  'Scenario: Newest first, capped — el orden es del más nuevo al más antiguo, con desempate estable'
);

select is(
  (select record_id from activity_log
    where organization_id = '00000000-0000-0000-0000-0000000015b0'
      and table_name = 'orders'
    order by occurred_at desc, id desc
    limit 1),
  '00000000-0000-0000-0000-000000015106'::uuid,
  'Scenario: Newest first, capped — el primero es el último pedido registrado'
);

-- Scenario: Restricted to one business line
select is(
  (select count(*) from activity_log
    where organization_id = '00000000-0000-0000-0000-0000000015b0'
      and business_line_id = '00000000-0000-0000-0000-0000000015c2'
      and table_name = 'orders'),
  2::bigint,
  'Scenario: Restricted to one business line — solo los eventos de esa línea'
);

select is(
  (select count(*) from activity_log
    where organization_id = '00000000-0000-0000-0000-0000000015b0'
      and business_line_id = '00000000-0000-0000-0000-0000000015c1'
      and table_name = 'orders'),
  4::bigint,
  'Scenario: Restricted to one business line — la otra línea tiene los suyos'
);

-- Scenario: Another organization's events never appear
select is(
  (select count(*) from activity_log
    where organization_id = '00000000-0000-0000-0000-0000000015b9'),
  0::bigint,
  'Scenario: Another organizations events never appear — la organización ajena no devuelve nada'
);

select is(
  (select count(*) from activity_log
    where organization_id <> '00000000-0000-0000-0000-0000000015b0'),
  0::bigint,
  'Scenario: Another organizations events never appear — ni siquiera sin filtrar por la propia'
);

select pg_temp.logout();

-- Scenario: Assistant still reads nothing
select pg_temp.login('00000000-0000-0000-0000-0000000015a2');

select is(
  (select count(*) from activity_log),
  0::bigint,
  'Scenario: Assistant still reads nothing — el ayudante no lee la bitácora, exista lo que exista'
);

select pg_temp.logout();

select * from finish();
rollback;
