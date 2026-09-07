-- KAM-14 · Vista derivada `cash_flow_by_line_month`.
-- Escenarios del delta spec `payments` § Flujo de caja del periodo por línea:
--   "Cobrado y pagado del mes", "Cada movimiento cae en el mes en que
--   ocurrió", "El movimiento anulado no suma", "La línea la pone el destino",
--   "El ayudante obtiene cero filas", "Ninguna organización ve a otra",
--   "Un mes sin movimiento no inventa filas".
-- Escenario del delta spec `dashboard` § La variante del ayudante es un
--   diseño propio, sin dinero y sin huecos: "Tampoco por consulta directa".
begin;

set search_path to public, extensions;

select plan(16);

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
-- Zona horaria explícita: la vista corta el mes en la de la organización, así
-- que una prueba que dependiera de la del servidor no probaría nada.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000014a1', 'owner-cash@kamay.test'),
  ('00000000-0000-0000-0000-0000000014a2', 'helper-cash@kamay.test'),
  ('00000000-0000-0000-0000-0000000014a3', 'owner-cash-b@kamay.test');

insert into organizations (id, name, timezone) values
  ('00000000-0000-0000-0000-0000000014b0', 'Caja A', 'America/La_Paz'),
  ('00000000-0000-0000-0000-0000000014b9', 'Caja B', 'America/La_Paz');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000014b0', '00000000-0000-0000-0000-0000000014a1', 'owner'),
  ('00000000-0000-0000-0000-0000000014b0', '00000000-0000-0000-0000-0000000014a2', 'assistant'),
  ('00000000-0000-0000-0000-0000000014b9', '00000000-0000-0000-0000-0000000014a3', 'owner');

insert into business_lines (id, organization_id, name, position) values
  ('00000000-0000-0000-0000-0000000014c1', '00000000-0000-0000-0000-0000000014b0', 'Sublimación', 1),
  ('00000000-0000-0000-0000-0000000014c2', '00000000-0000-0000-0000-0000000014b0', 'Alfarería',   2),
  ('00000000-0000-0000-0000-0000000014c3', '00000000-0000-0000-0000-0000000014b0', 'Sin uso',     3),
  ('00000000-0000-0000-0000-0000000014c9', '00000000-0000-0000-0000-0000000014b9', 'Sublimación', 1);

insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-0000000014d1', '00000000-0000-0000-0000-0000000014b0', '00000000-0000-0000-0000-0000000014c1', 'order', 'Registrado', 'initial', 1),
  ('00000000-0000-0000-0000-0000000014d2', '00000000-0000-0000-0000-0000000014b0', '00000000-0000-0000-0000-0000000014c2', 'order', 'Registrado', 'initial', 1),
  ('00000000-0000-0000-0000-0000000014d9', '00000000-0000-0000-0000-0000000014b9', '00000000-0000-0000-0000-0000000014c9', 'order', 'Registrado', 'initial', 1);

insert into expense_categories (id, organization_id, name) values
  ('00000000-0000-0000-0000-0000000014e1', '00000000-0000-0000-0000-0000000014b0', 'Servicios');

insert into contacts (id, organization_id, name, is_customer) values
  ('00000000-0000-0000-0000-0000000014f1', '00000000-0000-0000-0000-0000000014b0', 'Cliente', true),
  ('00000000-0000-0000-0000-0000000014f9', '00000000-0000-0000-0000-0000000014b9', 'Cliente B', true);

insert into items (id, organization_id, business_line_id, kind, name) values
  ('00000000-0000-0000-0000-000000001401', '00000000-0000-0000-0000-0000000014b0', '00000000-0000-0000-0000-0000000014c1', 'product', 'Taza');

-- Pedido de Sublimación y pedido de Alfarería, ambos de la organización A.
insert into orders (id, organization_id, business_line_id, kind, contact_id, status_id, occurred_at) values
  ('00000000-0000-0000-0000-000000014101', '00000000-0000-0000-0000-0000000014b0',
   '00000000-0000-0000-0000-0000000014c1', 'order',
   '00000000-0000-0000-0000-0000000014f1', '00000000-0000-0000-0000-0000000014d1',
   '2026-01-15 12:00:00-04'),
  ('00000000-0000-0000-0000-000000014102', '00000000-0000-0000-0000-0000000014b0',
   '00000000-0000-0000-0000-0000000014c2', 'order',
   '00000000-0000-0000-0000-0000000014f1', '00000000-0000-0000-0000-0000000014d2',
   '2026-02-10 12:00:00-04'),
  -- Pedido archivado: su cobro no debe contar.
  ('00000000-0000-0000-0000-000000014103', '00000000-0000-0000-0000-0000000014b0',
   '00000000-0000-0000-0000-0000000014c1', 'order',
   '00000000-0000-0000-0000-0000000014f1', '00000000-0000-0000-0000-0000000014d1',
   '2026-02-11 12:00:00-04'),
  -- Organización B: nunca debe aparecer en las consultas de A.
  ('00000000-0000-0000-0000-000000014901', '00000000-0000-0000-0000-0000000014b9',
   '00000000-0000-0000-0000-0000000014c9', 'order',
   '00000000-0000-0000-0000-0000000014f9', '00000000-0000-0000-0000-0000000014d9',
   '2026-02-12 12:00:00-04');

