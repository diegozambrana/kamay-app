-- KAM-12 · La separación de las dos vías de alta.
-- Escenarios del delta spec `orders` — requisito modificado "El alta es una
-- sola operación y el estado inicial lo asigna la base": «El alta de pedidos
-- no crea ventas directas» y «El alta de pedidos exige cliente».
--
-- Comprueba además que los escenarios de idempotencia que KAM-11 añadió a ese
-- mismo requisito siguen pasando: el bloque MODIFIED de este cambio los
-- arrastra sin tocarlos, y una regresión ahí sería invisible de otro modo.
begin;

set search_path to public, extensions;

select plan(11);

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
  ('00000000-0000-0000-0000-000000000c01', 'owner-kinds@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-000000000c0a', 'Dos vías');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-000000000c0a', '00000000-0000-0000-0000-000000000c01', 'owner');

insert into business_lines (id, organization_id, name) values
  ('00000000-0000-0000-0000-000000000c1a', '00000000-0000-0000-0000-000000000c0a', 'Alfarería');

insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-000000000c21', '00000000-0000-0000-0000-000000000c0a', '00000000-0000-0000-0000-000000000c1a', 'order', 'Reservado', 'initial', 1),
  ('00000000-0000-0000-0000-000000000c22', '00000000-0000-0000-0000-000000000c0a', '00000000-0000-0000-0000-000000000c1a', 'order', 'Entregado', 'final',   2);

insert into contacts (id, organization_id, name, is_customer) values
  ('00000000-0000-0000-0000-000000000c31', '00000000-0000-0000-0000-000000000c0a', 'Cliente', true);

select pg_temp.login('00000000-0000-0000-0000-000000000c01');

-- ══ Scenario: El alta de pedidos no crea ventas directas ══════════════════
-- El jsonb lleva `kind` a propósito. La función lo ignora y fija 'order'
-- literal: las dos vías no se mezclan ni por descuido ni a propósito.

select lives_ok($$
  select create_order(
    jsonb_build_object(
      'id',               '00000000-0000-0000-0000-0000000000c1',
      'organization_id',  '00000000-0000-0000-0000-000000000c0a',
      'business_line_id', '00000000-0000-0000-0000-000000000c1a',
      'contact_id',       '00000000-0000-0000-0000-000000000c31',
      'kind',             'direct_sale'),
    jsonb_build_array(jsonb_build_object(
      'id', '00000000-0000-0000-0000-0000000000e1',
      'quantity', 1, 'unit_price', 10)))
$$, 'create_order acepta la llamada aunque el jsonb intente colar un kind');

select is(
  (select kind from orders where id = '00000000-0000-0000-0000-0000000000c1'),
  'order', 'create_order fija kind = order y descarta lo que llegó en el jsonb');

select is(
  (select s.kind from orders o join statuses s on s.id = o.status_id
    where o.id = '00000000-0000-0000-0000-0000000000c1'),
  'initial', 'el pedido nace en estado initial, no en el final de la venta directa');

-- ══ Scenario: El alta de pedidos exige cliente ════════════════════════════
-- Lo que la venta directa sí admite.

select throws_ok($$
  select create_order(
    jsonb_build_object(
      'id',               '00000000-0000-0000-0000-0000000000c2',
      'organization_id',  '00000000-0000-0000-0000-000000000c0a',
      'business_line_id', '00000000-0000-0000-0000-000000000c1a'),
    jsonb_build_array(jsonb_build_object('quantity', 1, 'unit_price', 10)))
$$, '23514', null, 'create_order rechaza el alta sin cliente');

select lives_ok($$
  select create_direct_sale(
    jsonb_build_object(
      'id',               '00000000-0000-0000-0000-0000000000c3',
      'organization_id',  '00000000-0000-0000-0000-000000000c0a',
      'business_line_id', '00000000-0000-0000-0000-000000000c1a'),
    jsonb_build_array(jsonb_build_object('quantity', 1, 'unit_price', 10)),
    null)
$$, 'create_direct_sale sí acepta la venta sin cliente: es la diferencia');

-- ══ Las dos vías permanecen separadas ═════════════════════════════════════
-- `create_direct_sale` tampoco puede fabricar un pedido.

select is(
  create_direct_sale(
    jsonb_build_object(
      'id',               '00000000-0000-0000-0000-0000000000c4',
      'organization_id',  '00000000-0000-0000-0000-000000000c0a',
      'business_line_id', '00000000-0000-0000-0000-000000000c1a',
      'kind',             'order'),
    jsonb_build_array(jsonb_build_object('quantity', 1, 'unit_price', 10)),
    null),
  '00000000-0000-0000-0000-0000000000c4'::uuid,
  'create_direct_sale acepta la llamada aunque el jsonb intente colar un kind');

select is(
  (select kind from orders where id = '00000000-0000-0000-0000-0000000000c4'),
  'direct_sale',
  'create_direct_sale fija kind = direct_sale y descarta lo que llegó en el jsonb');

-- ══ Idempotencia de KAM-11: sigue viva ════════════════════════════════════
-- Escenarios arrastrados por el bloque MODIFIED de este cambio.

-- Scenario: El mismo pedido enviado dos veces
select is(
  create_order(
    jsonb_build_object(
      'id',               '00000000-0000-0000-0000-0000000000c1',
      'organization_id',  '00000000-0000-0000-0000-000000000c0a',
      'business_line_id', '00000000-0000-0000-0000-000000000c1a',
      'contact_id',       '00000000-0000-0000-0000-000000000c31'),
    jsonb_build_array(jsonb_build_object(
      'id', '00000000-0000-0000-0000-0000000000e1',
      'quantity', 1, 'unit_price', 10))),
  '00000000-0000-0000-0000-0000000000c1'::uuid,
  'create_order sigue siendo idempotente: devuelve el identificador existente');

select is(
  (select count(*)::int from orders where id = '00000000-0000-0000-0000-0000000000c1'),
  1, 'el reenvío del pedido no creó un segundo');

-- Scenario: El reenvío no ensucia la bitácora
select is(
  (select count(*)::int from activity_log
    where table_name = 'orders' and record_id = '00000000-0000-0000-0000-0000000000c1'),
  1, 'el reenvío del pedido no ensució la bitácora');

-- El reenvío tampoco duplica las líneas: sin `on conflict` en el bucle, el
-- segundo envío moriría en la primera.
select is(
  (select count(*)::int from order_items
    where order_id = '00000000-0000-0000-0000-0000000000c1' and archived_at is null),
  1, 'el reenvío del pedido no duplicó sus líneas: el id de línea llega estable');

select * from finish();
rollback;
