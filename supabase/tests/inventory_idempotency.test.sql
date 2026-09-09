-- KAM-18 · inventory: entrada automática desde la compra, idempotencia y
-- archivado. El archivo que nombra el backlog como `inventory_idempotency`.
-- Escenarios del delta spec `inventory` — requisitos "Cada línea de compra de
-- un insumo genera exactamente una entrada", "La misma compra sincronizada dos
-- veces deja una sola entrada" y "Archivar una compra no altera el inventario".
--
-- Corre como `postgres`: aquí se comprueba el trigger y el índice, no quién
-- puede verlos (eso es de inventory_access.test.sql).
begin;

set search_path to public, extensions;

select plan(12);

-- ── Semilla propia ────────────────────────────────────────────────────────

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-000000018d01', 'Idempotencia de inventario');

insert into business_lines (id, organization_id, name) values
  ('00000000-0000-0000-0000-000000018d11', '00000000-0000-0000-0000-000000018d01', 'Sublimación');

insert into contacts (id, organization_id, name, is_supplier, is_customer) values
  ('00000000-0000-0000-0000-000000018d12', '00000000-0000-0000-0000-000000018d01', 'Andina', true, false);

-- Tres insumos y un producto: el producto es el que NO debe mover inventario.
insert into items (id, organization_id, business_line_id, kind, name, min_stock) values
  ('00000000-0000-0000-0000-000000018d21', '00000000-0000-0000-0000-000000018d01',
   '00000000-0000-0000-0000-000000018d11', 'supply',  'Taza',   10),
  ('00000000-0000-0000-0000-000000018d22', '00000000-0000-0000-0000-000000018d01',
   '00000000-0000-0000-0000-000000018d11', 'supply',  'Papel',  10),
  ('00000000-0000-0000-0000-000000018d23', '00000000-0000-0000-0000-000000018d01',
   '00000000-0000-0000-0000-000000018d11', 'supply',  'Tinta',  10);

insert into items (id, organization_id, business_line_id, kind, name) values
  ('00000000-0000-0000-0000-000000018d24', '00000000-0000-0000-0000-000000018d01',
   '00000000-0000-0000-0000-000000018d11', 'product', 'Taza personalizada');

insert into expenses (id, organization_id, business_line_id, kind, contact_id, occurred_at) values
  ('00000000-0000-0000-0000-000000018d31', '00000000-0000-0000-0000-000000018d01',
   '00000000-0000-0000-0000-000000018d11', 'purchase',
   '00000000-0000-0000-0000-000000018d12', now() - interval '3 days');

-- ── Scenario: Compra de tres insumos ──────────────────────────────────────

insert into expense_items (id, organization_id, expense_id, item_id, quantity, unit_price) values
  ('00000000-0000-0000-0000-000000018d41', '00000000-0000-0000-0000-000000018d01',
   '00000000-0000-0000-0000-000000018d31', '00000000-0000-0000-0000-000000018d21', 50, 8.50),
  ('00000000-0000-0000-0000-000000018d42', '00000000-0000-0000-0000-000000018d01',
   '00000000-0000-0000-0000-000000018d31', '00000000-0000-0000-0000-000000018d22',  2, 95),
  ('00000000-0000-0000-0000-000000018d43', '00000000-0000-0000-0000-000000018d01',
   '00000000-0000-0000-0000-000000018d31', '00000000-0000-0000-0000-000000018d23',  7, 40);

select is(
  (select count(*)::int from inventory_movements
   where organization_id = '00000000-0000-0000-0000-000000018d01'
     and source_type = 'expense_item'),
  3, 'inventory: una compra de tres líneas de insumo genera tres entradas');

select is(
  (select quantity from inventory_movements
   where source_type = 'expense_item'
     and source_id = '00000000-0000-0000-0000-000000018d41'),
  50::numeric(14,3), 'inventory: la entrada lleva la cantidad de su línea');

-- La fecha del movimiento es la del hecho que lo causó, no la del `insert`.
select is(
  (select occurred_at::date from inventory_movements
   where source_id = '00000000-0000-0000-0000-000000018d41'),
  (now() - interval '3 days')::date,
  'inventory: la entrada hereda la fecha del hecho del egreso, no la de registro');

-- ── Scenario: El saldo sube con la compra ─────────────────────────────────

