-- KAM-04 · org-configuration: la semilla deja Geeko Store lista para trabajar.
-- Escenarios del delta spec: "Geeko Store is seeded with its real lines and
-- channels" y "Existing test organizations survive the seed".
--
-- A diferencia de las demás suites, esta no crea sus propios datos: lee los que
-- `supabase db reset` dejó a partir de supabase/seed.sql.
begin;

set search_path to public, extensions;

select plan(12);

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

-- ── Scenario: La semilla contiene los casos límite de los pedidos ─────────
-- Hasta KAM-08 no hay pantalla de alta: el tablero y las pruebas e2e viven
-- de la semilla. Si un cambio futuro la altera, estas aserciones fallan en
-- vez de dejar las pruebas de pedidos verdes sobre datos que ya no existen
-- (design.md, riesgo anotado).

select is(
  (select count(*)::int from orders o
     join statuses s on s.id = o.status_id
    where o.organization_id = '10000000-0000-0000-0000-000000000003'
      and s.is_queue and o.archived_at is null
      and o.business_line_id = '30000000-0000-0000-0000-000000000001'),
  3, 'semilla: tres pedidos en la columna En cola de Sublimación');

-- El orden de llegada es el INVERSO al de fecha comprometida, para que la
-- prueba de la cola discrimine entre ordenar por una y por la otra.
select results_eq(
  $$ select code from orders o
       join statuses s on s.id = o.status_id
      where o.organization_id = '10000000-0000-0000-0000-000000000003'
        and s.is_queue and o.archived_at is null
        and o.business_line_id = '30000000-0000-0000-0000-000000000001'
      order by o.queued_at asc $$,
  $$ values (1), (2), (3) $$,
  'semilla: la cola llega en orden 1, 2, 3 y sus fechas van al revés');

select ok(
  (select bool_and(a.due_date > b.due_date)
     from orders a, orders b
    where a.code = 1 and b.code = 3
      and a.organization_id = '10000000-0000-0000-0000-000000000003'
      and b.organization_id = '10000000-0000-0000-0000-000000000003'),
  'semilla: el primero de la cola es el que se compromete más tarde');

select ok(
  exists (select 1 from orders o
            join statuses s on s.id = o.status_id
           where o.organization_id = '10000000-0000-0000-0000-000000000003'
             and o.due_date < current_date and s.kind = 'waiting'
             and o.archived_at is null),
  'semilla: hay un pedido vencido en un estado de espera (no debe alertar)');

select ok(
  exists (select 1 from orders o
            join statuses s on s.id = o.status_id
           where o.organization_id = '10000000-0000-0000-0000-000000000003'
             and o.due_date < current_date and s.kind = 'in_progress'
             and o.archived_at is null),
  'semilla: hay un pedido vencido en proceso (sí debe alertar)');

select * from finish();

rollback;