insert into order_items (organization_id, order_id, item_id, quantity, unit_price) values
  ('00000000-0000-0000-0000-0000000014b0', '00000000-0000-0000-0000-000000014101', '00000000-0000-0000-0000-000000001401', 1, 900),
  ('00000000-0000-0000-0000-0000000014b0', '00000000-0000-0000-0000-000000014102', '00000000-0000-0000-0000-000000001401', 1, 500),
  ('00000000-0000-0000-0000-0000000014b0', '00000000-0000-0000-0000-000000014103', '00000000-0000-0000-0000-000000001401', 1, 70);

-- Egreso de Alfarería, para que el pagado tenga línea propia.
insert into expenses (id, organization_id, business_line_id, kind, expense_category_id, amount, occurred_at) values
  ('00000000-0000-0000-0000-000000014201', '00000000-0000-0000-0000-0000000014b0',
   '00000000-0000-0000-0000-0000000014c2', 'expense',
   '00000000-0000-0000-0000-0000000014e1', 350.00, '2026-02-05 12:00:00-04');

-- Movimientos de febrero de 2026, todos con hora del mediodía salvo el del
-- cambio de mes, que es el caso interesante de la zona horaria.
insert into payments (id, organization_id, direction, order_id, amount, occurred_at) values
  -- Sublimación: 300 + 600 = 900 cobrados en febrero, del pedido de enero.
  ('00000000-0000-0000-0000-000000014301', '00000000-0000-0000-0000-0000000014b0', 'in',
   '00000000-0000-0000-0000-000000014101', 300, '2026-02-03 12:00:00-04'),
  ('00000000-0000-0000-0000-000000014302', '00000000-0000-0000-0000-0000000014b0', 'in',
   '00000000-0000-0000-0000-000000014101', 600, '2026-02-20 12:00:00-04'),
  -- Alfarería: 120 cobrados en febrero.
  ('00000000-0000-0000-0000-000000014303', '00000000-0000-0000-0000-0000000014b0', 'in',
   '00000000-0000-0000-0000-000000014102', 120, '2026-02-14 12:00:00-04'),
  -- Cobro del pedido archivado: no cuenta.
  ('00000000-0000-0000-0000-000000014304', '00000000-0000-0000-0000-0000000014b0', 'in',
   '00000000-0000-0000-0000-000000014103', 70, '2026-02-11 12:00:00-04'),
  -- 28 de febrero a las 22:00 en La Paz = 1 de marzo a las 02:00 en UTC.
  -- En la zona de la organización pertenece a febrero, y ahí debe caer.
  ('00000000-0000-0000-0000-000000014305', '00000000-0000-0000-0000-0000000014b0', 'in',
   '00000000-0000-0000-0000-000000014101', 50, '2026-02-28 22:00:00-04'),
  -- Organización B.
  ('00000000-0000-0000-0000-000000014901', '00000000-0000-0000-0000-0000000014b9', 'in',
   '00000000-0000-0000-0000-000000014901', 4000, '2026-02-15 12:00:00-04');

insert into payments (id, organization_id, direction, expense_id, amount, occurred_at) values
  ('00000000-0000-0000-0000-000000014401', '00000000-0000-0000-0000-0000000014b0', 'out',
   '00000000-0000-0000-0000-000000014201', 350, '2026-02-06 12:00:00-04');

update orders set archived_at = now()
  where id = '00000000-0000-0000-0000-000000014103';

-- ── Forma de la vista ─────────────────────────────────────────────────────

select columns_are(
  'public', 'cash_flow_by_line_month',
  array['organization_id', 'business_line_id', 'month', 'collected', 'paid'],
  'cash_flow_by_line_month expone organización, línea, mes, cobrado y pagado'
);

-- ── Requirement: Flujo de caja del periodo por línea ──────────────────────

select pg_temp.login('00000000-0000-0000-0000-0000000014a1');

-- Scenario: Cobrado y pagado del mes
-- Sublimación cobró 300 + 600 (+ 50 del último día, comprobado aparte).
select is(
  (select collected from cash_flow_by_line_month
    where business_line_id = '00000000-0000-0000-0000-0000000014c1'
      and month = date '2026-02-01'),
  950::numeric,
  'Scenario: Cobrado y pagado del mes — el cobrado de la línea suma sus movimientos'
);

select is(
  (select paid from cash_flow_by_line_month
    where business_line_id = '00000000-0000-0000-0000-0000000014c2'
      and month = date '2026-02-01'),
  350::numeric,
  'Scenario: Cobrado y pagado del mes — el pagado de la línea suma sus movimientos'
);

