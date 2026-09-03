-- KAM-07 · orders: la cola.
-- Escenarios del delta spec `orders` — requisito "La columna en cola se
-- ordena por llegada y muestra posición": entrada, salida, regreso, y que
-- una edición ajena no toque `queued_at` (design.md D4).
begin;

set search_path to public, extensions;

select plan(8);

-- ── Semilla propia ────────────────────────────────────────────────────────

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-000000007d01', 'Cola de pedidos');

insert into business_lines (id, organization_id, name) values
  ('00000000-0000-0000-0000-000000007d11', '00000000-0000-0000-0000-000000007d01', 'Sublimación');

-- "En cola" es la única con is_queue; la restricción queue_only_when_waiting
-- (KAM-05) ya garantiza que solo un estado de espera pueda serlo.
insert into statuses (id, organization_id, business_line_id, flow, name, kind, is_queue, position) values
  ('00000000-0000-0000-0000-000000007d21', '00000000-0000-0000-0000-000000007d01', '00000000-0000-0000-0000-000000007d11', 'order', 'Registrado',  'initial',     false, 1),
  ('00000000-0000-0000-0000-000000007d22', '00000000-0000-0000-0000-000000007d01', '00000000-0000-0000-0000-000000007d11', 'order', 'En cola',     'waiting',     true,  2),
  ('00000000-0000-0000-0000-000000007d23', '00000000-0000-0000-0000-000000007d01', '00000000-0000-0000-0000-000000007d11', 'order', 'Sublimando',  'in_progress', false, 3),
  ('00000000-0000-0000-0000-000000007d24', '00000000-0000-0000-0000-000000007d01', '00000000-0000-0000-0000-000000007d11', 'order', 'Entregado',   'final',       false, 4);

insert into contacts (id, organization_id, name, is_customer) values
  ('00000000-0000-0000-0000-000000007d31', '00000000-0000-0000-0000-000000007d01', 'Cliente', true);

insert into orders (id, organization_id, business_line_id, kind, contact_id, status_id) values
  ('00000000-0000-0000-0000-00000007d001', '00000000-0000-0000-0000-000000007d01',
   '00000000-0000-0000-0000-000000007d11', 'order',
   '00000000-0000-0000-0000-000000007d31', '00000000-0000-0000-0000-000000007d21');

-- ── Scenario: Un pedido fuera de la cola no tiene queued_at ───────────────

select is(
  (select queued_at from orders where id = '00000000-0000-0000-0000-00000007d001'),
  null, 'orders: nacer en un estado que no es cola deja queued_at nulo');

-- ── Scenario: Entrada a la cola ───────────────────────────────────────────

update orders set status_id = '00000000-0000-0000-0000-000000007d22'
where id = '00000000-0000-0000-0000-00000007d001';

select isnt(
  (select queued_at from orders where id = '00000000-0000-0000-0000-00000007d001'),
  null, 'orders: pasar a un estado con is_queue registra queued_at');

-- ── Scenario: Una edición que no cambia el estado no toca la cola ─────────
-- Es lo que permite que reordenar la cola escriba `queued_at` sin que el
-- trigger lo pise (design.md D4).

update orders set queued_at = '2020-01-01 10:00:00+00'
where id = '00000000-0000-0000-0000-00000007d001';

update orders set notes = 'una nota cualquiera'
where id = '00000000-0000-0000-0000-00000007d001';

select is(
  (select queued_at from orders where id = '00000000-0000-0000-0000-00000007d001'),
  '2020-01-01 10:00:00+00'::timestamptz,
  'orders: editar sin cambiar de estado conserva queued_at (reordenar no se pisa)');

-- ── Scenario: Salida de la cola ───────────────────────────────────────────

update orders set status_id = '00000000-0000-0000-0000-000000007d23'
where id = '00000000-0000-0000-0000-00000007d001';

select is(
  (select queued_at from orders where id = '00000000-0000-0000-0000-00000007d001'),
  null, 'orders: salir de la cola pone queued_at a nulo');

