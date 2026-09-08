-- KAM-17 · notifications y notification_preferences: integridad y RLS.
-- Escenarios del delta spec `notifications` — requisitos "Modelo de
-- notificación con tipo cerrado" y "Preferencias de notificación por persona,
-- con cada tipo apagable".
--
-- Estas son las dos primeras tablas del esquema cuyo alcance es la persona y
-- no la organización, así que lo que se prueba con más insistencia es
-- justamente eso: que un compañero de la misma organización —que pasa
-- `is_member` sin problema— siga sin ver mis avisos ni tocar mis preferencias.
begin;

set search_path to public, extensions;

select plan(16);

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

create function pg_temp.logout() returns void
language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- ── Semilla propia (como postgres, sin RLS) ───────────────────────────────

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000017e0a1', 'owner-notif-a@kamay.test'),
  ('00000000-0000-0000-0000-00000017e0a2', 'assist-notif-a@kamay.test'),
  ('00000000-0000-0000-0000-00000017e0b1', 'owner-notif-b@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-0000000017ea', 'Avisos A'),
  ('00000000-0000-0000-0000-0000000017eb', 'Avisos B');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000017ea', '00000000-0000-0000-0000-00000017e0a1', 'owner'),
  ('00000000-0000-0000-0000-0000000017ea', '00000000-0000-0000-0000-00000017e0a2', 'assistant'),
  ('00000000-0000-0000-0000-0000000017eb', '00000000-0000-0000-0000-00000017e0b1', 'owner');

-- Una para el dueño, una para el ayudante de la misma organización, una de la
-- organización ajena. Las tres con la misma forma, para que lo único que
-- separe los resultados sea la política.
insert into notifications (id, organization_id, user_id, type, title, dedupe_key) values
  ('00000000-0000-0000-0000-00000017e101', '00000000-0000-0000-0000-0000000017ea',
   '00000000-0000-0000-0000-00000017e0a1', 'task_overdue', 'Se venció una tarea', 'task_overdue:t1:2026-09-01'),
  ('00000000-0000-0000-0000-00000017e102', '00000000-0000-0000-0000-0000000017ea',
   '00000000-0000-0000-0000-00000017e0a2', 'task_assigned', 'Te asignaron una tarea', 'task_assigned:t2:a2'),
  ('00000000-0000-0000-0000-00000017e1b1', '00000000-0000-0000-0000-0000000017eb',
   '00000000-0000-0000-0000-00000017e0b1', 'due_summary', 'Resumen del día', 'due_summary:2026-09-08');

-- ── Scenario: Tipo fuera del catálogo ─────────────────────────────────────

select throws_ok(
  $$ insert into notifications (organization_id, user_id, type, title, dedupe_key)
     values ('00000000-0000-0000-0000-0000000017ea',
             '00000000-0000-0000-0000-00000017e0a1', 'order_shipped', 'Inventado', 'x:1') $$,
  '23514', null, 'notifications: un tipo fuera de los seis se rechaza');

