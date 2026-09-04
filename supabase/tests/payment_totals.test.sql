-- KAM-10 · `paid` en los totales derivados e indicadores Por cobrar / Por
-- pagar.
-- Escenarios del delta spec `payments`: "El saldo pendiente se deriva y nunca
-- se almacena" e "Indicadores agregados Por cobrar y Por pagar".
-- Escenarios del delta spec `orders`: "El total del pedido se deriva, nunca se
-- almacena" (cobrado con anticipo, pedido sin cobros, la vista sigue
-- respetando al invocante, ninguna columna almacena el derivado).
begin;

set search_path to public, extensions;

select plan(25);

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
  ('00000000-0000-0000-0000-0000000011a1', 'owner-tot@kamay.test'),
  ('00000000-0000-0000-0000-0000000011a2', 'helper-tot@kamay.test'),
  ('00000000-0000-0000-0000-0000000011a3', 'owner-tot-b@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-0000000000b0', 'Totales A'),
  ('00000000-0000-0000-0000-0000000000b9', 'Totales B');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-0000000011a1', 'owner'),
  ('00000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-0000000011a2', 'assistant'),
  ('00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-0000000011a3', 'owner');

insert into business_lines (id, organization_id, name, position) values
  ('00000000-0000-0000-0000-0000000011b1', '00000000-0000-0000-0000-0000000000b0', 'Sublimación', 1),
  ('00000000-0000-0000-0000-0000000011b2', '00000000-0000-0000-0000-0000000000b0', 'Alfarería',   2);

insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-0000000011c1', '00000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-0000000011b1', 'order', 'Registrado', 'initial', 1),
  ('00000000-0000-0000-0000-0000000011c2', '00000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-0000000011b2', 'order', 'Registrado', 'initial', 1);

insert into expense_categories (id, organization_id, name) values
  ('00000000-0000-0000-0000-0000000011d1', '00000000-0000-0000-0000-0000000000b0', 'Servicios');

insert into contacts (id, organization_id, name, is_customer) values
  ('00000000-0000-0000-0000-0000000011e1', '00000000-0000-0000-0000-0000000000b0', 'Cliente', true);

insert into items (id, organization_id, business_line_id, kind, name) values
  ('00000000-0000-0000-0000-0000000011f1', '00000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-0000000011b1', 'product', 'Taza');

-- Pedido A: total 115 (3 × 25 + 1 × 40), con un anticipo de 40.
insert into orders (id, organization_id, business_line_id, kind, contact_id, status_id) values
  ('00000000-0000-0000-0000-000000011001', '00000000-0000-0000-0000-0000000000b0',
   '00000000-0000-0000-0000-0000000011b1', 'order',
   '00000000-0000-0000-0000-0000000011e1', '00000000-0000-0000-0000-0000000011c1');

insert into order_items (organization_id, order_id, item_id, quantity, unit_price) values
  ('00000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-000000011001', '00000000-0000-0000-0000-0000000011f1', 3, 25),
  ('00000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-000000011001', '00000000-0000-0000-0000-0000000011f1', 1, 40);

-- Pedido B: total 50, sin ningún cobro.
insert into orders (id, organization_id, business_line_id, kind, contact_id, status_id) values
  ('00000000-0000-0000-0000-000000011002', '00000000-0000-0000-0000-0000000000b0',
   '00000000-0000-0000-0000-0000000011b1', 'order',
   '00000000-0000-0000-0000-0000000011e1', '00000000-0000-0000-0000-0000000011c1');

insert into order_items (organization_id, order_id, item_id, quantity, unit_price) values
  ('00000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-000000011002', '00000000-0000-0000-0000-0000000011f1', 1, 50);

-- Pedido C, de otra línea: total 30, cobrado 30.
insert into orders (id, organization_id, business_line_id, kind, contact_id, status_id) values
  ('00000000-0000-0000-0000-000000011003', '00000000-0000-0000-0000-0000000000b0',
   '00000000-0000-0000-0000-0000000011b2', 'order',
   '00000000-0000-0000-0000-0000000011e1', '00000000-0000-0000-0000-0000000011c2');

