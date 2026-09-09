-- KAM-19 · assets: costo total, margen de caja desde la adquisición y la
-- regla de que la inversión cuenta una sola vez.
-- Escenarios del delta spec `assets`:
--   "El costo total del activo suma su mantenimiento" → "Mantenimiento
--   vinculado", "El egreso de adquisición no se cuenta dos veces",
--   "Mantenimiento archivado", "El costo total no vive en una columna";
--   "El margen que recupera la inversión se mide en caja desde la fecha de
--   adquisición" → "Solo desde la fecha de adquisición", "Manda la fecha del
--   movimiento de dinero", "Entregado y no cobrado todavía no recupera", "Lo
--   anulado deja de contar", "Cada activo mira su propia línea";
--   "La inversión cuenta una sola vez" → sus cuatro escenarios;
--   "Activos solo para la persona dueña" → "El ayudante tampoco lee la
--   recuperación".
begin;

set search_path to public, extensions;

select plan(13);

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
-- Zona horaria explícita: el corte por `acquired_on` se hace en la del taller.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000192a1', 'owner-rec@kamay.test'),
  ('00000000-0000-0000-0000-0000000192a2', 'helper-rec@kamay.test');

insert into organizations (id, name, timezone) values
  ('00000000-0000-0000-0000-0000000192b0', 'Recuperación A', 'America/La_Paz');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000192b0', '00000000-0000-0000-0000-0000000192a1', 'owner'),
  ('00000000-0000-0000-0000-0000000192b0', '00000000-0000-0000-0000-0000000192a2', 'assistant');

insert into business_lines (id, organization_id, name, position) values
  ('00000000-0000-0000-0000-0000000192c1', '00000000-0000-0000-0000-0000000192b0', 'Impresión 3D', 1),
  ('00000000-0000-0000-0000-0000000192c2', '00000000-0000-0000-0000-0000000192b0', 'Alfarería',    2);

insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-0000000192d1', '00000000-0000-0000-0000-0000000192b0', '00000000-0000-0000-0000-0000000192c1', 'order', 'Registrado', 'initial', 1),
  ('00000000-0000-0000-0000-0000000192d2', '00000000-0000-0000-0000-0000000192b0', '00000000-0000-0000-0000-0000000192c2', 'order', 'Registrado', 'initial', 1);

insert into expense_categories (id, organization_id, name) values
  ('00000000-0000-0000-0000-0000000192e1', '00000000-0000-0000-0000-0000000192b0', 'Servicios');

insert into contacts (id, organization_id, name, is_customer, is_supplier) values
  ('00000000-0000-0000-0000-0000000192f1', '00000000-0000-0000-0000-0000000192b0', 'Cliente',   true,  false),
  ('00000000-0000-0000-0000-0000000192f2', '00000000-0000-0000-0000-0000000192b0', 'Proveedor', false, true);

insert into items (id, organization_id, business_line_id, kind, name) values
  ('00000000-0000-0000-0000-000000019201', '00000000-0000-0000-0000-0000000192b0', '00000000-0000-0000-0000-0000000192c1', 'product', 'Figura'),
  ('00000000-0000-0000-0000-000000019202', '00000000-0000-0000-0000-0000000192b0', '00000000-0000-0000-0000-0000000192c1', 'asset',   'Impresora 3D'),
  ('00000000-0000-0000-0000-000000019203', '00000000-0000-0000-0000-0000000192b0', '00000000-0000-0000-0000-0000000192c1', 'asset',   'Plotter'),
  ('00000000-0000-0000-0000-000000019204', '00000000-0000-0000-0000-0000000192b0', '00000000-0000-0000-0000-0000000192c2', 'product', 'Maceta'),
  ('00000000-0000-0000-0000-000000019205', '00000000-0000-0000-0000-0000000192b0', '00000000-0000-0000-0000-0000000192c2', 'asset',   'Horno');

