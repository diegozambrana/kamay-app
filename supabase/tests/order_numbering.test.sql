-- KAM-07 · orders: numeración visible por organización sin duplicados.
-- Escenarios del delta spec `orders` — requisito "Numeración visible por
-- organización sin duplicados": primer pedido con code 1, numeración
-- independiente entre organizaciones, inserciones simultáneas y el número
-- que no se reutiliza.
begin;

set search_path to public, extensions;

select plan(7);

-- ── Semilla propia (como postgres, sin RLS) ───────────────────────────────
-- Toda prueba crea su propia organización (constitución § Pruebas).

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-000000007a01', 'Numeración A'),
  ('00000000-0000-0000-0000-000000007b01', 'Numeración B');

insert into business_lines (id, organization_id, name) values
  ('00000000-0000-0000-0000-000000007a11', '00000000-0000-0000-0000-000000007a01', 'Línea A'),
  ('00000000-0000-0000-0000-000000007b11', '00000000-0000-0000-0000-000000007b01', 'Línea B');

insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-000000007a21', '00000000-0000-0000-0000-000000007a01', '00000000-0000-0000-0000-000000007a11', 'order', 'Inicio', 'initial', 1),
  ('00000000-0000-0000-0000-000000007a22', '00000000-0000-0000-0000-000000007a01', '00000000-0000-0000-0000-000000007a11', 'order', 'Fin',    'final',   2),
  ('00000000-0000-0000-0000-000000007b21', '00000000-0000-0000-0000-000000007b01', '00000000-0000-0000-0000-000000007b11', 'order', 'Inicio', 'initial', 1),
  ('00000000-0000-0000-0000-000000007b22', '00000000-0000-0000-0000-000000007b01', '00000000-0000-0000-0000-000000007b11', 'order', 'Fin',    'final',   2);

insert into contacts (id, organization_id, name, is_customer) values
  ('00000000-0000-0000-0000-000000007a31', '00000000-0000-0000-0000-000000007a01', 'Cliente A', true),
  ('00000000-0000-0000-0000-000000007b31', '00000000-0000-0000-0000-000000007b01', 'Cliente B', true);

-- ── Scenario: Primer pedido de una organización ───────────────────────────

insert into orders (id, organization_id, business_line_id, kind, contact_id, status_id) values
  ('00000000-0000-0000-0000-00000007a001', '00000000-0000-0000-0000-000000007a01',
   '00000000-0000-0000-0000-000000007a11', 'order',
   '00000000-0000-0000-0000-000000007a31', '00000000-0000-0000-0000-000000007a21');

select is(
  (select code from orders where id = '00000000-0000-0000-0000-00000007a001'),
  1, 'orders: el primer pedido de una organización recibe code 1');

-- ── Scenario: Numeración independiente entre organizaciones ───────────────

insert into orders (id, organization_id, business_line_id, kind, contact_id, status_id) values
  ('00000000-0000-0000-0000-00000007b001', '00000000-0000-0000-0000-000000007b01',
   '00000000-0000-0000-0000-000000007b11', 'order',
   '00000000-0000-0000-0000-000000007b31', '00000000-0000-0000-0000-000000007b21');

select is(
  (select code from orders where id = '00000000-0000-0000-0000-00000007b001'),
  1, 'orders: otra organización también empieza en 1, sin violar la unicidad');

-- ── Scenario: Inserciones sucesivas dentro de la misma organización ───────

insert into orders (id, organization_id, business_line_id, kind, contact_id, status_id) values
  ('00000000-0000-0000-0000-00000007a002', '00000000-0000-0000-0000-000000007a01',
   '00000000-0000-0000-0000-000000007a11', 'order',
   '00000000-0000-0000-0000-000000007a31', '00000000-0000-0000-0000-000000007a21'),
  ('00000000-0000-0000-0000-00000007a003', '00000000-0000-0000-0000-000000007a01',
   '00000000-0000-0000-0000-000000007a11', 'order',
   '00000000-0000-0000-0000-000000007a31', '00000000-0000-0000-0000-000000007a21');

select results_eq(
  $$ select code from orders
     where organization_id = '00000000-0000-0000-0000-000000007a01'
     order by code $$,
  $$ values (1), (2), (3) $$,
  'orders: la numeración avanza sin huecos ni repeticiones');

-- ── Scenario: Inserciones simultáneas ─────────────────────────────────────
-- El bloqueo de la fila de la organización serializa a quienes insertan en
-- ella. Aquí se comprueba el contrato que lo hace verificable: la unicidad
-- rechaza el duplicado, de modo que si el trigger dejara de bloquear, una
-- de las dos transacciones fallaría en vez de duplicar en silencio.

select throws_ok(
  $$ insert into orders (organization_id, business_line_id, kind, contact_id, status_id, code)
     values ('00000000-0000-0000-0000-000000007a01',
             '00000000-0000-0000-0000-000000007a11', 'order',
             '00000000-0000-0000-0000-000000007a31',
             '00000000-0000-0000-0000-000000007a21', 3) $$,
  '23505', null, 'orders: un code repetido en la misma organización se rechaza');

select lives_ok(
  $$ insert into orders (organization_id, business_line_id, kind, contact_id, status_id, code)
     values ('00000000-0000-0000-0000-000000007b01',
             '00000000-0000-0000-0000-000000007b11', 'order',
             '00000000-0000-0000-0000-000000007b31',
             '00000000-0000-0000-0000-000000007b21', 3) $$,
  'orders: el mismo code en otra organización se acepta');

-- ── Scenario: El número no se reutiliza ───────────────────────────────────
-- El máximo se toma incluidos los archivados: si se reciclara, "el #3"
-- pasaría a señalar otro pedido.

update orders set archived_at = now()
where id = '00000000-0000-0000-0000-00000007a003';

insert into orders (id, organization_id, business_line_id, kind, contact_id, status_id) values
  ('00000000-0000-0000-0000-00000007a004', '00000000-0000-0000-0000-000000007a01',
   '00000000-0000-0000-0000-000000007a11', 'order',
   '00000000-0000-0000-0000-000000007a31', '00000000-0000-0000-0000-000000007a21');

select is(
  (select code from orders where id = '00000000-0000-0000-0000-00000007a004'),
  4, 'orders: tras archivar el code más alto, el siguiente pedido no lo reutiliza');

select is(
  (select code from orders where id = '00000000-0000-0000-0000-00000007a003'),
  3, 'orders: el pedido archivado conserva su número');

select * from finish();
rollback;
