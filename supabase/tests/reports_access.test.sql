-- KAM-20 · Recorte por rol y aislamiento de las seis funciones de reportes.
-- Escenarios del delta spec `payments` § Flujo de caja del periodo por línea:
--   "El ayudante obtiene cero filas", "Ninguna organización ve a otra".
-- Del delta spec `expenses` § Agregación de egresos por categoría y línea
--   dentro de un periodo: "El ayudante obtiene cero filas", "Ninguna
--   organización ve a otra".
-- Del delta spec `orders` § Ranking de productos vendidos…: "El ayudante
--   obtiene cero filas".
-- Del delta spec `reports` § Reportes es una página completa reservada a la
--   persona dueña: "El ayudante consulta el derivado a mano".
--
-- Lo que esta prueba distingue, y por eso existe: cero filas **por recorte**
-- no es lo mismo que cero filas **por ausencia de datos**. La dueña de A ve
-- cifras sobre exactamente los mismos datos con los que el ayudante ve nada.
begin;

set search_path to public, extensions;

select plan(16);

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

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000023a1', 'owner-acc@kamay.test'),
  ('00000000-0000-0000-0000-0000000023a2', 'helper-acc@kamay.test'),
  ('00000000-0000-0000-0000-0000000023a3', 'owner-acc-b@kamay.test');

insert into organizations (id, name, timezone) values
  ('00000000-0000-0000-0000-0000000023b0', 'Acceso A', 'America/La_Paz'),
  ('00000000-0000-0000-0000-0000000023b9', 'Acceso B', 'America/La_Paz');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000023b0', '00000000-0000-0000-0000-0000000023a1', 'owner'),
  ('00000000-0000-0000-0000-0000000023b0', '00000000-0000-0000-0000-0000000023a2', 'assistant'),
  ('00000000-0000-0000-0000-0000000023b9', '00000000-0000-0000-0000-0000000023a3', 'owner');

insert into business_lines (id, organization_id, name, position) values
  ('00000000-0000-0000-0000-0000000023c1', '00000000-0000-0000-0000-0000000023b0', 'Sublimación', 1),
  ('00000000-0000-0000-0000-0000000023c9', '00000000-0000-0000-0000-0000000023b9', 'Sublimación', 1);

insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-0000000023d1', '00000000-0000-0000-0000-0000000023b0', '00000000-0000-0000-0000-0000000023c1', 'order', 'Registrado', 'initial', 1),
  ('00000000-0000-0000-0000-0000000023d9', '00000000-0000-0000-0000-0000000023b9', '00000000-0000-0000-0000-0000000023c9', 'order', 'Registrado', 'initial', 1);

insert into expense_categories (id, organization_id, name) values
  ('00000000-0000-0000-0000-0000000023e1', '00000000-0000-0000-0000-0000000023b0', 'Insumos'),
  ('00000000-0000-0000-0000-0000000023e9', '00000000-0000-0000-0000-0000000023b9', 'Insumos');

insert into contacts (id, organization_id, name, is_customer) values
  ('00000000-0000-0000-0000-0000000023f1', '00000000-0000-0000-0000-0000000023b0', 'Cliente A', true),
  ('00000000-0000-0000-0000-0000000023f9', '00000000-0000-0000-0000-0000000023b9', 'Cliente B', true);

insert into items (id, organization_id, business_line_id, kind, name, min_stock) values
  ('00000000-0000-0000-0000-000000002301', '00000000-0000-0000-0000-0000000023b0', '00000000-0000-0000-0000-0000000023c1', 'product', 'Taza',  null),
  ('00000000-0000-0000-0000-000000002302', '00000000-0000-0000-0000-0000000023b0', '00000000-0000-0000-0000-0000000023c1', 'supply',  'Papel', 10);

insert into orders (id, organization_id, business_line_id, kind, contact_id, status_id, occurred_at) values
  ('00000000-0000-0000-0000-000000023101', '00000000-0000-0000-0000-0000000023b0', '00000000-0000-0000-0000-0000000023c1', 'order', '00000000-0000-0000-0000-0000000023f1', '00000000-0000-0000-0000-0000000023d1', '2026-03-10 12:00:00-04'),
  ('00000000-0000-0000-0000-000000023901', '00000000-0000-0000-0000-0000000023b9', '00000000-0000-0000-0000-0000000023c9', 'order', '00000000-0000-0000-0000-0000000023f9', '00000000-0000-0000-0000-0000000023d9', '2026-03-10 12:00:00-04');

insert into order_items (organization_id, order_id, item_id, quantity, unit_price) values
  ('00000000-0000-0000-0000-0000000023b0', '00000000-0000-0000-0000-000000023101', '00000000-0000-0000-0000-000000002301', 1, 900),
  ('00000000-0000-0000-0000-0000000023b9', '00000000-0000-0000-0000-000000023901', null, 1, 4000);

insert into expenses (id, organization_id, business_line_id, kind, expense_category_id, amount, occurred_at) values
  ('00000000-0000-0000-0000-000000023201', '00000000-0000-0000-0000-0000000023b0', '00000000-0000-0000-0000-0000000023c1', 'expense', '00000000-0000-0000-0000-0000000023e1', 350.00, '2026-03-11 12:00:00-04'),
  ('00000000-0000-0000-0000-000000023901', '00000000-0000-0000-0000-0000000023b9', '00000000-0000-0000-0000-0000000023c9', 'expense', '00000000-0000-0000-0000-0000000023e9', 700.00, '2026-03-11 12:00:00-04');

