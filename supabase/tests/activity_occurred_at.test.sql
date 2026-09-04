-- KAM-11 · Infraestructura sin conexión: la bitácora fecha con la hora del
-- hecho, no con la de la sincronización.
--
-- Escenarios del delta spec `activity-log` — requisito "Every INSERT on an
-- audited table produces a created event": «A record created offline keeps
-- its real time in the log», «Audited table without a client-set time»,
-- «Later changes are dated when they arrive»; y del delta `offline-capture`
-- — requisito "La hora del hecho la fija el dispositivo y la de llegada el
-- servidor": «La bitácora conserva la hora real», «Varios registros conservan
-- sus horas distintas».
begin;

set search_path to public, extensions;

select plan(13);

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
  ('00000000-0000-0000-0000-000000000e01', 'owner-occurred@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-000000000e0a', 'Hora real');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-000000000e0a', '00000000-0000-0000-0000-000000000e01', 'owner');

insert into business_lines (id, organization_id, name) values
  ('00000000-0000-0000-0000-000000000e1a', '00000000-0000-0000-0000-000000000e0a', 'Sublimación');

insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-000000000e21', '00000000-0000-0000-0000-000000000e0a', '00000000-0000-0000-0000-000000000e1a', 'order', 'Registrado', 'initial', 1),
  ('00000000-0000-0000-0000-000000000e22', '00000000-0000-0000-0000-000000000e0a', '00000000-0000-0000-0000-000000000e1a', 'order', 'En proceso', 'in_progress', 2);

insert into contacts (id, organization_id, name, is_customer) values
  ('00000000-0000-0000-0000-000000000e31', '00000000-0000-0000-0000-000000000e0a', 'Cliente', true);

select pg_temp.login('00000000-0000-0000-0000-000000000e01');

-- ══ Un registro creado sin señal conserva su hora en la bitácora ══════════
-- El pedido ocurre a las 15:40 y llega a la base ahora. `created_at` es
-- ahora; `occurred_at` del registro y de su evento son las 15:40.

select lives_ok(
  $$ select create_order(
       jsonb_build_object(
         'id',               '00000000-0000-0000-0000-00000000f001',
         'organization_id',  '00000000-0000-0000-0000-000000000e0a',
         'business_line_id', '00000000-0000-0000-0000-000000000e1a',
         'contact_id',       '00000000-0000-0000-0000-000000000e31',
         'occurred_at',      '2026-09-03T15:40:00Z'),
       jsonb_build_array(jsonb_build_object('description', 'Taza', 'quantity', 1, 'unit_price', 45))) $$,
  'create_order: se registra un pedido cuya hora real es anterior a su llegada');

-- ── Scenario: A record created offline keeps its real time in the log ─────

select is(
  (select occurred_at from activity_log
    where table_name = 'orders'
      and record_id = '00000000-0000-0000-0000-00000000f001'
      and action = 'created'),
  '2026-09-03T15:40:00Z'::timestamptz,
  'activity_log: el evento de creación se fecha con la hora del hecho');

select ok(
  (select created_at from orders where id = '00000000-0000-0000-0000-00000000f001')
    > '2026-09-03T15:40:00Z'::timestamptz,
  'orders: `created_at` sigue siendo la hora de llegada al servidor');

select is(
  (select occurred_at from orders where id = '00000000-0000-0000-0000-00000000f001'),
  '2026-09-03T15:40:00Z'::timestamptz,
  'orders: `occurred_at` es la hora que fijó el cliente');

-- ── Scenario: Varios registros conservan sus horas distintas ──────────────
-- Tres pedidos creados a horas distintas y sincronizados en el mismo instante
-- no pueden compartir la hora de la sincronización.

select lives_ok(
  $$ select create_order(
       jsonb_build_object(
         'id',               '00000000-0000-0000-0000-00000000f002',
         'organization_id',  '00000000-0000-0000-0000-000000000e0a',
         'business_line_id', '00000000-0000-0000-0000-000000000e1a',
         'contact_id',       '00000000-0000-0000-0000-000000000e31',
         'occurred_at',      '2026-09-03T16:10:00Z'),
       jsonb_build_array(jsonb_build_object('description', 'Taza', 'quantity', 1, 'unit_price', 45))) $$,
  'create_order: segundo pedido de la misma tanda, con otra hora real');

