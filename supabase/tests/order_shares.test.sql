-- KAM-32 · Enlace público del pedido, de solo lectura y con comentarios.
--
-- Escenarios de la delta spec `order-share` (openspec/changes/
-- public-order-share/specs/order-share/spec.md): las dos funciones
-- `security definer`, la lectura pública de imágenes, el límite de
-- comentarios, el enlace único vigente por pedido, y que nada se filtre que
-- no deba. Las propiedades genéricas del esquema (RLS activa, sin política
-- DELETE, disparador de auditoría, ausencia de políticas `anon` en `public`)
-- ya las cubre `preproduction_checklist.test.sql` para toda tabla nueva.
begin;

set search_path to public, extensions;

select plan(22);

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

create function pg_temp.anon() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
end;
$$;

create function pg_temp.logout() returns void
language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- ── Semilla propia ──────────────────────────────────────────────────────
-- A: la organización principal, con dueño y ayudante, una línea, un estado,
-- dos pedidos (uno para el flujo feliz, otro para aislamiento). B: la ajena.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000320a01', 'owner-share-a@kamay.test'),
  ('00000000-0000-0000-0000-000000320a02', 'assistant-share-a@kamay.test'),
  ('00000000-0000-0000-0000-000000320b01', 'owner-share-b@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-00000032000a', 'Comparte A'),
  ('00000000-0000-0000-0000-00000032000b', 'Comparte B');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-00000032000a', '00000000-0000-0000-0000-000000320a01', 'owner'),
  ('00000000-0000-0000-0000-00000032000a', '00000000-0000-0000-0000-000000320a02', 'assistant'),
  ('00000000-0000-0000-0000-00000032000b', '00000000-0000-0000-0000-000000320b01', 'owner');

insert into business_lines (id, organization_id, name, color) values
  ('00000000-0000-0000-0000-00000032001a', '00000000-0000-0000-0000-00000032000a', 'Sublimación', 'amber');

insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-00000032002a', '00000000-0000-0000-0000-00000032000a',
   null, 'order', 'En cola', 'waiting', 1);

insert into orders (id, organization_id, business_line_id, kind, code, status_id, due_date, occurred_at) values
  ('00000000-0000-0000-0000-00000032010a', '00000000-0000-0000-0000-00000032000a',
   '00000000-0000-0000-0000-00000032001a', 'direct_sale', 1, '00000000-0000-0000-0000-00000032002a',
   '2026-10-01', now()),
  ('00000000-0000-0000-0000-00000032010b', '00000000-0000-0000-0000-00000032000a',
   '00000000-0000-0000-0000-00000032001a', 'direct_sale', 2, '00000000-0000-0000-0000-00000032002a',
   '2026-10-05', now());

insert into order_items (order_id, organization_id, description, quantity, unit_price) values
  ('00000000-0000-0000-0000-00000032010a', '00000000-0000-0000-0000-00000032000a',
   'Taza personalizada', 2, 50.00);

-- Una solicitud abierta de A, para el flujo feliz.
insert into order_shares (id, organization_id, order_id, token_hash, expires_at, created_by)
values (
  '00000000-0000-0000-0000-00000032020a', '00000000-0000-0000-0000-00000032000a',
  '00000000-0000-0000-0000-00000032010a', sha256(convert_to('token-vigente', 'utf8')),
  now() + interval '180 days', '00000000-0000-0000-0000-000000320a01'
);

-- ── Aislamiento entre organizaciones ──────────────────────────────────────

select pg_temp.login('00000000-0000-0000-0000-000000320b01');

select is(
  (select count(*)::int from order_shares where organization_id = '00000000-0000-0000-0000-00000032000a'),
  0, 'la dueña de B no ve ningún enlace de A');

select is(
  (select count(*)::int from order_comments where organization_id = '00000000-0000-0000-0000-00000032000a'),
  0, 'la dueña de B no ve ningún comentario de A');

select pg_temp.logout();

-- ── El ayudante tiene los mismos privilegios que el dueño ─────────────────

select pg_temp.login('00000000-0000-0000-0000-000000320a02');

