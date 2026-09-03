-- KAM-07 · orders: forma del modelo y total derivado.
-- Escenarios del delta spec `orders` — requisitos "Modelo de pedido con
-- cliente obligatorio", "Líneas de pedido con precio propio" y "El total del
-- pedido se deriva, nunca se almacena".
begin;

set search_path to public, extensions;

select plan(13);

-- ── Semilla propia ────────────────────────────────────────────────────────

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-000000007c01', 'Integridad de pedidos');

insert into business_lines (id, organization_id, name) values
  ('00000000-0000-0000-0000-000000007c11', '00000000-0000-0000-0000-000000007c01', 'Sublimación');

insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-000000007c21', '00000000-0000-0000-0000-000000007c01', '00000000-0000-0000-0000-000000007c11', 'order', 'Registrado', 'initial', 1),
  ('00000000-0000-0000-0000-000000007c22', '00000000-0000-0000-0000-000000007c01', '00000000-0000-0000-0000-000000007c11', 'order', 'Entregado',  'final',   2);

insert into contacts (id, organization_id, name, is_customer) values
  ('00000000-0000-0000-0000-000000007c31', '00000000-0000-0000-0000-000000007c01', 'Cliente', true);

insert into items (id, organization_id, business_line_id, kind, name) values
  ('00000000-0000-0000-0000-000000007c41', '00000000-0000-0000-0000-000000007c01', '00000000-0000-0000-0000-000000007c11', 'product', 'Taza personalizada');

-- ── Scenario: Pedido sin cliente ──────────────────────────────────────────

select throws_ok(
  $$ insert into orders (organization_id, business_line_id, kind, status_id)
     values ('00000000-0000-0000-0000-000000007c01',
             '00000000-0000-0000-0000-000000007c11', 'order',
             '00000000-0000-0000-0000-000000007c21') $$,
  '23514', null, 'orders: un pedido sin cliente se rechaza (order_needs_customer)');

-- ── Scenario: Venta directa sin cliente ───────────────────────────────────

select lives_ok(
  $$ insert into orders (organization_id, business_line_id, kind, status_id)
     values ('00000000-0000-0000-0000-000000007c01',
             '00000000-0000-0000-0000-000000007c11', 'direct_sale',
             '00000000-0000-0000-0000-000000007c21') $$,
  'orders: una venta directa sin cliente se acepta');

-- ── Scenario: Modo de entrega fuera del dominio ───────────────────────────

select throws_ok(
  $$ insert into orders (organization_id, business_line_id, kind, contact_id, status_id, delivery_mode)
     values ('00000000-0000-0000-0000-000000007c01',
             '00000000-0000-0000-0000-000000007c11', 'order',
             '00000000-0000-0000-0000-000000007c31',
             '00000000-0000-0000-0000-000000007c21', 'drone') $$,
  '23514', null, 'orders: un delivery_mode fuera de pickup/delivery se rechaza');

-- El pedido sobre el que se miden los totales.
insert into orders (id, organization_id, business_line_id, kind, contact_id, status_id) values
  ('00000000-0000-0000-0000-00000007c001', '00000000-0000-0000-0000-000000007c01',
   '00000000-0000-0000-0000-000000007c11', 'order',
   '00000000-0000-0000-0000-000000007c31', '00000000-0000-0000-0000-000000007c21');

-- Un segundo pedido que se queda sin líneas a propósito.
insert into orders (id, organization_id, business_line_id, kind, contact_id, status_id) values
  ('00000000-0000-0000-0000-00000007c002', '00000000-0000-0000-0000-000000007c01',
   '00000000-0000-0000-0000-000000007c11', 'order',
   '00000000-0000-0000-0000-000000007c31', '00000000-0000-0000-0000-000000007c21');

-- ── Scenario: Cantidad no positiva ────────────────────────────────────────

select throws_ok(
  $$ insert into order_items (organization_id, order_id, item_id, quantity, unit_price)
     values ('00000000-0000-0000-0000-000000007c01',
             '00000000-0000-0000-0000-00000007c001',
             '00000000-0000-0000-0000-000000007c41', 0, 45) $$,
  '23514', null, 'order_items: una cantidad de cero se rechaza');

