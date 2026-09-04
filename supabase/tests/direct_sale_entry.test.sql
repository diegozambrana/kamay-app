-- KAM-12 · Modo feria: el alta de la venta directa.
-- Escenarios del delta spec `fair-mode` — requisitos "La venta directa es un
-- pedido de tipo `direct_sale` nacido en estado final" y "La venta y su cobro
-- se registran en una sola operación"; y de "Vender sin conexión no falla ni
-- duplica" → «Reintento por fallo de red» en su parte de base de datos.
--
-- `create_direct_sale` es `security invoker`, así que todo se ejerce desde un
-- usuario autenticado: llamarla como `postgres` no probaría nada de lo que
-- importa.
begin;

set search_path to public, extensions;

select plan(36);

-- ── Helpers: simular usuarios autenticados ────────────────────────────────

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
  ('00000000-0000-0000-0000-000000000901', 'owner-fair-a@kamay.test'),
  ('00000000-0000-0000-0000-000000000911', 'owner-fair-b@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-00000000090a', 'Feria A'),
  ('00000000-0000-0000-0000-00000000090b', 'Feria B');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000090a', '00000000-0000-0000-0000-000000000901', 'owner'),
  ('00000000-0000-0000-0000-00000000090b', '00000000-0000-0000-0000-000000000911', 'owner');

insert into business_lines (id, organization_id, name) values
  ('00000000-0000-0000-0000-00000000091a', '00000000-0000-0000-0000-00000000090a', 'Alfarería'),
  ('00000000-0000-0000-0000-00000000091c', '00000000-0000-0000-0000-00000000090a', 'Sin final útil'),
  ('00000000-0000-0000-0000-00000000091b', '00000000-0000-0000-0000-00000000090b', 'Alfarería');

-- El estado `final` NO es el último insertado ni el de menor identificador, y
-- hay DOS de tipo final: la prueba distingue "resolver por kind y position"
-- de "tomar el primero que aparezca".
insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-000000000924', '00000000-0000-0000-0000-00000000090a', '00000000-0000-0000-0000-00000000091a', 'order', 'Devuelto',   'final',       4),
  ('00000000-0000-0000-0000-000000000923', '00000000-0000-0000-0000-00000000090a', '00000000-0000-0000-0000-00000000091a', 'order', 'Entregado',  'final',       3),
  ('00000000-0000-0000-0000-000000000922', '00000000-0000-0000-0000-00000000090a', '00000000-0000-0000-0000-00000000091a', 'order', 'En proceso', 'in_progress', 2),
  ('00000000-0000-0000-0000-000000000921', '00000000-0000-0000-0000-00000000090a', '00000000-0000-0000-0000-00000000091a', 'order', 'Reservado',  'initial',     1),
  ('00000000-0000-0000-0000-000000000931', '00000000-0000-0000-0000-00000000090b', '00000000-0000-0000-0000-00000000091b', 'order', 'Reservado',  'initial',     1),
  ('00000000-0000-0000-0000-000000000932', '00000000-0000-0000-0000-00000000090b', '00000000-0000-0000-0000-00000000091b', 'order', 'Entregado',  'final',       2);

insert into contacts (id, organization_id, name, is_customer) values
  ('00000000-0000-0000-0000-000000000941', '00000000-0000-0000-0000-00000000090a', 'Cliente feria', true);

insert into sales_channels (id, organization_id, name) values
  ('00000000-0000-0000-0000-000000000951', '00000000-0000-0000-0000-00000000090a', 'Feria');

-- El precio del catálogo es 999 a propósito: ninguna línea debe heredarlo.
insert into items (id, organization_id, business_line_id, kind, name, sale_price) values
  ('00000000-0000-0000-0000-000000000961', '00000000-0000-0000-0000-00000000090a',
   '00000000-0000-0000-0000-00000000091a', 'product', 'Taza de barro', 999);

select pg_temp.login('00000000-0000-0000-0000-000000000901');

