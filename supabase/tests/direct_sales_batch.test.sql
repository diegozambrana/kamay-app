-- Cambio `fair-all-lines`: `create_direct_sales` registra en una sola
-- operación las ventas de un carrito con productos de varias líneas.
-- Escenarios del delta `fair-mode`, requisito «Con todas las líneas, cada
-- producto se registra en su línea»: «Un carrito de dos líneas crea dos
-- ventas», «Todo o nada» y «Reenvío sin duplicados», en su parte de base.
--
-- `security invoker`, como `create_direct_sale`: todo se ejerce desde un
-- usuario autenticado.
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

-- ── Semilla propia (como postgres, sin RLS) ───────────────────────────────

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000a01', 'owner-batch-a@kamay.test'),
  ('00000000-0000-0000-0000-000000000a11', 'owner-batch-b@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-000000000a0a', 'Lote A'),
  ('00000000-0000-0000-0000-000000000a0b', 'Lote B');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-000000000a0a', '00000000-0000-0000-0000-000000000a01', 'owner'),
  ('00000000-0000-0000-0000-000000000a0b', '00000000-0000-0000-0000-000000000a11', 'owner');

insert into business_lines (id, organization_id, name) values
  ('00000000-0000-0000-0000-000000000a1a', '00000000-0000-0000-0000-000000000a0a', 'Alfarería'),
  ('00000000-0000-0000-0000-000000000a1b', '00000000-0000-0000-0000-000000000a0a', 'Sublimación'),
  -- Sin ningún estado: `create_direct_sale` la rechaza.
  ('00000000-0000-0000-0000-000000000a1c', '00000000-0000-0000-0000-000000000a0a', 'Sin final');

insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-000000000a21', '00000000-0000-0000-0000-000000000a0a', '00000000-0000-0000-0000-000000000a1a', 'order', 'Reservado', 'initial', 1),
  ('00000000-0000-0000-0000-000000000a22', '00000000-0000-0000-0000-000000000a0a', '00000000-0000-0000-0000-000000000a1a', 'order', 'Entregado', 'final',   2),
  ('00000000-0000-0000-0000-000000000a23', '00000000-0000-0000-0000-000000000a0a', '00000000-0000-0000-0000-000000000a1b', 'order', 'Reservado', 'initial', 1),
  ('00000000-0000-0000-0000-000000000a24', '00000000-0000-0000-0000-000000000a0a', '00000000-0000-0000-0000-000000000a1b', 'order', 'Entregado', 'final',   2);

insert into items (id, organization_id, business_line_id, kind, name, sale_price) values
  ('00000000-0000-0000-0000-000000000a31', '00000000-0000-0000-0000-000000000a0a',
   '00000000-0000-0000-0000-000000000a1a', 'product', 'Maceta', 60),
  ('00000000-0000-0000-0000-000000000a32', '00000000-0000-0000-0000-000000000a0a',
   '00000000-0000-0000-0000-000000000a1b', 'product', 'Taza', 45);

/** Una venta del lote, con una línea y, si `amount` no es nulo, su cobro. */
create function pg_temp.sale(
  sale_id uuid, line_id uuid, item_id uuid, item_line uuid,
  quantity int, unit_price numeric, payment_id uuid, amount numeric
) returns jsonb
language sql as $$
  select jsonb_build_object(
    'sale', jsonb_build_object(
      'id', sale_id,
      'organization_id', '00000000-0000-0000-0000-000000000a0a',
      'business_line_id', line_id,
      'occurred_at', '2026-09-26T15:40:00Z'),
    'items', jsonb_build_array(jsonb_build_object(
      'id', item_line, 'item_id', item_id,
      'quantity', quantity, 'unit_price', unit_price)),
    'payment', case when amount is null then null
      else jsonb_build_object('id', payment_id, 'amount', amount, 'method', 'cash') end
  );
$$;

select pg_temp.login('00000000-0000-0000-0000-000000000a01');

-- ── Scenario: Un carrito de dos líneas crea dos ventas ────────────────────