-- ── Scenario: Salida y regreso a la cola ──────────────────────────────────
-- Vuelve al final, no a su posición anterior: la llegada es la nueva.

update orders set status_id = '00000000-0000-0000-0000-000000007d22'
where id = '00000000-0000-0000-0000-00000007d001';

select cmp_ok(
  (select queued_at from orders where id = '00000000-0000-0000-0000-00000007d001'),
  '>', '2020-01-01 10:00:00+00'::timestamptz,
  'orders: volver a la cola actualiza queued_at al nuevo momento de entrada');

-- ── Scenario: Tres pedidos en cola, orden por llegada ─────────────────────
-- Las fechas comprometidas van en orden INVERSO a la llegada: si el orden
-- se tomara de `due_date`, el resultado saldría al revés.

insert into orders (id, organization_id, business_line_id, kind, contact_id, status_id, due_date, queued_at) values
  ('00000000-0000-0000-0000-00000007d011', '00000000-0000-0000-0000-000000007d01',
   '00000000-0000-0000-0000-000000007d11', 'order',
   '00000000-0000-0000-0000-000000007d31', '00000000-0000-0000-0000-000000007d22',
   current_date + 9, now() - interval '3 days'),
  ('00000000-0000-0000-0000-00000007d012', '00000000-0000-0000-0000-000000007d01',
   '00000000-0000-0000-0000-000000007d11', 'order',
   '00000000-0000-0000-0000-000000007d31', '00000000-0000-0000-0000-000000007d22',
   current_date + 5, now() - interval '2 days'),
  ('00000000-0000-0000-0000-00000007d013', '00000000-0000-0000-0000-000000007d01',
   '00000000-0000-0000-0000-000000007d11', 'order',
   '00000000-0000-0000-0000-000000007d31', '00000000-0000-0000-0000-000000007d22',
   current_date + 2, now() - interval '1 day');

select results_eq(
  $$ select id from orders
     where status_id = '00000000-0000-0000-0000-000000007d22'
       and id <> '00000000-0000-0000-0000-00000007d001'
     order by queued_at asc, code asc $$,
  $$ values ('00000000-0000-0000-0000-00000007d011'::uuid),
            ('00000000-0000-0000-0000-00000007d012'::uuid),
            ('00000000-0000-0000-0000-00000007d013'::uuid) $$,
  'orders: la cola se ordena por llegada, no por fecha comprometida');

select results_eq(
  $$ select id from orders
     where status_id = '00000000-0000-0000-0000-000000007d22'
       and id <> '00000000-0000-0000-0000-00000007d001'
     order by due_date asc $$,
  $$ values ('00000000-0000-0000-0000-00000007d013'::uuid),
            ('00000000-0000-0000-0000-00000007d012'::uuid),
            ('00000000-0000-0000-0000-00000007d011'::uuid) $$,
  'orders: ordenar por fecha comprometida da el orden inverso (la prueba discrimina)');

-- ── Scenario: Reordenar reescribe la llegada ──────────────────────────────
-- Adelantar el tercero al frente: su queued_at pasa a ser anterior al del
-- primero, y el orden derivado cambia sin tocar ninguna otra fila.

update orders
set queued_at = (select min(queued_at) - interval '1 second' from orders
                 where status_id = '00000000-0000-0000-0000-000000007d22')
where id = '00000000-0000-0000-0000-00000007d013';

select results_eq(
  $$ select id from orders
     where status_id = '00000000-0000-0000-0000-000000007d22'
       and id <> '00000000-0000-0000-0000-00000007d001'
     order by queued_at asc, code asc $$,
  $$ values ('00000000-0000-0000-0000-00000007d013'::uuid),
            ('00000000-0000-0000-0000-00000007d011'::uuid),
            ('00000000-0000-0000-0000-00000007d012'::uuid) $$,
  'orders: reordenar cambia el orden derivado sin escribir en las demás filas');

select * from finish();
rollback;