select is(
  (select paid from cash_flow_by_line_month
    where business_line_id = '00000000-0000-0000-0000-0000000014c1'
      and month = date '2026-02-01'),
  0::numeric,
  'Scenario: Cobrado y pagado del mes — una línea sin pagos da 0, no nulo'
);

-- Scenario: Cada movimiento cae en el mes en que ocurrió
-- El pedido es de enero; su cobro, de febrero. Enero no tiene ninguna fila.
select is(
  (select count(*) from cash_flow_by_line_month where month = date '2026-01-01'),
  0::bigint,
  'Scenario: Cada movimiento cae en el mes en que ocurrió — el mes del pedido no cuenta, cuenta el del cobro'
);

-- El cobro de las 22:00 del 28 de febrero en La Paz es 1 de marzo en UTC:
-- si el corte usara la zona del servidor, marzo tendría una fila.
select is(
  (select count(*) from cash_flow_by_line_month where month = date '2026-03-01'),
  0::bigint,
  'Scenario: Cada movimiento cae en el mes en que ocurrió — el corte usa la zona horaria de la organización'
);

-- Scenario: La línea la pone el destino
select is(
  (select collected from cash_flow_by_line_month
    where business_line_id = '00000000-0000-0000-0000-0000000014c2'
      and month = date '2026-02-01'),
  120::numeric,
  'Scenario: La línea la pone el destino — el cobro suma en la línea de su pedido'
);

select is(
  (select count(*) from cash_flow_by_line_month
    where business_line_id = '00000000-0000-0000-0000-0000000014c1'
      and month = date '2026-02-01'
      and paid > 0),
  0::bigint,
  'Scenario: La línea la pone el destino — el pago suma en la línea de su egreso y no en otra'
);

-- Scenario: Un mes sin movimiento no inventa filas
select is(
  (select count(*) from cash_flow_by_line_month
    where business_line_id = '00000000-0000-0000-0000-0000000014c3'),
  0::bigint,
  'Scenario: Un mes sin movimiento no inventa filas — la línea sin movimientos no aparece'
);

-- Scenario: El movimiento anulado no suma
update payments set archived_at = now()
  where id = '00000000-0000-0000-0000-000000014302';

select is(
  (select collected from cash_flow_by_line_month
    where business_line_id = '00000000-0000-0000-0000-0000000014c1'
      and month = date '2026-02-01'),
  350::numeric,
  'Scenario: El movimiento anulado no suma — el cobrado baja en su importe'
);

-- El cobro del pedido archivado (70) nunca entró en esa suma: 300 + 50 = 350.
select is(
  (select collected from cash_flow_by_line_month
    where business_line_id = '00000000-0000-0000-0000-0000000014c1'
      and month = date '2026-02-01'),
  350::numeric,
  'Scenario: El movimiento anulado no suma — el cobro de un pedido archivado tampoco contaba'
);

-- Scenario: Ninguna organización ve a otra
select is(
  (select count(*) from cash_flow_by_line_month
    where organization_id = '00000000-0000-0000-0000-0000000014b9'),
  0::bigint,
  'Scenario: Ninguna organización ve a otra — la persona dueña de A no ve filas de B'
);

select is(
  (select count(distinct organization_id) from cash_flow_by_line_month),
  1::bigint,
  'Scenario: Ninguna organización ve a otra — solo aparece la organización propia'
);

select pg_temp.logout();

-- ── Requirement: El ayudante obtiene cero filas ───────────────────────────
-- Y con él, el escenario "Tampoco por consulta directa" del spec `dashboard`.
-- La distinción importa: cero filas por recorte no es lo mismo que cero filas
-- por mes sin movimiento, y el ayudante consulta el mismo mes en el que la
-- persona dueña sí ve datos.

select pg_temp.login('00000000-0000-0000-0000-0000000014a2');

select is(
  (select count(*) from cash_flow_by_line_month),
  0::bigint,
  'Scenario: El ayudante obtiene cero filas — la vista no le devuelve nada'
);

-- Que sí lee los cobros individuales es justamente lo que hace insuficiente
-- `security_invoker` y necesaria la condición `is_owner` dentro de la vista.
select isnt(
  (select count(*) from payments where direction = 'in'),
  0::bigint,
  'Scenario: El ayudante obtiene cero filas — aunque sí lee los cobros que registró'
);

select pg_temp.logout();

-- La persona dueña sigue viendo ese mismo mes: cero filas del ayudante es
-- recorte, no ausencia de datos.
select pg_temp.login('00000000-0000-0000-0000-0000000014a1');

select isnt(
  (select count(*) from cash_flow_by_line_month where month = date '2026-02-01'),
  0::bigint,
  'Scenario: El ayudante obtiene cero filas — el mismo mes sí tiene filas para la persona dueña'
);

select pg_temp.logout();

select * from finish();
rollback;