-- ══ Requisito: nace en estado final ═══════════════════════════════════════
-- ── Scenario: Venta cobrada en el acto ────────────────────────────────────

select is(
  create_direct_sale(
    jsonb_build_object(
      'id',               '00000000-0000-0000-0000-00000000c001',
      'organization_id',  '00000000-0000-0000-0000-00000000090a',
      'business_line_id', '00000000-0000-0000-0000-00000000091a',
      'sales_channel_id', '00000000-0000-0000-0000-000000000951',
      'occurred_at',      '2026-09-01T15:40:00Z'
    ),
    jsonb_build_array(
      jsonb_build_object('id', '00000000-0000-0000-0000-00000000d001',
        'item_id', '00000000-0000-0000-0000-000000000961',
        'quantity', 1, 'unit_price', 35),
      jsonb_build_object('id', '00000000-0000-0000-0000-00000000d002',
        'item_id', '00000000-0000-0000-0000-000000000961',
        'quantity', 2, 'unit_price', 40)
    ),
    jsonb_build_object('id', '00000000-0000-0000-0000-00000000e001',
      'amount', 115, 'method', 'cash')
  ),
  '00000000-0000-0000-0000-00000000c001'::uuid,
  'create_direct_sale: devuelve el identificador que generó el cliente');

-- ── Scenario: Nace en el estado final de su línea ─────────────────────────
-- «Entregado» está en posición 3; «Devuelto», también final, en la 4. Se
-- elige el de menor posición, no el primero que aparezca.

select is(
  (select status_id from orders where id = '00000000-0000-0000-0000-00000000c001'),
  '00000000-0000-0000-0000-000000000923'::uuid,
  'la venta nace en el estado final de MENOR posición, no en el otro final');

select is(
  (select s.kind from orders o join statuses s on s.id = o.status_id
    where o.id = '00000000-0000-0000-0000-00000000c001'),
  'final', 'el estado asignado es de tipo final, no initial');

select is(
  (select kind from orders where id = '00000000-0000-0000-0000-00000000c001'),
  'direct_sale', 'la fila se guarda con kind = direct_sale');

select is(
  (select sales_channel_id from orders where id = '00000000-0000-0000-0000-00000000c001'),
  '00000000-0000-0000-0000-000000000951'::uuid,
  'guarda el canal de venta que llegó');

select is(
  (select delivery_mode from orders where id = '00000000-0000-0000-0000-00000000c001'),
  null, 'no fija modo de entrega: una venta de feria se entrega en el acto');

-- ── Scenario: Venta cobrada en el acto (totales) ──────────────────────────
-- 1 × 35 + 2 × 40 = 115, cobrado entero.

select is(
  (select total from order_totals where order_id = '00000000-0000-0000-0000-00000000c001'),
  115::numeric, 'order_totals: el total de la venta es 115');

select is(
  (select paid from order_totals where order_id = '00000000-0000-0000-0000-00000000c001'),
  115::numeric, 'order_totals: cobrada entera en el acto');

select is(
  (select count(*)::int from payments
    where order_id = '00000000-0000-0000-0000-00000000c001'),
  1, 'existe un solo movimiento de cobro contra la venta');

select is(
  (select direction from payments where id = '00000000-0000-0000-0000-00000000e001'),
  'in', 'el cobro es siempre de dirección in');

-- ── Scenario: La hora real es la del hecho ────────────────────────────────
-- Vendida a las 15:40 sin señal; `created_at` lo pone el servidor al llegar.

select is(
  (select occurred_at from orders where id = '00000000-0000-0000-0000-00000000c001'),
  '2026-09-01T15:40:00Z'::timestamptz,
  'occurred_at es la hora que fijó el cliente, no la del servidor');

select is(
  (select occurred_at from payments where id = '00000000-0000-0000-0000-00000000e001'),
  '2026-09-01T15:40:00Z'::timestamptz,
  'el cobro hereda la hora del hecho de la venta: se cobró al venderla');

select isnt(
  (select created_at from orders where id = '00000000-0000-0000-0000-00000000c001'),
  '2026-09-01T15:40:00Z'::timestamptz,
  'created_at lo fija el servidor y no coincide con la hora del hecho');