insert into asset_details (item_id, organization_id, acquisition_cost, acquired_on) values
  ('00000000-0000-0000-0000-000000019202', '00000000-0000-0000-0000-0000000192b0', 7000, date '2026-03-01'),
  -- Adquirido más tarde que la impresora: solo ve lo cobrado desde el día 16.
  ('00000000-0000-0000-0000-000000019203', '00000000-0000-0000-0000-0000000192b0', 1000, date '2026-03-16'),
  ('00000000-0000-0000-0000-000000019205', '00000000-0000-0000-0000-0000000192b0', 2000, date '2026-03-01');

insert into orders (id, organization_id, business_line_id, kind, contact_id, status_id, occurred_at) values
  -- Entregado y cobrado antes de la adquisición: no recupera nada.
  ('00000000-0000-0000-0000-000000019221', '00000000-0000-0000-0000-0000000192b0', '00000000-0000-0000-0000-0000000192c1',
   'order', '00000000-0000-0000-0000-0000000192f1', '00000000-0000-0000-0000-0000000192d1', '2026-02-01 12:00:00-04'),
  -- Entregado antes de la adquisición pero cobrado después: sí recupera.
  ('00000000-0000-0000-0000-000000019222', '00000000-0000-0000-0000-0000000192b0', '00000000-0000-0000-0000-0000000192c1',
   'order', '00000000-0000-0000-0000-0000000192f1', '00000000-0000-0000-0000-0000000192d1', '2026-02-20 12:00:00-04'),
  -- Entregado después de la adquisición y sin cobrar: no recupera todavía.
  ('00000000-0000-0000-0000-000000019223', '00000000-0000-0000-0000-0000000192b0', '00000000-0000-0000-0000-0000000192c1',
   'order', '00000000-0000-0000-0000-0000000192f1', '00000000-0000-0000-0000-0000000192d1', '2026-03-10 12:00:00-04'),
  ('00000000-0000-0000-0000-000000019224', '00000000-0000-0000-0000-0000000192b0', '00000000-0000-0000-0000-0000000192c1',
   'order', '00000000-0000-0000-0000-0000000192f1', '00000000-0000-0000-0000-0000000192d1', '2026-03-15 12:00:00-04'),
  -- Alfarería, para que cada activo mire su propia línea.
  ('00000000-0000-0000-0000-000000019225', '00000000-0000-0000-0000-0000000192b0', '00000000-0000-0000-0000-0000000192c2',
   'order', '00000000-0000-0000-0000-0000000192f1', '00000000-0000-0000-0000-0000000192d2', '2026-03-02 12:00:00-04');

insert into order_items (organization_id, order_id, item_id, quantity, unit_price) values
  ('00000000-0000-0000-0000-0000000192b0', '00000000-0000-0000-0000-000000019221', '00000000-0000-0000-0000-000000019201', 1, 1000),
  ('00000000-0000-0000-0000-0000000192b0', '00000000-0000-0000-0000-000000019222', '00000000-0000-0000-0000-000000019201', 1, 3000),
  ('00000000-0000-0000-0000-0000000192b0', '00000000-0000-0000-0000-000000019223', '00000000-0000-0000-0000-000000019201', 1, 5000),
  ('00000000-0000-0000-0000-0000000192b0', '00000000-0000-0000-0000-000000019224', '00000000-0000-0000-0000-000000019201', 1, 4500),
  ('00000000-0000-0000-0000-0000000192b0', '00000000-0000-0000-0000-000000019225', '00000000-0000-0000-0000-000000019204', 1, 800);

-- La compra de la impresora: una compra real con su línea, declarada como el
-- egreso de adquisición del activo.
insert into expenses (id, organization_id, business_line_id, kind, contact_id, occurred_at,
                      asset_id, asset_expense_role) values
  ('00000000-0000-0000-0000-000000019231', '00000000-0000-0000-0000-0000000192b0', '00000000-0000-0000-0000-0000000192c1',
   'purchase', '00000000-0000-0000-0000-0000000192f2', '2026-03-01 12:00:00-04',
   '00000000-0000-0000-0000-000000019202', 'acquisition');

