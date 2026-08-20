-- KAM-05 · configurable-statuses: la tabla `statuses`, su resolución, la
-- integridad del juego (al menos un inicial y un final), el archivado con
-- reasignación, la RLS y la bitácora. Escenarios del delta spec
-- `configurable-statuses`, más la verificación de la semilla de Geeko Store.
begin;

set search_path to public, extensions;

select plan(41);

-- El trigger de integridad es diferido (valida al confirmar). Esta suite corre
-- entera dentro de una transacción que termina en rollback, así que se fuerza
-- la validación por sentencia para poder observar los errores.
set constraints status_set_integrity immediate;

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
  ('00000000-0000-0000-0000-0000000005a1', 'owner-st-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000005a2', 'assistant-st-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000005b1', 'owner-st-b@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-00000000005a', 'Estados A'),
  ('00000000-0000-0000-0000-00000000005b', 'Estados B');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-0000000005a1', 'owner'),
  ('00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-0000000005a2', 'assistant'),
  ('00000000-0000-0000-0000-00000000005b', '00000000-0000-0000-0000-0000000005b1', 'owner');

insert into business_lines (id, organization_id, name, color) values
  ('00000000-0000-0000-0000-00000000051a', '00000000-0000-0000-0000-00000000005a', 'Con juego propio', 'blue'),
  ('00000000-0000-0000-0000-00000000052a', '00000000-0000-0000-0000-00000000005a', 'Sin juego propio', 'green');

-- Juego de pedidos de la organización A…
insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-00000000053a', '00000000-0000-0000-0000-00000000005a', null, 'order', 'Registrado', 'initial', 1),
  ('00000000-0000-0000-0000-00000000054a', '00000000-0000-0000-0000-00000000005a', null, 'order', 'Entregado',  'final',   2);

-- …y juego propio de la primera línea.
insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-00000000055a', '00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-00000000051a', 'order', 'Reservado', 'initial', 1),
  ('00000000-0000-0000-0000-00000000056a', '00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-00000000051a', 'order', 'Listo',     'final',   2);

-- Un juego mínimo en la organización B, para el aislamiento.
insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-00000000053b', '00000000-0000-0000-0000-00000000005b', null, 'order', 'Registrado', 'initial', 1),
  ('00000000-0000-0000-0000-00000000054b', '00000000-0000-0000-0000-00000000005b', null, 'order', 'Entregado',  'final',   2);

-- ── Scenario: Nombre duplicado en el mismo juego / en juegos distintos ────

select throws_ok(
  $$ insert into statuses (organization_id, business_line_id, flow, name, kind)
     values ('00000000-0000-0000-0000-00000000005a', null, 'order', 'Registrado', 'waiting') $$,
  '23505', null,
  'unicidad: el mismo nombre no se repite dentro de un juego (nulls not distinct)');

select lives_ok(
  $$ insert into statuses (organization_id, business_line_id, flow, name, kind, position)
     values ('00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-00000000051a', 'order', 'Registrado', 'waiting', 3) $$,
  'unicidad: el mismo nombre sí puede existir en el juego de otra línea');

-- ── Scenario: Solo un estado de espera puede ser cola ─────────────────────

select throws_ok(
  $$ insert into statuses (organization_id, flow, name, kind, is_queue, position)
     values ('00000000-0000-0000-0000-00000000005a', 'order', 'Cola inválida', 'in_progress', true, 8) $$,
  '23514', null,
  'queue_only_when_waiting: is_queue exige kind = waiting');

select lives_ok(
  $$ insert into statuses (id, organization_id, flow, name, kind, is_queue, position)
     values ('00000000-0000-0000-0000-00000000059a', '00000000-0000-0000-0000-00000000005a', 'order', 'Cola válida', 'waiting', true, 9) $$,
  'queue_only_when_waiting: un estado de espera sí puede ser cola');

-- ── Scenario: Resolución del juego aplicable ──────────────────────────────

select is(
  (select count(*)::int from resolve_statuses(
    '00000000-0000-0000-0000-00000000005a',
    '00000000-0000-0000-0000-00000000052a', 'order')),
  3, 'resolución: la línea sin juego propio recibe el juego de la organización');

