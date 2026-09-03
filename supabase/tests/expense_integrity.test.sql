-- KAM-09 · expenses: restricciones del modelo, líneas con precio propio,
-- alta atómica y ausencia de columnas derivadas.
-- Escenarios del delta spec `expenses`: "Modelo de egreso con dos tipos en una
-- sola tabla", "Líneas de compra con precio propio", "Una compra necesita al
-- menos una línea" (operación de guardado y guardado atómico) y "Ninguna
-- columna almacena el derivado".
begin;

set search_path to public, extensions;

select plan(25);

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
  ('00000000-0000-0000-0000-0000000009a1', 'owner-exp-a@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-00000000009a', 'Egresos A');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000009a', '00000000-0000-0000-0000-0000000009a1', 'owner');

insert into business_lines (id, organization_id, name, is_shared, position) values
  ('00000000-0000-0000-0000-00000000091a', '00000000-0000-0000-0000-00000000009a', 'Sublimación', false, 1),
  ('00000000-0000-0000-0000-00000000091b', '00000000-0000-0000-0000-00000000009a', 'General',     true,  2);

insert into expense_categories (id, organization_id, name) values
  ('00000000-0000-0000-0000-00000000092a', '00000000-0000-0000-0000-00000000009a', 'Servicios');

insert into contacts (id, organization_id, name, is_supplier, is_customer) values
  ('00000000-0000-0000-0000-00000000093a', '00000000-0000-0000-0000-00000000009a', 'Proveedor A', true, false);

insert into items (id, organization_id, kind, name) values
  ('00000000-0000-0000-0000-00000000094a', '00000000-0000-0000-0000-00000000009a', 'supply', 'Taza'),
  ('00000000-0000-0000-0000-00000000094b', '00000000-0000-0000-0000-00000000009a', 'supply', 'Papel');

-- ── Scenario: Gasto sin categoría / sin monto ─────────────────────────────

select throws_like(
  $$ insert into expenses (organization_id, business_line_id, kind, amount)
     values ('00000000-0000-0000-0000-00000000009a', '00000000-0000-0000-0000-00000000091a', 'expense', 50) $$,
  '%expense_needs_category_and_amount%',
  'expenses: un gasto sin categoría se rechaza');

select throws_like(
  $$ insert into expenses (organization_id, business_line_id, kind, expense_category_id)
     values ('00000000-0000-0000-0000-00000000009a', '00000000-0000-0000-0000-00000000091a', 'expense',
             '00000000-0000-0000-0000-00000000092a') $$,
  '%expense_needs_category_and_amount%',
  'expenses: un gasto sin monto se rechaza');

-- ── Scenario: Compra sin proveedor / con monto propio ─────────────────────

select throws_like(
  $$ insert into expenses (organization_id, business_line_id, kind)
     values ('00000000-0000-0000-0000-00000000009a', '00000000-0000-0000-0000-00000000091a', 'purchase') $$,
  '%purchase_needs_supplier%',
  'expenses: una compra sin proveedor se rechaza');

select throws_like(
  $$ insert into expenses (organization_id, business_line_id, kind, contact_id, amount)
     values ('00000000-0000-0000-0000-00000000009a', '00000000-0000-0000-0000-00000000091a', 'purchase',
             '00000000-0000-0000-0000-00000000093a', 100) $$,
  '%purchase_has_no_own_amount%',
  'expenses: una compra con monto propio se rechaza (el total se deriva)');

-- ── Scenario: Egreso sin línea de negocio ─────────────────────────────────

select throws_ok(
  $$ insert into expenses (organization_id, kind, expense_category_id, amount)
     values ('00000000-0000-0000-0000-00000000009a', 'expense',
             '00000000-0000-0000-0000-00000000092a', 50) $$,
  '23502',
  null, 'expenses: todo egreso lleva línea de negocio obligatoria');

select throws_ok(
  $$ insert into expenses (organization_id, business_line_id, kind, expense_category_id, amount)
     values ('00000000-0000-0000-0000-00000000009a', '00000000-0000-0000-0000-00000000091a', 'otro',
             '00000000-0000-0000-0000-00000000092a', 50) $$,
  '23514',
  null, 'expenses: el tipo solo puede ser purchase o expense');

-- ── Scenario: Identificador y fecha del hecho fijados por el cliente ──────

