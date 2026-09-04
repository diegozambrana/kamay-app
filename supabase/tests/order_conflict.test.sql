-- KAM-11 · Ante ediciones desordenadas gana la última en llegar.
--
-- Escenarios de `offline-capture` — requisito "Ante ediciones desordenadas
-- gana la última en llegar, con constancia": «Una edición encolada pisa a una
-- más reciente», «El estado descartado es recuperable».
--
-- No hace falta ninguna función nueva: `update_order` ya se comporta así. Lo
-- que esta prueba fija es la **constancia** —que el estado descartado siga
-- siendo legible en la bitácora— y que nadie añada después una comprobación
-- de versión que convierta el segundo envío en un error.
begin;

set search_path to public, extensions;

select plan(10);

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

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000c01', 'owner-conflict@kamay.test'),
  ('00000000-0000-0000-0000-000000000c02', 'assistant-conflict@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-000000000c0a', 'Conflicto');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-000000000c0a', '00000000-0000-0000-0000-000000000c01', 'owner'),
  ('00000000-0000-0000-0000-000000000c0a', '00000000-0000-0000-0000-000000000c02', 'assistant');

insert into business_lines (id, organization_id, name) values
  ('00000000-0000-0000-0000-000000000c1a', '00000000-0000-0000-0000-000000000c0a', 'Sublimación');

insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-000000000c21', '00000000-0000-0000-0000-000000000c0a', '00000000-0000-0000-0000-000000000c1a', 'order', 'Registrado', 'initial', 1);

insert into contacts (id, organization_id, name, is_customer) values
  ('00000000-0000-0000-0000-000000000c31', '00000000-0000-0000-0000-000000000c0a', 'Cliente', true);

-- ── El pedido, registrado sin red a las 15:40 ─────────────────────────────

select pg_temp.login('00000000-0000-0000-0000-000000000c01');

select lives_ok(
  $$ select create_order(
       jsonb_build_object(
         'id',               '00000000-0000-0000-0000-0000000ca001',
         'organization_id',  '00000000-0000-0000-0000-000000000c0a',
         'business_line_id', '00000000-0000-0000-0000-000000000c1a',
         'contact_id',       '00000000-0000-0000-0000-000000000c31',
         'occurred_at',      '2026-09-03T15:40:00Z',
         'notes',            'Original'),
       jsonb_build_array(jsonb_build_object(
         'id', '00000000-0000-0000-0000-0000000cb001',
         'description', 'Taza', 'quantity', 1, 'unit_price', 45))) $$,
  'create_order: el pedido existe antes de que nadie lo edite');

-- ── La edición que SÍ tenía red, hecha desde otro dispositivo ─────────────

select pg_temp.login('00000000-0000-0000-0000-000000000c02');

select lives_ok(
  $$ select update_order(
       jsonb_build_object(
         'id',              '00000000-0000-0000-0000-0000000ca001',
         'organization_id', '00000000-0000-0000-0000-000000000c0a',
         'contact_id',      '00000000-0000-0000-0000-000000000c31',
         'notes',           'Editado con red a las 18:00'),
       jsonb_build_array(jsonb_build_object(
         'id', '00000000-0000-0000-0000-0000000cb001',
         'description', 'Taza', 'quantity', 1, 'unit_price', 45))) $$,
  'update_order: la edición con red se guarda');

-- ── La edición encolada, que llega después aunque se hizo antes ───────────
-- Es exactamente lo que hace la cola al reconectar: reenvía lo que guardó,
-- sin comprobar si alguien tocó el pedido mientras tanto.

select pg_temp.login('00000000-0000-0000-0000-000000000c01');

select lives_ok(
  $$ select update_order(
       jsonb_build_object(
         'id',              '00000000-0000-0000-0000-0000000ca001',
         'organization_id', '00000000-0000-0000-0000-000000000c0a',
         'contact_id',      '00000000-0000-0000-0000-000000000c31',
         'notes',           'Editado sin red a las 15:40'),
       jsonb_build_array(jsonb_build_object(
         'id', '00000000-0000-0000-0000-0000000cb001',
         'description', 'Taza', 'quantity', 1, 'unit_price', 45))) $$,
  'update_order: la edición encolada no se rechaza por llegar tarde');

-- ── Scenario: Una edición encolada pisa a una más reciente ────────────────

select is(
  (select notes from orders where id = '00000000-0000-0000-0000-0000000ca001'),
  'Editado sin red a las 15:40',
  'orders: gana la última escritura en llegar, sin bloquear ni preguntar');

-- ── Scenario: El estado descartado es recuperable ─────────────────────────
-- Los dos cambios están en la bitácora, con sus autores. Quien mire el
-- historial puede reconstruir qué decía el pedido antes de cada uno.

select is(
  (select count(*)::int from activity_log
    where table_name = 'orders'
      and record_id = '00000000-0000-0000-0000-0000000ca001'
      and action = 'updated'),
  2, 'activity_log: los dos cambios quedan registrados, no solo el que ganó');

select is(
  (select count(distinct actor_id)::int from activity_log
    where table_name = 'orders'
      and record_id = '00000000-0000-0000-0000-0000000ca001'
      and action = 'updated'),
  2, 'activity_log: cada cambio conserva su autor');

select ok(
  exists(
    select 1 from activity_log
    where table_name = 'orders'
      and record_id = '00000000-0000-0000-0000-0000000ca001'
      and action = 'updated'
      and changes->'notes'->>'despues' = 'Editado con red a las 18:00'),
  'activity_log: el valor que fue pisado sigue siendo legible en el historial');

select ok(
  exists(
    select 1 from activity_log
    where table_name = 'orders'
      and record_id = '00000000-0000-0000-0000-0000000ca001'
      and action = 'updated'
      and changes->'notes'->>'antes' = 'Editado con red a las 18:00'
      and changes->'notes'->>'despues' = 'Editado sin red a las 15:40'),
  'activity_log: el cambio ganador dice de qué valor vino');

-- ── La fusión de ruido no borra el estado descartado ──────────────────────
-- Si las dos ediciones fueran de la MISMA persona en dos dispositivos, la
-- bitácora las consolidaría en un solo evento (KAM-03). Aun así el estado
-- descartado sigue siendo recuperable: el evento fusionado conserva el valor
-- anterior más viejo. Queda fijado para que nadie lo tome por una pérdida.

select lives_ok(
  $$ select update_order(
       jsonb_build_object(
         'id',              '00000000-0000-0000-0000-0000000ca001',
         'organization_id', '00000000-0000-0000-0000-000000000c0a',
         'contact_id',      '00000000-0000-0000-0000-000000000c31',
         'notes',           'Tercera edición, misma persona'),
       jsonb_build_array(jsonb_build_object(
         'id', '00000000-0000-0000-0000-0000000cb001',
         'description', 'Taza', 'quantity', 1, 'unit_price', 45))) $$,
  'update_order: una tercera edición de la misma persona se guarda');

select ok(
  exists(
    select 1 from activity_log
    where table_name = 'orders'
      and record_id = '00000000-0000-0000-0000-0000000ca001'
      and action = 'updated'
      and changes->'notes'->>'antes' = 'Editado con red a las 18:00'
      and changes->'notes'->>'despues' = 'Tercera edición, misma persona'),
  'activity_log: el evento fusionado conserva el valor anterior más viejo');

select * from finish();
rollback;
