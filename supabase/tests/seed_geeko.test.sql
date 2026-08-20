-- KAM-04 · org-configuration: la semilla deja Geeko Store lista para trabajar.
-- Escenarios del delta spec: "Geeko Store is seeded with its real lines and
-- channels" y "Existing test organizations survive the seed".
--
-- A diferencia de las demás suites, esta no crea sus propios datos: lee los que
-- `supabase db reset` dejó a partir de supabase/seed.sql.
begin;

set search_path to public, extensions;

select plan(7);

-- ── Scenario: Reset leaves Geeko Store ready ──────────────────────────────

select is(
  (select name from organizations
    where id = '10000000-0000-0000-0000-000000000003'),
  'Geeko Store', 'semilla: Geeko Store existe');

-- Se consulta por los identificadores fijos de la semilla y no por el total:
-- las pruebas e2e crean líneas en esta misma organización, y lo que aquí se
-- verifica es lo que dejó `supabase db reset`, no lo que haya después.
select is(
  (select count(*)::int from business_lines
    where id between '30000000-0000-0000-0000-000000000001'
                 and '30000000-0000-0000-0000-000000000004'
      and archived_at is null),
  4, 'semilla: Geeko Store tiene sus cuatro líneas activas');

select bag_eq(
  $$ select name, color from business_lines
     where id between '30000000-0000-0000-0000-000000000001'
                  and '30000000-0000-0000-0000-000000000004' $$,
  $$ values ('Sublimación', 'blue'), ('Impresión 3D', 'violet'),
            ('Alfarería', 'orange'), ('General', 'zinc') $$,
  'semilla: las cuatro líneas reales con sus colores');

select is(
  (select name from business_lines
    where organization_id = '10000000-0000-0000-0000-000000000003'
      and is_shared),
  'General', 'semilla: General es la línea compartida');

select bag_eq(
  $$ select name from sales_channels
     where id between '40000000-0000-0000-0000-000000000001'
                  and '40000000-0000-0000-0000-000000000004' $$,
  $$ values ('Feria'), ('Redes'), ('Pedido directo'), ('Mostrador') $$,
  'semilla: los cuatro canales de venta');

-- ── Scenario: Existing test organizations survive the seed ────────────────

select is(
  (select count(*)::int from organizations
    where id in ('10000000-0000-0000-0000-000000000001',
                 '10000000-0000-0000-0000-000000000002')),
  2, 'semilla: las organizaciones de las pruebas de autenticación siguen ahí');

select ok(
  (select count(*) from memberships
    where organization_id = '10000000-0000-0000-0000-000000000001') >= 3,
  'semilla: Taller Kamay conserva sus membresías');

select * from finish();

rollback;