-- ── Idempotencia: la llave es lo que hace reejecutable al trabajo ─────────
-- Escenario "Reejecución sin duplicados" en la capa que lo garantiza. La
-- llave incluye la fecha límite, no el día de la pasada: por eso una tarea
-- tres días vencida sigue teniendo un solo aviso ("Vencida una vez, no cada
-- día"), y por eso reprogramarla sí vuelve a avisar.

select throws_ok(
  $$ insert into notifications (organization_id, user_id, type, title, dedupe_key)
     values ('00000000-0000-0000-0000-0000000017ea',
             '00000000-0000-0000-0000-00000017e0a1', 'task_overdue',
             'Se venció una tarea', 'task_overdue:t1:2026-09-01') $$,
  '23505', null, 'notifications: la misma llave para la misma persona se rechaza');

select lives_ok(
  $$ insert into notifications (organization_id, user_id, type, title, dedupe_key)
     values ('00000000-0000-0000-0000-0000000017ea',
             '00000000-0000-0000-0000-00000017e0a2', 'task_overdue',
             'Se venció una tarea', 'task_overdue:t1:2026-09-01') $$,
  'notifications: la misma llave para otra persona sí entra — son dos avisos legítimos');

-- Lo que hace de verdad el generador: insertar sin comprobar antes.
insert into notifications (organization_id, user_id, type, title, dedupe_key)
values ('00000000-0000-0000-0000-0000000017ea',
        '00000000-0000-0000-0000-00000017e0a1', 'task_overdue',
        'Se venció una tarea', 'task_overdue:t1:2026-09-01')
on conflict (user_id, dedupe_key) do nothing;

select is(
  (select count(*)::int from notifications
    where user_id = '00000000-0000-0000-0000-00000017e0a1'
      and dedupe_key = 'task_overdue:t1:2026-09-01'),
  1,
  'notifications: reejecutar con on conflict do nothing no duplica nada');

-- ── Scenario: Aislamiento entre organizaciones ────────────────────────────

select pg_temp.login('00000000-0000-0000-0000-00000017e0b1');

select is((select count(*)::int from notifications), 1,
  'notifications: quien es de otra organización solo ve la suya');

select is(
  (select count(*)::int from notifications
    where id = '00000000-0000-0000-0000-00000017e101'),
  0,
  'notifications: conocer el identificador exacto de una ajena no la revela');

select pg_temp.logout();

-- ── Scenario: Las notificaciones son de quien las recibe ──────────────────
-- El ayudante es miembro de la misma organización que el dueño: `is_member`
-- lo deja pasar y lo que lo detiene es el `user_id = auth.uid()`.

select pg_temp.login('00000000-0000-0000-0000-00000017e0a2');

select is((select count(*)::int from notifications), 2,
  'notifications: un compañero de organización ve solo las suyas, no las del dueño');

-- ── Scenario: No hay borrado ──────────────────────────────────────────────

select throws_ok(
  $$ delete from notifications
      where id = '00000000-0000-0000-0000-00000017e102' $$,
  '42501', null, 'notifications: borrar está revocado, ni siquiera la propia');

-- Marcar leída es la única transición, y funciona sobre la propia.
select lives_ok(
  $$ update notifications set read_at = now()
      where id = '00000000-0000-0000-0000-00000017e102' $$,
  'notifications: marcar leída la propia funciona');

-- Lo demás no se puede tocar: el privilegio es por columna, no por confianza
-- en la Server Action.
select throws_ok(
  $$ update notifications set title = 'Otro título'
      where id = '00000000-0000-0000-0000-00000017e102' $$,
  '42501', null, 'notifications: cambiar cualquier columna que no sea read_at está revocado');

-- Y nadie crea avisos desde una sesión: eso es del generador con service role.
select throws_ok(
  $$ insert into notifications (organization_id, user_id, type, title, dedupe_key)
     values ('00000000-0000-0000-0000-0000000017ea',
             '00000000-0000-0000-0000-00000017e0a2', 'task_review', 'Autoservicio', 'y:1') $$,
  '42501', null, 'notifications: insertar desde una sesión está revocado');

-- La ajena no se alcanza: sin error, sin filas.
with touched as (
  update notifications set read_at = now()
   where id = '00000000-0000-0000-0000-00000017e101'
  returning 1
)
select is((select count(*)::int from touched), 0,
  'notifications: marcar leída la de otro no afecta a ninguna fila');

-- ── Scenario: El ayudante configura las suyas ─────────────────────────────
-- La excepción deliberada a «V15 solo dueño» (design D1): aquí no aparece
-- `is_owner` en ninguna política, y este es el caso que lo comprueba.

select lives_ok(
  $$ insert into notification_preferences
       (organization_id, user_id, task_assigned, daily_summary_hour)
     values ('00000000-0000-0000-0000-0000000017ea',
             '00000000-0000-0000-0000-00000017e0a2', false, 18) $$,
  'notification_preferences: un ayudante crea y apaga las suyas');

-- ── Scenario: Nadie toca las de otro ──────────────────────────────────────

select throws_ok(
  $$ insert into notification_preferences (organization_id, user_id)
     values ('00000000-0000-0000-0000-0000000017ea',
             '00000000-0000-0000-0000-00000017e0a1') $$,
  '42501', null, 'notification_preferences: crear las de otra persona se rechaza');

select pg_temp.logout();

-- Sembrada por fuera de RLS, para comprobar que tampoco se leen ni se editan.
insert into notification_preferences (organization_id, user_id, daily_summary_hour)
values ('00000000-0000-0000-0000-0000000017ea',
        '00000000-0000-0000-0000-00000017e0a1', 6);

select pg_temp.login('00000000-0000-0000-0000-00000017e0a2');

select is(
  (select count(*)::int from notification_preferences
    where user_id = '00000000-0000-0000-0000-00000017e0a1'),
  0,
  'notification_preferences: las de otra persona no se leen');

-- ── Rango de la hora del resumen ──────────────────────────────────────────

select throws_ok(
  $$ update notification_preferences set daily_summary_hour = 24
      where user_id = '00000000-0000-0000-0000-00000017e0a2' $$,
  '23514', null, 'notification_preferences: una hora fuera de 0–23 se rechaza');

select pg_temp.logout();

select * from finish();
rollback;
