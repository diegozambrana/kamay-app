-- KAM-21 · task_deliverables: aislamiento, unicidad, y el cierre con entregables.
-- Escenarios del delta spec `task-links-deliverables`:
--   · "Los entregables solo son accesibles dentro de su organización y nadie
--     los borra" → los cuatro.
--   · "Una tarea declara qué debe existir al terminarla" → «No se declara dos
--     veces el mismo tipo».
--   · "El asistente ofrece tres salidas y ninguna se penaliza" → «Crear
--     seleccionados cierra la tarea», «Un fallo no deja la tarea a medias».
--   · "El registro creado queda enlazado desde la tarea y visible en la
--     bitácora" → «El producto creado aparece en los vínculos», «La creación
--     queda en la bitácora».
--   · "Cerrar sin entregables deja una marca discreta y localizable" → «La
--     marca aparece al cerrar sin crear nada», «Reabrir retira la marca».
begin;

set search_path to public, extensions;

select plan(20);

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

-- ── Dos organizaciones, para que el aislamiento tenga contra qué probarse ──

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000021d0a1', 'owner-a-deliv@kamay.test'),
  ('00000000-0000-0000-0000-00000021d0a2', 'assist-a-deliv@kamay.test'),
  ('00000000-0000-0000-0000-00000021d0b1', 'owner-b-deliv@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-0000000021da', 'Taller A'),
  ('00000000-0000-0000-0000-0000000021db', 'Taller B');

insert into memberships (id, organization_id, user_id, role) values
  ('00000000-0000-0000-0000-00000021d1a1', '00000000-0000-0000-0000-0000000021da', '00000000-0000-0000-0000-00000021d0a1', 'owner'),
  ('00000000-0000-0000-0000-00000021d1a2', '00000000-0000-0000-0000-0000000021da', '00000000-0000-0000-0000-00000021d0a2', 'assistant'),
  ('00000000-0000-0000-0000-00000021d1b1', '00000000-0000-0000-0000-0000000021db', '00000000-0000-0000-0000-00000021d0b1', 'owner');

insert into business_lines (id, organization_id, name) values
  ('00000000-0000-0000-0000-00000021d2a1', '00000000-0000-0000-0000-0000000021da', 'Alfarería'),
  ('00000000-0000-0000-0000-00000021d2a2', '00000000-0000-0000-0000-0000000021da', 'Sublimación'),
  ('00000000-0000-0000-0000-00000021d2b1', '00000000-0000-0000-0000-0000000021db', 'Ajena');

insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-00000021d3a1', '00000000-0000-0000-0000-0000000021da', null, 'task', 'Por hacer', 'initial', 1),
  -- El nombre no decide nada: lo decide `kind` (convención nº 5).
  ('00000000-0000-0000-0000-00000021d3a2', '00000000-0000-0000-0000-0000000021da', null, 'task', 'Entregado', 'final',   2),
  ('00000000-0000-0000-0000-00000021d3b1', '00000000-0000-0000-0000-0000000021db', null, 'task', 'Por hacer', 'initial', 1);

insert into tasks (id, organization_id, business_line_id, title, status_id) values
  ('00000000-0000-0000-0000-00000021d4a1', '00000000-0000-0000-0000-0000000021da',
   '00000000-0000-0000-0000-00000021d2a1', 'Set de 6 tazas artesanales',
   '00000000-0000-0000-0000-00000021d3a1'),
  ('00000000-0000-0000-0000-00000021d4a2', '00000000-0000-0000-0000-0000000021da',
   '00000000-0000-0000-0000-00000021d2a1', 'Cerrar sin crear nada',
   '00000000-0000-0000-0000-00000021d3a1'),
  ('00000000-0000-0000-0000-00000021d4a3', '00000000-0000-0000-0000-0000000021da',
   '00000000-0000-0000-0000-00000021d2a2', 'Tarea de otra línea',
   '00000000-0000-0000-0000-00000021d3a1'),
  ('00000000-0000-0000-0000-00000021d4b1', '00000000-0000-0000-0000-0000000021db',
   '00000000-0000-0000-0000-00000021d2b1', 'Tarea ajena',
   '00000000-0000-0000-0000-00000021d3b1');

-- ── Scenario: No se declara dos veces el mismo tipo ───────────────────────

select lives_ok(
  $$ insert into task_deliverables (task_id, organization_id, deliverable_type)
     values ('00000000-0000-0000-0000-00000021d4a1',
             '00000000-0000-0000-0000-0000000021da', 'product') $$,
  'task_deliverables: se declara un entregable');