-- El ayudante registra este cobro: puede leerlo fila a fila desde KAM-10, y
-- esa es justamente la razón por la que `security invoker` a secas no bastaba.
insert into payments (id, organization_id, direction, order_id, amount, occurred_at, created_by) values
  ('00000000-0000-0000-0000-000000023301', '00000000-0000-0000-0000-0000000023b0', 'in', '00000000-0000-0000-0000-000000023101', 900, '2026-03-12 12:00:00-04', '00000000-0000-0000-0000-0000000023a2'),
  ('00000000-0000-0000-0000-000000023901', '00000000-0000-0000-0000-0000000023b9', 'in', '00000000-0000-0000-0000-000000023901', 4000, '2026-03-12 12:00:00-04', null);

-- Insumo bajo mínimo, para que `report_low_stock` tenga qué devolver.
insert into inventory_movements (organization_id, item_id, kind, quantity, source_type, occurred_at) values
  ('00000000-0000-0000-0000-0000000023b0', '00000000-0000-0000-0000-000000002302', 'in', 3, 'manual', '2026-03-01 12:00:00-04');

-- ── La dueña de A sí ve: cero filas del ayudante será por recorte ─────────

select pg_temp.login('00000000-0000-0000-0000-0000000023a1');

select isnt_empty(
  $$ select * from cash_flow_by_line_range(
       '00000000-0000-0000-0000-0000000023b0',
       '2026-03-01 00:00:00-04', '2026-04-01 00:00:00-04') $$,
  'La dueña de A ve flujo de caja: hay datos que ver'
);

select isnt_empty(
  $$ select * from report_expense_breakdown(
       '00000000-0000-0000-0000-0000000023b0',
       '2026-03-01 00:00:00-04', '2026-04-01 00:00:00-04') $$,
  'La dueña de A ve el desglose de egresos'
);

select isnt_empty(
  $$ select * from report_product_ranking(
       '00000000-0000-0000-0000-0000000023b0',
       '2026-03-01 00:00:00-04', '2026-04-01 00:00:00-04') $$,
  'La dueña de A ve el ranking de productos'
);

select isnt_empty(
  $$ select * from report_profitability(
       '00000000-0000-0000-0000-0000000023b0',
       '2026-03-01 00:00:00-04', '2026-04-01 00:00:00-04') $$,
  'La dueña de A ve la rentabilidad'
);

select isnt_empty(
  $$ select * from report_low_stock('00000000-0000-0000-0000-0000000023b0') $$,
  'La dueña de A ve los insumos bajo mínimo'
);

select isnt_empty(
  $$ select * from report_line_comparison(
       '00000000-0000-0000-0000-0000000023b0',
       '2026-03-01 00:00:00-04', '2026-04-01 00:00:00-04') $$,
  'La dueña de A ve el comparativo entre líneas'
);

-- ── Ninguna organización ve a otra ────────────────────────────────────────
-- Misma sesión de la dueña de A, preguntando por la organización B.

select is_empty(
  $$ select * from cash_flow_by_line_range(
       '00000000-0000-0000-0000-0000000023b9',
       '2026-03-01 00:00:00-04', '2026-04-01 00:00:00-04') $$,
  'La dueña de A no ve el flujo de caja de B'
);

select is_empty(
  $$ select * from report_expense_breakdown(
       '00000000-0000-0000-0000-0000000023b9',
       '2026-03-01 00:00:00-04', '2026-04-01 00:00:00-04') $$,
  'La dueña de A no ve los egresos de B'
);

select is_empty(
  $$ select * from report_line_comparison(
       '00000000-0000-0000-0000-0000000023b9',
       '2026-03-01 00:00:00-04', '2026-04-01 00:00:00-04') $$,
  'La dueña de A no ve el comparativo de B'
);

-- ── El ayudante obtiene cero filas ────────────────────────────────────────
-- Sobre EXACTAMENTE los mismos datos que la dueña acaba de ver.

select pg_temp.login('00000000-0000-0000-0000-0000000023a2');

-- Primero: el ayudante sí lee el cobro individual (KAM-10). Si esto fallara,
-- las comprobaciones de abajo no probarían el recorte, solo la ausencia.
select isnt_empty(
  $$ select 1 from payments
     where id = '00000000-0000-0000-0000-000000023301' $$,
  'El ayudante sí lee fila a fila el cobro que registró'
);

select is_empty(
  $$ select * from cash_flow_by_line_range(
       '00000000-0000-0000-0000-0000000023b0',
       '2026-03-01 00:00:00-04', '2026-04-01 00:00:00-04') $$,
  'El ayudante obtiene cero filas del flujo de caja, con cualquier rango'
);

select is_empty(
  $$ select * from report_expense_breakdown(
       '00000000-0000-0000-0000-0000000023b0',
       '2026-03-01 00:00:00-04', '2026-04-01 00:00:00-04') $$,
  'El ayudante obtiene cero filas del desglose de egresos'
);

select is_empty(
  $$ select * from report_product_ranking(
       '00000000-0000-0000-0000-0000000023b0',
       '2026-03-01 00:00:00-04', '2026-04-01 00:00:00-04') $$,
  'El ayudante obtiene cero filas del ranking: expone margen'
);

select is_empty(
  $$ select * from report_profitability(
       '00000000-0000-0000-0000-0000000023b0',
       '2026-03-01 00:00:00-04', '2026-04-01 00:00:00-04') $$,
  'El ayudante obtiene cero filas de la rentabilidad'
);

select is_empty(
  $$ select * from report_low_stock('00000000-0000-0000-0000-0000000023b0') $$,
  'El ayudante obtiene cero filas de los insumos bajo mínimo'
);

select is_empty(
  $$ select * from report_line_comparison(
       '00000000-0000-0000-0000-0000000023b0',
       '2026-03-01 00:00:00-04', '2026-04-01 00:00:00-04') $$,
  'El ayudante obtiene cero filas del comparativo entre líneas'
);

select * from finish();
rollback;
