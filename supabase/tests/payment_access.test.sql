-- KAM-10 · payments: permiso partido del ayudante y aislamiento por
-- organización.
-- Escenarios del delta spec `payments`: "El ayudante cobra pero no paga" y
-- "Aislamiento por organización de los movimientos".
-- Es la única tabla del proyecto con permiso partido (matriz §16): el
-- ayudante crea cobros y no pagos.
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

-- ── Semilla propia: dos organizaciones ────────────────────────────────────

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000013a1', 'owner-acc-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000013a2', 'assistant-acc-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000013a3', 'owner-acc-b@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-0000000000c0', 'Acceso A'),
  ('00000000-0000-0000-0000-0000000000c9', 'Acceso B');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000c0', '00000000-0000-0000-0000-0000000013a1', 'owner'),
  ('00000000-0000-0000-0000-0000000000c0', '00000000-0000-0000-0000-0000000013a2', 'assistant'),
  ('00000000-0000-0000-0000-0000000000c9', '00000000-0000-0000-0000-0000000013a3', 'owner');

insert into business_lines (id, organization_id, name, position) values
  ('00000000-0000-0000-0000-0000000013b1', '00000000-0000-0000-0000-0000000000c0', 'Sublimación', 1),
  ('00000000-0000-0000-0000-0000000013b9', '00000000-0000-0000-0000-0000000000c9', 'Sublimación', 1);

insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-0000000013c1', '00000000-0000-0000-0000-0000000000c0', '00000000-0000-0000-0000-0000000013b1', 'order', 'Registrado', 'initial', 1),
  ('00000000-0000-0000-0000-0000000013c9', '00000000-0000-0000-0000-0000000000c9', '00000000-0000-0000-0000-0000000013b9', 'order', 'Registrado', 'initial', 1);

insert into expense_categories (id, organization_id, name) values
  ('00000000-0000-0000-0000-0000000013d1', '00000000-0000-0000-0000-0000000000c0', 'Servicios');

insert into contacts (id, organization_id, name, is_customer) values
  ('00000000-0000-0000-0000-0000000013e1', '00000000-0000-0000-0000-0000000000c0', 'Cliente A', true),
  ('00000000-0000-0000-0000-0000000013e9', '00000000-0000-0000-0000-0000000000c9', 'Cliente B', true);

insert into orders (id, organization_id, business_line_id, kind, contact_id, status_id) values
  ('00000000-0000-0000-0000-000000013f01', '00000000-0000-0000-0000-0000000000c0',
   '00000000-0000-0000-0000-0000000013b1', 'order',
   '00000000-0000-0000-0000-0000000013e1', '00000000-0000-0000-0000-0000000013c1'),
  ('00000000-0000-0000-0000-000000013f09', '00000000-0000-0000-0000-0000000000c9',
   '00000000-0000-0000-0000-0000000013b9', 'order',
   '00000000-0000-0000-0000-0000000013e9', '00000000-0000-0000-0000-0000000013c9');

insert into expenses (id, organization_id, business_line_id, kind, expense_category_id, amount) values
  ('00000000-0000-0000-0000-000000013f11', '00000000-0000-0000-0000-0000000000c0',
   '00000000-0000-0000-0000-0000000013b1', 'expense',
   '00000000-0000-0000-0000-0000000013d1', 100.00);

-- Un movimiento de cada tipo, sembrado sin RLS para poder leerlos después.
insert into payments (id, organization_id, direction, order_id, amount) values
  ('00000000-0000-0000-0000-000000014001', '00000000-0000-0000-0000-0000000000c0', 'in', '00000000-0000-0000-0000-000000013f01', 10),
  ('00000000-0000-0000-0000-000000014009', '00000000-0000-0000-0000-0000000000c9', 'in', '00000000-0000-0000-0000-000000013f09', 90);

insert into payments (id, organization_id, direction, expense_id, amount) values
  ('00000000-0000-0000-0000-000000014002', '00000000-0000-0000-0000-0000000000c0', 'out', '00000000-0000-0000-0000-000000013f11', 20);

-- ── Requirement: El ayudante cobra pero no paga ───────────────────────────

select pg_temp.login('00000000-0000-0000-0000-0000000013a2');

-- Scenario: El ayudante registra un cobro
select lives_ok(
  $$insert into payments (id, organization_id, direction, order_id, amount)
    values ('00000000-0000-0000-0000-000000014003',
            '00000000-0000-0000-0000-0000000000c0', 'in',
            '00000000-0000-0000-0000-000000013f01', 15)$$,
  'Scenario: El ayudante registra un cobro — direction in se acepta'
);

-- Scenario: El ayudante intenta registrar un pago
select throws_ok(
  $$insert into payments (organization_id, direction, expense_id, amount)
    values ('00000000-0000-0000-0000-0000000000c0', 'out',
            '00000000-0000-0000-0000-000000013f11', 15)$$,
  '42501',
  null,
  'Scenario: El ayudante intenta registrar un pago — la política de escritura lo rechaza'
);

-- Scenario: El ayudante no ve el egreso de todos modos
select is(
  (select count(*)::int from payments where expense_id is not null),
  0,
  'Scenario: El ayudante no ve el egreso de todos modos — cero filas con expense_id'
);

select is(
  (select count(*)::int from expenses),
  0,
  'El ayudante tampoco ve los egresos a los que apuntarían'
);

-- Scenario: Solo el dueño anula
select throws_ok(
  $$update payments set archived_at = now()
    where id = '00000000-0000-0000-0000-000000014001'$$,
  '42501',
  null,
  'Scenario: Solo el dueño anula — el ayudante no puede archivar un movimiento'
);

-- Los cobros de su organización sí los ve.
select is(
  (select count(*)::int from payments where direction = 'in'),
  2,
  'El ayudante ve los cobros de su organización'
);

select pg_temp.logout();

-- Scenario: El dueño registra un pago
select pg_temp.login('00000000-0000-0000-0000-0000000013a1');

select lives_ok(
  $$insert into payments (id, organization_id, direction, expense_id, amount)
    values ('00000000-0000-0000-0000-000000014004',
            '00000000-0000-0000-0000-0000000000c0', 'out',
            '00000000-0000-0000-0000-000000013f11', 25)$$,
  'Scenario: El dueño registra un pago — direction out se acepta'
);

-- ── Requirement: Aislamiento por organización de los movimientos ──────────

-- Scenario: Movimientos de otra organización
select is(
  (select count(*)::int from payments
    where organization_id = '00000000-0000-0000-0000-0000000000c9'),
  0,
  'Scenario: Movimientos de otra organización — no aparece ninguno de la organización B'
);

-- Scenario: Crear en organización ajena
select throws_ok(
  $$insert into payments (organization_id, direction, order_id, amount)
    values ('00000000-0000-0000-0000-0000000000c9', 'in',
            '00000000-0000-0000-0000-000000013f09', 10)$$,
  '42501',
  null,
  'Scenario: Crear en organización ajena — la política lo rechaza'
);

-- Scenario: Destino de otra organización
-- La referencia compuesta (order_id, organization_id) lo impide antes que RLS:
-- el pedido de B no existe bajo la organización A.
select throws_ok(
  $$insert into payments (organization_id, direction, order_id, amount)
    values ('00000000-0000-0000-0000-0000000000c0', 'in',
            '00000000-0000-0000-0000-000000013f09', 10)$$,
  '23503',
  null,
  'Scenario: Destino de otra organización — la referencia compuesta lo rechaza'
);

select pg_temp.logout();

select * from finish();
rollback;
