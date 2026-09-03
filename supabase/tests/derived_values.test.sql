-- KAM-09 · Vistas derivadas: `expense_totals` e `item_last_cost` coinciden con
-- el cálculo manual (ARCHITECTURE.md nombra este archivo; nace aquí con los
-- egresos y las tareas siguientes lo amplían con sus vistas).
-- Escenarios del delta spec `expenses`: "El total del egreso se deriva, nunca
-- se almacena" y "El último costo de un ítem se deriva de sus compras".
--
-- Corre como `postgres` a propósito: aquí se comprueba la aritmética de las
-- vistas, no quién puede verlas (eso es de expense_access.test.sql).
begin;

set search_path to public, extensions;

select plan(13);

-- ── Semilla propia ────────────────────────────────────────────────────────

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-0000000000d9', 'Derivados');

insert into business_lines (id, organization_id, name) values
  ('00000000-0000-0000-0000-000000000d91', '00000000-0000-0000-0000-0000000000d9', 'Sublimación');

insert into expense_categories (id, organization_id, name) values
  ('00000000-0000-0000-0000-000000000d92', '00000000-0000-0000-0000-0000000000d9', 'Servicios');

insert into contacts (id, organization_id, name, is_supplier, is_customer) values
  ('00000000-0000-0000-0000-000000000d93', '00000000-0000-0000-0000-0000000000d9', 'Andina', true, false),
  ('00000000-0000-0000-0000-000000000d94', '00000000-0000-0000-0000-0000000000d9', 'Ñawi',   true, false);

insert into items (id, organization_id, kind, name) values
  ('00000000-0000-0000-0000-000000000d95', '00000000-0000-0000-0000-0000000000d9', 'supply', 'Taza'),
  ('00000000-0000-0000-0000-000000000d96', '00000000-0000-0000-0000-0000000000d9', 'supply', 'Papel'),
  ('00000000-0000-0000-0000-000000000d97', '00000000-0000-0000-0000-0000000000d9', 'supply', 'Nunca comprado');

-- Compra de marzo (taza a 25), REGISTRADA DESPUÉS de la de febrero.
-- Compra de febrero (taza a 12), registrada antes. Si la vista decidiera por
-- orden de registro, devolvería 12; por fecha del hecho, 25.
insert into expenses (id, organization_id, business_line_id, kind, contact_id, occurred_at, created_at) values
  ('00000000-0000-0000-0000-000000000da1', '00000000-0000-0000-0000-0000000000d9',
   '00000000-0000-0000-0000-000000000d91', 'purchase', '00000000-0000-0000-0000-000000000d93',
   '2026-03-15 10:00+00', '2026-03-20 10:00+00'),
  ('00000000-0000-0000-0000-000000000da2', '00000000-0000-0000-0000-0000000000d9',
   '00000000-0000-0000-0000-000000000d91', 'purchase', '00000000-0000-0000-0000-000000000d94',
   '2026-02-10 10:00+00', '2026-02-10 10:00+00'),
  -- Una compra sin líneas (solo posible por semilla): total 0, no nulo.
  ('00000000-0000-0000-0000-000000000da3', '00000000-0000-0000-0000-0000000000d9',
   '00000000-0000-0000-0000-000000000d91', 'purchase', '00000000-0000-0000-0000-000000000d93',
   '2026-01-05 10:00+00', '2026-01-05 10:00+00');

insert into expenses (id, organization_id, business_line_id, kind, expense_category_id, amount, occurred_at) values
  ('00000000-0000-0000-0000-000000000da4', '00000000-0000-0000-0000-0000000000d9',
   '00000000-0000-0000-0000-000000000d91', 'expense', '00000000-0000-0000-0000-000000000d92', 80,
   '2026-03-01 10:00+00');

insert into expense_items (organization_id, expense_id, item_id, quantity, unit_price) values
  -- Marzo: 3 × 25 + 1 × 40 = 115; la taza a 25 es el último costo.
  ('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-000000000da1', '00000000-0000-0000-0000-000000000d95', 3, 25),
  ('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-000000000da1', '00000000-0000-0000-0000-000000000d96', 1, 40),
  -- Febrero: taza a 12.
  ('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-000000000da2', '00000000-0000-0000-0000-000000000d95', 10, 12);

