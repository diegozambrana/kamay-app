-- KAM-20 · Función derivada `report_expense_breakdown`.
-- Escenarios del delta spec `expenses` § Agregación de egresos por categoría
--   y línea dentro de un periodo: "Agrupación por categoría", "Las compras
--   van aparte", "La suma cuadra con los egresos", "El egreso archivado no
--   suma", "Un rango que no empieza el día 1".
-- El recorte por rol y el aislamiento viven en `reports_access.test.sql`.
begin;

set search_path to public, extensions;

select plan(7);

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
  ('00000000-0000-0000-0000-0000000021a1', 'owner-breakdown@kamay.test');

insert into organizations (id, name, timezone) values
  ('00000000-0000-0000-0000-0000000021b0', 'Desglose A', 'America/La_Paz');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000021b0', '00000000-0000-0000-0000-0000000021a1', 'owner');

insert into business_lines (id, organization_id, name, position) values
  ('00000000-0000-0000-0000-0000000021c1', '00000000-0000-0000-0000-0000000021b0', 'Sublimación', 1);

insert into expense_categories (id, organization_id, name) values
  ('00000000-0000-0000-0000-0000000021e1', '00000000-0000-0000-0000-0000000021b0', 'Insumos'),
  ('00000000-0000-0000-0000-0000000021e2', '00000000-0000-0000-0000-0000000021b0', 'Servicios'),
  ('00000000-0000-0000-0000-0000000021e3', '00000000-0000-0000-0000-0000000021b0', 'Transporte');

insert into contacts (id, organization_id, name, is_supplier) values
  ('00000000-0000-0000-0000-0000000021f1', '00000000-0000-0000-0000-0000000021b0', 'Proveedor', true);

insert into items (id, organization_id, business_line_id, kind, name) values
  ('00000000-0000-0000-0000-000000002101', '00000000-0000-0000-0000-0000000021b0',
   '00000000-0000-0000-0000-0000000021c1', 'supply', 'Papel');

-- Gastos de marzo: 600 en Insumos (300 + 300), 300 en Servicios, 100 en
-- Transporte. Total de gastos: 1.000.
insert into expenses (id, organization_id, business_line_id, kind, expense_category_id, amount, occurred_at) values
  ('00000000-0000-0000-0000-000000021201', '00000000-0000-0000-0000-0000000021b0', '00000000-0000-0000-0000-0000000021c1', 'expense', '00000000-0000-0000-0000-0000000021e1', 300.00, '2026-03-05 12:00:00-04'),
  ('00000000-0000-0000-0000-000000021202', '00000000-0000-0000-0000-0000000021b0', '00000000-0000-0000-0000-0000000021c1', 'expense', '00000000-0000-0000-0000-0000000021e1', 300.00, '2026-03-15 12:00:00-04'),
  ('00000000-0000-0000-0000-000000021203', '00000000-0000-0000-0000-0000000021b0', '00000000-0000-0000-0000-0000000021c1', 'expense', '00000000-0000-0000-0000-0000000021e2', 300.00, '2026-03-18 12:00:00-04'),
  ('00000000-0000-0000-0000-000000021204', '00000000-0000-0000-0000-0000000021b0', '00000000-0000-0000-0000-0000000021c1', 'expense', '00000000-0000-0000-0000-0000000021e3', 100.00, '2026-03-20 12:00:00-04'),
  -- Se archiva más abajo: deja de sumar.
  ('00000000-0000-0000-0000-000000021205', '00000000-0000-0000-0000-0000000021b0', '00000000-0000-0000-0000-0000000021c1', 'expense', '00000000-0000-0000-0000-0000000021e1', 555.00, '2026-03-22 12:00:00-04'),
  -- Fuera del rango del 12 de marzo al 20 de abril, por los dos extremos.
  ('00000000-0000-0000-0000-000000021206', '00000000-0000-0000-0000-0000000021b0', '00000000-0000-0000-0000-0000000021c1', 'expense', '00000000-0000-0000-0000-0000000021e2', 999.00, '2026-03-11 12:00:00-04'),
  ('00000000-0000-0000-0000-000000021207', '00000000-0000-0000-0000-0000000021b0', '00000000-0000-0000-0000-0000000021c1', 'expense', '00000000-0000-0000-0000-0000000021e2', 888.00, '2026-04-21 12:00:00-04');

