-- KAM-15 · tasks: el cierre se deriva de la posición en el tablero.
-- Escenarios del delta spec `tasks` — requisito "El cierre se deriva de la
-- posición en el tablero", y "El arrastre funciona en ambos sentidos y sin
-- efectos secundarios" → «Retroceder desde un estado final reabre la tarea».
--
-- Vive aparte de `task_integrity` porque prueba un trigger, no una
-- restricción: cuando falla, lo que hay que mirar es otro sitio.
begin;

set search_path to public, extensions;

select plan(7);

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-000000015d01', 'Cierre de tareas');

insert into business_lines (id, organization_id, name) values
  ('00000000-0000-0000-0000-000000015d11', '00000000-0000-0000-0000-000000015d01', 'Sublimación');

insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-000000015d21', '00000000-0000-0000-0000-000000015d01', null, 'task', 'Por hacer',   'initial',     1),
  ('00000000-0000-0000-0000-000000015d22', '00000000-0000-0000-0000-000000015d01', null, 'task', 'Haciendo',    'in_progress', 2),
  ('00000000-0000-0000-0000-000000015d23', '00000000-0000-0000-0000-000000015d01', null, 'task', 'En revisión', 'waiting',     3),
  ('00000000-0000-0000-0000-000000015d24', '00000000-0000-0000-0000-000000015d01', null, 'task', 'Hecho',       'final',       4);

insert into tasks (id, organization_id, business_line_id, title) values
  ('00000000-0000-0000-0000-00000015d001', '00000000-0000-0000-0000-000000015d01',
   '00000000-0000-0000-0000-000000015d11', 'Diseñar arte del #142');

select is(
  (select closed_at from tasks where id = '00000000-0000-0000-0000-00000015d001'),
  null, 'tasks: una tarea nueva nace abierta');

-- ── Scenario: Cerrar una tarea ────────────────────────────────────────────

update tasks set status_id = '00000000-0000-0000-0000-000000015d24'
where id = '00000000-0000-0000-0000-00000015d001';

select isnt(
  (select closed_at from tasks where id = '00000000-0000-0000-0000-00000015d001'),
  null, 'tasks: al entrar en un estado final queda el instante de cierre');

-- ── Scenario: Reabrir una tarea ───────────────────────────────────────────
-- Y "Retroceder desde un estado final reabre la tarea": arrastrar de vuelta a
-- *Por hacer* desde *Hecho* deja la tarea abierta otra vez, sin rastro raro.

update tasks set status_id = '00000000-0000-0000-0000-000000015d21'
where id = '00000000-0000-0000-0000-00000015d001';

select is(
  (select closed_at from tasks where id = '00000000-0000-0000-0000-00000015d001'),
  null, 'tasks: al salir de un estado final el cierre desaparece');

-- ── Scenario: Editar la tarea no la cierra ────────────────────────────────

update tasks set title = 'Diseñar arte del #142 (v2)', due_at = now() + interval '3 days'
where id = '00000000-0000-0000-0000-00000015d001';

select is(
  (select closed_at from tasks where id = '00000000-0000-0000-0000-00000015d001'),
  null, 'tasks: cambiar título y fecha no cierra la tarea');

select is(
  (select status_id from tasks where id = '00000000-0000-0000-0000-00000015d001'),
  '00000000-0000-0000-0000-000000015d21'::uuid,
  'tasks: cambiar título y fecha no mueve la tarea de columna');

-- Editar una tarea ya cerrada tampoco reescribe su fecha de cierre.
update tasks set status_id = '00000000-0000-0000-0000-000000015d24'
where id = '00000000-0000-0000-0000-00000015d001';

create temp table cierre as
select closed_at from tasks where id = '00000000-0000-0000-0000-00000015d001';

update tasks set title = 'Cerrada y luego editada'
where id = '00000000-0000-0000-0000-00000015d001';

select is(
  (select closed_at from tasks where id = '00000000-0000-0000-0000-00000015d001'),
  (select closed_at from cierre),
  'tasks: editar una tarea cerrada no reescribe su fecha de cierre');

-- Moverse entre dos estados no finales no inventa ningún cierre.
update tasks set status_id = '00000000-0000-0000-0000-000000015d22'
where id = '00000000-0000-0000-0000-00000015d001';
update tasks set status_id = '00000000-0000-0000-0000-000000015d23'
where id = '00000000-0000-0000-0000-00000015d001';

select is(
  (select closed_at from tasks where id = '00000000-0000-0000-0000-00000015d001'),
  null, 'tasks: pasar por Haciendo y En revisión no cierra nada');

select * from finish();
rollback;
