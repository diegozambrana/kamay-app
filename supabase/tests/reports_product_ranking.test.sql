-- KAM-20 · Función derivada `report_product_ranking`.
-- Escenarios del delta spec `orders` § Ranking de productos vendidos dentro
--   de un periodo, con unidades y margen: "Unidades y margen en la misma
--   fila", "Las ventas directas cuentan", "El precio es el que se registró",
--   "Lo archivado no suma", "Un rango que no empieza el día 1", "El costo se
--   prorratea por ingreso dentro del pedido", "Un pedido sin egreso asignado
--   no atribuye costo", "El ranking de feria no cambia".
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

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000022a1', 'owner-ranking@kamay.test');

insert into organizations (id, name, timezone) values
  ('00000000-0000-0000-0000-0000000022b0', 'Ranking A', 'America/La_Paz');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000022b0', '00000000-0000-0000-0000-0000000022a1', 'owner');

insert into business_lines (id, organization_id, name, position) values
  ('00000000-0000-0000-0000-0000000022c1', '00000000-0000-0000-0000-0000000022b0', 'Sublimación', 1);

insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-0000000022d1', '00000000-0000-0000-0000-0000000022b0', '00000000-0000-0000-0000-0000000022c1', 'order', 'Registrado', 'initial', 1),
  ('00000000-0000-0000-0000-0000000022d2', '00000000-0000-0000-0000-0000000022b0', '00000000-0000-0000-0000-0000000022c1', 'order', 'Entregado',  'final',   2);

insert into sales_channels (id, organization_id, name, position) values
  ('00000000-0000-0000-0000-000000229100', '00000000-0000-0000-0000-0000000022b0', 'Feria',   1);

insert into expense_categories (id, organization_id, name) values
  ('00000000-0000-0000-0000-0000000022e1', '00000000-0000-0000-0000-0000000022b0', 'Insumos');

insert into contacts (id, organization_id, name, is_customer) values
  ('00000000-0000-0000-0000-0000000022f1', '00000000-0000-0000-0000-0000000022b0', 'Cliente', true);

insert into items (id, organization_id, business_line_id, kind, name, sale_price) values
  ('00000000-0000-0000-0000-000000002201', '00000000-0000-0000-0000-0000000022b0', '00000000-0000-0000-0000-0000000022c1', 'product', 'Taza',  300),
  ('00000000-0000-0000-0000-000000002202', '00000000-0000-0000-0000-0000000022b0', '00000000-0000-0000-0000-0000000022c1', 'product', 'Gorra', 400);

-- O1 · pedido de marzo con dos ítems: 600 de Taza y 400 de Gorra. Un egreso
-- de 300 asignado a él es lo que se prorratea 180 / 120.
insert into orders (id, organization_id, business_line_id, kind, contact_id, status_id, occurred_at) values
  ('00000000-0000-0000-0000-000000022101', '00000000-0000-0000-0000-0000000022b0', '00000000-0000-0000-0000-0000000022c1', 'order', '00000000-0000-0000-0000-0000000022f1', '00000000-0000-0000-0000-0000000022d1', '2026-03-15 12:00:00-04');

insert into order_items (organization_id, order_id, item_id, quantity, unit_price) values
  ('00000000-0000-0000-0000-0000000022b0', '00000000-0000-0000-0000-000000022101', '00000000-0000-0000-0000-000000002201', 2, 300),
  ('00000000-0000-0000-0000-0000000022b0', '00000000-0000-0000-0000-000000022101', '00000000-0000-0000-0000-000000002202', 1, 400);

insert into expenses (id, organization_id, business_line_id, kind, expense_category_id, order_id, amount, occurred_at) values
  ('00000000-0000-0000-0000-000000022201', '00000000-0000-0000-0000-0000000022b0', '00000000-0000-0000-0000-0000000022c1', 'expense', '00000000-0000-0000-0000-0000000022e1', '00000000-0000-0000-0000-000000022101', 300.00, '2026-03-15 13:00:00-04');