select lives_ok(
  $$ update order_shares set archived_at = now()
     where id = '00000000-0000-0000-0000-00000032020a' $$,
  'el ayudante revoca un enlace, sin ser dueño');

select pg_temp.logout();

-- Se regenera para el resto de las pruebas (revocado arriba a propósito).
update order_shares set archived_at = null,
  token_hash = sha256(convert_to('token-vigente', 'utf8')), expires_at = now() + interval '180 days'
  where id = '00000000-0000-0000-0000-00000032020a';

-- ── Un solo enlace vigente por pedido ──────────────────────────────────────

select pg_temp.login('00000000-0000-0000-0000-000000320a01');

select throws_ok(
  $$ insert into order_shares (organization_id, order_id, token_hash, expires_at, created_by)
     values ('00000000-0000-0000-0000-00000032000a', '00000000-0000-0000-0000-00000032010a',
             sha256(convert_to('otro-token', 'utf8')), now() + interval '180 days',
             '00000000-0000-0000-0000-000000320a01') $$,
  '23505', null, 'un segundo enlace vigente para el mismo pedido se rechaza');

-- ── Regenerar un enlace revocado se rechaza ────────────────────────────────

insert into order_shares (id, organization_id, order_id, token_hash, expires_at, archived_at, created_by)
values (
  '00000000-0000-0000-0000-00000032020b', '00000000-0000-0000-0000-00000032000a',
  '00000000-0000-0000-0000-00000032010b', sha256(convert_to('token-revocado', 'utf8')),
  now() + interval '180 days', now(), '00000000-0000-0000-0000-000000320a01'
);

select throws_ok(
  $$ update order_shares set token_hash = sha256(convert_to('nuevo', 'utf8'))
     where id = '00000000-0000-0000-0000-00000032020b' $$,
  '23514', null, 'regenerar un enlace ya revocado se rechaza');

select pg_temp.logout();

-- ── `resolve_order_share`: solo lo público, mismo mensaje para todo fallo ──

select pg_temp.anon();

select results_eq(
  $$ select order_id, code, status_name, total, items->0->>'description'
       from resolve_order_share('token-vigente') $$,
  $$ values ('00000000-0000-0000-0000-00000032010a'::uuid, 1, 'En cola'::text,
             100.00::numeric, 'Taza personalizada'::text) $$,
  'resolve_order_share: número, estado, total y línea correctos');

select throws_ok(
  $$ select * from resolve_order_share('no-existe-este-token') $$,
  '23514', null, 'token inexistente: rechazado');

select throws_ok(
  $$ select * from resolve_order_share('token-revocado') $$,
  '23514', null, 'token revocado: mismo rechazo');

select pg_temp.logout();

-- Pedido archivado con enlace vigente: cuarto caso de fallo. Sembrado con
-- sesión: la fila de order_shares y el archivado del pedido no son cosa de
-- `anon`.
select pg_temp.login('00000000-0000-0000-0000-000000320a01');

insert into order_shares (id, organization_id, order_id, token_hash, expires_at, created_by)
values (
  '00000000-0000-0000-0000-00000032020c', '00000000-0000-0000-0000-00000032000a',
  '00000000-0000-0000-0000-00000032010b', sha256(convert_to('token-pedido-archivado', 'utf8')),
  now() + interval '180 days', '00000000-0000-0000-0000-000000320a01'
);
update orders set archived_at = now() where id = '00000000-0000-0000-0000-00000032010b';

select throws_ok(
  $$ select * from resolve_order_share('token-pedido-archivado') $$,
  '23514', null, 'pedido archivado: mismo rechazo, aunque el enlace en sí siga vigente');

-- ── Nada interno se filtra: la forma exacta del objeto ─────────────────────

select set_eq(
  $$ select parameter_name from information_schema.parameters
      where specific_schema = 'public' and specific_name = (
        select specific_name from information_schema.routines
         where routine_name = 'resolve_order_share' and routine_schema = 'public'
      ) and parameter_mode = 'OUT' $$,
  ARRAY['organization_id','order_id','code','business_line_name','status_name',
        'due_date','total','paid','balance','items','attachments'],
  'resolve_order_share no devuelve ninguna columna fuera de las once declaradas — en particular, nada de orders.notes, costo, margen ni proveedor');