select throws_ok(
  $$ insert into task_deliverables (task_id, organization_id, deliverable_type)
     values ('00000000-0000-0000-0000-00000021d4a1',
             '00000000-0000-0000-0000-0000000021da', 'product') $$,
  '23505', null, 'task_deliverables: el mismo tipo no se declara dos veces en la misma tarea');

select throws_ok(
  $$ insert into task_deliverables (task_id, organization_id, deliverable_type)
     values ('00000000-0000-0000-0000-00000021d4a1',
             '00000000-0000-0000-0000-0000000021da', 'invoice') $$,
  '23514', null, 'task_deliverables: un tipo fuera del canon se rechaza');

-- El cumplimiento va entero o no va: leer `fulfilled_id` sin comprobar
-- `fulfilled_at` sería posible si esto no estuviera.
select throws_ok(
  $$ insert into task_deliverables (task_id, organization_id, deliverable_type,
                                    fulfilled_id)
     values ('00000000-0000-0000-0000-00000021d4a1',
             '00000000-0000-0000-0000-0000000021da', 'supply',
             '00000000-0000-0000-0000-0000000000ff') $$,
  '23514', null, 'task_deliverables: un cumplimiento a medias se rechaza');

-- ── Scenario: Nadie borra un entregable ───────────────────────────────────

select pg_temp.login('00000000-0000-0000-0000-00000021d0a1');

select throws_ok(
  $$ delete from task_deliverables
     where task_id = '00000000-0000-0000-0000-00000021d4a1' $$,
  '42501', null, 'task_deliverables: ni la persona dueña borra una fila');

select pg_temp.logout();

-- ── Scenario: Otra organización no lee / no declara entregables ajenos ────

select pg_temp.login('00000000-0000-0000-0000-00000021d0b1');

select is(
  (select count(*)::int from task_deliverables
   where organization_id = '00000000-0000-0000-0000-0000000021da'),
  0, 'task_deliverables: otra organización no lee los entregables ajenos');

select throws_ok(
  $$ insert into task_deliverables (task_id, organization_id, deliverable_type)
     values ('00000000-0000-0000-0000-00000021d4a1',
             '00000000-0000-0000-0000-0000000021da', 'supplier') $$,
  '42501', null, 'task_deliverables: otra organización no declara sobre una tarea ajena');

select pg_temp.logout();

-- ── Scenario: El ayudante sigue la visibilidad de la tarea ────────────────
-- Restringido a Alfarería: no ve la tarea de Sublimación ni sus entregables.

insert into membership_lines (membership_id, business_line_id, organization_id) values
  ('00000000-0000-0000-0000-00000021d1a2', '00000000-0000-0000-0000-00000021d2a1',
   '00000000-0000-0000-0000-0000000021da');

insert into task_deliverables (task_id, organization_id, deliverable_type) values
  ('00000000-0000-0000-0000-00000021d4a3', '00000000-0000-0000-0000-0000000021da', 'supply');

select pg_temp.login('00000000-0000-0000-0000-00000021d0a2');

select is(
  (select count(*)::int from task_deliverables
   where task_id = '00000000-0000-0000-0000-00000021d4a3'),
  0, 'task_deliverables: el ayudante no ve los de una tarea que no alcanza');

select is(
  (select count(*)::int from task_deliverables
   where task_id = '00000000-0000-0000-0000-00000021d4a1'),
  1, 'task_deliverables: el ayudante sí ve los de una tarea de su línea');

select pg_temp.logout();

-- ── El cierre con entregables ─────────────────────────────────────────────
-- Scenario: Crear seleccionados cierra la tarea.
-- Scenario: El producto creado aparece en los vínculos.
-- Scenario: La creación queda en la bitácora.

select pg_temp.login('00000000-0000-0000-0000-00000021d0a1');

select lives_ok(
  $$ select close_task_with_deliverables(
       '00000000-0000-0000-0000-00000021d4a1',
       jsonb_build_array(jsonb_build_object(
         'deliverable_type', 'product',
         'new_id', '00000000-0000-0000-0000-00000021d5a1',
         'payload', jsonb_build_object(
           'name', 'Taza artesanal',
           'business_line_id', '00000000-0000-0000-0000-00000021d2a1'))),
       '00000000-0000-0000-0000-00000021d3a2') $$,
  'close_task_with_deliverables: crea el producto y cierra');