-- O2 · venta directa de feria, sin egreso asignado: 3 Tazas a 100.
insert into orders (id, organization_id, business_line_id, kind, status_id, sales_channel_id, occurred_at) values
  ('00000000-0000-0000-0000-000000022102', '00000000-0000-0000-0000-0000000022b0', '00000000-0000-0000-0000-0000000022c1', 'direct_sale', '00000000-0000-0000-0000-0000000022d2', '00000000-0000-0000-0000-000000229100', '2026-03-16 12:00:00-04');

insert into order_items (organization_id, order_id, item_id, quantity, unit_price) values
  ('00000000-0000-0000-0000-0000000022b0', '00000000-0000-0000-0000-000000022102', '00000000-0000-0000-0000-000000002201', 3, 100);

-- O3 · archivado: 10 Tazas que no deben contar en ninguna cifra.
insert into orders (id, organization_id, business_line_id, kind, contact_id, status_id, occurred_at) values
  ('00000000-0000-0000-0000-000000022103', '00000000-0000-0000-0000-0000000022b0', '00000000-0000-0000-0000-0000000022c1', 'order', '00000000-0000-0000-0000-0000000022f1', '00000000-0000-0000-0000-0000000022d1', '2026-03-17 12:00:00-04');

insert into order_items (organization_id, order_id, item_id, quantity, unit_price) values
  ('00000000-0000-0000-0000-0000000022b0', '00000000-0000-0000-0000-000000022103', '00000000-0000-0000-0000-000000002201', 10, 50);

-- O4 · fuera del rango del 12 de marzo al 20 de abril, por abajo.
insert into orders (id, organization_id, business_line_id, kind, contact_id, status_id, occurred_at) values
  ('00000000-0000-0000-0000-000000022104', '00000000-0000-0000-0000-0000000022b0', '00000000-0000-0000-0000-0000000022c1', 'order', '00000000-0000-0000-0000-0000000022f1', '00000000-0000-0000-0000-0000000022d1', '2026-03-05 12:00:00-04');

insert into order_items (organization_id, order_id, item_id, quantity, unit_price) values
  ('00000000-0000-0000-0000-0000000022b0', '00000000-0000-0000-0000-000000022104', '00000000-0000-0000-0000-000000002202', 1, 999);

-- O5 · reciente, para que la retícula de feria (ventana de 90 días) tenga qué
-- mostrar. Queda fuera de todos los rangos de marzo que se consultan abajo.
insert into orders (id, organization_id, business_line_id, kind, status_id, sales_channel_id, occurred_at) values
  ('00000000-0000-0000-0000-000000022105', '00000000-0000-0000-0000-0000000022b0', '00000000-0000-0000-0000-0000000022c1', 'direct_sale', '00000000-0000-0000-0000-0000000022d2', '00000000-0000-0000-0000-000000229100', now() - interval '10 days');

insert into order_items (organization_id, order_id, item_id, quantity, unit_price) values
  ('00000000-0000-0000-0000-0000000022b0', '00000000-0000-0000-0000-000000022105', '00000000-0000-0000-0000-000000002201', 1, 77);

update orders set archived_at = now()
  where id = '00000000-0000-0000-0000-000000022103';

select pg_temp.login('00000000-0000-0000-0000-0000000022a1');

-- ── Unidades y margen en la misma fila ────────────────────────────────────
-- Taza en marzo: 2 (pedido) + 3 (feria) = 5 unidades; 600 + 300 = 900 de
-- ingreso; 180 de costo prorrateado. Las dos columnas salen juntas: es lo que
-- permite ordenar por una sin perder la otra.

select is(
  (select units_sold from report_product_ranking(
     '00000000-0000-0000-0000-0000000022b0',
     '2026-03-01 00:00:00-04', '2026-04-01 00:00:00-04')
   where item_id = '00000000-0000-0000-0000-000000002201'),
  5::numeric,
  'Taza acumula 5 unidades entre pedido y venta directa'
);

select is(
  (select revenue - attributed_cost from report_product_ranking(
     '00000000-0000-0000-0000-0000000022b0',
     '2026-03-01 00:00:00-04', '2026-04-01 00:00:00-04')
   where item_id = '00000000-0000-0000-0000-000000002201'),
  720::numeric,
  'El margen de Taza sale de la misma fila que sus unidades'
);

-- ── Las ventas directas cuentan ───────────────────────────────────────────
-- Sin la venta de feria, Taza tendría 2 unidades y 600 de ingreso.