select is(
  (select count(distinct occurred_at)::int from activity_log
    where table_name = 'orders'
      and action = 'created'
      and record_id in ('00000000-0000-0000-0000-00000000f001',
                        '00000000-0000-0000-0000-00000000f002')),
  2, 'activity_log: dos pedidos sincronizados juntos conservan sus dos horas distintas');

-- ── Scenario: Later changes are dated when they arrive ────────────────────
-- Ni `updated` ni `status_changed` ni `archived` pueden tomar la hora del
-- registro: ninguna columna lleva la hora real de esos gestos.

update orders set notes = 'Nota añadida al sincronizar'
where id = '00000000-0000-0000-0000-00000000f001';

select ok(
  (select occurred_at from activity_log
    where table_name = 'orders'
      and record_id = '00000000-0000-0000-0000-00000000f001'
      and action = 'updated')
    > now() - interval '1 minute',
  'activity_log: una edición posterior se fecha cuando llega, no con la hora del pedido');

update orders set status_id = '00000000-0000-0000-0000-000000000e22'
where id = '00000000-0000-0000-0000-00000000f001';

select ok(
  (select occurred_at from activity_log
    where table_name = 'orders'
      and record_id = '00000000-0000-0000-0000-00000000f001'
      and action = 'status_changed')
    > now() - interval '1 minute',
  'activity_log: un cambio de estado se fecha cuando llega');

update orders set archived_at = now()
where id = '00000000-0000-0000-0000-00000000f001';

select ok(
  (select occurred_at from activity_log
    where table_name = 'orders'
      and record_id = '00000000-0000-0000-0000-00000000f001'
      and action = 'archived')
    > now() - interval '1 minute',
  'activity_log: un archivado se fecha cuando llega');

-- ── Scenario: Audited table without a client-set time ─────────────────────
-- `contacts` no tiene `occurred_at`: su evento se comporta exactamente como
-- antes de este cambio.

insert into contacts (id, organization_id, name, is_customer) values
  ('00000000-0000-0000-0000-000000000e32', '00000000-0000-0000-0000-000000000e0a', 'Otro cliente', true);

select ok(
  (select occurred_at from activity_log
    where table_name = 'contacts'
      and record_id = '00000000-0000-0000-0000-000000000e32'
      and action = 'created')
    > now() - interval '1 minute',
  'activity_log: una tabla auditada sin `occurred_at` se fecha con el momento de la inserción');

-- ══ La fusión de ruido sigue funcionando ══════════════════════════════════
-- Mitigación anotada en design.md, decisión 6: un evento `created` fechado en
-- el pasado no debe entrar en la ventana de fusión ni alterarla. La fusión
-- solo mira eventos `updated`, que conservan `now()`.

update orders set notes = 'Segunda edición seguida'
where id = '00000000-0000-0000-0000-00000000f002';

update orders set notes = 'Tercera edición seguida'
where id = '00000000-0000-0000-0000-00000000f002';

select is(
  (select count(*)::int from activity_log
    where table_name = 'orders'
      and record_id = '00000000-0000-0000-0000-00000000f002'
      and action = 'updated'),
  1, 'activity_log: dos ediciones seguidas del mismo autor siguen fusionándose en un evento');

select is(
  (select changes->'notes'->>'despues' from activity_log
    where table_name = 'orders'
      and record_id = '00000000-0000-0000-0000-00000000f002'
      and action = 'updated'),
  'Tercera edición seguida',
  'activity_log: el evento fusionado conserva el valor más reciente');

select is(
  (select count(*)::int from activity_log
    where table_name = 'orders'
      and record_id = '00000000-0000-0000-0000-00000000f002'
      and action = 'created'),
  1, 'activity_log: el evento de creación fechado en el pasado no se fusionó con las ediciones');

select * from finish();
rollback;
