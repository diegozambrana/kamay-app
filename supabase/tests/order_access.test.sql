-- KAM-07 · orders: aislamiento, roles y archivado.
-- Escenarios del delta spec `orders` — requisito "Aislamiento, roles y
-- archivado de pedidos". Viven aquí y no en `no_delete` o `rls_roles`
-- (KAM-02/KAM-04) por el mismo criterio que `catalog.test.sql`: cada suite
-- cubre su propia capacidad.
begin;

set search_path to public, extensions;

select plan(15);

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
  ('00000000-0000-0000-0000-0000000007a1', 'owner-ord-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000007a2', 'assistant-ord-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000007b1', 'owner-ord-b@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-00000000007a', 'Pedidos A'),
  ('00000000-0000-0000-0000-00000000007b', 'Pedidos B');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000007a', '00000000-0000-0000-0000-0000000007a1', 'owner'),
  ('00000000-0000-0000-0000-00000000007a', '00000000-0000-0000-0000-0000000007a2', 'assistant'),
  ('00000000-0000-0000-0000-00000000007b', '00000000-0000-0000-0000-0000000007b1', 'owner');

insert into business_lines (id, organization_id, name) values
  ('00000000-0000-0000-0000-00000000071a', '00000000-0000-0000-0000-00000000007a', 'Sublimación'),
  ('00000000-0000-0000-0000-00000000071b', '00000000-0000-0000-0000-00000000007b', 'Sublimación');

insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-00000000072a', '00000000-0000-0000-0000-00000000007a', '00000000-0000-0000-0000-00000000071a', 'order', 'Registrado', 'initial',     1),
  ('00000000-0000-0000-0000-00000000073a', '00000000-0000-0000-0000-00000000007a', '00000000-0000-0000-0000-00000000071a', 'order', 'En proceso', 'in_progress', 2),
  ('00000000-0000-0000-0000-00000000074a', '00000000-0000-0000-0000-00000000007a', '00000000-0000-0000-0000-00000000071a', 'order', 'Entregado',  'final',       3),
  ('00000000-0000-0000-0000-00000000072b', '00000000-0000-0000-0000-00000000007b', '00000000-0000-0000-0000-00000000071b', 'order', 'Registrado', 'initial',     1),
  ('00000000-0000-0000-0000-00000000074b', '00000000-0000-0000-0000-00000000007b', '00000000-0000-0000-0000-00000000071b', 'order', 'Entregado',  'final',       2);

insert into contacts (id, organization_id, name, is_customer) values
  ('00000000-0000-0000-0000-00000000075a', '00000000-0000-0000-0000-00000000007a', 'Cliente A', true),
  ('00000000-0000-0000-0000-00000000075b', '00000000-0000-0000-0000-00000000007b', 'Cliente B', true);

insert into items (id, organization_id, kind, name) values
  ('00000000-0000-0000-0000-00000000076a', '00000000-0000-0000-0000-00000000007a', 'product', 'Taza');

insert into orders (id, organization_id, business_line_id, kind, contact_id, status_id) values
  ('00000000-0000-0000-0000-00000007a0a1', '00000000-0000-0000-0000-00000000007a',
   '00000000-0000-0000-0000-00000000071a', 'order',
   '00000000-0000-0000-0000-00000000075a', '00000000-0000-0000-0000-00000000072a'),
  ('00000000-0000-0000-0000-00000007b0b1', '00000000-0000-0000-0000-00000000007b',
   '00000000-0000-0000-0000-00000000071b', 'order',
   '00000000-0000-0000-0000-00000000075b', '00000000-0000-0000-0000-00000000072b');

insert into order_items (id, organization_id, order_id, item_id, quantity, unit_price) values
  ('00000000-0000-0000-0000-0000007a1a01', '00000000-0000-0000-0000-00000000007a',
   '00000000-0000-0000-0000-00000007a0a1', '00000000-0000-0000-0000-00000000076a', 2, 45);

-- ── Scenario: Miembro de otra organización ────────────────────────────────

select pg_temp.login('00000000-0000-0000-0000-0000000007b1');