-- ── Scenario: El precio del momento ───────────────────────────────────────

select is(
  (select unit_price from order_items where id = '00000000-0000-0000-0000-00000000d001'),
  35::numeric(14,2),
  'la línea conserva su precio, no el 999 del catálogo');

-- ── Scenario: Registro en la bitácora ─────────────────────────────────────

select is(
  (select count(*)::int from activity_log
    where table_name = 'orders' and record_id = '00000000-0000-0000-0000-00000000c001'),
  1, 'bitácora: un evento de creación de la venta');

select is(
  (select count(*)::int from activity_log
    where table_name = 'order_items'
      and record_id in ('00000000-0000-0000-0000-00000000d001',
                        '00000000-0000-0000-0000-00000000d002')),
  2, 'bitácora: un evento por cada línea');

select is(
  (select count(*)::int from activity_log
    where table_name = 'payments' and record_id = '00000000-0000-0000-0000-00000000e001'),
  1, 'bitácora: un evento del cobro');

-- ── Scenario: Venta sin cliente ───────────────────────────────────────────

select is(
  (select contact_id from orders where id = '00000000-0000-0000-0000-00000000c001'),
  null, 'la venta sin cliente se acepta y guarda contact_id nulo');

-- ── Scenario: Venta con cliente ───────────────────────────────────────────

select lives_ok($$
  select create_direct_sale(
    jsonb_build_object(
      'id',               '00000000-0000-0000-0000-00000000c002',
      'organization_id',  '00000000-0000-0000-0000-00000000090a',
      'business_line_id', '00000000-0000-0000-0000-00000000091a',
      'contact_id',       '00000000-0000-0000-0000-000000000941'),
    jsonb_build_array(jsonb_build_object('quantity', 1, 'unit_price', 20)),
    jsonb_build_object('amount', 20, 'method', 'cash'))
$$, 'la venta con cliente se acepta');

select is(
  (select contact_id from orders where id = '00000000-0000-0000-0000-00000000c002'),
  '00000000-0000-0000-0000-000000000941'::uuid,
  'la venta queda asociada al contacto elegido');

-- ── Scenario: Numerada como cualquier pedido ──────────────────────────────

select is(
  (select count(distinct code)::int from orders
    where organization_id = '00000000-0000-0000-0000-00000000090a'),
  2, 'las dos ventas recibieron números visibles distintos');

select ok(
  (select code from orders where id = '00000000-0000-0000-0000-00000000c002')
  > (select code from orders where id = '00000000-0000-0000-0000-00000000c001'),
  'la numeración avanza como en cualquier pedido');

-- ══ Requisito: la venta y su cobro, en una sola operación ═════════════════
-- ── Scenario: Cobro parcial ───────────────────────────────────────────────

select lives_ok($$
  select create_direct_sale(
    jsonb_build_object(
      'id',               '00000000-0000-0000-0000-00000000c003',
      'organization_id',  '00000000-0000-0000-0000-00000000090a',
      'business_line_id', '00000000-0000-0000-0000-00000000091a'),
    jsonb_build_array(jsonb_build_object('quantity', 1, 'unit_price', 115)),
    jsonb_build_object('amount', 80, 'method', 'cash'))
$$, 'el cobro parcial se acepta');

select is(
  (select total - paid from order_totals
    where order_id = '00000000-0000-0000-0000-00000000c003'),
  35::numeric, 'cobro parcial: el saldo pendiente derivado es 35');

-- ── Scenario: Venta sin cobro ─────────────────────────────────────────────

select lives_ok($$
  select create_direct_sale(
    jsonb_build_object(
      'id',               '00000000-0000-0000-0000-00000000c004',
      'organization_id',  '00000000-0000-0000-0000-00000000090a',
      'business_line_id', '00000000-0000-0000-0000-00000000091a'),
    jsonb_build_array(jsonb_build_object('quantity', 1, 'unit_price', 50)),
    null)
$$, 'la venta sin cobro se acepta: es el caso raro, no el imposible');