insert into expense_items (organization_id, expense_id, item_id, quantity, unit_price) values
  ('00000000-0000-0000-0000-0000000192b0', '00000000-0000-0000-0000-000000019231',
   '00000000-0000-0000-0000-000000019202', 1, 7000);

-- Un gasto corriente de la línea: este sí resta del margen.
insert into expenses (id, organization_id, business_line_id, kind, expense_category_id, amount, occurred_at) values
  ('00000000-0000-0000-0000-000000019232', '00000000-0000-0000-0000-0000000192b0', '00000000-0000-0000-0000-0000000192c1',
   'expense', '00000000-0000-0000-0000-0000000192e1', 300, '2026-03-12 12:00:00-04');

insert into payments (id, organization_id, direction, order_id, expense_id, amount, occurred_at) values
  ('00000000-0000-0000-0000-000000019241', '00000000-0000-0000-0000-0000000192b0', 'in',
   '00000000-0000-0000-0000-000000019221', null, 1000, '2026-02-10 12:00:00-04'),
  ('00000000-0000-0000-0000-000000019242', '00000000-0000-0000-0000-0000000192b0', 'in',
   '00000000-0000-0000-0000-000000019222', null, 3000, '2026-03-05 12:00:00-04'),
  ('00000000-0000-0000-0000-000000019243', '00000000-0000-0000-0000-0000000192b0', 'in',
   '00000000-0000-0000-0000-000000019224', null, 4000, '2026-03-20 12:00:00-04'),
  -- Cobro que se anula: no debe contar para ninguna barra.
  ('00000000-0000-0000-0000-000000019244', '00000000-0000-0000-0000-0000000192b0', 'in',
   '00000000-0000-0000-0000-000000019224', null, 500,  '2026-03-21 12:00:00-04'),
  ('00000000-0000-0000-0000-000000019245', '00000000-0000-0000-0000-0000000192b0', 'in',
   '00000000-0000-0000-0000-000000019225', null, 800,  '2026-03-05 12:00:00-04'),
  ('00000000-0000-0000-0000-000000019246', '00000000-0000-0000-0000-0000000192b0', 'out',
   null, '00000000-0000-0000-0000-000000019231', 7000, '2026-03-01 12:00:00-04'),
  ('00000000-0000-0000-0000-000000019247', '00000000-0000-0000-0000-0000000192b0', 'out',
   null, '00000000-0000-0000-0000-000000019232', 300,  '2026-03-12 12:00:00-04');

update payments set archived_at = now() where id = '00000000-0000-0000-0000-000000019244';

select pg_temp.login('00000000-0000-0000-0000-0000000192a1');

-- ── Scenario: El egreso de adquisición no se cuenta dos veces ─────────────

select is(
  (select total_cost from asset_recovery where item_id = '00000000-0000-0000-0000-000000019202'),
  7000::numeric,
  'El costo total es el declarado: la compra vinculada no lo duplica');

-- ── Scenario: La compra de la máquina no castiga su propia barra ──────────
-- Cobrado desde el 1 de marzo: 3000 + 4000 = 7000. Pagado que no pertenece a
-- ningún activo: 300. Margen 6700. Si los 7000 de la compra restaran, sería
-- −300 y la máquina tendría que generar el doble de su costo.

select is(
  (select line_margin_since from asset_recovery where item_id = '00000000-0000-0000-0000-000000019202'),
  6700::numeric,
  'El pago de la propia compra no resta del margen con el que se mide');

-- ── Scenario: Solo desde la fecha de adquisición / Lo anulado deja de contar

select is(
  (select line_margin_since from asset_recovery where item_id = '00000000-0000-0000-0000-000000019203'),
  4000::numeric,
  'El plotter solo ve lo cobrado desde el 16 de marzo, y el cobro anulado no cuenta');

-- ── Scenario: Entregado y no cobrado todavía no recupera ──────────────────

select is(
  (select total from order_totals where order_id = '00000000-0000-0000-0000-000000019223'),
  5000::numeric,
  'Existe un pedido entregado tras la adquisición y sin cobrar, por 5000');

