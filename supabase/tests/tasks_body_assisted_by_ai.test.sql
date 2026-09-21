-- KAM-30 · Cambio `task-body-writing-assist`: `tasks.body_assisted_by_ai` es
-- una columna real, y el trigger `audit` que ya lleva `tasks` desde su
-- creación la diferencia como cualquier otra (supabase/README.md → "Cómo
-- auditar una tabla nueva"). Escenario de la spec `ai-writing-assist` →
-- *Una propuesta aceptada y guardada queda registrada como asistida*.
--
-- Dos tareas distintas y no dos ediciones de la misma: `log_activity()` funde
-- ediciones sucesivas del mismo registro dentro de cinco minutos, y una
-- segunda `update` en la misma transacción se fundiría con la primera en vez
-- de dejar dos eventos que comprobar por separado.
begin;

set search_path to public, extensions;

select plan(4);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000752a01', 'owner-ai-body-a@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-00000075200a', 'Redacción A');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-00000075200a', '00000000-0000-0000-0000-000000752a01', 'owner');

insert into business_lines (id, organization_id, name, color) values
  ('00000000-0000-0000-0000-000000752c01', '00000000-0000-0000-0000-00000075200a', 'Taller', 'amber');

insert into statuses (organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-00000075200a', null, 'task', 'Por hacer', 'initial', 1),
  ('00000000-0000-0000-0000-00000075200a', null, 'task', 'Hecho',     'final',   2);

-- ── Guardar una propuesta aceptada marca la columna ────────────────────────

insert into tasks (id, organization_id, business_line_id, title, body_markdown) values
  ('00000000-0000-0000-0000-000000752d01', '00000000-0000-0000-0000-00000075200a',
   '00000000-0000-0000-0000-000000752c01', 'Redactar la ficha del pedido', 'Texto apurado.');

select is(
  (select body_assisted_by_ai from tasks where id = '00000000-0000-0000-0000-000000752d01'),
  false, 'tasks: body_assisted_by_ai nace en falso');

update tasks
   set body_markdown = 'Texto mejorado por el asistente.', body_assisted_by_ai = true
 where id = '00000000-0000-0000-0000-000000752d01';

select ok(
  (select changes ? 'body_assisted_by_ai' and changes ? 'body_markdown'
     from activity_log
    where table_name = 'tasks'
      and record_id = '00000000-0000-0000-0000-000000752d01'
      and action = 'updated'),
  'activity_log: el guardado asistido registra el cuerpo y la marca de asistido, juntos');

select is(
  (select changes->'body_assisted_by_ai'->>'despues' from activity_log
    where table_name = 'tasks'
      and record_id = '00000000-0000-0000-0000-000000752d01'
      and action = 'updated'),
  'true', 'activity_log: la marca de asistido queda en "true" en el después');

-- ── Una edición manual posterior la vuelve a apagar ───────────────────────
-- Tarea aparte, ya nacida con la marca en verdadero, para que la única
-- `update` de esta tarea sea justamente la que la apaga.

insert into tasks (id, organization_id, business_line_id, title, body_markdown, body_assisted_by_ai) values
  ('00000000-0000-0000-0000-000000752d02', '00000000-0000-0000-0000-00000075200a',
   '00000000-0000-0000-0000-000000752c01', 'Otra ficha', 'Texto que ya vino de una propuesta aceptada.', true);

update tasks
   set body_markdown = 'Texto editado a mano después.', body_assisted_by_ai = false
 where id = '00000000-0000-0000-0000-000000752d02';

select is(
  (select changes->'body_assisted_by_ai'->>'despues' from activity_log
    where table_name = 'tasks'
      and record_id = '00000000-0000-0000-0000-000000752d02'
      and action = 'updated'),
  'false', 'activity_log: una edición manual posterior vuelve a apagar la marca');

select * from finish();
rollback;
