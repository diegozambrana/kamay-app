-- KAM-12 · Modo feria: la vista que ordena la cuadrícula.
-- Escenarios del delta spec `fair-mode` — requisito "Cuadrícula de productos
-- vendibles ordenada por más vendidos": «Orden por ventas recientes» y, en su
-- parte de datos, «Producto de otra línea».
--
-- La ventana de 90 días vive en la vista y en ningún otro sitio (design,
-- decisión 4), así que es aquí donde se comprueba que corta donde debe.
begin;

set search_path to public, extensions;

select plan(9);

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

-- ── Semilla propia ────────────────────────────────────────────────────────

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000b01', 'owner-bs@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-000000000b0a', 'Más vendidos');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-000000000b0a', '00000000-0000-0000-0000-000000000b01', 'owner');

insert into business_lines (id, organization_id, name) values
  ('00000000-0000-0000-0000-000000000b1a', '00000000-0000-0000-0000-000000000b0a', 'Alfarería'),
  ('00000000-0000-0000-0000-000000000b1b', '00000000-0000-0000-0000-000000000b0a', 'Sublimación');

insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-000000000b21', '00000000-0000-0000-0000-000000000b0a', '00000000-0000-0000-0000-000000000b1a', 'order', 'Reservado', 'initial', 1),
  ('00000000-0000-0000-0000-000000000b22', '00000000-0000-0000-0000-000000000b0a', '00000000-0000-0000-0000-000000000b1a', 'order', 'Entregado', 'final',   2);

insert into items (id, organization_id, business_line_id, kind, name, sale_price) values
  ('00000000-0000-0000-0000-000000000b41', '00000000-0000-0000-0000-000000000b0a', '00000000-0000-0000-0000-000000000b1a', 'product', 'Taza de barro', 35),
  ('00000000-0000-0000-0000-000000000b42', '00000000-0000-0000-0000-000000000b0a', '00000000-0000-0000-0000-000000000b1a', 'product', 'Maceta',        60),
  ('00000000-0000-0000-0000-000000000b43', '00000000-0000-0000-0000-000000000b0a', '00000000-0000-0000-0000-000000000b1a', 'product', 'Plato',         28),
  ('00000000-0000-0000-0000-000000000b44', '00000000-0000-0000-0000-000000000b0a', '00000000-0000-0000-0000-000000000b1b', 'product', 'Taza sublimada', 45);

-- Ventas dentro de la ventana: taza 30, maceta 4. Y una taza de hace 200 días
-- con 500 unidades: un éxito viejo NO debe empujar hacia abajo lo que hoy se
-- vende, que es la razón de que la ventana exista.
-- El pedido necesita cliente: `order_needs_customer` solo lo dispensa a las
-- ventas directas.
insert into contacts (id, organization_id, name, is_customer) values
  ('00000000-0000-0000-0000-000000000b31', '00000000-0000-0000-0000-000000000b0a', 'Cliente', true);

insert into orders (id, organization_id, business_line_id, kind, code, status_id, occurred_at) values
  ('00000000-0000-0000-0000-000000000b51', '00000000-0000-0000-0000-000000000b0a', '00000000-0000-0000-0000-000000000b1a', 'direct_sale', 1, '00000000-0000-0000-0000-000000000b22', now() - interval '10 days'),
  ('00000000-0000-0000-0000-000000000b52', '00000000-0000-0000-0000-000000000b0a', '00000000-0000-0000-0000-000000000b1a', 'direct_sale', 2, '00000000-0000-0000-0000-000000000b22', now() - interval '200 days');

-- Un PEDIDO, no una venta: la vista suma los dos por igual. Va aparte porque
-- necesita cliente y las ventas directas no.
insert into orders (id, organization_id, business_line_id, kind, code, contact_id, status_id, occurred_at) values
  ('00000000-0000-0000-0000-000000000b53', '00000000-0000-0000-0000-000000000b0a', '00000000-0000-0000-0000-000000000b1a', 'order', 3, '00000000-0000-0000-0000-000000000b31', '00000000-0000-0000-0000-000000000b21', now() - interval '5 days');

insert into orders (id, organization_id, business_line_id, kind, code, status_id, occurred_at, archived_at) values
  ('00000000-0000-0000-0000-000000000b54', '00000000-0000-0000-0000-000000000b0a', '00000000-0000-0000-0000-000000000b1a', 'direct_sale', 4, '00000000-0000-0000-0000-000000000b22', now() - interval '3 days', now() - interval '2 days');

