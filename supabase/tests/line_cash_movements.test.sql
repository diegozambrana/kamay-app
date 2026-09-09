-- KAM-19 · payments: la vista de movimientos de caja con su línea y su activo.
-- Escenarios del delta spec `payments`, requisito "Movimiento de caja con su
-- línea y su activo": "Un movimiento por fila con su línea", "El activo del
-- pago aparece en la fila", "Un pago corriente no señala ningún activo", "Lo
-- archivado no aparece", "El agregado mensual coincide con el detalle", "El
-- ayudante obtiene cero filas", "Ninguna organización ve a otra".
begin;

set search_path to public, extensions;

select plan(10);

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
  ('00000000-0000-0000-0000-0000000191a1', 'owner-lcm@kamay.test'),
  ('00000000-0000-0000-0000-0000000191a2', 'helper-lcm@kamay.test'),
  ('00000000-0000-0000-0000-0000000191b1', 'owner-lcm-b@kamay.test');

insert into organizations (id, name, timezone) values
  ('00000000-0000-0000-0000-0000000191b0', 'Movimientos A', 'America/La_Paz'),
  ('00000000-0000-0000-0000-0000000191b9', 'Movimientos B', 'America/La_Paz');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000191b0', '00000000-0000-0000-0000-0000000191a1', 'owner'),
  ('00000000-0000-0000-0000-0000000191b0', '00000000-0000-0000-0000-0000000191a2', 'assistant'),
  ('00000000-0000-0000-0000-0000000191b9', '00000000-0000-0000-0000-0000000191b1', 'owner');

insert into business_lines (id, organization_id, name, position) values
  ('00000000-0000-0000-0000-0000000191c1', '00000000-0000-0000-0000-0000000191b0', 'Sublimación', 1),
  ('00000000-0000-0000-0000-0000000191c2', '00000000-0000-0000-0000-0000000191b0', 'Alfarería',   2),
  ('00000000-0000-0000-0000-0000000191c9', '00000000-0000-0000-0000-0000000191b9', 'Sublimación', 1);

insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-0000000191d1', '00000000-0000-0000-0000-0000000191b0', '00000000-0000-0000-0000-0000000191c1', 'order', 'Registrado', 'initial', 1),
  ('00000000-0000-0000-0000-0000000191d9', '00000000-0000-0000-0000-0000000191b9', '00000000-0000-0000-0000-0000000191c9', 'order', 'Registrado', 'initial', 1);

insert into expense_categories (id, organization_id, name) values
  ('00000000-0000-0000-0000-0000000191e1', '00000000-0000-0000-0000-0000000191b0', 'Servicios');

insert into contacts (id, organization_id, name, is_customer, is_supplier) values
  ('00000000-0000-0000-0000-0000000191f1', '00000000-0000-0000-0000-0000000191b0', 'Cliente', true, true),
  ('00000000-0000-0000-0000-0000000191f9', '00000000-0000-0000-0000-0000000191b9', 'Cliente B', true, false);

insert into items (id, organization_id, business_line_id, kind, name) values
  ('00000000-0000-0000-0000-000000019101', '00000000-0000-0000-0000-0000000191b0', '00000000-0000-0000-0000-0000000191c1', 'product', 'Taza'),
  ('00000000-0000-0000-0000-000000019102', '00000000-0000-0000-0000-0000000191b0', '00000000-0000-0000-0000-0000000191c2', 'asset',   'Horno');

insert into asset_details (item_id, organization_id, acquisition_cost, acquired_on) values
  ('00000000-0000-0000-0000-000000019102', '00000000-0000-0000-0000-0000000191b0', 4000, date '2026-01-01');

insert into orders (id, organization_id, business_line_id, kind, contact_id, status_id, occurred_at) values
  ('00000000-0000-0000-0000-000000019201', '00000000-0000-0000-0000-0000000191b0',
   '00000000-0000-0000-0000-0000000191c1', 'order',
   '00000000-0000-0000-0000-0000000191f1', '00000000-0000-0000-0000-0000000191d1', '2026-02-01 12:00:00-04'),
  -- Pedido archivado: su cobro no debe aparecer.
  ('00000000-0000-0000-0000-000000019202', '00000000-0000-0000-0000-0000000191b0',
   '00000000-0000-0000-0000-0000000191c1', 'order',
   '00000000-0000-0000-0000-0000000191f1', '00000000-0000-0000-0000-0000000191d1', '2026-02-01 12:00:00-04'),
  ('00000000-0000-0000-0000-000000019901', '00000000-0000-0000-0000-0000000191b9',
   '00000000-0000-0000-0000-0000000191c9', 'order',
   '00000000-0000-0000-0000-0000000191f9', '00000000-0000-0000-0000-0000000191d9', '2026-02-01 12:00:00-04');

insert into order_items (organization_id, order_id, item_id, quantity, unit_price) values
  ('00000000-0000-0000-0000-0000000191b0', '00000000-0000-0000-0000-000000019201', '00000000-0000-0000-0000-000000019101', 1, 900),
  ('00000000-0000-0000-0000-0000000191b0', '00000000-0000-0000-0000-000000019202', '00000000-0000-0000-0000-000000019101', 1, 70);