select is(
  (select count(*)::int from orders
    where organization_id = '00000000-0000-0000-0000-00000000007a'),
  0, 'orders: el miembro de otra organización no obtiene ninguna fila');

select is(
  (select count(*)::int from order_items
    where organization_id = '00000000-0000-0000-0000-00000000007a'),
  0, 'order_items: el miembro de otra organización no obtiene ninguna fila');

select is(
  (select count(*)::int from order_totals
    where organization_id = '00000000-0000-0000-0000-00000000007a'),
  0, 'order_totals: la vista con security_invoker también aísla');

select pg_temp.logout();

-- ── Scenario: El ayudante edita ───────────────────────────────────────────
-- Matriz de acceso §16: `orders` y `order_items` son leer, crear y editar
-- para todo miembro, el ayudante incluido.

select pg_temp.login('00000000-0000-0000-0000-0000000007a2');

select lives_ok(
  $$ update orders set status_id = '00000000-0000-0000-0000-00000000073a'
     where id = '00000000-0000-0000-0000-00000007a0a1' $$,
  'orders: el ayudante cambia el estado de un pedido de su organización');

select lives_ok(
  $$ insert into orders (organization_id, business_line_id, kind, contact_id, status_id)
     values ('00000000-0000-0000-0000-00000000007a',
             '00000000-0000-0000-0000-00000000071a', 'order',
             '00000000-0000-0000-0000-00000000075a',
             '00000000-0000-0000-0000-00000000072a') $$,
  'orders: el ayudante crea pedidos');

select lives_ok(
  $$ insert into order_items (organization_id, order_id, item_id, quantity, unit_price)
     values ('00000000-0000-0000-0000-00000000007a',
             '00000000-0000-0000-0000-00000007a0a1',
             '00000000-0000-0000-0000-00000000076a', 1, 30) $$,
  'order_items: el ayudante agrega líneas');

-- ── Scenario: El ayudante intenta archivar ────────────────────────────────

select throws_ok(
  $$ update orders set archived_at = now()
     where id = '00000000-0000-0000-0000-00000007a0a1' $$,
  '42501', 'Solo la persona dueña puede archivar o desarchivar',
  'orders: el ayudante no archiva');

-- ── Scenario: Intento de borrado ──────────────────────────────────────────

select throws_ok(
  $$ delete from orders where id = '00000000-0000-0000-0000-00000007a0a1' $$,
  '42501', null, 'orders: el ayudante no puede borrar — privilegio revocado');

select throws_ok(
  $$ delete from order_items where order_id = '00000000-0000-0000-0000-00000007a0a1' $$,
  '42501', null, 'order_items: el ayudante no puede borrar');

select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000007a1');

select throws_ok(
  $$ delete from orders where id = '00000000-0000-0000-0000-00000007a0a1' $$,
  '42501', null, 'orders: tampoco el dueño puede borrar');

-- ── Scenario: El pedido archivado conserva su historia ────────────────────

select lives_ok(
  $$ update orders set archived_at = now()
     where id = '00000000-0000-0000-0000-00000007a0a1' $$,
  'orders: el dueño archiva');

select throws_ok(
  $$ update orders set notes = 'editando un archivado'
     where id = '00000000-0000-0000-0000-00000007a0a1' $$,
  '23514', 'Un registro archivado no se puede editar: desarchívalo primero',
  'orders: un pedido archivado no se puede editar');

select pg_temp.logout();

select is(
  (select code from orders where id = '00000000-0000-0000-0000-00000007a0a1'),
  1, 'orders: el pedido archivado conserva su número');

select is(
  (select count(*)::int from order_items
    where order_id = '00000000-0000-0000-0000-00000007a0a1'),
  2, 'order_items: las líneas del pedido archivado siguen ahí');

-- El archivado sale de `order_totals`, que es la vista de lo vigente; la
-- historia sigue en las tablas.
select is(
  (select count(*)::int from order_totals
    where order_id = '00000000-0000-0000-0000-00000007a0a1'),
  0, 'order_totals: el pedido archivado sale de la vista de lo vigente');

select * from finish();
rollback;
