-- KAM-12 · Modo feria: permisos y aislamiento de la venta directa.
-- Escenarios del delta spec `fair-mode` — requisito "Aislamiento y roles en el
-- modo feria".
--
-- Vive aquí y no en `rls_roles` o `no_delete` por el mismo criterio que el
-- resto: cada suite cubre su propia capacidad.
begin;

set search_path to public, extensions;

select plan(12);

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
  ('00000000-0000-0000-0000-000000000a01', 'owner-fa@kamay.test'),
  ('00000000-0000-0000-0000-000000000a02', 'assistant-fa@kamay.test'),
  ('00000000-0000-0000-0000-000000000a11', 'owner-fb@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-000000000a0a', 'Puesto A'),
  ('00000000-0000-0000-0000-000000000a0b', 'Puesto B');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-000000000a0a', '00000000-0000-0000-0000-000000000a01', 'owner'),
  ('00000000-0000-0000-0000-000000000a0a', '00000000-0000-0000-0000-000000000a02', 'assistant'),
  ('00000000-0000-0000-0000-000000000a0b', '00000000-0000-0000-0000-000000000a11', 'owner');

insert into business_lines (id, organization_id, name) values
  ('00000000-0000-0000-0000-000000000a1a', '00000000-0000-0000-0000-000000000a0a', 'Alfarería'),
  ('00000000-0000-0000-0000-000000000a1b', '00000000-0000-0000-0000-000000000a0b', 'Alfarería');

insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-000000000a21', '00000000-0000-0000-0000-000000000a0a', '00000000-0000-0000-0000-000000000a1a', 'order', 'Reservado', 'initial', 1),
  ('00000000-0000-0000-0000-000000000a22', '00000000-0000-0000-0000-000000000a0a', '00000000-0000-0000-0000-000000000a1a', 'order', 'Entregado', 'final',   2),
  ('00000000-0000-0000-0000-000000000a31', '00000000-0000-0000-0000-000000000a0b', '00000000-0000-0000-0000-000000000a1b', 'order', 'Reservado', 'initial', 1),
  ('00000000-0000-0000-0000-000000000a32', '00000000-0000-0000-0000-000000000a0b', '00000000-0000-0000-0000-000000000a1b', 'order', 'Entregado', 'final',   2);

insert into items (id, organization_id, business_line_id, kind, name, sale_price) values
  ('00000000-0000-0000-0000-000000000a41', '00000000-0000-0000-0000-000000000a0a',
   '00000000-0000-0000-0000-000000000a1a', 'product', 'Taza de A', 35),
  ('00000000-0000-0000-0000-000000000a42', '00000000-0000-0000-0000-000000000a0b',
   '00000000-0000-0000-0000-000000000a1b', 'product', 'Taza de B', 40);

-- ══ Scenario: El ayudante vende ═══════════════════════════════════════════
-- Atender un puesto de feria es su trabajo. Puede crear la venta Y su cobro,
-- porque el cobro es `direction = 'in'` y la política de KAM-10 se lo permite.

select pg_temp.login('00000000-0000-0000-0000-000000000a02');

select lives_ok($$
  select create_direct_sale(
    jsonb_build_object(
      'id',               '00000000-0000-0000-0000-0000000000f1',
      'organization_id',  '00000000-0000-0000-0000-000000000a0a',
      'business_line_id', '00000000-0000-0000-0000-000000000a1a'),
    jsonb_build_array(jsonb_build_object(
      'item_id', '00000000-0000-0000-0000-000000000a41',
      'quantity', 2, 'unit_price', 35)),
    jsonb_build_object('amount', 70, 'method', 'cash'))
$$, 'el ayudante registra una venta directa con su cobro');

select is(
  (select created_by from orders where id = '00000000-0000-0000-0000-0000000000f1'),
  '00000000-0000-0000-0000-000000000a02'::uuid,
  'la venta queda a nombre del ayudante que la registró');

select is(
  (select paid from order_totals where order_id = '00000000-0000-0000-0000-0000000000f1'),
  70::numeric, 'el cobro del ayudante quedó registrado');

-- El reverso, para que la separación de KAM-10 siga viva: el ayudante NO paga
-- egresos. Se comprueba aquí porque la feria es donde más tienta confundirlos.
select is(
  (select count(*)::int from payments
    where organization_id = '00000000-0000-0000-0000-000000000a0a' and direction = 'out'),
  0, 'el ayudante no dejó ningún movimiento de salida');

-- ══ Scenario: Miembro de otra organización ════════════════════════════════

select pg_temp.login('00000000-0000-0000-0000-000000000a11');

select is(
  (select count(*)::int from orders
    where kind = 'direct_sale' and organization_id = '00000000-0000-0000-0000-000000000a0a'),
  0, 'un miembro de otra organización no ve ninguna venta directa ajena');

select is(
  (select count(*)::int from order_totals
    where order_id = '00000000-0000-0000-0000-0000000000f1'),
  0, 'tampoco la ve a través de order_totals: la vista respeta al invocante');

select throws_ok($$
  select create_direct_sale(
    jsonb_build_object(
      'id',               '00000000-0000-0000-0000-0000000000f2',
      'organization_id',  '00000000-0000-0000-0000-000000000a0a',
      'business_line_id', '00000000-0000-0000-0000-000000000a1a'),
    jsonb_build_array(jsonb_build_object('quantity', 1, 'unit_price', 10)),
    null)
$$, '42501', 'No perteneces a esa organización',
   'no puede crear una venta en una organización ajena');

-- Identificador ajeno: el `on conflict do nothing` no puede convertir una
-- venta de otra organización en un «ya existe, todo bien».
select throws_ok($$
  select create_direct_sale(
    jsonb_build_object(
      'id',               '00000000-0000-0000-0000-0000000000f1',
      'organization_id',  '00000000-0000-0000-0000-000000000a0b',
      'business_line_id', '00000000-0000-0000-0000-000000000a1b'),
    jsonb_build_array(jsonb_build_object('quantity', 1, 'unit_price', 10)),
    null)
$$, '42501', 'Ese identificador ya pertenece a otra venta o pedido',
   'un identificador de otra organización se rechaza, no se adopta');

select pg_temp.logout();

select is(
  (select organization_id from orders where id = '00000000-0000-0000-0000-0000000000f1'),
  '00000000-0000-0000-0000-000000000a0a'::uuid,
  'la venta ajena quedó intacta tras el intento');

-- ══ Scenario: Intento de borrado ══════════════════════════════════════════

select pg_temp.login('00000000-0000-0000-0000-000000000a01');

select throws_ok($$
  delete from orders where id = '00000000-0000-0000-0000-0000000000f1'
$$, '42501', null,
   'una venta directa no se borra: no existe política DELETE');

-- ══ Scenario: La cuadrícula no cruza organizaciones ═══════════════════════

select is(
  (select count(*)::int from best_selling_products
    where organization_id <> '00000000-0000-0000-0000-000000000a0a'),
  0, 'best_selling_products solo devuelve filas de la organización activa');

select is(
  (select count(*)::int from items
    where kind = 'product' and organization_id = '00000000-0000-0000-0000-000000000a0b'),
  0, 'el catálogo vendible tampoco cruza organizaciones');

select * from finish();
rollback;
