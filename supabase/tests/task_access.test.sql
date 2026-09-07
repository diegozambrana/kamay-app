-- KAM-15 · tasks: visibilidad por rol y por línea.
-- Escenarios del delta spec `tasks` — requisito "Visibilidad de tareas por rol
-- y por línea"; y del delta spec `user-management` — requisito "The owner
-- assigns business lines to a membership".
--
-- Es la política más compleja del proyecto, así que la matriz se prueba
-- entera: dueño, ayudante sin líneas, ayudante con una línea, tarea asignada
-- de otra línea, línea compartida y otra organización. `has_line_access` se
-- prueba además por separado, para que un fallo diga cuál de las dos falló.
begin;

set search_path to public, extensions;

select plan(21);

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
  ('00000000-0000-0000-0000-00000015e0a1', 'owner-task-a@kamay.test'),
  ('00000000-0000-0000-0000-00000015e0a2', 'assist-libre-a@kamay.test'),
  ('00000000-0000-0000-0000-00000015e0a3', 'assist-alfareria-a@kamay.test'),
  ('00000000-0000-0000-0000-00000015e0b1', 'owner-task-b@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-0000000015ea', 'Tareas A'),
  ('00000000-0000-0000-0000-0000000015eb', 'Tareas B');

insert into memberships (id, organization_id, user_id, role) values
  ('00000000-0000-0000-0000-00000015e1a1', '00000000-0000-0000-0000-0000000015ea', '00000000-0000-0000-0000-00000015e0a1', 'owner'),
  ('00000000-0000-0000-0000-00000015e1a2', '00000000-0000-0000-0000-0000000015ea', '00000000-0000-0000-0000-00000015e0a2', 'assistant'),
  ('00000000-0000-0000-0000-00000015e1a3', '00000000-0000-0000-0000-0000000015ea', '00000000-0000-0000-0000-00000015e0a3', 'assistant'),
  ('00000000-0000-0000-0000-00000015e1b1', '00000000-0000-0000-0000-0000000015eb', '00000000-0000-0000-0000-00000015e0b1', 'owner');

insert into business_lines (id, organization_id, name, is_shared) values
  ('00000000-0000-0000-0000-00000015e2a1', '00000000-0000-0000-0000-0000000015ea', 'Sublimación', false),
  ('00000000-0000-0000-0000-00000015e2a2', '00000000-0000-0000-0000-0000000015ea', 'Alfarería',   false),
  ('00000000-0000-0000-0000-00000015e2a3', '00000000-0000-0000-0000-0000000015ea', 'General',     true),
  ('00000000-0000-0000-0000-00000015e2b1', '00000000-0000-0000-0000-0000000015eb', 'Sublimación', false);

insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-00000015e3a1', '00000000-0000-0000-0000-0000000015ea', null, 'task', 'Por hacer', 'initial', 1),
  ('00000000-0000-0000-0000-00000015e3a2', '00000000-0000-0000-0000-0000000015ea', null, 'task', 'Hecho',     'final',   2),
  ('00000000-0000-0000-0000-00000015e3b1', '00000000-0000-0000-0000-0000000015eb', null, 'task', 'Por hacer', 'initial', 1),
  ('00000000-0000-0000-0000-00000015e3b2', '00000000-0000-0000-0000-0000000015eb', null, 'task', 'Hecho',     'final',   2);

-- El ayudante 3 queda restringido a Alfarería; el ayudante 2, sin declarar.
insert into membership_lines (membership_id, business_line_id, organization_id) values
  ('00000000-0000-0000-0000-00000015e1a3', '00000000-0000-0000-0000-00000015e2a2', '00000000-0000-0000-0000-0000000015ea');

insert into tasks (id, organization_id, business_line_id, title, assignee_id) values
  -- Sublimación, sin responsable: fuera del alcance del ayudante restringido
  ('00000000-0000-0000-0000-00000015e401', '00000000-0000-0000-0000-0000000015ea',
   '00000000-0000-0000-0000-00000015e2a1', 'Arte de sublimación', null),
  -- Alfarería: su línea
  ('00000000-0000-0000-0000-00000015e402', '00000000-0000-0000-0000-0000000015ea',
   '00000000-0000-0000-0000-00000015e2a2', 'Set de 6 tazas', null),
  -- General/Compartido: de todos
  ('00000000-0000-0000-0000-00000015e403', '00000000-0000-0000-0000-0000000015ea',
   '00000000-0000-0000-0000-00000015e2a3', 'Preparar la feria', null),
  -- Sublimación pero asignada al ayudante restringido: la ve por asignación
  ('00000000-0000-0000-0000-00000015e404', '00000000-0000-0000-0000-0000000015ea',
   '00000000-0000-0000-0000-00000015e2a1', 'Sublimar lo del sábado',
   '00000000-0000-0000-0000-00000015e0a3'),
  -- Otra organización
  ('00000000-0000-0000-0000-00000015e4b1', '00000000-0000-0000-0000-0000000015eb',
   '00000000-0000-0000-0000-00000015e2b1', 'Tarea ajena', null);

-- ── has_line_access, probada aparte de la política ────────────────────────

select pg_temp.login('00000000-0000-0000-0000-00000015e0a3');

select ok(
  has_line_access('00000000-0000-0000-0000-0000000015ea', '00000000-0000-0000-0000-00000015e2a2'),
  'has_line_access: la línea declarada se alcanza');