insert into expenses (id, organization_id, business_line_id, kind, expense_category_id, amount, occurred_at)
values ('00000000-0000-0000-0000-00000000095a', '00000000-0000-0000-0000-00000000009a',
        '00000000-0000-0000-0000-00000000091a', 'expense', '00000000-0000-0000-0000-00000000092a', 80,
        now() - interval '1 day');

select is(
  (select count(*)::int from expenses where id = '00000000-0000-0000-0000-00000000095a'),
  1, 'expenses: conserva el id generado por el cliente');

select ok(
  (select occurred_at < created_at - interval '23 hours'
     from expenses where id = '00000000-0000-0000-0000-00000000095a'),
  'expenses: occurred_at es el del cliente y created_at lo pone el servidor');

-- ── Scenario: Cantidad no positiva / precio negativo ──────────────────────

insert into expenses (id, organization_id, business_line_id, kind, contact_id, occurred_at)
values ('00000000-0000-0000-0000-00000000096a', '00000000-0000-0000-0000-00000000009a',
        '00000000-0000-0000-0000-00000000091a', 'purchase', '00000000-0000-0000-0000-00000000093a',
        '2026-03-01');

select throws_ok(
  $$ insert into expense_items (organization_id, expense_id, item_id, quantity, unit_price)
     values ('00000000-0000-0000-0000-00000000009a', '00000000-0000-0000-0000-00000000096a',
             '00000000-0000-0000-0000-00000000094a', 0, 10) $$,
  '23514',
  null, 'expense_items: la cantidad tiene que ser mayor que cero');

select throws_ok(
  $$ insert into expense_items (organization_id, expense_id, item_id, quantity, unit_price)
     values ('00000000-0000-0000-0000-00000000009a', '00000000-0000-0000-0000-00000000096a',
             '00000000-0000-0000-0000-00000000094a', 1, -1) $$,
  '23514',
  null, 'expense_items: el precio no puede ser negativo');

select throws_ok(
  $$ insert into expense_items (organization_id, expense_id, quantity, unit_price)
     values ('00000000-0000-0000-0000-00000000009a', '00000000-0000-0000-0000-00000000096a', 1, 1) $$,
  '23502',
  null, 'expense_items: toda línea de compra lleva ítem');

-- ── Scenario: El precio de una compra posterior no reescribe la anterior ──

insert into expense_items (id, organization_id, expense_id, item_id, quantity, unit_price)
values ('00000000-0000-0000-0000-00000000097a', '00000000-0000-0000-0000-00000000009a',
        '00000000-0000-0000-0000-00000000096a', '00000000-0000-0000-0000-00000000094a', 10, 8.50);

insert into expenses (id, organization_id, business_line_id, kind, contact_id, occurred_at)
values ('00000000-0000-0000-0000-00000000096b', '00000000-0000-0000-0000-00000000009a',
        '00000000-0000-0000-0000-00000000091a', 'purchase', '00000000-0000-0000-0000-00000000093a',
        '2026-04-01');

insert into expense_items (organization_id, expense_id, item_id, quantity, unit_price)
values ('00000000-0000-0000-0000-00000000009a', '00000000-0000-0000-0000-00000000096b',
        '00000000-0000-0000-0000-00000000094a', 5, 9.20);

select is(
  (select unit_price from expense_items where id = '00000000-0000-0000-0000-00000000097a'),
  8.50::numeric(14,2),
  'expense_items: la línea anterior conserva su precio tras una compra a otro precio');

-- ── Scenario: Intento contra la operación de guardado / Guardado atómico ──

select pg_temp.login('00000000-0000-0000-0000-0000000009a1');

select throws_like(
  $$ select create_expense(
       '{"id":"00000000-0000-0000-0000-00000000098a",
         "organization_id":"00000000-0000-0000-0000-00000000009a",
         "business_line_id":"00000000-0000-0000-0000-00000000091a",
         "kind":"purchase","contact_id":"00000000-0000-0000-0000-00000000093a"}'::jsonb,
       '[]'::jsonb) $$,
  '%al menos una línea%',
  'create_expense: una compra sin líneas se rechaza');

select is(
  (select count(*)::int from expenses where id = '00000000-0000-0000-0000-00000000098a'),
  0, 'create_expense: la compra rechazada no deja encabezado');

