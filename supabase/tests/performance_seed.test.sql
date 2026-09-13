-- KAM-23 · La semilla de rendimiento tiene un año de actividad en su propia
-- organización (supabase/seeds/performance.sql).
--
-- Escenario del delta `performance-budget` → *The performance seed contains
-- twelve months of data* → «The seed produces a year of activity in its own
-- organization». La medición del panel solo mide algo si esta semilla trae
-- de verdad un año en cada dominio: con tres pedidos, cualquier panel carga
-- rápido.
begin;

set search_path to public, extensions;

select plan(9);

create function pg_temp.perf_months(tbl regclass, col text) returns int
language plpgsql as $$
declare months int;
begin
  execute format(
    'select count(distinct date_trunc(''month'', %I))::int from %s
      where organization_id = ''10000000-0000-0000-0000-000000000005''',
    col, tbl) into months;
  return months;
end;
$$;

select is(
  (select name from organizations where id = '10000000-0000-0000-0000-000000000005'),
  'Kamay Rendimiento',
  'la semilla tiene su propia organización');

select ok(
  (select count(*) from memberships
    where organization_id = '10000000-0000-0000-0000-000000000005') = 1,
  'y una sola persona en ella, que no pertenece a ninguna otra');

-- Cada dominio que el panel lee cubre los doce meses.
select cmp_ok(pg_temp.perf_months('orders', 'occurred_at'), '>=', 12,
  'pedidos repartidos en doce meses o más');
select cmp_ok(pg_temp.perf_months('payments', 'occurred_at'), '>=', 12,
  'cobros y pagos repartidos en doce meses o más');
select cmp_ok(pg_temp.perf_months('expenses', 'occurred_at'), '>=', 12,
  'egresos repartidos en doce meses o más');
select cmp_ok(pg_temp.perf_months('inventory_movements', 'occurred_at'), '>=', 12,
  'movimientos de inventario repartidos en doce meses o más');
select cmp_ok(pg_temp.perf_months('tasks', 'created_at'), '>=', 12,
  'tareas repartidas en doce meses o más');

-- El volumen de un taller real, no un puñado.
select cmp_ok(
  (select count(*)::int from orders where organization_id = '10000000-0000-0000-0000-000000000005'),
  '>=', 600, 'un año de pedidos: cientos, no decenas');

-- La bitácora se llenó sola al insertar, como en uso real.
select cmp_ok(
  (select count(*)::int from activity_log where organization_id = '10000000-0000-0000-0000-000000000005'),
  '>=', 3000, 'la bitácora tiene la historia de ese año');

select * from finish();
rollback;
