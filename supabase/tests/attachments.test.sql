-- KAM-06b · Adjuntos: la tabla, sus límites y las políticas de Storage.
-- La ruta empieza siempre con el organization_id (esquema §13): es lo que
-- hace verificable el aislamiento en Storage, y por eso se comprueba aquí.
begin;

set search_path to public, extensions;

select plan(14);

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
  ('00000000-0000-0000-0000-0000000007a1', 'owner-att-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000007a2', 'assistant-att-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000007b1', 'owner-att-b@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-00000000007a', 'Adjuntos A'),
  ('00000000-0000-0000-0000-00000000007b', 'Adjuntos B');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000007a', '00000000-0000-0000-0000-0000000007a1', 'owner'),
  ('00000000-0000-0000-0000-00000000007a', '00000000-0000-0000-0000-0000000007a2', 'assistant'),
  ('00000000-0000-0000-0000-00000000007b', '00000000-0000-0000-0000-0000000007b1', 'owner');

insert into items (id, organization_id, kind, name) values
  ('00000000-0000-0000-0000-0000000079a1', '00000000-0000-0000-0000-00000000007a', 'product', 'Taza con foto');

-- ── Los cuatro buckets existen y ninguno es público ───────────────────────

select bag_eq(
  $$ select id from storage.buckets
     where id in ('attachments','receipts','item-photos','org-logos') $$,
  $$ values ('attachments'), ('receipts'), ('item-photos'), ('org-logos') $$,
  'storage: los cuatro buckets del esquema existen');

select is(
  (select count(*)::int from storage.buckets
    where id in ('attachments','receipts','item-photos','org-logos')
      and public),
  0, 'storage: ningún bucket es público');

select is(
  (select file_size_limit from storage.buckets where id = 'item-photos'),
  (5 * 1024 * 1024)::bigint,
  'storage: item-photos limita a 5 MB, sin depender del cliente');

-- ── La ruta empieza con el organization_id ────────────────────────────────

select throws_ok(
  $$ insert into attachments
       (organization_id, entity_type, entity_id, bucket, storage_path, file_name)
     values ('00000000-0000-0000-0000-00000000007a', 'item',
             '00000000-0000-0000-0000-0000000079a1', 'item-photos',
             'otra-carpeta/item/foto.jpg', 'foto.jpg') $$,
  '23514', null, 'attachments: una ruta que no empieza por la organización se rechaza');

select throws_ok(
  $$ insert into attachments
       (organization_id, entity_type, entity_id, bucket, storage_path, file_name, size_bytes)
     values ('00000000-0000-0000-0000-00000000007a', 'item',
             '00000000-0000-0000-0000-0000000079a1', 'item-photos',
             '00000000-0000-0000-0000-00000000007a/item/grande.jpg', 'grande.jpg',
             6 * 1024 * 1024) $$,
  '23514', null, 'attachments: más de 5 MB se rechaza');

select throws_ok(
  $$ insert into attachments
       (organization_id, entity_type, entity_id, bucket, storage_path, file_name)
     values ('00000000-0000-0000-0000-00000000007a', 'invoice',
             '00000000-0000-0000-0000-0000000079a1', 'item-photos',
             '00000000-0000-0000-0000-00000000007a/x/y.jpg', 'y.jpg') $$,
  '23514', null, 'attachments: un tipo de entidad fuera del juego se rechaza');

-- ── El ayudante adjunta; archivar sigue siendo del dueño ──────────────────

select pg_temp.login('00000000-0000-0000-0000-0000000007a2');

select lives_ok(
  $$ insert into attachments
       (id, organization_id, entity_type, entity_id, bucket, storage_path, file_name, mime_type, size_bytes)
     values ('00000000-0000-0000-0000-0000000078a1',
             '00000000-0000-0000-0000-00000000007a', 'item',
             '00000000-0000-0000-0000-0000000079a1', 'item-photos',
             '00000000-0000-0000-0000-00000000007a/item/00000000-0000-0000-0000-0000000079a1/foto.jpg',
             'foto.jpg', 'image/jpeg', 120000) $$,
  'attachments: el ayudante adjunta');

select throws_ok(
  $$ update attachments set archived_at = now()
     where id = '00000000-0000-0000-0000-0000000078a1' $$,
  '42501', 'Solo la persona dueña puede archivar o desarchivar',
  'attachments: el ayudante no archiva');

select throws_ok(
  $$ delete from attachments $$,
  '42501', null, 'attachments: nadie borra — el privilegio está revocado');

-- ── Aislamiento entre organizaciones ──────────────────────────────────────

select pg_temp.login('00000000-0000-0000-0000-0000000007b1');

select is(
  (select count(*)::int from attachments), 0,
  'attachments: la otra organización no ve ni un adjunto');

-- ── El dueño archiva, y el registro sigue existiendo ──────────────────────

select pg_temp.login('00000000-0000-0000-0000-0000000007a1');

select lives_ok(
  $$ update attachments set archived_at = now()
     where id = '00000000-0000-0000-0000-0000000078a1' $$,
  'attachments: el dueño archiva');

select is(
  (select file_name from attachments
    where id = '00000000-0000-0000-0000-0000000078a1'),
  'foto.jpg',
  'attachments: archivar no borra la fila — el objeto del bucket sigue referenciado');

select pg_temp.logout();

-- ── Bitácora ──────────────────────────────────────────────────────────────

select is(
  (select count(*)::int from activity_log
    where table_name = 'attachments'
      and record_id = '00000000-0000-0000-0000-0000000078a1'
      and action = 'created'),
  1, 'attachments: el alta queda en la bitácora');

select is(
  (select count(*)::int from activity_log
    where table_name = 'attachments'
      and record_id = '00000000-0000-0000-0000-0000000078a1'
      and action = 'archived'),
  1, 'attachments: el archivado queda en la bitácora');

select * from finish();
rollback;