select is(
  (select paid from order_totals where order_id = '00000000-0000-0000-0000-00000000c004'),
  0::numeric, 'la venta sin cobro tiene paid = 0, no nulo');

-- ── Scenario: Venta sin líneas ────────────────────────────────────────────

select throws_ok($$
  select create_direct_sale(
    jsonb_build_object(
      'id',               '00000000-0000-0000-0000-00000000c005',
      'organization_id',  '00000000-0000-0000-0000-00000000090a',
      'business_line_id', '00000000-0000-0000-0000-00000000091a'),
    jsonb_build_array(),
    null)
$$, '23514', 'Una venta necesita al menos una línea',
   'la venta sin líneas se rechaza');

select is(
  (select count(*)::int from orders where id = '00000000-0000-0000-0000-00000000c005'),
  0, 'la venta rechazada no dejó ninguna fila');

-- ── Scenario: Un fallo deja todo como estaba ──────────────────────────────
-- El cobro viola `amount > 0` de KAM-10 con un monto negativo. La venta y sus
-- líneas ya se insertaron dentro de la función: si la transacción no fuera
-- atómica, quedarían huérfanas.

select throws_ok($$
  select create_direct_sale(
    jsonb_build_object(
      'id',               '00000000-0000-0000-0000-00000000c006',
      'organization_id',  '00000000-0000-0000-0000-00000000090a',
      'business_line_id', '00000000-0000-0000-0000-00000000091a'),
    jsonb_build_array(jsonb_build_object('quantity', 1, 'unit_price', 10)),
    jsonb_build_object('amount', -5, 'method', 'cash'))
$$, '23514', 'El cobro de una venta no puede ser negativo',
   'un cobro negativo hace fallar toda la operación, no se traga en silencio');

select is(
  (select count(*)::int from orders where id = '00000000-0000-0000-0000-00000000c006'),
  0, 'tras el fallo no existe la venta');

select is(
  (select count(*)::int from order_items where order_id = '00000000-0000-0000-0000-00000000c006'),
  0, 'tras el fallo no existe ninguna línea');

-- ── Scenario: Reintento por fallo de red (idempotencia) ───────────────────
-- La cola reenvía un sobre cuya respuesta no llegó, con el MISMO identificador.

select is(
  create_direct_sale(
    jsonb_build_object(
      'id',               '00000000-0000-0000-0000-00000000c001',
      'organization_id',  '00000000-0000-0000-0000-00000000090a',
      'business_line_id', '00000000-0000-0000-0000-00000000091a'),
    jsonb_build_array(
      jsonb_build_object('id', '00000000-0000-0000-0000-00000000d001',
        'item_id', '00000000-0000-0000-0000-000000000961',
        'quantity', 1, 'unit_price', 35),
      jsonb_build_object('id', '00000000-0000-0000-0000-00000000d002',
        'item_id', '00000000-0000-0000-0000-000000000961',
        'quantity', 2, 'unit_price', 40)),
    jsonb_build_object('id', '00000000-0000-0000-0000-00000000e001',
      'amount', 115, 'method', 'cash')
  ),
  '00000000-0000-0000-0000-00000000c001'::uuid,
  'el reenvío devuelve el identificador de la venta que ya existía');

select is(
  (select count(*)::int from orders where id = '00000000-0000-0000-0000-00000000c001'),
  1, 'el reenvío no creó una segunda venta');

select is(
  (select count(*)::int from order_items where order_id = '00000000-0000-0000-0000-00000000c001'),
  2, 'el reenvío no duplicó las líneas');

select is(
  (select count(*)::int from payments where order_id = '00000000-0000-0000-0000-00000000c001'),
  1, 'el reenvío no duplicó el cobro');

select is(
  (select count(*)::int from activity_log
    where table_name = 'orders' and record_id = '00000000-0000-0000-0000-00000000c001'),
  1, 'el reenvío no ensució la bitácora');

select * from finish();
rollback;
