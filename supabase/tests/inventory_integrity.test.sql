-- KAM-18 · inventory: forma del movimiento e inmutabilidad del documento.
-- Escenarios del delta spec `inventory` — requisitos "Los movimientos de
-- inventario son el único documento del saldo", "Un movimiento no se edita, no
-- se archiva y no se borra" y "Todo movimiento de inventario queda en la
-- bitácora" (parte de la bitácora única).
begin;

set search_path to public, extensions;

select plan(12);

-- ── Semilla propia ────────────────────────────────────────────────────────

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-000000018c01', 'Integridad de inventario');

insert into business_lines (id, organization_id, name) values
  ('00000000-0000-0000-0000-000000018c11', '00000000-0000-0000-0000-000000018c01', 'Sublimación');

insert into items (id, organization_id, business_line_id, kind, name, min_stock) values
  ('00000000-0000-0000-0000-000000018c21', '00000000-0000-0000-0000-000000018c01',
   '00000000-0000-0000-0000-000000018c11', 'supply', 'Taza', 10);

-- ── Scenario: Tipo de movimiento fuera del juego permitido ────────────────

select throws_ok(
  $$ insert into inventory_movements (organization_id, item_id, kind, quantity)
     values ('00000000-0000-0000-0000-000000018c01',
             '00000000-0000-0000-0000-000000018c21', 'transfer', 5) $$,
  '23514', null,
  'inventory_movements: un kind fuera de in/out/adjustment se rechaza');

-- ── Scenario: Entrada con cantidad negativa ───────────────────────────────

select throws_ok(
  $$ insert into inventory_movements (organization_id, item_id, kind, quantity)
     values ('00000000-0000-0000-0000-000000018c01',
             '00000000-0000-0000-0000-000000018c21', 'in', -5) $$,
  '23514', null,
  'inventory_movements: una entrada negativa se rechaza (sign_matches_kind)');

-- ── Scenario: Salida con cantidad positiva ────────────────────────────────

select throws_ok(
  $$ insert into inventory_movements (organization_id, item_id, kind, quantity)
     values ('00000000-0000-0000-0000-000000018c01',
             '00000000-0000-0000-0000-000000018c21', 'out', 5) $$,
  '23514', null,
  'inventory_movements: una salida positiva se rechaza (sign_matches_kind)');

-- ── Scenario: Movimiento de cantidad cero ─────────────────────────────────

select throws_ok(
  $$ insert into inventory_movements (organization_id, item_id, kind, quantity)
     values ('00000000-0000-0000-0000-000000018c01',
             '00000000-0000-0000-0000-000000018c21', 'adjustment', 0) $$,
  '23514', null,
  'inventory_movements: un movimiento de cantidad cero se rechaza');

-- ── Scenario: Ajuste en cualquiera de los dos sentidos ────────────────────

select lives_ok(
  $$ insert into inventory_movements (id, organization_id, item_id, kind, quantity, source_type)
     values ('00000000-0000-0000-0000-000000018c31',
             '00000000-0000-0000-0000-000000018c01',
             '00000000-0000-0000-0000-000000018c21', 'adjustment', 12, 'count') $$,
  'inventory_movements: un ajuste positivo se acepta');

select lives_ok(
  $$ insert into inventory_movements (id, organization_id, item_id, kind, quantity, source_type)
     values ('00000000-0000-0000-0000-000000018c32',
             '00000000-0000-0000-0000-000000018c01',
             '00000000-0000-0000-0000-000000018c21', 'adjustment', -4, 'count') $$,
  'inventory_movements: un ajuste negativo se acepta');

-- ── Scenario: Intento de editar un movimiento ─────────────────────────────
-- La inmutabilidad es un privilegio que no se concede, no un trigger que
-- vigila (design D3). Se comprueba sobre el catálogo de privilegios porque
-- este archivo corre como `postgres`, que los tiene todos: lo que importa es
-- qué recibió `authenticated`, no qué puede hacer el superusuario.

select is_empty(
  $$ select privilege_type from information_schema.role_table_grants
     where table_name = 'inventory_movements' and grantee = 'authenticated'
       and privilege_type in ('UPDATE','DELETE') $$,
  'inventory_movements: authenticated no tiene privilegio de UPDATE ni de DELETE');

select is(
  (select array_agg(privilege_type::text order by privilege_type)
   from information_schema.role_table_grants
   where table_name = 'inventory_movements' and grantee = 'authenticated'),
  array['INSERT','SELECT'],
  'inventory_movements: authenticated solo puede leer y crear');

-- ── Scenario: Intento de borrar un movimiento ─────────────────────────────
-- Con RLS activo, lo que no tiene política está prohibido. La ausencia de
-- política de UPDATE y de DELETE es la segunda valla, deliberada.

select is_empty(
  $$ select policyname from pg_policies
     where tablename = 'inventory_movements' and cmd in ('UPDATE','DELETE') $$,
  'inventory_movements: no existe ninguna política de UPDATE ni de DELETE');

-- ── Un movimiento no se archiva ───────────────────────────────────────────

select hasnt_column('public', 'inventory_movements', 'archived_at',
  'inventory_movements: no tiene columna de archivado');

-- ── Scenario: Una sola bitácora ───────────────────────────────────────────
-- Convención nº 7: todo lo que muestre «qué pasó aquí» lee de `activity_log`.
-- No existe —ni debe existir— una segunda tabla de historial de inventario.

select is_empty(
  $$ select table_name from information_schema.tables
     where table_schema = 'public'
       and table_name <> 'activity_log'
       and (table_name like '%inventory%history%'
         or table_name like '%inventory%log%'
         or table_name like '%movement%history%') $$,
  'inventory: no existe una segunda tabla de historial de inventario');

-- ── Scenario: El consumo queda registrado ─────────────────────────────────

select is(
  (select count(*)::int from activity_log
   where table_name = 'inventory_movements'
     and record_id = '00000000-0000-0000-0000-000000018c31'
     and action = 'created'),
  1, 'inventory_movements: la creación de un movimiento queda en la bitácora');

select * from finish();
rollback;