select is(
  (select line_margin_since from asset_recovery where item_id = '00000000-0000-0000-0000-000000019202'),
  6700::numeric,
  'Ese pedido no entra en el margen: sería 11700 si la base fuera devengada');

-- ── Scenario: Cada activo mira su propia línea ────────────────────────────

select is(
  (select line_margin_since from asset_recovery where item_id = '00000000-0000-0000-0000-000000019205'),
  800::numeric,
  'El horno se mide contra el margen de Alfarería, no contra el de la organización');

-- ── Scenario: Un egreso corriente sí resta ────────────────────────────────

select is(
  (select sum(m.amount) from line_cash_movements m
    where m.business_line_id = '00000000-0000-0000-0000-0000000192c1'
      and m.direction = 'out'
      and m.asset_id is null),
  300::numeric,
  'De los pagos de la línea, solo el gasto corriente entra en el margen');

select pg_temp.logout();

-- ── Aparece un mantenimiento ──────────────────────────────────────────────

insert into expenses (id, organization_id, business_line_id, kind, expense_category_id, amount, occurred_at,
                      asset_id, asset_expense_role) values
  ('00000000-0000-0000-0000-000000019233', '00000000-0000-0000-0000-0000000192b0', '00000000-0000-0000-0000-0000000192c1',
   'expense', '00000000-0000-0000-0000-0000000192e1', 500, '2026-03-11 12:00:00-04',
   '00000000-0000-0000-0000-000000019202', 'maintenance');

insert into payments (id, organization_id, direction, expense_id, amount, occurred_at) values
  ('00000000-0000-0000-0000-000000019248', '00000000-0000-0000-0000-0000000192b0', 'out',
   '00000000-0000-0000-0000-000000019233', 500, '2026-03-11 12:00:00-04');

select pg_temp.login('00000000-0000-0000-0000-0000000192a1');

-- ── Scenario: El panel sigue viendo la salida de caja ─────────────────────
-- 7000 de la compra + 300 del gasto corriente + 500 del mantenimiento.

select is(
  (select paid from cash_flow_by_line_month
    where business_line_id = '00000000-0000-0000-0000-0000000192c1'
      and month = date '2026-03-01'),
  7800::numeric,
  'El agregado del panel cuenta la compra de la máquina y su mantenimiento');

-- ── Scenario: Mantenimiento vinculado ─────────────────────────────────────

select is(
  (select total_cost from asset_recovery where item_id = '00000000-0000-0000-0000-000000019202'),
  7500::numeric,
  'El mantenimiento de 500 sube el costo total a 7500');

-- ── Scenario: El mantenimiento sube el costo pero no baja el margen ───────

select is(
  (select line_margin_since from asset_recovery where item_id = '00000000-0000-0000-0000-000000019202'),
  6700::numeric,
  'Y su pago no baja el margen con el que se mide el activo');

select pg_temp.logout();

-- ── Scenario: Mantenimiento archivado ─────────────────────────────────────

update expenses set archived_at = now() where id = '00000000-0000-0000-0000-000000019233';

select pg_temp.login('00000000-0000-0000-0000-0000000192a1');

select is(
  (select total_cost from asset_recovery where item_id = '00000000-0000-0000-0000-000000019202'),
  7000::numeric,
  'Archivar el mantenimiento lo retira del costo total del activo');

select pg_temp.logout();

-- ── Scenario: El costo total no vive en una columna ───────────────────────

select is(
  (select count(*)::int from information_schema.columns
    where table_schema = 'public'
      and table_name in ('asset_details', 'items')
      and column_name ~ '(total|maintenance|mantenimiento|recovery|recuper|margin|margen|progress)'),
  0,
  'Ninguna tabla guarda el costo total, el mantenimiento ni la recuperación');

-- ── Scenario: El ayudante tampoco lee la recuperación ─────────────────────

select pg_temp.login('00000000-0000-0000-0000-0000000192a2');

select is(
  (select count(*) from asset_recovery),
  0::bigint,
  'El ayudante obtiene cero filas del derivado de recuperación');

select pg_temp.logout();

select * from finish();
rollback;