select ok(
  not has_line_access('00000000-0000-0000-0000-0000000015ea', '00000000-0000-0000-0000-00000015e2a1'),
  'has_line_access: una línea no declarada no se alcanza');

select ok(
  has_line_access('00000000-0000-0000-0000-0000000015ea', '00000000-0000-0000-0000-00000015e2a3'),
  'has_line_access: la línea compartida se alcanza siempre');

select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-00000015e0a2');

select ok(
  has_line_access('00000000-0000-0000-0000-0000000015ea', '00000000-0000-0000-0000-00000015e2a1')
  and has_line_access('00000000-0000-0000-0000-0000000015ea', '00000000-0000-0000-0000-00000015e2a2'),
  'has_line_access: sin líneas declaradas se alcanzan todas');

select pg_temp.logout();

-- ── Scenario: la persona dueña ve todo ────────────────────────────────────

select pg_temp.login('00000000-0000-0000-0000-00000015e0a1');

select is((select count(*)::int from tasks), 4,
  'tasks: la persona dueña ve las cuatro tareas de su organización');

select pg_temp.logout();

-- ── Scenario: Ayudante sin líneas asignadas ───────────────────────────────

select pg_temp.login('00000000-0000-0000-0000-00000015e0a2');

select is((select count(*)::int from tasks), 4,
  'tasks: un ayudante sin líneas asignadas ve las de todas las líneas');

select pg_temp.logout();

-- ── Scenario: Ayudante restringido a una línea ────────────────────────────
-- Y «Tarea asignada de otra línea» y «La línea compartida es de todos»: ve
-- Alfarería + General + la de Sublimación que le asignaron; no la otra.

select pg_temp.login('00000000-0000-0000-0000-00000015e0a3');

select is((select count(*)::int from tasks), 3,
  'tasks: el ayudante restringido ve su línea, la compartida y lo asignado');

select ok(
  exists (select 1 from tasks where id = '00000000-0000-0000-0000-00000015e402'),
  'tasks: ve la tarea de su línea (Alfarería)');

select ok(
  exists (select 1 from tasks where id = '00000000-0000-0000-0000-00000015e403'),
  'tasks: ve la tarea de la línea compartida');

select ok(
  exists (select 1 from tasks where id = '00000000-0000-0000-0000-00000015e404'),
  'tasks: ve la tarea de otra línea que le está asignada');

select ok(
  not exists (select 1 from tasks where id = '00000000-0000-0000-0000-00000015e401'),
  'tasks: no ve la tarea de Sublimación que no le toca ni le asignaron');

-- ── Scenario: Aislamiento entre organizaciones ────────────────────────────

select is(
  (select count(*)::int from tasks
   where organization_id = '00000000-0000-0000-0000-0000000015eb'),
  0, 'tasks: cero filas de la otra organización');

select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-00000015e0b1');

select is((select count(*)::int from tasks), 1,
  'tasks: la dueña de B ve solo la suya');

select pg_temp.logout();

-- ── Scenario: El ayudante no archiva ──────────────────────────────────────

select pg_temp.login('00000000-0000-0000-0000-00000015e0a3');

select throws_ok(
  $$ update tasks set archived_at = now()
     where id = '00000000-0000-0000-0000-00000015e402' $$,
  '42501', null, 'tasks: un ayudante no puede archivar');

select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-00000015e0a1');

select lives_ok(
  $$ update tasks set archived_at = now()
     where id = '00000000-0000-0000-0000-00000015e402' $$,
  'tasks: la persona dueña sí archiva');

select pg_temp.logout();

-- ── Scenario: Nadie borra una tarea ───────────────────────────────────────
-- Las cinco tablas van más allá de «sin política»: tienen el privilegio de
-- DELETE revocado, como `payments` (KAM-10), así que el borrado ni siquiera
-- llega a ejecutarse. Es el patrón más fuerte de los dos que usa el proyecto.

select pg_temp.login('00000000-0000-0000-0000-00000015e0a1');

select throws_ok(
  $$ delete from tasks where id = '00000000-0000-0000-0000-00000015e401' $$,
  '42501', null,
  'tasks: ni la persona dueña borra — el privilegio está revocado');

select throws_ok(
  $$ delete from task_links $$,
  '42501', null,
  'task_links: DELETE ni se ejecuta — el privilegio está revocado');

select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public'
     and tablename in ('tasks', 'tags', 'task_tags', 'task_links', 'membership_lines')
     and cmd = 'DELETE'),
  0, 'tareas: ninguna de las cinco tablas tiene política DELETE');

select pg_temp.logout();

-- ── user-management: solo el dueño asigna líneas ──────────────────────────

select pg_temp.login('00000000-0000-0000-0000-00000015e0a3');

select throws_ok(
  $$ insert into membership_lines (membership_id, business_line_id, organization_id)
     values ('00000000-0000-0000-0000-00000015e1a3',
             '00000000-0000-0000-0000-00000015e2a1',
             '00000000-0000-0000-0000-0000000015ea') $$,
  '42501', null, 'membership_lines: un ayudante no se asigna líneas a sí mismo');

select is((select count(*)::int from membership_lines), 1,
  'membership_lines: un miembro lee las asignaciones de su organización');

select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-00000015e0b1');

select is((select count(*)::int from membership_lines), 0,
  'membership_lines: ninguna asignación cruza de organización');

select pg_temp.logout();

select * from finish();
rollback;