select bag_eq(
  $$ select name from resolve_statuses(
       '00000000-0000-0000-0000-00000000005a',
       '00000000-0000-0000-0000-00000000051a', 'order') $$,
  $$ values ('Reservado'), ('Listo'), ('Registrado') $$,
  'resolución: la línea con juego propio recibe solo el suyo');

select is(
  (select count(*)::int from resolve_statuses(
    '00000000-0000-0000-0000-00000000005a',
    '00000000-0000-0000-0000-00000000051a', 'order')
    where business_line_id is null),
  0, 'resolución: con juego propio, el de la organización se ignora por completo');

select is(
  (select count(*)::int from resolve_statuses(
    '00000000-0000-0000-0000-00000000005a', null, 'task')),
  0, 'resolución: sin juego de tareas no se devuelve nada (juego vacío válido)');

-- Un estado archivado desaparece de la resolución.
update statuses set archived_at = now()
  where id = '00000000-0000-0000-0000-00000000059a';

select is(
  (select count(*)::int from resolve_statuses(
    '00000000-0000-0000-0000-00000000005a',
    '00000000-0000-0000-0000-00000000052a', 'order')),
  2, 'resolución: los estados archivados quedan excluidos');

-- ── Scenario: Integridad — al menos un inicial y un final ─────────────────

select throws_ok(
  $$ update statuses set archived_at = now()
     where id = '00000000-0000-0000-0000-00000000056a' $$,
  '23514', 'Todo juego de estados necesita al menos un estado inicial y uno final',
  'integridad: dejar un juego sin estado final falla con mensaje comprensible');

select throws_ok(
  $$ update statuses set archived_at = now()
     where id = '00000000-0000-0000-0000-00000000055a' $$,
  '23514', 'Todo juego de estados necesita al menos un estado inicial y uno final',
  'integridad: dejar un juego sin estado inicial falla');

select is(
  (select count(*)::int from statuses
    where business_line_id = '00000000-0000-0000-0000-00000000051a'
      and archived_at is null),
  3, 'integridad: tras el rechazo, el juego queda como estaba');

select throws_ok(
  $$ insert into statuses (organization_id, flow, name, kind, position)
     values ('00000000-0000-0000-0000-00000000005a', 'task', 'Suelto', 'waiting', 1) $$,
  '23514', null,
  'integridad: un juego nuevo no puede nacer sin inicial y final');

-- Varias sentencias sí pueden pasar por estados intermedios inválidos: la
-- validación diferida mira el resultado completo al confirmar.
set constraints status_set_integrity deferred;

