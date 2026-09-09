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

select plan(19);

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

-- La vista sale en el orden canónico de columnas. KAM-10 la redefinió con
-- `create or replace view` añadiendo `paid` AL FINAL, que es lo único que ese
-- comando permite: las existentes no pueden cambiar de sitio ni de tipo.
select is(
  (select string_agg(column_name::text, ',' order by ordinal_position)
     from information_schema.columns
    where table_schema = 'public' and table_name = 'expense_totals'),
  'expense_id,organization_id,business_line_id,kind,occurred_at,total,paid',
  'expense_totals: columnas en el orden canónico, con paid al final');

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

-- ── `item_balances` · KAM-18 ──────────────────────────────────────────────
-- Convención nº 4: el saldo no existe como dato, existe como suma. Estas
-- pruebas comprueban la aritmética de la vista; quién puede verla es de
-- inventory_access.test.sql.
--
-- Se añade un ítem propio para no depender de las entradas que el trigger de
-- KAM-18 ya generó desde las compras de arriba.

insert into items (id, organization_id, kind, name, min_stock) values
  ('00000000-0000-0000-0000-000000000db1', '00000000-0000-0000-0000-0000000000d9', 'supply', 'Filamento', 20),
  ('00000000-0000-0000-0000-000000000db2', '00000000-0000-0000-0000-0000000000d9', 'product', 'Llavero 3D', null);

insert into inventory_movements (organization_id, item_id, kind, quantity, source_type) values
  ('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-000000000db1', 'in',        100, 'manual'),
  ('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-000000000db1', 'out',       -30, 'manual'),
  ('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-000000000db1', 'adjustment', -5, 'count');

-- ── Scenario: El saldo coincide con la suma manual ────────────────────────

select is(
  (select balance from item_balances where item_id = '00000000-0000-0000-0000-000000000db1'),
  65::numeric,
  'item_balances: 100 de entrada, 30 de consumo y −5 de ajuste dan 65');

select is(
  (select balance from item_balances where item_id = '00000000-0000-0000-0000-000000000db1'),
  (select coalesce(sum(quantity), 0) from inventory_movements
   where item_id = '00000000-0000-0000-0000-000000000db1'),
  'item_balances: el saldo derivado es exactamente la suma de sus movimientos');

-- El mínimo se evalúa en la propia vista, para que las tres superficies que lo
-- leen (panel, catálogo y V11) no puedan discrepar.
select ok(
  (select not below_min from item_balances where item_id = '00000000-0000-0000-0000-000000000db1'),
  'item_balances: 65 sobre un mínimo de 20 no está bajo mínimo');

-- ── Scenario: Insumo sin movimientos ──────────────────────────────────────
-- El `left join` de la vista es lo que hace que aparezca con cero en vez de
-- desaparecer: un insumo ausente del listado se lee como «no falta nada».

select is(
  (select balance from item_balances where item_id = '00000000-0000-0000-0000-000000000d97'),
  0::numeric,
  'item_balances: un insumo sin movimientos tiene saldo cero, y aparece');

-- ── Scenario: Solo los insumos tienen saldo ───────────────────────────────

select is_empty(
  $$ select item_id from item_balances
     where item_id = '00000000-0000-0000-0000-000000000db2' $$,
  'item_balances: un producto no aparece en la vista de saldos');

-- ── Scenario: Ninguna columna guarda el saldo ─────────────────────────────
-- La misma comprobación que `catalog.test.sql` hace sobre `items`, extendida a
-- las tres tablas que podrían tentar a almacenarlo. `min_stock` es canónico y
-- no es derivado: lo fija la persona dueña.

select is_empty(
  $$ select table_name || '.' || column_name
     from information_schema.columns
     where table_schema = 'public'
       and table_name in ('items', 'item_variants', 'inventory_movements')
       and column_name <> 'min_stock'
       and (column_name like '%balance%' or column_name like '%stock%'
         or column_name like '%saldo%'  or column_name like '%avg_cost%'
         or column_name like '%last_cost%' or column_name like '%margin%') $$,
  'catálogo e inventario: ninguna columna almacena saldo, último costo ni margen');

select * from finish();

rollback;