insert into order_items (organization_id, order_id, item_id, quantity, unit_price) values
  ('00000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-000000011003', '00000000-0000-0000-0000-0000000011f1', 1, 30);

-- Egreso: gasto de 500, pagado 200.
insert into expenses (id, organization_id, business_line_id, kind, expense_category_id, amount) values
  ('00000000-0000-0000-0000-000000011f01', '00000000-0000-0000-0000-0000000000b0',
   '00000000-0000-0000-0000-0000000011b1', 'expense',
   '00000000-0000-0000-0000-0000000011d1', 500.00);

insert into payments (id, organization_id, direction, order_id, amount) values
  ('00000000-0000-0000-0000-000000012001', '00000000-0000-0000-0000-0000000000b0', 'in', '00000000-0000-0000-0000-000000011001', 40),
  ('00000000-0000-0000-0000-000000012003', '00000000-0000-0000-0000-0000000000b0', 'in', '00000000-0000-0000-0000-000000011003', 30);

insert into payments (id, organization_id, direction, expense_id, amount) values
  ('00000000-0000-0000-0000-000000012004', '00000000-0000-0000-0000-0000000000b0', 'out', '00000000-0000-0000-0000-000000011f01', 200);

-- ── La forma de las vistas tras el `create or replace` ────────────────────
-- `paid` va AL FINAL: si alguien reordena, el fallo aparece aquí y no en una
-- consulta de la aplicación devolviendo la columna equivocada.

select columns_are(
  'public', 'order_totals',
  array['order_id', 'organization_id', 'business_line_id', 'kind', 'occurred_at', 'total', 'paid'],
  'order_totals conserva sus columnas y `paid` se añade al final'
);

select columns_are(
  'public', 'expense_totals',
  array['expense_id', 'organization_id', 'business_line_id', 'kind', 'occurred_at', 'total', 'paid'],
  'expense_totals conserva sus columnas y `paid` se añade al final'
);

-- ── Requirement: El saldo pendiente se deriva y nunca se almacena ─────────

-- Scenario: Pedido con anticipo (total 300 / cobro 100 en la redacción del
-- spec; aquí 115 / 40, el mismo hecho con las cifras de esta semilla).
select is(
  (select total from order_totals where order_id = '00000000-0000-0000-0000-000000011001'),
  115::numeric,
  'Scenario: Pedido con anticipo — el total sale de las líneas'
);

select is(
  (select paid from order_totals where order_id = '00000000-0000-0000-0000-000000011001'),
  40::numeric,
  'Scenario: Pedido con anticipo — paid es la suma de los cobros'
);

select is(
  (select total - paid from order_totals where order_id = '00000000-0000-0000-0000-000000011001'),
  75::numeric,
  'Scenario: Pedido con anticipo — el saldo pendiente es total menos paid'
);

-- Scenario: Pedido sin cobros
select is(
  (select paid from order_totals where order_id = '00000000-0000-0000-0000-000000011002'),
  0::numeric,
  'Scenario: Pedido sin cobros — paid es 0, no nulo'
);

select is(
  (select total - paid from order_totals where order_id = '00000000-0000-0000-0000-000000011002'),
  50::numeric,
  'Scenario: Pedido sin cobros — el saldo pendiente es igual al total'
);

-- Scenario: Se registra un cobro adicional
insert into payments (id, organization_id, direction, order_id, amount) values
  ('00000000-0000-0000-0000-000000012002', '00000000-0000-0000-0000-0000000000b0', 'in', '00000000-0000-0000-0000-000000011001', 35);

select is(
  (select paid from order_totals where order_id = '00000000-0000-0000-0000-000000011001'),
  75::numeric,
  'Scenario: Se registra un cobro adicional — paid lo refleja sin recálculo'
);

-- Scenario: Un cobro archivado no cuenta
update payments set archived_at = now()
  where id = '00000000-0000-0000-0000-000000012002';

select is(
  (select paid from order_totals where order_id = '00000000-0000-0000-0000-000000011001'),
  40::numeric,
  'Scenario: Un cobro archivado no cuenta — paid vuelve a 40'
);

select is(
  (select total - paid from order_totals where order_id = '00000000-0000-0000-0000-000000011001'),
  75::numeric,
  'Scenario: Un cobro archivado no cuenta — el saldo sube en ese importe'
);