select is(
  (select closed_at is not null and closed_without_deliverables = false
   from tasks where id = '00000000-0000-0000-0000-00000021d4a1'),
  true, 'close: la tarea queda cerrada y sin marca, porque sí se creó algo');

select is(
  (select count(*)::int from task_links
   where task_id = '00000000-0000-0000-0000-00000021d4a1'
     and entity_type = 'item'
     and entity_id = '00000000-0000-0000-0000-00000021d5a1'),
  1, 'close: el producto creado queda vinculado a la tarea');

select is(
  (select fulfilled_type || ':' || fulfilled_id::text
   from task_deliverables
   where task_id = '00000000-0000-0000-0000-00000021d4a1'
     and deliverable_type = 'product'),
  'item:00000000-0000-0000-0000-00000021d5a1',
  'close: el entregable registra qué se creó');

select pg_temp.logout();

-- La bitácora la escribe el trigger de `items`, no una tabla propia
-- (convención nº 7). Se lee sin rol para no depender de la política.
select is(
  (select count(*)::int from activity_log
   where table_name = 'items'
     and record_id = '00000000-0000-0000-0000-00000021d5a1'
     and action = 'created'),
  1, 'close: la creación del producto queda en la bitácora del sistema');

-- ── Scenario: La marca aparece al cerrar sin crear nada ───────────────────

insert into task_deliverables (task_id, organization_id, deliverable_type) values
  ('00000000-0000-0000-0000-00000021d4a2', '00000000-0000-0000-0000-0000000021da', 'expenses');

select pg_temp.login('00000000-0000-0000-0000-00000021d0a1');

select lives_ok(
  $$ select close_task_with_deliverables(
       '00000000-0000-0000-0000-00000021d4a2',
       '[]'::jsonb,
       '00000000-0000-0000-0000-00000021d3a2') $$,
  'close: cerrar sin crear nada no falla ni pide justificación');

select is(
  (select closed_without_deliverables
   from tasks where id = '00000000-0000-0000-0000-00000021d4a2'),
  true, 'close: queda la marca de cerrada sin entregables');

-- ── Scenario: Reabrir retira la marca ─────────────────────────────────────
-- Lo lleva el trigger, así que vale para cualquier vía de reapertura.

update tasks set status_id = '00000000-0000-0000-0000-00000021d3a1'
 where id = '00000000-0000-0000-0000-00000021d4a2';

select is(
  (select closed_at is null and closed_without_deliverables = false
   from tasks where id = '00000000-0000-0000-0000-00000021d4a2'),
  true, 'close: reabrir borra la fecha de cierre y retira la marca');

-- ── Scenario: Un fallo no deja la tarea a medias ──────────────────────────
-- Dos entregables marcados: el proveedor es válido y va primero; el gasto llega
-- sin categoría ni importe, que es lo que `expenses` exige. La transacción
-- entera se deshace, así que **tampoco** queda el proveedor que sí era válido.
--
-- El tipo desconocido no sirve para esto: la RPC solo crea lo que está
-- declarado y sin cumplir, y `task_deliverables` no admite un tipo fuera del
-- canon. Es una robustez que la prueba descubrió, no un caso que ejercitar.

insert into task_deliverables (task_id, organization_id, deliverable_type) values
  ('00000000-0000-0000-0000-00000021d4a2', '00000000-0000-0000-0000-0000000021da', 'supplier');

select throws_ok(
  $$ select close_task_with_deliverables(
       '00000000-0000-0000-0000-00000021d4a2',
       jsonb_build_array(
         jsonb_build_object(
           'deliverable_type', 'supplier',
           'new_id', '00000000-0000-0000-0000-00000021d6a1',
           'payload', jsonb_build_object('name', 'Proveedor nuevo')),
         jsonb_build_object(
           'deliverable_type', 'expenses',
           'new_id', '00000000-0000-0000-0000-00000021d6a2',
           'payload', '{}'::jsonb)),
       '00000000-0000-0000-0000-00000021d3a2') $$,
  '23514', null, 'close: un gasto sin categoría ni importe aborta la operación');

select is(
  (select count(*)::int from contacts
   where id = '00000000-0000-0000-0000-00000021d6a1'),
  0, 'close: el proveedor que iba antes en la lista tampoco se creó');

select is(
  (select closed_at is null
   from tasks where id = '00000000-0000-0000-0000-00000021d4a2'),
  true, 'close: la tarea sigue abierta tras el fallo');

select pg_temp.logout();

select * from finish();
rollback;