select is(
  (select balance from item_balances
   where item_id = '00000000-0000-0000-0000-000000018d21'),
  50::numeric, 'inventory: el saldo del insumo sube con la compra, sin registrar nada más');

-- ── Scenario: Línea de compra de un producto ──────────────────────────────

insert into expense_items (id, organization_id, expense_id, item_id, quantity, unit_price) values
  ('00000000-0000-0000-0000-000000018d44', '00000000-0000-0000-0000-000000018d01',
   '00000000-0000-0000-0000-000000018d31', '00000000-0000-0000-0000-000000018d24', 3, 45);

select is_empty(
  $$ select id from inventory_movements
     where source_type = 'expense_item'
       and source_id = '00000000-0000-0000-0000-000000018d44' $$,
  'inventory: una línea de compra de un producto no genera entrada');

select is(
  (select count(*)::int from inventory_movements
   where organization_id = '00000000-0000-0000-0000-000000018d01'),
  3, 'inventory: sigue habiendo tres movimientos, solo de los insumos');

-- ── Scenario: Dos reintentos, un solo movimiento ──────────────────────────
-- El índice único parcial es la única garantía (design D2): no hay
-- comprobación previa en ninguna capa, porque «leer y después escribir» es una
-- condición de carrera que dos vaciados de cola concurrentes superan los dos.

select throws_ok(
  $$ insert into inventory_movements
       (organization_id, item_id, kind, quantity, source_type, source_id)
     values ('00000000-0000-0000-0000-000000018d01',
             '00000000-0000-0000-0000-000000018d21', 'in', 50,
             'expense_item', '00000000-0000-0000-0000-000000018d41') $$,
  '23505', null,
  'inventory: un segundo movimiento con el mismo origen documental se rechaza');

-- ── Scenario: Compra reenviada tras una respuesta perdida ─────────────────
-- La otra mitad de D2: cuando el trigger se topa con el conflicto, lo absorbe
-- con `on conflict do nothing`. La segunda llegada de la compra NO puede
-- romper el alta con un error de restricción que nadie sabe interpretar.
--
-- Se simula al revés, que es la única forma de provocar el conflicto desde el
-- trigger: el movimiento ya existe cuando llega su línea.

insert into inventory_movements
  (organization_id, item_id, kind, quantity, source_type, source_id, occurred_at)
values
  ('00000000-0000-0000-0000-000000018d01', '00000000-0000-0000-0000-000000018d21',
   'in', 11, 'expense_item', '00000000-0000-0000-0000-000000018d45', now());

select lives_ok(
  $$ insert into expense_items (id, organization_id, expense_id, item_id, quantity, unit_price)
     values ('00000000-0000-0000-0000-000000018d45',
             '00000000-0000-0000-0000-000000018d01',
             '00000000-0000-0000-0000-000000018d31',
             '00000000-0000-0000-0000-000000018d21', 11, 8.50) $$,
  'inventory: la línea cuya entrada ya existe se guarda sin error');

select is(
  (select count(*)::int from inventory_movements
   where source_type = 'expense_item'
     and source_id = '00000000-0000-0000-0000-000000018d45'),
  1, 'inventory: sigue existiendo una sola entrada para esa línea');

-- ── Scenario: Compra archivada, saldo intacto ─────────────────────────────
-- Decisión explícita (design D1, supuesto 3): el insumo entró físicamente al
-- taller. Si además no entró, se corrige con un ajuste por conteo.

update expenses set archived_at = now()
where id = '00000000-0000-0000-0000-000000018d31';

select is(
  (select balance from item_balances
   where item_id = '00000000-0000-0000-0000-000000018d21'),
  61::numeric, 'inventory: archivar la compra no cambia el saldo');

select is(
  (select count(*)::int from inventory_movements
   where organization_id = '00000000-0000-0000-0000-000000018d01'),
  4, 'inventory: archivar la compra no borra ni añade ningún movimiento');

-- ── Scenario: Ningún movimiento aparece sin autor ─────────────────────────
-- Archivar no genera un ajuste compensatorio: cada fila del historial
-- corresponde a un hecho registrado, y ninguna la inventó el sistema.

select is_empty(
  $$ select id from inventory_movements
     where organization_id = '00000000-0000-0000-0000-000000018d01'
       and kind = 'adjustment' $$,
  'inventory: archivar no generó ningún ajuste automático');

select * from finish();
rollback;