-- Scenario: Egreso pagado en parte
select is(
  (select paid from expense_totals where expense_id = '00000000-0000-0000-0000-000000011f01'),
  200::numeric,
  'Scenario: Egreso pagado en parte — paid es 200'
);

select is(
  (select total - paid from expense_totals where expense_id = '00000000-0000-0000-0000-000000011f01'),
  300::numeric,
  'Scenario: Egreso pagado en parte — el saldo por pagar es 300'
);

-- Scenario: Ninguna columna almacena el derivado
select hasnt_column('public', 'orders',   'paid',           'orders no almacena paid');
select hasnt_column('public', 'orders',   'balance',        'orders no almacena balance');
select hasnt_column('public', 'orders',   'payment_status', 'orders no almacena el estado de pago');
select hasnt_column('public', 'expenses', 'paid',           'expenses no almacena paid');
select hasnt_column('public', 'payments', 'balance',        'payments no almacena saldo');

-- ── Requirement: Indicadores agregados Por cobrar y Por pagar ─────────────

select pg_temp.login('00000000-0000-0000-0000-0000000011a1');

-- Scenario: Por cobrar con varios pedidos — 75 del pedido A y 50 del B.
select is(
  (select outstanding from receivables_by_line
    where business_line_id = '00000000-0000-0000-0000-0000000011b1'),
  125::numeric,
  'Scenario: Por cobrar con varios pedidos — suma los saldos pendientes'
);

-- Scenario: Un pedido sobrepagado no resta
insert into payments (id, organization_id, direction, order_id, amount) values
  ('00000000-0000-0000-0000-000000012005', '00000000-0000-0000-0000-0000000000b0', 'in', '00000000-0000-0000-0000-000000011003', 80);

select is(
  (select total - paid from order_totals where order_id = '00000000-0000-0000-0000-000000011003'),
  -80::numeric,
  'Scenario: Un pedido sobrepagado no resta — su saldo real queda negativo y visible'
);

select is(
  (select outstanding from receivables_by_line
    where business_line_id = '00000000-0000-0000-0000-0000000011b2'),
  0::numeric,
  'Scenario: Un pedido sobrepagado no resta — aporta 0 al agregado'
);

-- Scenario: Filtro por línea de negocio
select is(
  (select outstanding from receivables_by_line
    where business_line_id = '00000000-0000-0000-0000-0000000011b1'),
  125::numeric,
  'Scenario: Filtro por línea de negocio — Sublimación suma solo lo suyo'
);

-- Scenario: Ningún pedido pendiente
insert into payments (id, organization_id, direction, order_id, amount) values
  ('00000000-0000-0000-0000-000000012006', '00000000-0000-0000-0000-0000000000b0', 'in', '00000000-0000-0000-0000-000000011001', 75),
  ('00000000-0000-0000-0000-000000012007', '00000000-0000-0000-0000-0000000000b0', 'in', '00000000-0000-0000-0000-000000011002', 50);

select is(
  (select outstanding from receivables_by_line
    where business_line_id = '00000000-0000-0000-0000-0000000011b1'),
  0::numeric,
  'Scenario: Ningún pedido pendiente — el indicador muestra 0, no nulo'
);

-- Por pagar, para el dueño.
select is(
  (select outstanding from payables_by_line
    where business_line_id = '00000000-0000-0000-0000-0000000011b1'),
  300::numeric,
  'Por pagar suma el saldo pendiente de los egresos'
);

-- Scenario: El ayudante no ve Por pagar
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000011a2');

select is(
  (select coalesce(sum(outstanding), 0) from payables_by_line),
  0::numeric,
  'Scenario: El ayudante no ve Por pagar — security_invoker le devuelve cero'
);

-- Scenario: La vista sigue respetando al invocante (delta `orders`)
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000011a3');

select is(
  (select count(*)::int from order_totals
    where organization_id = '00000000-0000-0000-0000-0000000000b0'),
  0,
  'Scenario: La vista sigue respetando al invocante — order_totals no filtra pedidos ajenos'
);

select pg_temp.logout();

select * from finish();
rollback;
