-- KAM-10 · payments: dominio del movimiento, destino único, dirección
-- coherente con el destino e inmutabilidad del hecho.
-- Escenarios del delta spec `payments`: "Modelo de movimiento de dinero",
-- "Un movimiento apunta exactamente a un destino", "La dirección se deduce del
-- destino y la base de datos la impone", "Un movimiento registrado no se
-- edita" y los dos escenarios de base de "Anular un cobro mediante movimiento
-- inverso" ("La fila no se borra", "Un movimiento archivado no se edita").
begin;

set search_path to public, extensions;

select plan(22);

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
-- Toda prueba crea su propia organización.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000010a1', 'owner-pay-a@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-0000000000a0', 'Cobros A');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000a0', '00000000-0000-0000-0000-0000000010a1', 'owner');

insert into business_lines (id, organization_id, name, is_shared, position) values
  ('00000000-0000-0000-0000-0000000010b1', '00000000-0000-0000-0000-0000000000a0', 'Sublimación', false, 1);

insert into expense_categories (id, organization_id, name) values
  ('00000000-0000-0000-0000-0000000010c1', '00000000-0000-0000-0000-0000000000a0', 'Servicios');

insert into contacts (id, organization_id, name, is_supplier, is_customer) values
  ('00000000-0000-0000-0000-0000000010d1', '00000000-0000-0000-0000-0000000000a0', 'Cliente A',   false, true),
  ('00000000-0000-0000-0000-0000000010d2', '00000000-0000-0000-0000-0000000000a0', 'Proveedor A', true,  false);

insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-0000000010b2', '00000000-0000-0000-0000-0000000000a0', '00000000-0000-0000-0000-0000000010b1', 'order', 'Registrado', 'initial', 1);

insert into orders (id, organization_id, business_line_id, kind, contact_id, status_id) values
  ('00000000-0000-0000-0000-0000000010e1', '00000000-0000-0000-0000-0000000000a0',
   '00000000-0000-0000-0000-0000000010b1', 'order',
   '00000000-0000-0000-0000-0000000010d1', '00000000-0000-0000-0000-0000000010b2');

insert into expenses (id, organization_id, business_line_id, kind, expense_category_id, amount) values
  ('00000000-0000-0000-0000-0000000010f1', '00000000-0000-0000-0000-0000000000a0',
   '00000000-0000-0000-0000-0000000010b1', 'expense',
   '00000000-0000-0000-0000-0000000010c1', 500.00);

-- ── Requirement: Modelo de movimiento de dinero ───────────────────────────

-- Scenario: Movimiento válido
select lives_ok(
  $$insert into payments (id, organization_id, direction, order_id, amount, method)
    values ('00000000-0000-0000-0000-000000001001',
            '00000000-0000-0000-0000-0000000000a0', 'in',
            '00000000-0000-0000-0000-0000000010e1', 50.00, 'cash')$$,
  'Scenario: Movimiento válido — organización, dirección in, pedido y monto 50 se acepta'
);

-- Scenario: Monto cero
select throws_ok(
  $$insert into payments (organization_id, direction, order_id, amount)
    values ('00000000-0000-0000-0000-0000000000a0', 'in',
            '00000000-0000-0000-0000-0000000010e1', 0)$$,
  '23514',
  null,
  'Scenario: Monto cero — la base rechaza un movimiento con amount = 0'
);

-- Scenario: Monto negativo
select throws_ok(
  $$insert into payments (organization_id, direction, order_id, amount)
    values ('00000000-0000-0000-0000-0000000000a0', 'in',
            '00000000-0000-0000-0000-0000000010e1', -10)$$,
  '23514',
  null,
  'Scenario: Monto negativo — la base rechaza un movimiento con amount negativo'
);

-- Scenario: Método fuera del dominio
select throws_ok(
  $$insert into payments (organization_id, direction, order_id, amount, method)
    values ('00000000-0000-0000-0000-0000000000a0', 'in',
            '00000000-0000-0000-0000-0000000010e1', 10, 'crypto')$$,
  '23514',
  null,
  'Scenario: Método fuera del dominio — solo cash, transfer u other'
);

-- Scenario: Método ausente
select lives_ok(
  $$insert into payments (id, organization_id, direction, order_id, amount)
    values ('00000000-0000-0000-0000-000000001002',
            '00000000-0000-0000-0000-0000000000a0', 'in',
            '00000000-0000-0000-0000-0000000010e1', 10)$$,
  'Scenario: Método ausente — un movimiento sin método se acepta'
);

-- La dirección la expresa `direction`, nunca el signo del monto.
select is(
  (select count(*)::int from payments where amount <= 0),
  0,
  'El importe se registra siempre en positivo: la dirección no la lleva el signo'
);

-- ── Requirement: Un movimiento apunta exactamente a un destino ────────────

-- Scenario: Movimiento con dos destinos
select throws_ok(
  $$insert into payments (organization_id, direction, order_id, expense_id, amount)
    values ('00000000-0000-0000-0000-0000000000a0', 'in',
            '00000000-0000-0000-0000-0000000010e1',
            '00000000-0000-0000-0000-0000000010f1', 10)$$,
  '23514',
  null,
  'Scenario: Movimiento con dos destinos — exactly_one_target lo rechaza'
);