-- Una línea inválida entre varias válidas: no queda nada.
select throws_ok(
  $$ select create_expense(
       '{"id":"00000000-0000-0000-0000-00000000098b",
         "organization_id":"00000000-0000-0000-0000-00000000009a",
         "business_line_id":"00000000-0000-0000-0000-00000000091a",
         "kind":"purchase","contact_id":"00000000-0000-0000-0000-00000000093a"}'::jsonb,
       '[{"item_id":"00000000-0000-0000-0000-00000000094a","quantity":2,"unit_price":10},
         {"item_id":"00000000-0000-0000-0000-00000000094b","quantity":0,"unit_price":10}]'::jsonb) $$,
  '23514',
  null, 'create_expense: una línea inválida rechaza la compra entera');

select is(
  (select count(*)::int from expenses where id = '00000000-0000-0000-0000-00000000098b'),
  0, 'create_expense: el guardado es atómico — sin encabezado');

select is(
  (select count(*)::int from expense_items where expense_id = '00000000-0000-0000-0000-00000000098b'),
  0, 'create_expense: el guardado es atómico — sin líneas');

select throws_like(
  $$ select create_expense(
       '{"organization_id":"00000000-0000-0000-0000-00000000009a",
         "business_line_id":"00000000-0000-0000-0000-00000000091a",
         "kind":"expense","expense_category_id":"00000000-0000-0000-0000-00000000092a","amount":10}'::jsonb,
       '[{"item_id":"00000000-0000-0000-0000-00000000094a","quantity":1,"unit_price":1}]'::jsonb) $$,
  '%no lleva líneas%',
  'create_expense: un gasto con líneas de insumo se rechaza');

-- La compra completa: encabezado, líneas con organization_id y el id dado.
select is(
  create_expense(
    '{"id":"00000000-0000-0000-0000-00000000098c",
      "organization_id":"00000000-0000-0000-0000-00000000009a",
      "business_line_id":"00000000-0000-0000-0000-00000000091a",
      "kind":"purchase","contact_id":"00000000-0000-0000-0000-00000000093a",
      "occurred_at":"2026-05-01T10:00:00Z","note":"dos líneas"}'::jsonb,
    '[{"id":"00000000-0000-0000-0000-00000000099a","item_id":"00000000-0000-0000-0000-00000000094a","quantity":3,"unit_price":25},
      {"item_id":"00000000-0000-0000-0000-00000000094b","quantity":1,"unit_price":40}]'::jsonb),
  '00000000-0000-0000-0000-00000000098c'::uuid,
  'create_expense: devuelve el id que trajo el cliente');

select is(
  (select count(*)::int from expense_items
    where expense_id = '00000000-0000-0000-0000-00000000098c'
      and organization_id = '00000000-0000-0000-0000-00000000009a'),
  2, 'create_expense: las líneas nacen con la organización del encabezado');

select is(
  (select created_by from expenses where id = '00000000-0000-0000-0000-00000000098c'),
  '00000000-0000-0000-0000-0000000009a1'::uuid,
  'create_expense: registra quién lo creó');

select is(
  (select total from expense_totals where expense_id = '00000000-0000-0000-0000-00000000098c'),
  115::numeric,
  'create_expense: el total de la compra sale de sus líneas (3×25 + 1×40)');

-- El gasto mínimo también entra por la función.
select ok(
  create_expense(
    '{"organization_id":"00000000-0000-0000-0000-00000000009a",
      "business_line_id":"00000000-0000-0000-0000-00000000091b",
      "kind":"expense","expense_category_id":"00000000-0000-0000-0000-00000000092a","amount":120}'::jsonb,
    '[]'::jsonb) is not null,
  'create_expense: un gasto con monto, categoría y línea se guarda');

select pg_temp.logout();

-- ── Scenario: Ninguna columna almacena el derivado ────────────────────────

select is(
  (select count(*)::int from information_schema.columns
    where table_schema = 'public'
      and table_name = 'expenses'
      and column_name ~ '(total|paid|pagado|balance|saldo|status|estado|margin|margen)'),
  0, 'expenses: ninguna columna de total, pagado, saldo ni estado de pago');

select is(
  (select count(*)::int from information_schema.columns
    where table_schema = 'public'
      and table_name = 'expense_items'
      and column_name ~ '(total|subtotal|line_total)'),
  0, 'expense_items: el total de la línea tampoco se guarda');

select * from finish();

rollback;