select is(
  (select revenue from report_product_ranking(
     '00000000-0000-0000-0000-0000000022b0',
     '2026-03-01 00:00:00-04', '2026-04-01 00:00:00-04')
   where item_id = '00000000-0000-0000-0000-000000002201'),
  900::numeric,
  'El ingreso de Taza incluye las 3 unidades vendidas en feria'
);

-- ── El costo se prorratea por ingreso dentro del pedido ───────────────────
-- O1 ingresa 1.000 (600 Taza + 400 Gorra) y carga 300 de egreso asignado:
-- 180 a Taza y 120 a Gorra. La venta de feria no aporta costo, así que el
-- costo total de Taza sigue siendo 180.

select is(
  (select attributed_cost from report_product_ranking(
     '00000000-0000-0000-0000-0000000022b0',
     '2026-03-01 00:00:00-04', '2026-04-01 00:00:00-04')
   where item_id = '00000000-0000-0000-0000-000000002201'),
  180::numeric,
  'Taza absorbe 180 de los 300 del pedido, en proporción a su ingreso'
);

select is(
  (select attributed_cost from report_product_ranking(
     '00000000-0000-0000-0000-0000000022b0',
     '2026-03-15 00:00:00-04', '2026-03-16 00:00:00-04')
   where item_id = '00000000-0000-0000-0000-000000002202'),
  120::numeric,
  'Gorra absorbe los 120 restantes'
);

-- ── Un pedido sin egreso asignado no atribuye costo ───────────────────────
-- El 16 de marzo solo ocurrió la venta de feria, que no tiene egreso.

select is(
  (select attributed_cost from report_product_ranking(
     '00000000-0000-0000-0000-0000000022b0',
     '2026-03-16 00:00:00-04', '2026-03-17 00:00:00-04')
   where item_id = '00000000-0000-0000-0000-000000002201'),
  0::numeric,
  'Una venta sin egreso asignado atribuye cero, no una estimación'
);

-- ── El precio es el que se registró ───────────────────────────────────────
-- Sube el precio de catálogo después de vender: el ingreso pasado no cambia.

update items set sale_price = 999
  where id = '00000000-0000-0000-0000-000000002201';

select is(
  (select revenue from report_product_ranking(
     '00000000-0000-0000-0000-0000000022b0',
     '2026-03-01 00:00:00-04', '2026-04-01 00:00:00-04')
   where item_id = '00000000-0000-0000-0000-000000002201'),
  900::numeric,
  'Subir el precio de catálogo no reescribe lo que se ganó en marzo'
);

-- ── Lo archivado no suma ──────────────────────────────────────────────────
-- Las 10 Tazas del pedido archivado están dentro del rango: si sumaran,
-- serían 15 unidades y 1.400 de ingreso.

select is(
  (select units_sold from report_product_ranking(
     '00000000-0000-0000-0000-0000000022b0',
     '2026-03-01 00:00:00-04', '2026-04-01 00:00:00-04')
   where item_id = '00000000-0000-0000-0000-000000002201'),
  5::numeric,
  'El pedido archivado dentro del rango no suma unidades'
);

-- ── Un rango que no empieza el día 1 ──────────────────────────────────────
-- Del 12 de marzo al 20 de abril, Gorra solo tiene el pedido del 15: sus 999
-- del 5 de marzo quedan fuera.

select is(
  (select revenue from report_product_ranking(
     '00000000-0000-0000-0000-0000000022b0',
     '2026-03-12 00:00:00-04', '2026-04-21 00:00:00-04')
   where item_id = '00000000-0000-0000-0000-000000002202'),
  400::numeric,
  'Un rango del 12 de marzo al 20 de abril deja fuera la venta del día 5'
);

-- ── El ranking de feria no cambia ─────────────────────────────────────────
-- `best_selling_products` conserva su ventana de 90 días y su propósito.
-- Su fuente es la venta reciente, no las de marzo.

select is(
  (select quantity_sold from best_selling_products
   where organization_id = '00000000-0000-0000-0000-0000000022b0'
     and item_id = '00000000-0000-0000-0000-000000002201'),
  1::numeric,
  'best_selling_products sigue respondiendo con su ventana de 90 días'
);

select * from finish();
rollback;
