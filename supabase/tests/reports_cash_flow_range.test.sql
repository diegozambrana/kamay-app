-- KAM-20 · Función derivada `cash_flow_by_line_range`.
-- Escenarios del delta spec `payments` § Flujo de caja del periodo por línea:
--   "Cobrado y pagado del mes", "Un rango que no empieza el día 1",
--   "Los extremos del rango se incluyen", "Cada movimiento cae en el mes en
--   que ocurrió", "El movimiento anulado no suma", "La línea la pone el
--   destino", "Un mes sin movimiento no inventa filas".
-- El recorte por rol y el aislamiento viven en `reports_access.test.sql`.
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
-- Zona horaria explícita: los extremos del rango los resuelve la aplicación,
-- pero la prueba usa instantes con desfase para que el borde del mes sea el
-- de La Paz y no el del servidor.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000020a1', 'owner-range@kamay.test');

insert into organizations (id, name, timezone) values
  ('00000000-0000-0000-0000-0000000020b0', 'Rango A', 'America/La_Paz');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000020b0', '00000000-0000-0000-0000-0000000020a1', 'owner');

insert into business_lines (id, organization_id, name, position) values
  ('00000000-0000-0000-0000-0000000020c1', '00000000-0000-0000-0000-0000000020b0', 'Sublimación', 1),
  ('00000000-0000-0000-0000-0000000020c2', '00000000-0000-0000-0000-0000000020b0', 'Alfarería',   2),
  ('00000000-0000-0000-0000-0000000020c3', '00000000-0000-0000-0000-0000000020b0', 'Sin uso',     3);

insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-0000000020d1', '00000000-0000-0000-0000-0000000020b0', '00000000-0000-0000-0000-0000000020c1', 'order', 'Registrado', 'initial', 1),
  ('00000000-0000-0000-0000-0000000020d2', '00000000-0000-0000-0000-0000000020b0', '00000000-0000-0000-0000-0000000020c2', 'order', 'Registrado', 'initial', 1);

insert into expense_categories (id, organization_id, name) values
  ('00000000-0000-0000-0000-0000000020e1', '00000000-0000-0000-0000-0000000020b0', 'Servicios');

insert into contacts (id, organization_id, name, is_customer) values
  ('00000000-0000-0000-0000-0000000020f1', '00000000-0000-0000-0000-0000000020b0', 'Cliente', true);

-- El pedido nace en ENERO y se cobra en FEBRERO: es lo que distingue medir
-- por la fecha del movimiento de medir por la del pedido.
insert into orders (id, organization_id, business_line_id, kind, contact_id, status_id, occurred_at) values
  ('00000000-0000-0000-0000-000000020101', '00000000-0000-0000-0000-0000000020b0',
   '00000000-0000-0000-0000-0000000020c1', 'order',
   '00000000-0000-0000-0000-0000000020f1', '00000000-0000-0000-0000-0000000020d1',
   '2026-01-15 12:00:00-04'),
  ('00000000-0000-0000-0000-000000020102', '00000000-0000-0000-0000-0000000020b0',
   '00000000-0000-0000-0000-0000000020c2', 'order',
   '00000000-0000-0000-0000-0000000020f1', '00000000-0000-0000-0000-0000000020d2',
   '2026-02-10 12:00:00-04');

-- Egreso de Alfarería: el pagado tiene que salir de SU línea, no de la del
-- cobro ni de ninguna que declare el movimiento (que no declara ninguna).
insert into expenses (id, organization_id, business_line_id, kind, expense_category_id, amount, occurred_at) values
  ('00000000-0000-0000-0000-000000020201', '00000000-0000-0000-0000-0000000020b0',
   '00000000-0000-0000-0000-0000000020c2', 'expense',
   '00000000-0000-0000-0000-0000000020e1', 350.00, '2026-02-05 12:00:00-04');

insert into payments (id, organization_id, direction, order_id, amount, occurred_at) values
  -- Sublimación, dentro de febrero: 300 + 600 = 900.
  ('00000000-0000-0000-0000-000000020301', '00000000-0000-0000-0000-0000000020b0', 'in',
   '00000000-0000-0000-0000-000000020101', 300, '2026-02-03 12:00:00-04'),
  ('00000000-0000-0000-0000-000000020302', '00000000-0000-0000-0000-0000000020b0', 'in',
   '00000000-0000-0000-0000-000000020101', 600, '2026-02-20 12:00:00-04'),
  -- Este se anula más abajo: deja de sumar.
  ('00000000-0000-0000-0000-000000020303', '00000000-0000-0000-0000-0000000020b0', 'in',
   '00000000-0000-0000-0000-000000020101', 70,  '2026-02-11 12:00:00-04'),
  -- Justo en el primer instante del rango del 12 de marzo.
  ('00000000-0000-0000-0000-000000020304', '00000000-0000-0000-0000-0000000020b0', 'in',
   '00000000-0000-0000-0000-000000020101', 500, '2026-03-12 00:00:00-04'),
  -- Último instante del 20 de abril en La Paz: 23:59.
  ('00000000-0000-0000-0000-000000020305', '00000000-0000-0000-0000-0000000020b0', 'in',
   '00000000-0000-0000-0000-000000020101', 700, '2026-04-20 23:59:00-04'),
  -- Fuera por poco, por los dos extremos.
  ('00000000-0000-0000-0000-000000020306', '00000000-0000-0000-0000-0000000020b0', 'in',
   '00000000-0000-0000-0000-000000020101', 999, '2026-03-11 23:59:00-04'),
  ('00000000-0000-0000-0000-000000020307', '00000000-0000-0000-0000-0000000020b0', 'in',
   '00000000-0000-0000-0000-000000020101', 888, '2026-04-21 00:01:00-04');