select throws_ok(
  $$ insert into order_items (organization_id, order_id, item_id, quantity, unit_price)
     values ('00000000-0000-0000-0000-000000007c01',
             '00000000-0000-0000-0000-00000007c001',
             '00000000-0000-0000-0000-000000007c41', -2, 45) $$,
  '23514', null, 'order_items: una cantidad negativa se rechaza');

-- ── Scenario: Precio negativo ─────────────────────────────────────────────

select throws_ok(
  $$ insert into order_items (organization_id, order_id, item_id, quantity, unit_price)
     values ('00000000-0000-0000-0000-000000007c01',
             '00000000-0000-0000-0000-00000007c001',
             '00000000-0000-0000-0000-000000007c41', 1, -1) $$,
  '23514', null, 'order_items: un precio negativo se rechaza');

select lives_ok(
  $$ insert into order_items (organization_id, order_id, item_id, quantity, unit_price)
     values ('00000000-0000-0000-0000-000000007c01',
             '00000000-0000-0000-0000-00000007c001',
             '00000000-0000-0000-0000-000000007c41', 1, 0) $$,
  'order_items: un precio de cero se acepta (una promoción es válida)');

-- ── Scenario: Total de un pedido con líneas ───────────────────────────────
-- 3 × 25 + 1 × 40 = 115, más la línea de precio cero de arriba.

delete from order_items where order_id = '00000000-0000-0000-0000-00000007c001';

insert into order_items (organization_id, order_id, item_id, quantity, unit_price) values
  ('00000000-0000-0000-0000-000000007c01', '00000000-0000-0000-0000-00000007c001', '00000000-0000-0000-0000-000000007c41', 3, 25),
  ('00000000-0000-0000-0000-000000007c01', '00000000-0000-0000-0000-00000007c001', '00000000-0000-0000-0000-000000007c41', 1, 40);

select is(
  (select total from order_totals where order_id = '00000000-0000-0000-0000-00000007c001'),
  115::numeric, 'order_totals: 3 × 25 + 1 × 40 da 115');

-- ── Scenario: Pedido sin líneas ───────────────────────────────────────────

select is(
  (select total from order_totals where order_id = '00000000-0000-0000-0000-00000007c002'),
  0::numeric, 'order_totals: un pedido sin líneas da 0, no nulo');

-- ── Scenario: Se agrega una línea ─────────────────────────────────────────

insert into order_items (organization_id, order_id, item_id, quantity, unit_price) values
  ('00000000-0000-0000-0000-000000007c01', '00000000-0000-0000-0000-00000007c001', '00000000-0000-0000-0000-000000007c41', 2, 10);

select is(
  (select total from order_totals where order_id = '00000000-0000-0000-0000-00000007c001'),
  135::numeric, 'order_totals: agregar una línea se refleja sin recalcular nada');

-- ── Scenario: El precio del catálogo cambia después ───────────────────────

update items set sale_price = 999 where id = '00000000-0000-0000-0000-000000007c41';

select is(
  (select total from order_totals where order_id = '00000000-0000-0000-0000-00000007c001'),
  135::numeric, 'order_items: cambiar el precio del catálogo no altera el pedido registrado');

-- ── Scenario: Ninguna columna almacena el derivado ────────────────────────
-- Deliberadamente rígida: la tentación de guardar el total aquí volverá con
-- los cobros (KAM-10) y con los reportes (KAM-20).

select is(
  (select count(*)::int from information_schema.columns
    where table_schema = 'public'
      and table_name in ('orders', 'order_items')
      and (column_name ~ '(total|cost|costo|margin|margen|balance|saldo|paid|pagado|cobrado)')),
  0, 'orders/order_items: ninguna columna de total, saldo, cobrado ni margen');

-- La vista es la única fuente del total, y corre con los privilegios de
-- quien la invoca para que RLS siga decidiendo.
select is(
  (select reloptions::text from pg_class where relname = 'order_totals'),
  '{security_invoker=true}', 'order_totals: declarada con security_invoker');

select * from finish();
rollback;
