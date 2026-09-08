-- KAM-16 · Las políticas de `storage.objects` entre organizaciones.
--
-- Las tres políticas las instaló KAM-06b y llevan vigentes desde entonces,
-- pero nadie las había ejercitado: `attachments.test.sql` comprueba que los
-- buckets existen y que no son públicos, no que la carpeta de una
-- organización sea inalcanzable desde otra.
--
-- Esa es la deuda que este archivo salda, y es lo único de base de datos que
-- KAM-16 toca: el criterio de aceptación exige verificar el aislamiento
-- «intentando el acceso desde otra organización», no leyendo la política.
--
-- La política comprueba `is_member((storage.foldername(name))[1]::uuid)`: la
-- primera carpeta de la ruta es el `organization_id`. Todo lo que sigue son
-- variaciones sobre eso.
begin;

set search_path to public, extensions;

select plan(12);

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
  ('00000000-0000-0000-0000-0000000016a1', 'owner-stg-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000016b1', 'owner-stg-b@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-00000000016a', 'Storage A'),
  ('00000000-0000-0000-0000-00000000016b', 'Storage B');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000016a', '00000000-0000-0000-0000-0000000016a1', 'owner'),
  ('00000000-0000-0000-0000-00000000016b', '00000000-0000-0000-0000-0000000016b1', 'owner');

insert into business_lines (id, organization_id, name, color) values
  ('00000000-0000-0000-0000-0000000016c1', '00000000-0000-0000-0000-00000000016a', 'Alfarería', 'amber');

-- El estado inicial lo resuelve la base al insertar la tarea (KAM-15), así que
-- la línea necesita su juego antes de que exista ninguna tarea.
insert into statuses (organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-00000000016a', null, 'task', 'Por hacer', 'initial', 1),
  ('00000000-0000-0000-0000-00000000016a', null, 'task', 'Hecho',     'final',   2);

insert into tasks (id, organization_id, business_line_id, title) values
  ('00000000-0000-0000-0000-0000000016d1', '00000000-0000-0000-0000-00000000016a',
   '00000000-0000-0000-0000-0000000016c1', 'Set de 6 tazas artesanales');

-- ── La organización A sube un adjunto de su tarea ─────────────────────────

select pg_temp.login('00000000-0000-0000-0000-0000000016a1');

select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('attachments',
             '00000000-0000-0000-0000-00000000016a/task/00000000-0000-0000-0000-0000000016d1/foto.jpg') $$,
  'storage: un miembro sube a la carpeta de su organización');

select lives_ok(
  $$ insert into attachments
       (id, organization_id, entity_type, entity_id, bucket, storage_path, file_name, mime_type, size_bytes)
     values ('00000000-0000-0000-0000-0000000016e1',
             '00000000-0000-0000-0000-00000000016a', 'task',
             '00000000-0000-0000-0000-0000000016d1', 'attachments',
             '00000000-0000-0000-0000-00000000016a/task/00000000-0000-0000-0000-0000000016d1/foto.jpg',
             'foto.jpg', 'image/jpeg', 120000) $$,
  'attachments: una tarea admite adjuntos con entity_type = task');

select is(
  (select count(*)::int from storage.objects
    where bucket_id = 'attachments'
      and name like '00000000-0000-0000-0000-00000000016a/%'),
  1, 'storage: un miembro sí accede al objeto de su organización');

-- ── La organización B no alcanza nada de la A ─────────────────────────────

select pg_temp.login('00000000-0000-0000-0000-0000000016b1');

select is(
  (select count(*)::int from attachments
    where organization_id = '00000000-0000-0000-0000-00000000016a'),
  0, 'attachments: la otra organización no lista los adjuntos de la tarea ajena');

select is(
  (select count(*)::int from storage.objects where bucket_id = 'attachments'),
  0, 'storage: la otra organización no lista ningún objeto ajeno');

-- Conocer la ruta exacta no cambia nada: la política no depende de que la
-- pantalla oculte el enlace, sino de a qué carpeta apunta el nombre.
select is(
  (select count(*)::int from storage.objects
    where bucket_id = 'attachments'
      and name = '00000000-0000-0000-0000-00000000016a/task/00000000-0000-0000-0000-0000000016d1/foto.jpg'),
  0, 'storage: conocer la ruta exacta no basta para leer el objeto ajeno');

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('attachments',
             '00000000-0000-0000-0000-00000000016a/task/00000000-0000-0000-0000-0000000016d1/intruso.jpg') $$,
  '42501', null,
  'storage: la otra organización no puede escribir en la carpeta ajena');

-- Actualizar un objeto ajeno no falla: sencillamente no alcanza ninguna fila.
-- Que el resultado sea «cero filas» y no un error es justo lo que hace que el
-- aislamiento no se pueda usar para averiguar si un objeto existe.
select lives_ok(
  $$ update storage.objects set metadata = '{"tocado": true}'::jsonb
     where bucket_id = 'attachments'
       and name = '00000000-0000-0000-0000-00000000016a/task/00000000-0000-0000-0000-0000000016d1/foto.jpg' $$,
  'storage: actualizar un objeto ajeno no alcanza ninguna fila');

-- ── Nadie borra: ni la fila ni el objeto ──────────────────────────────────

select throws_ok(
  $$ delete from attachments $$,
  '42501', null,
  'attachments: nadie borra un adjunto — el privilegio está revocado');

-- En `storage.objects` la defensa es todavía más dura que la ausencia de
-- política: un trigger de Supabase (`storage.protect_delete()`) rechaza el
-- borrado directo, así que ni siquiera el dueño de la organización puede
-- vaciar el bucket por SQL.
select pg_temp.login('00000000-0000-0000-0000-0000000016a1');

select throws_ok(
  $$ delete from storage.objects
     where bucket_id = 'attachments'
       and name = '00000000-0000-0000-0000-00000000016a/task/00000000-0000-0000-0000-0000000016d1/foto.jpg' $$,
  '42501', null,
  'storage: el borrado directo de un objeto se rechaza');

select is(
  (select count(*)::int from storage.objects
    where bucket_id = 'attachments'
      and name = '00000000-0000-0000-0000-00000000016a/task/00000000-0000-0000-0000-0000000016d1/foto.jpg'),
  1, 'storage: el objeto sigue ahí después de intentar borrarlo');

-- Retirar un adjunto lo archiva; el objeto no se toca, porque la historia de
-- una tarea no se reescribe cuando alguien quita una foto.
select lives_ok(
  $$ update attachments set archived_at = now()
     where id = '00000000-0000-0000-0000-0000000016e1' $$,
  'attachments: retirar un adjunto lo archiva');

select pg_temp.logout();

select * from finish();
rollback;
