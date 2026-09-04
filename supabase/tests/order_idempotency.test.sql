-- KAM-11 · Infraestructura sin conexión: `create_order` es idempotente.
-- Escenarios del delta spec `orders` — requisito "El alta es una sola
-- operación y el estado inicial lo asigna la base": «El mismo pedido enviado
-- dos veces», «El reenvío no ensucia la bitácora», «Identificador que
-- pertenece a otra organización»; y del delta `offline-capture` — requisito
-- "Reenviar un registro nunca crea un segundo": «Identificador de otra
-- organización».
--
-- La función es `security invoker`, así que todo se ejerce desde un usuario
-- autenticado: llamarla como `postgres` no probaría nada de lo que importa.
begin;

set search_path to public, extensions;

select plan(17);

-- ── Helpers: simular usuarios autenticados ────────────────────────────────

create function pg_temp.login(uid uuid) returns void
language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;
end;
$$;

-- ── Semilla propia (como postgres, sin RLS) ───────────────────────────────

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000b01', 'owner-idem-a@kamay.test'),
  ('00000000-0000-0000-0000-000000000b11', 'owner-idem-b@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-000000000b0a', 'Idem A'),
  ('00000000-0000-0000-0000-000000000b0b', 'Idem B');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-000000000b0a', '00000000-0000-0000-0000-000000000b01', 'owner'),
  ('00000000-0000-0000-0000-000000000b0b', '00000000-0000-0000-0000-000000000b11', 'owner');

insert into business_lines (id, organization_id, name) values
  ('00000000-0000-0000-0000-000000000b1a', '00000000-0000-0000-0000-000000000b0a', 'Sublimación'),
  ('00000000-0000-0000-0000-000000000b1b', '00000000-0000-0000-0000-000000000b0b', 'Sublimación');

-- El estado inicial se declara en posición 2 para que la prueba distinga
-- "resolver por kind y position" de "tomar el primero que aparezca".
insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-000000000b22', '00000000-0000-0000-0000-000000000b0a', '00000000-0000-0000-0000-000000000b1a', 'order', 'En proceso', 'in_progress', 1),
  ('00000000-0000-0000-0000-000000000b21', '00000000-0000-0000-0000-000000000b0a', '00000000-0000-0000-0000-000000000b1a', 'order', 'Registrado', 'initial',     2),
  ('00000000-0000-0000-0000-000000000b24', '00000000-0000-0000-0000-000000000b0b', '00000000-0000-0000-0000-000000000b1b', 'order', 'Registrado', 'initial',     1);

insert into contacts (id, organization_id, name, is_customer) values
  ('00000000-0000-0000-0000-000000000b31', '00000000-0000-0000-0000-000000000b0a', 'Cliente A', true),
  ('00000000-0000-0000-0000-000000000b32', '00000000-0000-0000-0000-000000000b0b', 'Cliente B', true);

-- ══ El mismo pedido enviado dos veces ══════════════════════════════════════
-- Es el criterio 3 del backlog: un envío que se reintenta dos veces por un
-- fallo de red crea UN solo registro.

select pg_temp.login('00000000-0000-0000-0000-000000000b01');

-- ── Scenario: El mismo pedido enviado dos veces ───────────────────────────

select is(
  create_order(
    jsonb_build_object(
      'id',               '00000000-0000-0000-0000-00000000c001',
      'organization_id',  '00000000-0000-0000-0000-000000000b0a',
      'business_line_id', '00000000-0000-0000-0000-000000000b1a',
      'contact_id',       '00000000-0000-0000-0000-000000000b31',
      'occurred_at',      '2026-09-03T15:40:00Z',
      'notes',            'Registrado sin señal'),
    jsonb_build_array(
      jsonb_build_object('id', '00000000-0000-0000-0000-00000000d001',
                         'description', 'Taza', 'quantity', 3, 'unit_price', 45),
      jsonb_build_object('id', '00000000-0000-0000-0000-00000000d002',
                         'description', 'La grande', 'quantity', 1, 'unit_price', 55))),
  '00000000-0000-0000-0000-00000000c001'::uuid,
  'create_order: el primer envío devuelve el identificador del cliente');

-- El número visible arranca en 1 por organización (`assign_order_code`), así
-- que el primer pedido de esta organización es el #1. Se comprueba de forma
-- literal para poder afirmar después que el reenvío no consumió otro.
select is(
  (select code from orders where id = '00000000-0000-0000-0000-00000000c001'),
  1, 'create_order: el primer pedido de la organización es el número 1');

-- El reenvío: mismo identificador, mismas líneas, mismos identificadores de
-- línea. Es literalmente lo que la cola vuelve a mandar.
select is(
  create_order(
    jsonb_build_object(
      'id',               '00000000-0000-0000-0000-00000000c001',
      'organization_id',  '00000000-0000-0000-0000-000000000b0a',
      'business_line_id', '00000000-0000-0000-0000-000000000b1a',
      'contact_id',       '00000000-0000-0000-0000-000000000b31',
      'occurred_at',      '2026-09-03T15:40:00Z',
      'notes',            'Registrado sin señal'),
    jsonb_build_array(
      jsonb_build_object('id', '00000000-0000-0000-0000-00000000d001',
                         'description', 'Taza', 'quantity', 3, 'unit_price', 45),
      jsonb_build_object('id', '00000000-0000-0000-0000-00000000d002',
                         'description', 'La grande', 'quantity', 1, 'unit_price', 55))),
  '00000000-0000-0000-0000-00000000c001'::uuid,
  'create_order: el reenvío no falla y devuelve el mismo identificador');