-- Un gasto corriente de Alfarería y un mantenimiento del horno de la misma línea.
insert into expenses (id, organization_id, business_line_id, kind, expense_category_id, amount, occurred_at,
                      asset_id, asset_expense_role) values
  ('00000000-0000-0000-0000-000000019301', '00000000-0000-0000-0000-0000000191b0',
   '00000000-0000-0000-0000-0000000191c2', 'expense',
   '00000000-0000-0000-0000-0000000191e1', 350, '2026-02-05 12:00:00-04', null, null),
  ('00000000-0000-0000-0000-000000019302', '00000000-0000-0000-0000-0000000191b0',
   '00000000-0000-0000-0000-0000000191c2', 'expense',
   '00000000-0000-0000-0000-0000000191e1', 500, '2026-02-06 12:00:00-04',
   '00000000-0000-0000-0000-000000019102', 'maintenance');

insert into payments (id, organization_id, direction, order_id, expense_id, amount, occurred_at) values
  ('00000000-0000-0000-0000-000000019401', '00000000-0000-0000-0000-0000000191b0', 'in',
   '00000000-0000-0000-0000-000000019201', null, 900, '2026-02-03 12:00:00-04'),
  -- Cobro del pedido archivado.
  ('00000000-0000-0000-0000-000000019402', '00000000-0000-0000-0000-0000000191b0', 'in',
   '00000000-0000-0000-0000-000000019202', null, 70,  '2026-02-04 12:00:00-04'),
  -- Cobro que se archivará: tampoco debe aparecer.
  ('00000000-0000-0000-0000-000000019403', '00000000-0000-0000-0000-0000000191b0', 'in',
   '00000000-0000-0000-0000-000000019201', null, 40,  '2026-02-07 12:00:00-04'),
  ('00000000-0000-0000-0000-000000019404', '00000000-0000-0000-0000-0000000191b0', 'out',
   null, '00000000-0000-0000-0000-000000019301', 350, '2026-02-05 12:00:00-04'),
  ('00000000-0000-0000-0000-000000019405', '00000000-0000-0000-0000-0000000191b0', 'out',
   null, '00000000-0000-0000-0000-000000019302', 500, '2026-02-06 12:00:00-04'),
  ('00000000-0000-0000-0000-000000019901', '00000000-0000-0000-0000-0000000191b9', 'in',
   '00000000-0000-0000-0000-000000019901', null, 1000, '2026-02-03 12:00:00-04');

update orders   set archived_at = now() where id = '00000000-0000-0000-0000-000000019202';
update payments set archived_at = now() where id = '00000000-0000-0000-0000-000000019403';

-- ── Scenario: Un movimiento por fila con su línea ─────────────────────────

select pg_temp.login('00000000-0000-0000-0000-0000000191a1');

select is(
  (select count(*) from line_cash_movements
    where business_line_id = '00000000-0000-0000-0000-0000000191c1' and direction = 'in'),
  1::bigint,
  'El cobro del pedido de Sublimación es una fila con la línea de su pedido');

select is(
  (select count(*) from line_cash_movements
    where business_line_id = '00000000-0000-0000-0000-0000000191c2' and direction = 'out'),
  2::bigint,
  'Los pagos de egresos de Alfarería llevan la línea de su egreso');

-- ── Scenario: El activo del pago aparece en la fila ───────────────────────

select is(
  (select asset_id from line_cash_movements where amount = 500 and direction = 'out'),
  '00000000-0000-0000-0000-000000019102'::uuid,
  'El pago de un mantenimiento identifica su activo');

-- ── Scenario: Un pago corriente no señala ningún activo ───────────────────

select is(
  (select asset_id from line_cash_movements where amount = 350 and direction = 'out'),
  null::uuid,
  'El pago de un egreso corriente no identifica ningún activo');

-- ── Scenario: Lo archivado no aparece ─────────────────────────────────────

select is(
  (select count(*) from line_cash_movements where amount = 40),
  0::bigint,
  'Un cobro archivado desaparece del derivado');

select is(
  (select count(*) from line_cash_movements where amount = 70),
  0::bigint,
  'El cobro de un pedido archivado tampoco aparece');

-- ── Scenario: El agregado mensual coincide con el detalle ─────────────────

select is(
  (select sum(m.amount) filter (where m.direction = 'in')
     from line_cash_movements m
    where m.business_line_id = '00000000-0000-0000-0000-0000000191c1'),
  (select collected from cash_flow_by_line_month
    where business_line_id = '00000000-0000-0000-0000-0000000191c1'),
  'Lo cobrado sumado del detalle coincide con el agregado mensual');

select is(
  (select sum(m.amount) filter (where m.direction = 'out')
     from line_cash_movements m
    where m.business_line_id = '00000000-0000-0000-0000-0000000191c2'),
  (select paid from cash_flow_by_line_month
    where business_line_id = '00000000-0000-0000-0000-0000000191c2'),
  'Lo pagado sumado del detalle coincide con el agregado mensual');

select pg_temp.logout();

-- ── Scenario: El ayudante obtiene cero filas ──────────────────────────────

select pg_temp.login('00000000-0000-0000-0000-0000000191a2');

select is(
  (select count(*) from line_cash_movements),
  0::bigint,
  'El ayudante obtiene cero filas del derivado de movimientos');

select pg_temp.logout();

-- ── Scenario: Ninguna organización ve a otra ──────────────────────────────

select pg_temp.login('00000000-0000-0000-0000-0000000191b1');

select is(
  (select count(*) from line_cash_movements
    where organization_id = '00000000-0000-0000-0000-0000000191b0'),
  0::bigint,
  'La persona dueña de otra organización no ve estos movimientos');

select pg_temp.logout();

select * from finish();
rollback;
