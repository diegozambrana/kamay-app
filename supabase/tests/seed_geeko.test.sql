-- KAM-04 · org-configuration: la semilla deja Geeko Store lista para trabajar.
-- Escenarios del delta spec: "Geeko Store is seeded with its real lines and
-- channels" y "Existing test organizations survive the seed".
--
-- A diferencia de las demás suites, esta no crea sus propios datos: lee los que
-- `supabase db reset` dejó a partir de supabase/seed.sql.
begin;

set search_path to public, extensions;

select plan(25);

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

-- KAM-08 · las líneas de la semilla nacen vigentes. El total del pedido #1
-- (190) lo afirman las pruebas e2e de KAM-07, y desde que las líneas se
-- pueden archivar ese total dejaría de cuadrar en silencio si alguna llegara
-- archivada por la semilla.
-- Acotado a los identificadores fijos de la semilla, como las aserciones de
-- líneas de negocio de arriba: las pruebas e2e editan pedidos en esta misma
-- organización y archivan líneas suyas, y lo que aquí se verifica es lo que
-- dejó `supabase db reset`, no lo que haya después.
select is(
  (select count(*)::int from order_items
    where id between 'a1000000-0000-0000-0000-000000000001'
                 and 'a1000000-0000-0000-0000-000000000099'
      and archived_at is not null),
  0, 'semilla: ninguna línea de pedido de la semilla nace archivada');

-- ── Scenario: La semilla contiene los egresos de KAM-09 ───────────────────
-- Acotado a los identificadores fijos, como arriba: las pruebas e2e registran
-- egresos en esta misma organización.

select is(
  (select count(*)::int from expenses
    where id between 'b0000000-0000-0000-0000-000000000001'
                 and 'b0000000-0000-0000-0000-000000000099'),
  7, 'semilla: Geeko Store tiene sus siete egresos');

select is(
  (select count(*)::int from expense_items
    where expense_id = 'b0000000-0000-0000-0000-000000000001'),
  2, 'semilla: la primera compra tiene varias líneas (50 × 8.50 + 2 × 95 = 615)');

-- La compra más reciente por `occurred_at` (9.20) se registró ANTES que la
-- fechada atrás (8.50): `item_last_cost` solo acierta por fecha del hecho.
select is(
  (select last_cost from item_last_cost
    where item_id = '90000000-0000-0000-0000-000000000001'),
  9.20::numeric(14,2),
  'semilla: la taza comprada dos veces tiene 9.20 como último costo');

select ok(
  (select a.created_at > b.created_at and a.occurred_at < b.occurred_at
     from expenses a, expenses b
    where a.id = 'b0000000-0000-0000-0000-000000000001'
      and b.id = 'b0000000-0000-0000-0000-000000000002'),
  'semilla: la compra fechada atrás se registró después (discrimina occurred_at de created_at)');

select is(
  (select l.is_shared from expenses e join business_lines l on l.id = e.business_line_id
    where e.id = 'b0000000-0000-0000-0000-000000000004'),
  true, 'semilla: hay un gasto en la línea General');

select ok(
  exists (select 1 from expenses
           where id = 'b0000000-0000-0000-0000-000000000005'
             and order_id = 'a0000000-0000-0000-0000-000000000001'),
  'semilla: hay un gasto asignado al pedido #1');

-- ── Cobros y pagos (KAM-10) ───────────────────────────────────────────────
-- Los cinco casos que el bloque de cobros, la señal de pago y los indicadores
-- necesitan. Se comprueban por su saldo derivado, no por la fila del cobro:
-- es lo que las pantallas leen realmente.

select is(
  (select total - paid from order_totals
    where order_id = 'a0000000-0000-0000-0000-000000000001'),
  130::numeric,
  'semilla: el pedido #1 tiene un anticipo de 60 sobre 190 → saldo 130');

select is(
  (select total - paid from order_totals
    where order_id = 'a0000000-0000-0000-0000-000000000003'),
  0::numeric,
  'semilla: el pedido #3 está saldado al céntimo');

select is(
  (select total - paid from order_totals
    where order_id = 'a0000000-0000-0000-0000-000000000012'),
  -30::numeric,
  'semilla: el pedido #12 está sobrepagado y su saldo queda negativo y visible');

-- El cobro anulado sigue existiendo —no se borró— y no cuenta en `paid`.
select ok(
  exists (select 1 from payments
           where id = 'c0000000-0000-0000-0000-000000000011'
             and archived_at is not null),
  'semilla: el cobro anulado del pedido #4 sigue registrado, archivado');

select is(
  (select paid from order_totals
    where order_id = 'a0000000-0000-0000-0000-000000000004'),
  130::numeric,
  'semilla: el anulado no cuenta — el pedido #4 tiene 130 cobrados, no 230');

select is(
  (select total - paid from expense_totals
    where expense_id = 'b0000000-0000-0000-0000-000000000004'),
  70::numeric,
  'semilla: el gasto de internet está pagado en parte → saldo por pagar 70');

select * from finish();

rollback;
