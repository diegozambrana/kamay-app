-- KAM-16 · Lo que el detalle de tarea (V18) da por sentado en la base.
--
-- Dos cosas: que una tarea ajena no se alcance **por identificador** —que es
-- como la pide la página, no filtrando por organización—, y que editar un
-- campo o adjuntar un archivo dejen su entrada en la bitácora, porque el
-- bloque de historial no tiene ninguna otra fuente (convención nº 7).
begin;

set search_path to public, extensions;

select plan(8);

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

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000166a1', 'owner-det-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000166b1', 'owner-det-b@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-00000000166a', 'Detalle A'),
  ('00000000-0000-0000-0000-00000000166b', 'Detalle B');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000166a', '00000000-0000-0000-0000-0000000166a1', 'owner'),
  ('00000000-0000-0000-0000-00000000166b', '00000000-0000-0000-0000-0000000166b1', 'owner');

insert into business_lines (id, organization_id, name, color) values
  ('00000000-0000-0000-0000-0000000166c1', '00000000-0000-0000-0000-00000000166a', 'Alfarería', 'amber');

insert into statuses (organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-00000000166a', null, 'task', 'Por hacer', 'initial', 1),
  ('00000000-0000-0000-0000-00000000166a', null, 'task', 'Hecho',     'final',   2);

insert into tasks (id, organization_id, business_line_id, title, body_markdown) values
  ('00000000-0000-0000-0000-0000000166d1', '00000000-0000-0000-0000-00000000166a',
   '00000000-0000-0000-0000-0000000166c1', 'Set de 6 tazas artesanales',
   '- [ ] Modelado' || chr(10) || '- [ ] Secado');

-- ── Una tarea de otra organización no se abre, ni conociendo su id ────────

select pg_temp.login('00000000-0000-0000-0000-0000000166b1');

select is(
  (select count(*)::int from tasks
    where id = '00000000-0000-0000-0000-0000000166d1'),
  0, 'tasks: pedir la tarea ajena por su identificador devuelve cero filas');

-- ── El cuerpo y el recordatorio existen y se editan ───────────────────────

select pg_temp.login('00000000-0000-0000-0000-0000000166a1');

select is(
  (select body_markdown from tasks
    where id = '00000000-0000-0000-0000-0000000166d1'),
  '- [ ] Modelado' || chr(10) || '- [ ] Secado',
  'tasks: el cuerpo se guarda tal cual, sin transformarlo');

select lives_ok(
  $$ update tasks
       set body_markdown = '- [x] Modelado' || chr(10) || '- [ ] Secado'
     where id = '00000000-0000-0000-0000-0000000166d1' $$,
  'tasks: marcar una casilla es una escritura del cuerpo');

-- Un recordatorio sin fecha límite no se guarda: es la restricción de la que
-- cuelga el mensaje que da la acción.
select throws_ok(
  $$ update tasks set remind_at = now() + interval '1 day'
     where id = '00000000-0000-0000-0000-0000000166d1' $$,
  '23514', null,
  'tasks: un recordatorio sin fecha límite se rechaza');

select lives_ok(
  $$ update tasks
       set due_at = now() + interval '7 days',
           remind_at = now() + interval '6 days'
     where id = '00000000-0000-0000-0000-0000000166d1' $$,
  'tasks: con fecha límite, el recordatorio se guarda');

-- ── Todo cambio deja rastro en la bitácora, y solo ahí ────────────────────

-- La bitácora consolida ediciones sucesivas del mismo autor sobre el mismo
-- registro dentro de cinco minutos (KAM-03, agrupación de ruido). Lo que hay
-- que comprobar no es cuántas entradas hay, sino que ningún cambio se pierda
-- por el camino: la entrada consolidada tiene que recoger los dos.
select ok(
  (select changes ? 'body_markdown' and changes ? 'remind_at'
     from activity_log
    where table_name = 'tasks'
      and record_id = '00000000-0000-0000-0000-0000000166d1'
      and action = 'updated'
    order by occurred_at desc
    limit 1),
  'activity_log: la edición del cuerpo y la del recordatorio quedan registradas');

select lives_ok(
  $$ insert into attachments
       (id, organization_id, entity_type, entity_id, bucket, storage_path, file_name, mime_type, size_bytes)
     values ('00000000-0000-0000-0000-0000000166e1',
             '00000000-0000-0000-0000-00000000166a', 'task',
             '00000000-0000-0000-0000-0000000166d1', 'attachments',
             '00000000-0000-0000-0000-00000000166a/task/00000000-0000-0000-0000-0000000166d1/foto.jpg',
             'foto.jpg', 'image/jpeg', 120000) $$,
  'attachments: se adjunta a la tarea');

select is(
  (select count(*)::int from activity_log
    where table_name = 'attachments'
      and record_id = '00000000-0000-0000-0000-0000000166e1'
      and action = 'created'),
  1, 'activity_log: adjuntar también queda registrado');

select pg_temp.logout();

select * from finish();
rollback;