insert into statuses (organization_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-00000000005a', 'task', 'Por hacer', 'initial', 1);
insert into statuses (organization_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-00000000005a', 'task', 'Hecho', 'final', 2);

-- Al volver a inmediato se validan los eventos pendientes: si el juego hubiera
-- quedado inválido, esta sentencia misma fallaría y la suite lo mostraría.
set constraints status_set_integrity immediate;

select pass('integridad: el juego se valida completo al confirmar, no fila a fila');

-- ── Scenario: Archivar con reasignación, sin huérfanos ────────────────────
-- Ninguna tabla de negocio referencia estados todavía (orders y tasks llegan
-- en KAM-07/15): una tabla ficticia con FK demuestra que la reasignación
-- descubre a sus dependientes por catálogo.

create table status_refs_probe (
  id        serial primary key,
  status_id uuid not null references statuses(id)
);

insert into status_refs_probe (status_id) values
  ('00000000-0000-0000-0000-00000000053a'),
  ('00000000-0000-0000-0000-00000000053a');

select throws_ok(
  $$ select archive_status('00000000-0000-0000-0000-00000000053a') $$,
  '23514', 'El estado está en uso: indica a qué estado mover sus registros',
  'archivar: un estado en uso exige estado de destino');

select throws_ok(
  $$ select archive_status(
       '00000000-0000-0000-0000-00000000053a',
       '00000000-0000-0000-0000-00000000053a') $$,
  '23514', null,
  'archivar: el propio estado no sirve como destino');

-- Otro inicial en el juego de la organización, para poder retirar el primero.
insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-00000000057a', '00000000-0000-0000-0000-00000000005a', null, 'order', 'Recibido', 'initial', 5);

select lives_ok(
  $$ select archive_status(
       '00000000-0000-0000-0000-00000000053a',
       '00000000-0000-0000-0000-00000000057a') $$,
  'archivar: con destino la operación procede');

select is(
  (select count(*)::int from status_refs_probe
    where status_id = '00000000-0000-0000-0000-00000000057a'),
  2, 'archivar: todos los registros pasaron al estado de destino');

select is(
  (select count(*)::int from status_refs_probe p
    join statuses s on s.id = p.status_id
    where s.archived_at is not null),
  0, 'archivar: ningún registro quedó apuntando a un estado archivado');

select ok(
  (select archived_at is not null from statuses
    where id = '00000000-0000-0000-0000-00000000053a'),
  'archivar: el estado quedó archivado, no borrado');

-- Sin registros dependientes no hace falta destino.
insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-00000000058b', '00000000-0000-0000-0000-00000000005b', null, 'order', 'Extra', 'waiting', 3);

select lives_ok(
  $$ select archive_status('00000000-0000-0000-0000-00000000058b') $$,
  'archivar: sin registros en uso no se exige destino');

-- ── Scenario: RLS — el ayudante no escribe, otra organización no ve ───────

select pg_temp.login('00000000-0000-0000-0000-0000000005a2');

select is(
  (select count(*)::int from statuses
    where organization_id = '00000000-0000-0000-0000-00000000005b'),
  0, 'rls: los estados de otra organización son invisibles');

select ok(
  (select count(*) > 0 from statuses),
  'rls: el ayudante sí lee los estados de su organización');

select throws_ok(
  $$ insert into statuses (organization_id, flow, name, kind, position)
     values ('00000000-0000-0000-0000-00000000005a', 'order', 'Del ayudante', 'waiting', 9) $$,
  '42501', null, 'rls: el ayudante no puede crear estados');

-- El UPDATE del ayudante no lanza: la política no le muestra filas que editar.
update statuses set name = 'tocado por ayudante'
  where id = '00000000-0000-0000-0000-00000000055a';

select throws_ok(
  $$ delete from statuses where id = '00000000-0000-0000-0000-00000000055a' $$,
  '42501', null, 'rls: nadie borra estados — el privilegio DELETE está revocado');

select pg_temp.logout();

select is(
  (select name from statuses where id = '00000000-0000-0000-0000-00000000055a'),
  'Reservado', 'rls: la edición del ayudante no tocó ninguna fila');

-- ── Scenario: El dueño administra y la bitácora lo demuestra ──────────────

select pg_temp.login('00000000-0000-0000-0000-0000000005a1');

insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-00000000058a', '00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-00000000051a', 'order', 'En camino', 'waiting', 4);

update statuses set name = 'En ruta', updated_at = now()
  where id = '00000000-0000-0000-0000-00000000058a';

select pg_temp.logout();

select is(
  (select count(*)::int from activity_log
    where table_name = 'statuses'
      and record_id = '00000000-0000-0000-0000-00000000058a'
      and action = 'created'),
  1, 'bitácora: crear un estado queda registrado');

select is(
  (select changes -> 'name' ->> 'despues' from activity_log
    where table_name = 'statuses'
      and record_id = '00000000-0000-0000-0000-00000000058a'
      and action = 'updated'),
  'En ruta', 'bitácora: el renombre guarda el valor nuevo del campo cambiado');

select is(
  (select changes -> 'name' ->> 'antes' from activity_log
    where table_name = 'statuses'
      and record_id = '00000000-0000-0000-0000-00000000058a'
      and action = 'updated'),
  'En camino', 'bitácora: el renombre guarda también el valor anterior');

-- Renombrar no cambia la identidad: los registros que referencian el estado
-- siguen apuntando al mismo id (la historia no se reescribe).
insert into status_refs_probe (status_id) values ('00000000-0000-0000-0000-00000000058a');

select is(
  (select s.name from status_refs_probe p
    join statuses s on s.id = p.status_id
    where p.status_id = '00000000-0000-0000-0000-00000000058a'),
  'En ruta', 'historia: el registro antiguo conserva su estado, hoy con el nombre nuevo');

-- ── Scenario: Volver al juego de la organización ──────────────────────────
-- En producción cada llamada RPC es su propia transacción y el trigger valida
-- al confirmar; aquí se vuelve a diferir para reproducir ese comportamiento.
set constraints status_set_integrity deferred;

select throws_ok(
  $$ select use_organization_statuses(
       '00000000-0000-0000-0000-00000000005a',
       '00000000-0000-0000-0000-00000000051a', 'order') $$,
  '23514', 'El estado está en uso: indica a qué estado mover sus registros',
  'volver al juego de la organización: un estado propio en uso corta la operación entera');

-- Liberado el registro, la operación procede completa.
delete from status_refs_probe
  where status_id = '00000000-0000-0000-0000-00000000058a';

select lives_ok(
  $$ select use_organization_statuses(
       '00000000-0000-0000-0000-00000000005a',
       '00000000-0000-0000-0000-00000000051a', 'order') $$,
  'volver al juego de la organización: el juego propio se archiva completo');

select is(
  (select count(*)::int from resolve_statuses(
    '00000000-0000-0000-0000-00000000005a',
    '00000000-0000-0000-0000-00000000051a', 'order')
    where business_line_id is null),
  2, 'volver al juego de la organización: la línea vuelve a resolver el juego común');

-- ── Scenario: Restaurar valores por defecto ───────────────────────────────
-- Reactiva por nombre (la unicidad incluye lo archivado) y archiva lo demás.

select lives_ok(
  $$ select restore_default_statuses(
       '00000000-0000-0000-0000-00000000005a', null, 'task',
       '[{"name": "Por hacer", "kind": "initial", "color": "zinc", "is_queue": false, "position": 1},
         {"name": "Haciendo", "kind": "in_progress", "color": "zinc", "is_queue": false, "position": 2},
         {"name": "Hecho", "kind": "final", "color": "zinc", "is_queue": false, "position": 3}]'::jsonb) $$,
  'restaurar: el juego por defecto se aplica en una sola transacción');

-- Al volver a inmediato se validan los eventos pendientes de ambos escenarios.
set constraints status_set_integrity immediate;

select bag_eq(
  $$ select name, kind from resolve_statuses(
       '00000000-0000-0000-0000-00000000005a', null, 'task') $$,
  $$ values ('Por hacer', 'initial'), ('Haciendo', 'in_progress'), ('Hecho', 'final') $$,
  'restaurar: los existentes conservan su identidad y los que faltaban se crean');

-- ── Scenario: Semilla de Geeko Store ──────────────────────────────────────
-- Como seed_geeko.test.sql: se lee lo que dejó `supabase db reset`, por los
-- identificadores fijos de la semilla.

select is(
  (select count(*)::int from statuses
    where organization_id = '10000000-0000-0000-0000-000000000003'
      and business_line_id is null and flow = 'task' and archived_at is null),
  4, 'semilla: los cuatro estados de tarea como juego de la organización');

select bag_eq(
  $$ select name, kind, is_queue from statuses
     where business_line_id = '30000000-0000-0000-0000-000000000001'
       and flow = 'order' and archived_at is null $$,
  $$ values ('Registrado', 'initial', false), ('En diseño', 'in_progress', false),
            ('En cola', 'waiting', true), ('Sublimando', 'in_progress', false),
            ('Listo para entrega', 'waiting', false), ('Entregado', 'final', false),
            ('Cancelado', 'cancelled', false) $$,
  'semilla: el juego de pedido de Sublimación, con En cola como única cola');

select is(
  (select count(*)::int from statuses
    where business_line_id = '30000000-0000-0000-0000-000000000003'
      and flow = 'order' and archived_at is null),
  4, 'semilla: el juego mínimo de Alfarería');

select bag_eq(
  $$ select name, kind from statuses
     where business_line_id = '30000000-0000-0000-0000-000000000002'
       and flow = 'order' and archived_at is null $$,
  $$ values ('Registrado', 'initial'), ('En cola', 'waiting'),
            ('Imprimiendo', 'in_progress'), ('Post-proceso', 'in_progress'),
            ('Listo para entrega', 'waiting'), ('Entregado', 'final'),
            ('Cancelado', 'cancelled') $$,
  'semilla: el juego provisional de Impresión 3D');

select is(
  (select count(*)::int from resolve_statuses(
    '10000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000001', 'order')
    where business_line_id = '30000000-0000-0000-0000-000000000001'),
  7, 'semilla: resolver pedidos de Sublimación devuelve su juego propio');

select is(
  (select count(*)::int from resolve_statuses(
    '10000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000001', 'task')
    where business_line_id is null),
  4, 'semilla: resolver tareas de cualquier línea devuelve el juego de la organización');

select * from finish();
rollback;