-- ── Scenario: Total de una compra con líneas ──────────────────────────────

select is(
  (select total from expense_totals where expense_id = '00000000-0000-0000-0000-000000000da1'),
  115::numeric,
  'expense_totals: 3 × 25 + 1 × 40 = 115');

-- ── Scenario: Total de un gasto ───────────────────────────────────────────

select is(
  (select total from expense_totals where expense_id = '00000000-0000-0000-0000-000000000da4'),
  80::numeric,
  'expense_totals: el total de un gasto es su monto');

select is(
  (select kind from expense_totals where expense_id = '00000000-0000-0000-0000-000000000da4'),
  'expense',
  'expense_totals: expone el tipo para que la bandeja lo distinga');

-- ── Scenario: Compra sin líneas registrada por semilla ────────────────────

select is(
  (select total from expense_totals where expense_id = '00000000-0000-0000-0000-000000000da3'),
  0::numeric,
  'expense_totals: una compra sin líneas da 0, no nulo');

-- ── Scenario: Coincide con la suma manual (sobre la semilla de Geeko) ─────

select is(
  (select count(*)::int
     from expense_totals et
     join expenses e on e.id = et.expense_id
    where et.total is distinct from coalesce(
            e.amount,
            (select sum(ei.quantity * ei.unit_price) from expense_items ei where ei.expense_id = e.id),
            0)),
  0, 'expense_totals: coincide con la suma manual en todos los egresos sembrados');

select ok(
  (select count(*) from expense_totals
    where organization_id = '10000000-0000-0000-0000-000000000003') >= 5,
  'expense_totals: la semilla de Geeko Store aporta egresos a la comprobación');

-- La vista sale en el orden canónico de columnas: KAM-10 la redefine con
-- `create or replace view` añadiendo `paid` al final, y eso solo funciona si
-- las existentes no cambian de sitio.
select is(
  (select string_agg(column_name::text, ',' order by ordinal_position)
     from information_schema.columns
    where table_schema = 'public' and table_name = 'expense_totals'),
  'expense_id,organization_id,business_line_id,kind,occurred_at,total',
  'expense_totals: columnas en el orden canónico, sin paid (KAM-10 la añade)');

-- ── Scenario: Comprado dos veces (decide occurred_at, no el registro) ─────

select is(
  (select last_cost from item_last_cost where item_id = '00000000-0000-0000-0000-000000000d95'),
  25::numeric(14,2),
  'item_last_cost: manda la fecha del hecho, no el orden de registro');

select is(
  (select last_supplier_id from item_last_cost where item_id = '00000000-0000-0000-0000-000000000d95'),
  '00000000-0000-0000-0000-000000000d93'::uuid,
  'item_last_cost: trae el proveedor de esa compra');

select is(
  (select last_purchase_at from item_last_cost where item_id = '00000000-0000-0000-0000-000000000d95'),
  '2026-03-15 10:00+00'::timestamptz,
  'item_last_cost: trae la fecha de esa compra');

-- ── Scenario: Nunca comprado ──────────────────────────────────────────────

select is(
  (select count(*)::int from item_last_cost where item_id = '00000000-0000-0000-0000-000000000d97'),
  0, 'item_last_cost: el insumo nunca comprado no tiene fila');

-- ── Scenario: La compra archivada no cuenta ───────────────────────────────

update expenses set archived_at = now() where id = '00000000-0000-0000-0000-000000000da1';

select is(
  (select last_cost from item_last_cost where item_id = '00000000-0000-0000-0000-000000000d95'),
  12::numeric(14,2),
  'item_last_cost: archivada la última compra, manda la anterior vigente');

select is(
  (select count(*)::int from expense_totals where expense_id = '00000000-0000-0000-0000-000000000da1'),
  0, 'expense_totals: el egreso archivado desaparece de la vista');

select * from finish();

rollback;