select is(
  create_direct_sales(jsonb_build_array(
    pg_temp.sale('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-000000000a1b',
      '00000000-0000-0000-0000-000000000a32', '00000000-0000-0000-0000-00000000b101',
      2, 45, '00000000-0000-0000-0000-00000000b201', 90),
    pg_temp.sale('00000000-0000-0000-0000-00000000b002', '00000000-0000-0000-0000-000000000a1a',
      '00000000-0000-0000-0000-000000000a31', '00000000-0000-0000-0000-00000000b102',
      1, 60, '00000000-0000-0000-0000-00000000b202', 60)
  )),
  array['00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-00000000b002']::uuid[],
  'create_direct_sales: devuelve los identificadores de las ventas, en orden');

select is(
  (select count(*)::int from orders
    where id in ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-00000000b002')
      and kind = 'direct_sale'),
  2, 'Un carrito de dos líneas crea dos ventas directas');

select is(
  (select business_line_id from orders where id = '00000000-0000-0000-0000-00000000b001'),
  '00000000-0000-0000-0000-000000000a1b'::uuid,
  'la venta de la taza queda en Sublimación');

select is(
  (select business_line_id from orders where id = '00000000-0000-0000-0000-00000000b002'),
  '00000000-0000-0000-0000-000000000a1a'::uuid,
  'la venta de la maceta queda en Alfarería');

select is(
  (select array_agg(amount order by amount) from payments
    where order_id in ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-00000000b002')),
  array[60, 90]::numeric[],
  'cada venta tiene su cobro: 90 y 60');

-- ── Scenario: Reenvío sin duplicados ──────────────────────────────────────

select create_direct_sales(jsonb_build_array(
  pg_temp.sale('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-000000000a1b',
    '00000000-0000-0000-0000-000000000a32', '00000000-0000-0000-0000-00000000b101',
    2, 45, '00000000-0000-0000-0000-00000000b201', 90),
  pg_temp.sale('00000000-0000-0000-0000-00000000b002', '00000000-0000-0000-0000-000000000a1a',
    '00000000-0000-0000-0000-000000000a31', '00000000-0000-0000-0000-00000000b102',
    1, 60, '00000000-0000-0000-0000-00000000b202', 60)
));

select is(
  (select count(*)::int from payments
    where order_id in ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-00000000b002')),
  2, 'Reenvío sin duplicados: reenviar el lote no crea ventas ni cobros de más');

-- ── Scenario: Todo o nada ─────────────────────────────────────────────────

select throws_ok(
  $$ select create_direct_sales(jsonb_build_array(
    pg_temp.sale('00000000-0000-0000-0000-00000000b003', '00000000-0000-0000-0000-000000000a1b',
      '00000000-0000-0000-0000-000000000a32', '00000000-0000-0000-0000-00000000b103',
      1, 45, '00000000-0000-0000-0000-00000000b203', 45),
    pg_temp.sale('00000000-0000-0000-0000-00000000b004', '00000000-0000-0000-0000-000000000a1c',
      '00000000-0000-0000-0000-000000000a31', '00000000-0000-0000-0000-00000000b104',
      1, 60, '00000000-0000-0000-0000-00000000b204', 60)
  )) $$,
  null, null, 'Todo o nada: una venta de una línea sin estado final hace fallar el lote');

select is(
  (select count(*)::int from orders where id = '00000000-0000-0000-0000-00000000b003'),
  0, 'Todo o nada: la primera venta del lote fallido no persiste');

select throws_ok(
  $$ select create_direct_sales('[]'::jsonb) $$,
  '23514', null, 'un lote vacío se rechaza');

-- ── Aislamiento ───────────────────────────────────────────────────────────

select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-000000000a11');

select throws_ok(
  $$ select create_direct_sales(jsonb_build_array(
    pg_temp.sale('00000000-0000-0000-0000-00000000b005', '00000000-0000-0000-0000-000000000a1a',
      '00000000-0000-0000-0000-000000000a31', '00000000-0000-0000-0000-00000000b105',
      1, 60, '00000000-0000-0000-0000-00000000b205', 60)
  )) $$,
  '42501', null, 'un miembro de otra organización no puede registrar ventas ajenas');

select * from finish();
rollback;