insert into payments (id, organization_id, direction, expense_id, amount, occurred_at) values
  ('00000000-0000-0000-0000-000000020401', '00000000-0000-0000-0000-0000000020b0', 'out',
   '00000000-0000-0000-0000-000000020201', 350, '2026-02-06 12:00:00-04');

update payments set archived_at = now()
  where id = '00000000-0000-0000-0000-000000020303';

select pg_temp.login('00000000-0000-0000-0000-0000000020a1');

-- ── Cobrado y pagado del mes ──────────────────────────────────────────────

select is(
  (select collected from cash_flow_by_line_range(
     '00000000-0000-0000-0000-0000000020b0',
     '2026-02-01 00:00:00-04', '2026-03-01 00:00:00-04')
   where business_line_id = '00000000-0000-0000-0000-0000000020c1'),
  900::numeric,
  'Cobrado del mes: los dos cobros de febrero suman 900'
);

-- ── La línea la pone el destino ───────────────────────────────────────────
-- El cobro es de Sublimación (su pedido) y el pago de Alfarería (su egreso).
-- `payments` no declara línea: si esto falla, la deducción se rompió.

select is(
  (select paid from cash_flow_by_line_range(
     '00000000-0000-0000-0000-0000000020b0',
     '2026-02-01 00:00:00-04', '2026-03-01 00:00:00-04')
   where business_line_id = '00000000-0000-0000-0000-0000000020c2'),
  350::numeric,
  'El pago suma en la línea de su egreso, no en la del cobro'
);

select is(
  (select paid from cash_flow_by_line_range(
     '00000000-0000-0000-0000-0000000020b0',
     '2026-02-01 00:00:00-04', '2026-03-01 00:00:00-04')
   where business_line_id = '00000000-0000-0000-0000-0000000020c1'),
  0::numeric,
  'Sublimación no carga con el pago de Alfarería'
);

-- ── El movimiento anulado no suma ─────────────────────────────────────────
-- Los 70 archivados están dentro del rango: si sumaran, el total sería 970.

select is(
  (select collected from cash_flow_by_line_range(
     '00000000-0000-0000-0000-0000000020b0',
     '2026-02-01 00:00:00-04', '2026-03-01 00:00:00-04')
   where business_line_id = '00000000-0000-0000-0000-0000000020c1'),
  900::numeric,
  'El cobro anulado dentro del rango no suma'
);

-- ── Cada movimiento cae en el mes en que ocurrió ──────────────────────────
-- El pedido es de enero y sus cobros de febrero: enero no ve nada.

select is(
  (select count(*) from cash_flow_by_line_range(
     '00000000-0000-0000-0000-0000000020b0',
     '2026-01-01 00:00:00-04', '2026-02-01 00:00:00-04')),
  0::bigint,
  'El pedido de enero no aporta ingreso a enero: manda la fecha del cobro'
);

-- ── Un rango que no empieza el día 1 ──────────────────────────────────────
-- Del 12 de marzo al 20 de abril: 500 + 700 = 1.200. Los 999 del 11 de marzo
-- y los 888 del 21 de abril quedan fuera.

select is(
  (select collected from cash_flow_by_line_range(
     '00000000-0000-0000-0000-0000000020b0',
     '2026-03-12 00:00:00-04', '2026-04-21 00:00:00-04')
   where business_line_id = '00000000-0000-0000-0000-0000000020c1'),
  1200::numeric,
  'Un rango del 12 de marzo al 20 de abril devuelve solo lo suyo'
);

-- ── Los extremos del rango se incluyen ────────────────────────────────────
-- Un rango de un solo día que contiene el cobro del primer instante.

select is(
  (select collected from cash_flow_by_line_range(
     '00000000-0000-0000-0000-0000000020b0',
     '2026-03-12 00:00:00-04', '2026-03-13 00:00:00-04')
   where business_line_id = '00000000-0000-0000-0000-0000000020c1'),
  500::numeric,
  'El cobro del primer instante del rango entra'
);

select is(
  (select collected from cash_flow_by_line_range(
     '00000000-0000-0000-0000-0000000020b0',
     '2026-04-20 00:00:00-04', '2026-04-21 00:00:00-04')
   where business_line_id = '00000000-0000-0000-0000-0000000020c1'),
  700::numeric,
  'El cobro de las 23:59 del último día del rango entra'
);

-- ── Un mes sin movimiento no inventa filas ────────────────────────────────
-- La línea "Sin uso" existe y nunca movió dinero: la función no debe
-- fabricarle una fila de ceros. Quien la consuma la presenta como cero.

select is(
  (select count(*) from cash_flow_by_line_range(
     '00000000-0000-0000-0000-0000000020b0',
     '2026-02-01 00:00:00-04', '2026-03-01 00:00:00-04')
   where business_line_id = '00000000-0000-0000-0000-0000000020c3'),
  0::bigint,
  'Una línea sin movimiento en el rango no produce fila'
);

select * from finish();
rollback;