insert into order_items (id, organization_id, order_id, item_id, quantity, unit_price) values
  ('00000000-0000-0000-0000-000000000b61', '00000000-0000-0000-0000-000000000b0a', '00000000-0000-0000-0000-000000000b51', '00000000-0000-0000-0000-000000000b41', 20, 35),
  ('00000000-0000-0000-0000-000000000b62', '00000000-0000-0000-0000-000000000b0a', '00000000-0000-0000-0000-000000000b51', '00000000-0000-0000-0000-000000000b42',  4, 60),
  -- El éxito viejo, fuera de la ventana.
  ('00000000-0000-0000-0000-000000000b63', '00000000-0000-0000-0000-000000000b0a', '00000000-0000-0000-0000-000000000b52', '00000000-0000-0000-0000-000000000b43', 500, 28),
  -- Diez tazas más, esta vez por pedido.
  ('00000000-0000-0000-0000-000000000b64', '00000000-0000-0000-0000-000000000b0a', '00000000-0000-0000-0000-000000000b53', '00000000-0000-0000-0000-000000000b41', 10, 35),
  -- En una venta archivada: no cuenta.
  ('00000000-0000-0000-0000-000000000b65', '00000000-0000-0000-0000-000000000b0a', '00000000-0000-0000-0000-000000000b54', '00000000-0000-0000-0000-000000000b42', 99, 60);

-- Una línea archivada dentro de una venta vigente: tampoco cuenta.
insert into order_items (id, organization_id, order_id, item_id, quantity, unit_price, archived_at) values
  ('00000000-0000-0000-0000-000000000b66', '00000000-0000-0000-0000-000000000b0a', '00000000-0000-0000-0000-000000000b51', '00000000-0000-0000-0000-000000000b42', 77, 60, now());

select pg_temp.login('00000000-0000-0000-0000-000000000b01');

-- ── Scenario: Orden por ventas recientes ──────────────────────────────────
-- Taza: 20 (venta) + 10 (pedido) = 30. Maceta: 4. La vista suma pedidos y
-- ventas directas por igual.

select is(
  (select quantity_sold from best_selling_products
    where item_id = '00000000-0000-0000-0000-000000000b41'),
  30::numeric, 'la taza suma 30: la vista cuenta pedidos y ventas directas por igual');

select is(
  (select quantity_sold from best_selling_products
    where item_id = '00000000-0000-0000-0000-000000000b42'),
  4::numeric, 'la maceta suma 4: ni la venta archivada ni la línea archivada cuentan');

select is(
  (select item_id from best_selling_products
    where business_line_id = '00000000-0000-0000-0000-000000000b1a'
    order by quantity_sold desc limit 1),
  '00000000-0000-0000-0000-000000000b41'::uuid,
  'la taza encabeza el orden de la cuadrícula');

-- ── La ventana de 90 días corta donde debe ────────────────────────────────

select is(
  (select count(*)::int from best_selling_products
    where item_id = '00000000-0000-0000-0000-000000000b43'),
  0, 'un éxito de hace 200 días no aparece: la ventana son 90 días');

select ok(
  (select quantity_sold from best_selling_products
    where item_id = '00000000-0000-0000-0000-000000000b41')
  > coalesce((select quantity_sold from best_selling_products
    where item_id = '00000000-0000-0000-0000-000000000b43'), 0),
  'lo que hoy se vende va por delante del éxito viejo');

-- ── Scenario: Producto de otra línea ──────────────────────────────────────

select is(
  (select count(*)::int from best_selling_products
    where business_line_id = '00000000-0000-0000-0000-000000000b1a'
      and item_id = '00000000-0000-0000-0000-000000000b44'),
  0, 'un producto de Sublimación no aparece bajo la línea de Alfarería');

-- ── La vista se declara con security_invoker ──────────────────────────────
-- Sin esto, la cuadrícula enseñaría las ventas de cualquier organización.

select is(
  (select reloptions::text from pg_class
    where relname = 'best_selling_products' and relkind = 'v'),
  '{security_invoker=true}',
  'best_selling_products se declara con security_invoker = true (convención nº 4)');

-- ── Lo derivado no se almacena ────────────────────────────────────────────

select is(
  (select count(*)::int from information_schema.columns
    where table_name = 'items'
      and column_name in ('quantity_sold', 'times_sold', 'last_sold_at')),
  0, 'ninguna columna de items almacena lo que la vista deriva');

select is(
  (select count(*)::int from information_schema.columns
    where table_name = 'orders' and column_name in ('total', 'paid', 'balance')),
  0, 'ninguna columna de orders almacena total, cobrado ni saldo');

select * from finish();
rollback;
