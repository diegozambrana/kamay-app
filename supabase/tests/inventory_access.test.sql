-- KAM-18 · inventory: aislamiento entre organizaciones y acceso por rol.
-- Escenarios del delta spec `inventory` — requisitos "Aislamiento entre
-- organizaciones del inventario", "Registrar un consumo cuesta tres
-- interacciones o menos" (parte del ayudante) y "El detalle del insumo muestra
-- saldo, movimientos y evolución de precios" (el recorte de costos).
--
-- El recorte de costos al ayudante no lo hace ninguna línea de código de
-- aplicación: `item_last_cost` es una vista con `security_invoker` sobre
-- `expense_items`, tabla sin política de lectura para él (esquema §16).
begin;

set search_path to public, extensions;

select plan(10);

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
  ('00000000-0000-0000-0000-0000000018a1', 'owner-inv-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000018a2', 'assistant-inv-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000018b1', 'owner-inv-b@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-00000000018a', 'Inventario acceso A'),
  ('00000000-0000-0000-0000-00000000018b', 'Inventario acceso B');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000018a', '00000000-0000-0000-0000-0000000018a1', 'owner'),
  ('00000000-0000-0000-0000-00000000018a', '00000000-0000-0000-0000-0000000018a2', 'assistant'),
  ('00000000-0000-0000-0000-00000000018b', '00000000-0000-0000-0000-0000000018b1', 'owner');

insert into business_lines (id, organization_id, name) values
  ('00000000-0000-0000-0000-0000000018a3', '00000000-0000-0000-0000-00000000018a', 'Sublimación'),
  ('00000000-0000-0000-0000-0000000018b3', '00000000-0000-0000-0000-00000000018b', 'Sublimación');

insert into contacts (id, organization_id, name, is_supplier, is_customer) values
  ('00000000-0000-0000-0000-0000000018a4', '00000000-0000-0000-0000-00000000018a', 'Andina', true, false);

insert into items (id, organization_id, business_line_id, kind, name, min_stock) values
  ('00000000-0000-0000-0000-0000000018a5', '00000000-0000-0000-0000-00000000018a',
   '00000000-0000-0000-0000-0000000018a3', 'supply', 'Taza A', 10),
  ('00000000-0000-0000-0000-0000000018b5', '00000000-0000-0000-0000-00000000018b',
   '00000000-0000-0000-0000-0000000018b3', 'supply', 'Taza B', 10);

-- Una compra en A: genera su entrada y da materia a `item_last_cost`.
insert into expenses (id, organization_id, business_line_id, kind, contact_id, occurred_at) values
  ('00000000-0000-0000-0000-0000000018a6', '00000000-0000-0000-0000-00000000018a',
   '00000000-0000-0000-0000-0000000018a3', 'purchase',
   '00000000-0000-0000-0000-0000000018a4', now() - interval '2 days');

insert into expense_items (id, organization_id, expense_id, item_id, quantity, unit_price) values
  ('00000000-0000-0000-0000-0000000018a7', '00000000-0000-0000-0000-00000000018a',
   '00000000-0000-0000-0000-0000000018a6', '00000000-0000-0000-0000-0000000018a5', 40, 8.50);

-- Un movimiento en B, para que haya algo que A no deba ver.
insert into inventory_movements (organization_id, item_id, kind, quantity, source_type) values
  ('00000000-0000-0000-0000-00000000018b', '00000000-0000-0000-0000-0000000018b5', 'in', 99, 'manual');

-- ── Scenario: Movimientos de otra organización ────────────────────────────

select pg_temp.login('00000000-0000-0000-0000-0000000018a1');

select is(
  (select count(*)::int from inventory_movements
   where organization_id = '00000000-0000-0000-0000-00000000018b'),
  0, 'inventory_movements: A obtiene cero filas de los movimientos de B');

select is(
  (select count(*)::int from inventory_movements),
  1, 'inventory_movements: A ve exactamente el suyo');

-- ── Scenario: Saldos de otra organización ─────────────────────────────────
-- La vista lleva `security_invoker`: el recorte lo aplica RLS sobre las tablas
-- de abajo, sin una línea de lógica en la vista.

select is(
  (select count(*)::int from item_balances
   where organization_id = '00000000-0000-0000-0000-00000000018b'),
  0, 'item_balances: A obtiene cero filas de los saldos de B');

select is(
  (select balance from item_balances
   where item_id = '00000000-0000-0000-0000-0000000018a5'),
  40::numeric, 'item_balances: A ve su propio saldo, generado por la compra');

-- ── Scenario: Escritura cruzada ───────────────────────────────────────────

select throws_ok(
  $$ insert into inventory_movements (organization_id, item_id, kind, quantity, source_type)
     values ('00000000-0000-0000-0000-00000000018b',
             '00000000-0000-0000-0000-0000000018b5', 'out', -1, 'manual') $$,
  '42501', null,
  'inventory_movements: A no puede registrar un movimiento en la organización B');

select pg_temp.logout();

-- ── Scenario: El ayudante registra consumo ────────────────────────────────
-- Matriz de acceso §16: `inventory_movements` es *Leer, crear* para el
-- ayudante. Es quien está delante del estante.

select pg_temp.login('00000000-0000-0000-0000-0000000018a2');

select lives_ok(
  $$ insert into inventory_movements
       (organization_id, item_id, kind, quantity, source_type, note)
     values ('00000000-0000-0000-0000-00000000018a',
             '00000000-0000-0000-0000-0000000018a5', 'out', -6, 'manual', 'Pedido #1') $$,
  'inventory_movements: el ayudante registra un consumo');

select is(
  (select balance from item_balances
   where item_id = '00000000-0000-0000-0000-0000000018a5'),
  34::numeric, 'item_balances: el consumo del ayudante baja el saldo');

select lives_ok(
  $$ insert into inventory_movements
       (organization_id, item_id, kind, quantity, source_type)
     values ('00000000-0000-0000-0000-00000000018a',
             '00000000-0000-0000-0000-0000000018a5', 'adjustment', -4, 'count') $$,
  'inventory_movements: el ayudante registra un ajuste por conteo');

-- ── Scenario: Tampoco por consulta directa ────────────────────────────────
-- El ayudante ve el saldo y los movimientos, y **cero filas** de los precios
-- de compra. No hay ningún `if` de rol detrás de esto.

select is(
  (select count(*)::int from item_last_cost
   where item_id = '00000000-0000-0000-0000-0000000018a5'),
  0, 'item_last_cost: el ayudante obtiene cero filas de los precios de compra');

select is(
  (select count(*)::int from inventory_movements
   where organization_id = '00000000-0000-0000-0000-00000000018a'),
  3, 'inventory_movements: el ayudante sí ve el historial completo de su organización');

select pg_temp.logout();

select * from finish();
rollback;