-- Scenario: Movimiento sin destino
select throws_ok(
  $$insert into payments (organization_id, direction, amount)
    values ('00000000-0000-0000-0000-0000000000a0', 'in', 10)$$,
  '23514',
  null,
  'Scenario: Movimiento sin destino — exactly_one_target lo rechaza'
);

-- Scenario: Movimiento contra un pedido
select lives_ok(
  $$insert into payments (id, organization_id, direction, order_id, amount)
    values ('00000000-0000-0000-0000-000000001003',
            '00000000-0000-0000-0000-0000000000a0', 'in',
            '00000000-0000-0000-0000-0000000010e1', 5)$$,
  'Scenario: Movimiento contra un pedido — con order_id y sin expense_id se acepta'
);

-- Scenario: Movimiento contra un egreso
select lives_ok(
  $$insert into payments (id, organization_id, direction, expense_id, amount)
    values ('00000000-0000-0000-0000-000000001004',
            '00000000-0000-0000-0000-0000000000a0', 'out',
            '00000000-0000-0000-0000-0000000010f1', 5)$$,
  'Scenario: Movimiento contra un egreso — con expense_id y sin order_id se acepta'
);

-- La restricción existe con el nombre que el criterio 4 del backlog nombra.
select has_check(
  'public', 'payments',
  'Existe la restricción de destino sobre payments'
);
select col_is_fk(
  'public', 'payments', array['order_id', 'organization_id'],
  'El destino pedido va referenciado junto con la organización'
);

-- ── Requirement: La dirección se deduce del destino ───────────────────────

-- Scenario: Cobro de pedido
select lives_ok(
  $$insert into payments (id, organization_id, direction, order_id, amount)
    values ('00000000-0000-0000-0000-000000001005',
            '00000000-0000-0000-0000-0000000000a0', 'in',
            '00000000-0000-0000-0000-0000000010e1', 5)$$,
  'Scenario: Cobro de pedido — order_id con direction in se acepta'
);

-- Scenario: Pago de egreso
select lives_ok(
  $$insert into payments (id, organization_id, direction, expense_id, amount)
    values ('00000000-0000-0000-0000-000000001006',
            '00000000-0000-0000-0000-0000000000a0', 'out',
            '00000000-0000-0000-0000-0000000010f1', 5)$$,
  'Scenario: Pago de egreso — expense_id con direction out se acepta'
);

-- Scenario: Dirección contraria sobre un pedido
select throws_ok(
  $$insert into payments (organization_id, direction, order_id, amount)
    values ('00000000-0000-0000-0000-0000000000a0', 'out',
            '00000000-0000-0000-0000-0000000010e1', 5)$$,
  '23514',
  null,
  'Scenario: Dirección contraria sobre un pedido — direction_matches_target lo rechaza'
);

-- Scenario: Dirección contraria sobre un egreso
select throws_ok(
  $$insert into payments (organization_id, direction, expense_id, amount)
    values ('00000000-0000-0000-0000-0000000000a0', 'in',
            '00000000-0000-0000-0000-0000000010f1', 5)$$,
  '23514',
  null,
  'Scenario: Dirección contraria sobre un egreso — direction_matches_target lo rechaza'
);

-- Y no hay tercera dirección posible.
select throws_ok(
  $$insert into payments (organization_id, direction, order_id, amount)
    values ('00000000-0000-0000-0000-0000000000a0', 'refund',
            '00000000-0000-0000-0000-0000000010e1', 5)$$,
  '23514',
  null,
  'direction solo admite in u out'
);

-- ── Requirement: Un movimiento registrado no se edita ─────────────────────

select pg_temp.login('00000000-0000-0000-0000-0000000010a1');

-- Scenario: Intento de corregir el importe
select throws_ok(
  $$update payments set amount = 999
    where id = '00000000-0000-0000-0000-000000001001'$$,
  '23514',
  null,
  'Scenario: Intento de corregir el importe — se rechaza; se anula y se registra otro'
);

-- Scenario: Intento de cambiar el destino
select throws_ok(
  $$update payments set order_id = null, expense_id = '00000000-0000-0000-0000-0000000010f1'
    where id = '00000000-0000-0000-0000-000000001001'$$,
  null,
  null,
  'Scenario: Intento de cambiar el destino — se rechaza'
);

-- Scenario: Archivar sí está permitido
select lives_ok(
  $$update payments set archived_at = now()
    where id = '00000000-0000-0000-0000-000000001002'$$,
  'Scenario: Archivar sí está permitido — el dueño fija archived_at sobre un movimiento vigente'
);

-- Scenario: Un movimiento archivado no se edita
select throws_ok(
  $$update payments set amount = 1
    where id = '00000000-0000-0000-0000-000000001002'$$,
  '23514',
  null,
  'Scenario: Un movimiento archivado no se edita'
);

-- Scenario: La fila no se borra
select throws_ok(
  $$delete from payments where id = '00000000-0000-0000-0000-000000001001'$$,
  '42501',
  null,
  'Scenario: La fila no se borra — sin política DELETE, ni el dueño puede eliminarla'
);

select pg_temp.logout();

select * from finish();
rollback;
