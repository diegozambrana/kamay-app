-- KAM-12 · Los ingresos suman pedidos y ventas directas.
-- Escenarios del delta spec `orders` — requisito "Las consultas de ingresos
-- incluyen las ventas directas".
--
-- Es la razón por la que el esquema canónico (§9) decidió una sola tabla
-- `orders` con `kind` en vez de dos tablas: para que ninguna consulta de
-- ingresos tenga que unir dos fuentes y mantenerlas sincronizadas. Esta suite
-- es lo que impide que esa decisión se erosione sin que nadie se entere.
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

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000d01', 'owner-rev@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-000000000d0a', 'Ingresos');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-000000000d0a', '00000000-0000-0000-0000-000000000d01', 'owner');

insert into business_lines (id, organization_id, name) values
  ('00000000-0000-0000-0000-000000000d1a', '00000000-0000-0000-0000-000000000d0a', 'Alfarería');

insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-000000000d21', '00000000-0000-0000-0000-000000000d0a', '00000000-0000-0000-0000-000000000d1a', 'order', 'Reservado', 'initial', 1),
  ('00000000-0000-0000-0000-000000000d22', '00000000-0000-0000-0000-000000000d0a', '00000000-0000-0000-0000-000000000d1a', 'order', 'Entregado', 'final',   2);

insert into contacts (id, organization_id, name, is_customer) values
  ('00000000-0000-0000-0000-000000000d31', '00000000-0000-0000-0000-000000000d0a', 'Cliente', true);

select pg_temp.login('00000000-0000-0000-0000-000000000d01');

-- Un pedido de 200, con un anticipo de 50.
select create_order(
  jsonb_build_object(
    'id',               '00000000-0000-0000-0000-0000000000d1',
    'organization_id',  '00000000-0000-0000-0000-000000000d0a',
    'business_line_id', '00000000-0000-0000-0000-000000000d1a',
    'contact_id',       '00000000-0000-0000-0000-000000000d31'),
  jsonb_build_array(jsonb_build_object('quantity', 1, 'unit_price', 200)));

insert into payments (organization_id, direction, order_id, amount, method) values
  ('00000000-0000-0000-0000-000000000d0a', 'in', '00000000-0000-0000-0000-0000000000d1', 50, 'cash');

-- Una venta directa de 115, cobrada en el acto.
select create_direct_sale(
  jsonb_build_object(
    'id',               '00000000-0000-0000-0000-0000000000d2',
    'organization_id',  '00000000-0000-0000-0000-000000000d0a',
    'business_line_id', '00000000-0000-0000-0000-000000000d1a'),
  jsonb_build_array(jsonb_build_object('quantity', 1, 'unit_price', 115)),
  jsonb_build_object('amount', 115, 'method', 'cash'));

-- ── Scenario: Ingresos de la línea ────────────────────────────────────────

select is(
  (select sum(total) from order_totals
    where business_line_id = '00000000-0000-0000-0000-000000000d1a'),
  315::numeric, 'el ingreso de la línea es 200 + 115 = 315');

select is(
  (select count(*)::int from order_totals
    where business_line_id = '00000000-0000-0000-0000-000000000d1a'),
  2, 'las dos filas conviven en la misma vista, pedido y venta directa');

-- ── Scenario: Una sola fuente ─────────────────────────────────────────────
-- No hay ninguna otra tabla de ventas que unir: el ingreso sale de aquí.

select is(
  (select count(*)::int from information_schema.tables
    where table_schema = 'public'
      and table_name in ('direct_sales', 'sales', 'fair_sales')),
  0, 'no existe ninguna tabla de ventas aparte: order_totals es la fuente única');

select is(
  (select count(distinct kind)::int from order_totals
    where business_line_id = '00000000-0000-0000-0000-000000000d1a'),
  2, 'order_totals expone kind para quien necesite separarlos, sin obligar a ello');

-- ── Scenario: El cobrado también suma ─────────────────────────────────────

select is(
  (select sum(paid) from order_totals
    where business_line_id = '00000000-0000-0000-0000-000000000d1a'),
  165::numeric, 'el cobrado suma el anticipo del pedido y el cobro de la venta: 50 + 115');

select is(
  (select sum(total - paid) from order_totals
    where business_line_id = '00000000-0000-0000-0000-000000000d1a'),
  150::numeric, 'el pendiente derivado es 150, todo del pedido');

-- ── Scenario: La venta directa archivada no suma ──────────────────────────

update orders set archived_at = now() where id = '00000000-0000-0000-0000-0000000000d2';

select is(
  (select sum(total) from order_totals
    where business_line_id = '00000000-0000-0000-0000-000000000d1a'),
  200::numeric, 'archivada la venta, el ingreso de la línea vuelve a 200');

select is(
  (select count(*)::int from order_totals
    where order_id = '00000000-0000-0000-0000-0000000000d2'),
  0, 'la venta archivada desaparece de order_totals, como cualquier pedido');

select * from finish();
rollback;