-- Una compra de 400: no lleva categoría de gasto y su total sale de sus
-- líneas (2 × 200), no de una columna.
insert into expenses (id, organization_id, business_line_id, kind, contact_id, occurred_at) values
  ('00000000-0000-0000-0000-000000021301', '00000000-0000-0000-0000-0000000021b0',
   '00000000-0000-0000-0000-0000000021c1', 'purchase',
   '00000000-0000-0000-0000-0000000021f1', '2026-03-10 12:00:00-04');

insert into expense_items (organization_id, expense_id, item_id, quantity, unit_price) values
  ('00000000-0000-0000-0000-0000000021b0', '00000000-0000-0000-0000-000000021301',
   '00000000-0000-0000-0000-000000002101', 2, 200.00);

update expenses set archived_at = now()
  where id = '00000000-0000-0000-0000-000000021205';

select pg_temp.login('00000000-0000-0000-0000-0000000021a1');

-- ── Agrupación por categoría ──────────────────────────────────────────────

select is(
  (select total from report_expense_breakdown(
     '00000000-0000-0000-0000-0000000021b0',
     '2026-03-01 00:00:00-04', '2026-04-01 00:00:00-04')
   where expense_category_id = '00000000-0000-0000-0000-0000000021e1'),
  600::numeric,
  'Los dos gastos de Insumos se agregan en 600'
);

select is(
  (select total from report_expense_breakdown(
     '00000000-0000-0000-0000-0000000021b0',
     '2026-03-01 00:00:00-04', '2026-04-01 00:00:00-04')
   where expense_category_id = '00000000-0000-0000-0000-0000000021e3'),
  100::numeric,
  'Transporte se agrega por separado'
);

-- ── Las compras van aparte ────────────────────────────────────────────────
-- Entrada propia identificable: categoría nula y `kind = 'purchase'`. Su
-- total sale de las líneas, así que 2 × 200 = 400.

select is(
  (select total from report_expense_breakdown(
     '00000000-0000-0000-0000-0000000021b0',
     '2026-03-01 00:00:00-04', '2026-04-01 00:00:00-04')
   where kind = 'purchase'),
  400::numeric,
  'La compra aparece como entrada propia por el total de sus líneas'
);

select is(
  (select count(*) from report_expense_breakdown(
     '00000000-0000-0000-0000-0000000021b0',
     '2026-03-01 00:00:00-04', '2026-04-01 00:00:00-04')
   where kind = 'purchase' and expense_category_id is not null),
  0::bigint,
  'La compra no se atribuye a ninguna categoría de gasto real'
);

-- ── La suma cuadra con los egresos ────────────────────────────────────────
-- 1.000 de gastos + 400 de compra = 1.400, y es lo mismo que suma
-- `expense_totals` sobre el mismo rango.

select is(
  (select sum(total) from report_expense_breakdown(
     '00000000-0000-0000-0000-0000000021b0',
     '2026-03-01 00:00:00-04', '2026-04-01 00:00:00-04')),
  (select sum(et.total) from expense_totals et
   where et.organization_id = '00000000-0000-0000-0000-0000000021b0'
     and et.occurred_at >= '2026-03-01 00:00:00-04'
     and et.occurred_at <  '2026-04-01 00:00:00-04'),
  'La suma de los grupos es la suma de los egresos del periodo'
);

-- ── El egreso archivado no suma ───────────────────────────────────────────
-- Los 555 archivados son de Insumos y están dentro del rango: si sumaran,
-- Insumos daría 1.155.

select is(
  (select total from report_expense_breakdown(
     '00000000-0000-0000-0000-0000000021b0',
     '2026-03-01 00:00:00-04', '2026-04-01 00:00:00-04')
   where expense_category_id = '00000000-0000-0000-0000-0000000021e1'),
  600::numeric,
  'El gasto archivado dentro del rango no suma en su categoría'
);

-- ── Un rango que no empieza el día 1 ──────────────────────────────────────
-- Del 12 de marzo al 20 de abril: quedan 300 (Insumos del 15), 300
-- (Servicios del 18) y 100 (Transporte del 20) = 700. Fuera: la compra del
-- 10, el gasto del 5, los 999 del 11 y los 888 del 21.

select is(
  (select coalesce(sum(total), 0) from report_expense_breakdown(
     '00000000-0000-0000-0000-0000000021b0',
     '2026-03-12 00:00:00-04', '2026-04-21 00:00:00-04')),
  700::numeric,
  'Un rango del 12 de marzo al 20 de abril agrega solo lo suyo'
);

select * from finish();
rollback;
