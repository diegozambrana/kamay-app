-- KAM-15 · tasks: forma del modelo y estado inicial resuelto.
-- Escenarios del delta spec `tasks` — requisitos "Modelo de tarea con título y
-- línea obligatorios" y "El estado inicial lo asigna la base resolviendo el
-- juego de la línea".
begin;

set search_path to public, extensions;

select plan(11);

-- ── Semilla propia ────────────────────────────────────────────────────────

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-000000015c01', 'Integridad de tareas');

insert into business_lines (id, organization_id, name, is_shared) values
  ('00000000-0000-0000-0000-000000015c11', '00000000-0000-0000-0000-000000015c01', 'Sublimación', false),
  ('00000000-0000-0000-0000-000000015c12', '00000000-0000-0000-0000-000000015c01', 'Alfarería',   false);

-- Juego de la organización (sin línea): lo hereda toda línea sin juego propio.
insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-000000015c21', '00000000-0000-0000-0000-000000015c01', null, 'task', 'Por hacer',   'initial',     1),
  ('00000000-0000-0000-0000-000000015c22', '00000000-0000-0000-0000-000000015c01', null, 'task', 'En revisión', 'waiting',     2),
  ('00000000-0000-0000-0000-000000015c23', '00000000-0000-0000-0000-000000015c01', null, 'task', 'Hecho',       'final',       3);

-- Juego propio de Alfarería: sus tareas no deben tocar el de la organización.
insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-000000015c31', '00000000-0000-0000-0000-000000015c01', '00000000-0000-0000-0000-000000015c12', 'task', 'Modelando', 'initial', 1),
  ('00000000-0000-0000-0000-000000015c32', '00000000-0000-0000-0000-000000015c01', '00000000-0000-0000-0000-000000015c12', 'task', 'Horneado',  'final',   2);

-- ── Scenario: Título y línea bastan ───────────────────────────────────────

select lives_ok(
  $$ insert into tasks (organization_id, business_line_id, title)
     values ('00000000-0000-0000-0000-000000015c01',
             '00000000-0000-0000-0000-000000015c11', 'Revisar filamento') $$,
  'tasks: una tarea con solo título y línea se guarda');

select is(
  (select count(*)::int from tasks
   where organization_id = '00000000-0000-0000-0000-000000015c01'
     and assignee_id is null and due_at is null),
  1, 'tasks: se guardó sin responsable ni fecha');

-- ── Scenario: Tarea sin línea ─────────────────────────────────────────────

select throws_ok(
  $$ insert into tasks (organization_id, title)
     values ('00000000-0000-0000-0000-000000015c01', 'Sin línea') $$,
  '23502', null, 'tasks: una tarea sin línea se rechaza (business_line_id not null)');

-- ── Scenario: Tarea sin título ────────────────────────────────────────────

select throws_ok(
  $$ insert into tasks (organization_id, business_line_id, title)
     values ('00000000-0000-0000-0000-000000015c01',
             '00000000-0000-0000-0000-000000015c11', '   ') $$,
  '23514', null, 'tasks: un título en blanco se rechaza (task_needs_title)');

-- ── Scenario: Recordatorio sin fecha límite ───────────────────────────────

select throws_ok(
  $$ insert into tasks (organization_id, business_line_id, title, remind_at)
     values ('00000000-0000-0000-0000-000000015c01',
             '00000000-0000-0000-0000-000000015c11', 'Avisar', now()) $$,
  '23514', null, 'tasks: un recordatorio sin fecha límite se rechaza (reminder_needs_due_date)');

select lives_ok(
  $$ insert into tasks (organization_id, business_line_id, title, due_at, remind_at)
     values ('00000000-0000-0000-0000-000000015c01',
             '00000000-0000-0000-0000-000000015c11', 'Avisar con fecha',
             now() + interval '2 days', now() + interval '1 day') $$,
  'tasks: con fecha límite, el recordatorio se acepta');

-- ── Scenario: Alta sin estado explícito ───────────────────────────────────
-- Sublimación no tiene juego propio de tareas: resuelve el de la organización.

insert into tasks (id, organization_id, business_line_id, title) values
  ('00000000-0000-0000-0000-00000015a001', '00000000-0000-0000-0000-000000015c01',
   '00000000-0000-0000-0000-000000015c11', 'Del juego de la organización');

select is(
  (select status_id from tasks where id = '00000000-0000-0000-0000-00000015a001'),
  '00000000-0000-0000-0000-000000015c21'::uuid,
  'tasks: sin juego propio, nace en el estado inicial de la organización');

-- ── Scenario: Línea con juego propio de tareas ────────────────────────────

insert into tasks (id, organization_id, business_line_id, title) values
  ('00000000-0000-0000-0000-00000015a002', '00000000-0000-0000-0000-000000015c01',
   '00000000-0000-0000-0000-000000015c12', 'Set de 6 tazas');

select is(
  (select status_id from tasks where id = '00000000-0000-0000-0000-00000015a002'),
  '00000000-0000-0000-0000-000000015c31'::uuid,
  'tasks: con juego propio, nace en el inicial de su línea y no en el de la organización');

-- ── Scenario: Estado explícito respetado ──────────────────────────────────

insert into tasks (id, organization_id, business_line_id, title, status_id) values
  ('00000000-0000-0000-0000-00000015a003', '00000000-0000-0000-0000-000000015c01',
   '00000000-0000-0000-0000-000000015c11', 'Ya en revisión',
   '00000000-0000-0000-0000-000000015c22');

select is(
  (select status_id from tasks where id = '00000000-0000-0000-0000-00000015a003'),
  '00000000-0000-0000-0000-000000015c22'::uuid,
  'tasks: un estado indicado no lo pisa la asignación automática');

-- ── Scenario: El nombre del estado no decide nada ─────────────────────────
-- Renombrar el inicial no cambia dónde nacen las tareas: manda `kind`.

update statuses set name = 'Pendientes de verdad'
where id = '00000000-0000-0000-0000-000000015c21';

insert into tasks (id, organization_id, business_line_id, title) values
  ('00000000-0000-0000-0000-00000015a004', '00000000-0000-0000-0000-000000015c01',
   '00000000-0000-0000-0000-000000015c11', 'Tras el renombrado');

select is(
  (select status_id from tasks where id = '00000000-0000-0000-0000-00000015a004'),
  '00000000-0000-0000-0000-000000015c21'::uuid,
  'tasks: renombrar el estado inicial no cambia dónde nacen las tareas');

-- Ningún valor derivado almacenado (convención nº 4): `closed_at` registra un
-- hecho, como `queued_at`; lo que no puede haber es total, saldo ni conteo.
select is(
  (select count(*)::int from information_schema.columns
   where table_schema = 'public' and table_name = 'tasks'
     and (column_name ~ '(total|cost|costo|margin|margen|balance|saldo|count|conteo)')),
  0, 'tasks: ninguna columna derivada de total, saldo ni conteo');

select * from finish();
rollback;