select pg_temp.logout();

-- ── `submit_order_comment`: recibe, bitácora, límite ───────────────────────

select pg_temp.anon();

select lives_ok(
  $$ select * from submit_order_comment('token-vigente', 'Cliente Feliz', 'Un comentario') $$,
  'el comentario se acepta con nombre y cuerpo');

select throws_ok(
  $$ select * from submit_order_comment('token-vigente', '', 'sin nombre') $$,
  '23514', null, 'sin nombre, se rechaza');

select throws_ok(
  $$ select * from submit_order_comment('token-vigente', 'Alguien', '') $$,
  '23514', null, 'sin cuerpo, se rechaza');

do $$
begin
  for i in 1..4 loop
    perform submit_order_comment('token-vigente', 'Cliente', 'más ' || i);
  end loop;
end $$;

select throws_ok(
  $$ select * from submit_order_comment('token-vigente', 'Cliente', 'el sexto') $$,
  '23514', null, 'el sexto comentario en la ventana se rechaza');

select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-000000320a01');

select is(
  (select actor_label from activity_log
     where table_name = 'order_comments' and action = 'created'
     order by id desc limit 1),
  'Cliente', 'el comentario queda con actor_label «Cliente»');

select is(
  (select actor_id from activity_log
     where table_name = 'order_comments' and action = 'created'
     order by id desc limit 1),
  null, 'el comentario no lleva actor_id');

select lives_ok(
  $$ update order_comments set archived_at = now()
     where id = (select id from order_comments
                  where order_id = '00000000-0000-0000-0000-00000032010a'
                    and archived_at is null
                  order by occurred_at limit 1) $$,
  'la organización archiva un comentario, sin borrarlo');

select throws_ok(
  $$ update order_comments set body = 'editado'
     where id = (select id from order_comments
                  where order_id = '00000000-0000-0000-0000-00000032010a'
                  order by occurred_at limit 1) $$,
  '42501', null, 'el cuerpo del comentario no se puede editar, ni con sesión');

select pg_temp.logout();

-- ── Lectura pública de imágenes ──────────────────────────────────────────

insert into storage.objects (bucket_id, name) values
  ('attachments', '00000000-0000-0000-0000-00000032000a/order/00000000-0000-0000-0000-00000032010a/foto.jpg'),
  ('attachments', '00000000-0000-0000-0000-00000032000a/order/00000000-0000-0000-0000-00000032020b/foto.jpg'),
  ('item-photos', '00000000-0000-0000-0000-00000032000a/order/00000000-0000-0000-0000-00000032010a/foto.jpg');

select pg_temp.anon();

select is(
  (select count(*)::int from storage.objects
     where bucket_id = 'attachments'
       and name = '00000000-0000-0000-0000-00000032000a/order/00000000-0000-0000-0000-00000032010a/foto.jpg'),
  1, 'con enlace vigente, la imagen del pedido se lee');

select is(
  (select count(*)::int from storage.objects
     where bucket_id = 'attachments'
       and name = '00000000-0000-0000-0000-00000032000a/order/00000000-0000-0000-0000-00000032020b/foto.jpg'),
  0, 'un pedido sin enlace vigente no se lee, aunque la ruta sea exacta');

select is(
  (select count(*)::int from storage.objects where bucket_id = 'item-photos'),
  0, 'otro bucket no gana la política nueva, aunque la ruta tenga la misma forma');

select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-000000320a01');
update order_shares set archived_at = now() where id = '00000000-0000-0000-0000-00000032020a';
select pg_temp.logout();

select pg_temp.anon();

select is(
  (select count(*)::int from storage.objects
     where bucket_id = 'attachments'
       and name = '00000000-0000-0000-0000-00000032000a/order/00000000-0000-0000-0000-00000032010a/foto.jpg'),
  0, 'revocar el enlace corta el acceso de inmediato');

select pg_temp.logout();

select * from finish();
rollback;