select is(
  (select count(*)::int from orders where id = '00000000-0000-0000-0000-00000000c001'),
  1, 'create_order: dos envíos, un solo pedido');

select is(
  (select count(*)::int from order_items
    where order_id = '00000000-0000-0000-0000-00000000c001'),
  2, 'create_order: dos envíos, dos líneas — ninguna duplicada');

select is(
  (select code from orders where id = '00000000-0000-0000-0000-00000000c001'),
  1, 'create_order: el reenvío no consume otro número visible');

select is(
  (select occurred_at from orders where id = '00000000-0000-0000-0000-00000000c001'),
  '2026-09-03T15:40:00Z'::timestamptz,
  'create_order: el reenvío no pisa la hora real del hecho');

-- ── Scenario: El reenvío no ensucia la bitácora ───────────────────────────
-- La bitácora la escribe un trigger `after insert`: si no hay insert, no hay
-- evento. Es la comprobación de que el `on conflict do nothing` es de verdad
-- "no hacer nada", no "hacer un update disfrazado".

select is(
  (select count(*)::int from activity_log
    where table_name = 'orders'
      and record_id = '00000000-0000-0000-0000-00000000c001'
      and action = 'created'),
  1, 'activity_log: el reenvío no crea un segundo evento de creación');

select is(
  (select count(*)::int from activity_log
    where table_name = 'orders'
      and record_id = '00000000-0000-0000-0000-00000000c001'),
  1, 'activity_log: el reenvío no genera ningún evento adicional');

-- ── Scenario: Identificador que pertenece a otra organización ─────────────
-- Sin la comprobación de organización, `on conflict do nothing` convertiría
-- un pedido ajeno en un "ya existe, todo bien" silencioso.

select pg_temp.login('00000000-0000-0000-0000-000000000b11');

select throws_ok(
  $$ select create_order(
       jsonb_build_object(
         'id',               '00000000-0000-0000-0000-00000000c001',
         'organization_id',  '00000000-0000-0000-0000-000000000b0b',
         'business_line_id', '00000000-0000-0000-0000-000000000b1b',
         'contact_id',       '00000000-0000-0000-0000-000000000b32'),
       jsonb_build_array(jsonb_build_object('description', 'x', 'quantity', 1, 'unit_price', 10))) $$,
  '42501',
  'Ese identificador ya pertenece a otro pedido',
  'create_order: un identificador de otra organización se rechaza, no se adopta');

select pg_temp.login('00000000-0000-0000-0000-000000000b01');

select is(
  (select organization_id from orders where id = '00000000-0000-0000-0000-00000000c001'),
  '00000000-0000-0000-0000-000000000b0a'::uuid,
  'create_order: el pedido ajeno queda intacto tras el intento');

select is(
  (select notes from orders where id = '00000000-0000-0000-0000-00000000c001'),
  'Registrado sin señal',
  'create_order: el intento no modificó ningún dato del pedido ajeno');

-- ══ El alta normal sigue comportándose como en KAM-08 ══════════════════════
-- La redefinición no puede ser una regresión silenciosa: se vuelven a ejercer
-- las garantías que ya existían.

-- ── Scenario: Nace en el estado inicial de su línea ───────────────────────

select is(
  create_order(
    jsonb_build_object(
      'id',               '00000000-0000-0000-0000-00000000c002',
      'organization_id',  '00000000-0000-0000-0000-000000000b0a',
      'business_line_id', '00000000-0000-0000-0000-000000000b1a',
      'contact_id',       '00000000-0000-0000-0000-000000000b31'),
    jsonb_build_array(jsonb_build_object('description', 'x', 'quantity', 1, 'unit_price', 10))),
  '00000000-0000-0000-0000-00000000c002'::uuid,
  'create_order: el alta normal sigue devolviendo el identificador');

select is(
  (select status_id from orders where id = '00000000-0000-0000-0000-00000000c002'),
  '00000000-0000-0000-0000-000000000b21'::uuid,
  'create_order: sigue naciendo en el estado de tipo initial, no en el primero de la lista');

select is(
  (select code from orders where id = '00000000-0000-0000-0000-00000000c002'),
  2, 'create_order: un pedido distinto sí consume su propio número visible');

-- ── Scenario: La base rechaza el alta sin líneas ──────────────────────────

select throws_ok(
  $$ select create_order(
       jsonb_build_object(
         'id',               '00000000-0000-0000-0000-00000000c003',
         'organization_id',  '00000000-0000-0000-0000-000000000b0a',
         'business_line_id', '00000000-0000-0000-0000-000000000b1a',
         'contact_id',       '00000000-0000-0000-0000-000000000b31'),
       '[]'::jsonb) $$,
  '23514',
  'Un pedido necesita al menos una línea',
  'create_order: sigue rechazando el alta sin líneas');

-- ── Scenario: No perteneces a esa organización ────────────────────────────

select throws_ok(
  $$ select create_order(
       jsonb_build_object(
         'id',               '00000000-0000-0000-0000-00000000c004',
         'organization_id',  '00000000-0000-0000-0000-000000000b0b',
         'business_line_id', '00000000-0000-0000-0000-000000000b1b',
         'contact_id',       '00000000-0000-0000-0000-000000000b32'),
       jsonb_build_array(jsonb_build_object('description', 'x', 'quantity', 1, 'unit_price', 10))) $$,
  '42501',
  'No perteneces a esa organización',
  'create_order: sigue rechazando el alta en una organización ajena');

select * from finish();
rollback;
