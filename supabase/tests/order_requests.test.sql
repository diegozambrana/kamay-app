-- KAM-28 · Solicitudes de pedido por enlace público.
--
-- Escenarios de la delta spec `order-requests` (openspec/changes/
-- public-order-intake/specs/order-requests/spec.md): las dos funciones
-- `security definer`, la cuarentena de imágenes, el aislamiento entre
-- organizaciones, y que `order_id` y el token no se puedan reescribir fuera
-- de sus reglas. Las propiedades genéricas del esquema (RLS activa, sin
-- política DELETE, disparador de auditoría, ausencia de políticas `anon` en
-- `public`) ya las cubre `preproduction_checklist.test.sql` para toda tabla
-- nueva, esta tabla incluida — no se repiten aquí.
begin;

set search_path to public, extensions;

select plan(28);

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
-- A: la organización principal, con dueño y ayudante. B: la ajena, para
-- probar aislamiento.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000280a01', 'owner-req-a@kamay.test'),
  ('00000000-0000-0000-0000-000000280a02', 'assistant-req-a@kamay.test'),
  ('00000000-0000-0000-0000-000000280b01', 'owner-req-b@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-00000028000a', 'Solicitudes A'),
  ('00000000-0000-0000-0000-00000028000b', 'Solicitudes B');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-00000028000a', '00000000-0000-0000-0000-000000280a01', 'owner'),
  ('00000000-0000-0000-0000-00000028000a', '00000000-0000-0000-0000-000000280a02', 'assistant'),
  ('00000000-0000-0000-0000-00000028000b', '00000000-0000-0000-0000-000000280b01', 'owner');

insert into business_lines (id, organization_id, name, color) values
  ('00000000-0000-0000-0000-00000028001a', '00000000-0000-0000-0000-00000028000a', 'Sublimación', 'amber');

-- Un estado y dos pedidos reales de A, solo para el bloque de "order_id no se
-- reasigna": la columna lleva llave foránea a `orders`, así que la prueba
-- necesita filas de verdad, no dos uuids sueltos.
insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-00000028002a', '00000000-0000-0000-0000-00000028000a',
   null, 'order', 'Entregado', 'final', 1);

insert into orders (id, organization_id, business_line_id, kind, code, status_id, occurred_at) values
  ('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-00000028000a',
   '00000000-0000-0000-0000-00000028001a', 'direct_sale', 1, '00000000-0000-0000-0000-00000028002a', now()),
  ('00000000-0000-0000-0000-0000000000bb', '00000000-0000-0000-0000-00000028000a',
   '00000000-0000-0000-0000-00000028001a', 'direct_sale', 2, '00000000-0000-0000-0000-00000028002a', now());

-- Tres solicitudes de A, cada una para un escenario distinto: una abierta
-- (esperando al cliente), una ya recibida, una ya vencida.
insert into order_requests (id, organization_id, business_line_id, token_hash,
                            prefilled_name, prefilled_phone, expires_at, created_by)
values
  ('00000000-0000-0000-0000-000000280101', '00000000-0000-0000-0000-00000028000a',
   '00000000-0000-0000-0000-00000028001a', sha256(convert_to('token-abierta', 'utf8')),
   'Cliente Uno', '70010001', now() + interval '7 days', '00000000-0000-0000-0000-000000280a01'),
  ('00000000-0000-0000-0000-000000280102', '00000000-0000-0000-0000-00000028000a',
   '00000000-0000-0000-0000-00000028001a', sha256(convert_to('token-recibida', 'utf8')),
   'Cliente Dos', '70010002', now() + interval '7 days', '00000000-0000-0000-0000-000000280a01'),
  ('00000000-0000-0000-0000-000000280103', '00000000-0000-0000-0000-00000028000a',
   '00000000-0000-0000-0000-00000028001a', sha256(convert_to('token-vencida', 'utf8')),
   'Cliente Tres', '70010003', now() - interval '1 day', '00000000-0000-0000-0000-000000280a01'),
  ('00000000-0000-0000-0000-000000280104', '00000000-0000-0000-0000-00000028000a',
   '00000000-0000-0000-0000-00000028001a', sha256(convert_to('token-archivada', 'utf8')),
   'Cliente Cuatro', '70010004', now() + interval '7 days', '00000000-0000-0000-0000-000000280a01'),
  -- Una quinta, sin tocar por nadie más: sirve exclusivamente para el bloque
  -- «la sesión autenticada no hereda la etiqueta», donde ningún otro evento
  -- debe existir todavía que la agrupación de ruido (`log_activity()`, misma
  -- ventana de 5 minutos, mismo actor) pudiera fusionar por debajo.
  ('00000000-0000-0000-0000-000000280105', '00000000-0000-0000-0000-00000028000a',
   '00000000-0000-0000-0000-00000028001a', sha256(convert_to('token-quinta', 'utf8')),
   'Cliente Cinco', '70010005', now() + interval '7 days', '00000000-0000-0000-0000-000000280a01'),
  -- Dedicadas a la cuarentena de imágenes (grupo 4), para no depender del
  -- estado que los bloques de arriba dejan en `token-recibida`/`token-vencida`.
  ('00000000-0000-0000-0000-000000280106', '00000000-0000-0000-0000-00000028000a',
   '00000000-0000-0000-0000-00000028001a', sha256(convert_to('token-cuarentena-abierta', 'utf8')),
   'Cliente Seis', '70010006', now() + interval '7 days', '00000000-0000-0000-0000-000000280a01'),
  ('00000000-0000-0000-0000-000000280107', '00000000-0000-0000-0000-00000028000a',
   '00000000-0000-0000-0000-00000028001a', sha256(convert_to('token-cuarentena-vencida', 'utf8')),
   'Cliente Siete', '70010007', now() - interval '1 day', '00000000-0000-0000-0000-000000280a01');

update order_requests set submitted_at = now()
  where id = '00000000-0000-0000-0000-000000280102';

update order_requests set archived_at = now()
  where id = '00000000-0000-0000-0000-000000280104';

-- ── Aislamiento entre organizaciones ──────────────────────────────────────

select pg_temp.login('00000000-0000-0000-0000-000000280b01');

select is(
  (select count(*)::int from order_requests where organization_id = '00000000-0000-0000-0000-00000028000a'),
  0, 'la dueña de B no ve ninguna solicitud de A');

select pg_temp.logout();

-- ── El ayudante tiene los mismos privilegios que el dueño ─────────────────

select pg_temp.login('00000000-0000-0000-0000-000000280a02');

select is(
  (select count(*)::int from order_requests where organization_id = '00000000-0000-0000-0000-00000028000a'),
  7, 'el ayudante lee la bandeja completa de su organización');

select lives_ok(
  $$ update order_requests set archived_at = now()
     where id = '00000000-0000-0000-0000-000000280103' $$,
  'el ayudante descarta una solicitud, sin ser dueño');

select pg_temp.logout();

-- ── `order_id` no se reasigna una vez fijado ──────────────────────────────

select pg_temp.login('00000000-0000-0000-0000-000000280a01');

select lives_ok(
  $$ update order_requests
       set order_id = '00000000-0000-0000-0000-0000000000aa'
     where id = '00000000-0000-0000-0000-000000280101' $$,
  'fijar order_id la primera vez se acepta');

select throws_ok(
  $$ update order_requests
       set order_id = '00000000-0000-0000-0000-0000000000bb'
     where id = '00000000-0000-0000-0000-000000280101' $$,
  '23514', null, 'reasignar order_id una segunda vez se rechaza');

select pg_temp.logout();

-- ── `resolve_order_request`: solo lo mínimo, mismo mensaje para todo fallo ─

select pg_temp.anon();

select results_eq(
  $$ select organization_id, request_id, organization_name, business_line_name,
            prefilled_name, prefilled_phone
       from resolve_order_request('token-abierta') $$,
  $$ values ('00000000-0000-0000-0000-00000028000a'::uuid,
             '00000000-0000-0000-0000-000000280101'::uuid,
             'Solicitudes A'::text, 'Sublimación'::text,
             'Cliente Uno'::text, '70010001'::text) $$,
  'resolve_order_request: exactamente los seis campos declarados, nada más');

select throws_ok(
  $$ select * from resolve_order_request('no-existe-este-token') $$,
  '23514', null, 'token inexistente: rechazado');

select throws_ok(
  $$ select * from resolve_order_request('token-recibida') $$,
  '23514', null, 'token ya usado: mismo rechazo');

select throws_ok(
  $$ select * from resolve_order_request('token-vencida') $$,
  '23514', null, 'token vencido: mismo rechazo');

-- El cuarto caso, archivada pero aún no vencida (`token-archivada`, sembrada
-- arriba junto con las otras tres).
select throws_ok(
  $$ select * from resolve_order_request('token-archivada') $$,
  '23514', null, 'solicitud archivada: mismo rechazo, sin distinguir el caso');

-- ── `submit_order_request`: recibe, no crea pedido ni contacto ────────────

select is(
  (select count(*)::int from orders where organization_id = '00000000-0000-0000-0000-00000028000a'),
  0, 'antes de enviar, A no tiene ningún pedido (control)');

select is(
  (select count(*)::int from contacts where organization_id = '00000000-0000-0000-0000-00000028000a'),
  0, 'antes de enviar, A no tiene ningún contacto (control)');

select lives_ok(
  $$ select * from submit_order_request('token-abierta', 'Cliente Real', '70099999', 'una nota') $$,
  'el envío público se acepta con nombre y teléfono');

select is(
  (select count(*)::int from orders where organization_id = '00000000-0000-0000-0000-00000028000a'),
  0, 'el envío no crea ningún pedido');

select is(
  (select count(*)::int from contacts where organization_id = '00000000-0000-0000-0000-00000028000a'),
  0, 'el envío no crea ningún contacto');

select throws_ok(
  $$ select * from submit_order_request('token-abierta', 'Otra vez', '70000000', null) $$,
  '23514', null, 'reenviar el mismo token ya recibido se rechaza');

-- ── La bitácora: `actor_label` sin `actor_id` ─────────────────────────────
-- `activity_log` solo la lee su dueña (`is_owner`), así que hace falta
-- iniciar sesión antes de consultarla — impersonar `anon` no alcanza para
-- leer, solo para escribir a través de las dos funciones.

select pg_temp.login('00000000-0000-0000-0000-000000280a01');

select is(
  (select actor_label from activity_log
     where table_name = 'order_requests'
       and record_id = '00000000-0000-0000-0000-000000280101'
       and action = 'updated'
     order by id desc limit 1),
  'Formulario público', 'el envío público queda con actor_label «Formulario público»');

select is(
  (select actor_id from activity_log
     where table_name = 'order_requests'
       and record_id = '00000000-0000-0000-0000-000000280101'
       and action = 'updated'
     order by id desc limit 1),
  null, 'el envío público no lleva actor_id');

-- Una persona autenticada no puede heredar la etiqueta fijando la misma
-- variable de sesión: `log_activity()` solo la lee cuando `auth.uid()` es
-- nulo (design D3). Usa la quinta solicitud, intacta hasta aquí, para que la
-- agrupación de ruido de `log_activity()` (mismo actor, 5 minutos) no
-- fusione este evento con uno anterior y enmascare el resultado.

select lives_ok(
  $$ select set_config('kamay.actor_label', 'Formulario público', true) $$,
  'una sesión autenticada puede fijar la variable (no se le impide)');

select lives_ok(
  $$ update order_requests set declared_note = 'nota editada'
     where id = '00000000-0000-0000-0000-000000280105' $$,
  'esa sesión edita la solicitud con la variable todavía fijada');

select is(
  (select actor_label from activity_log
     where table_name = 'order_requests'
       and record_id = '00000000-0000-0000-0000-000000280105'
       and action = 'updated'
     order by id desc limit 1),
  null, 'con auth.uid() presente, la variable de sesión no se usa: actor_label queda vacío');

select is(
  (select actor_id from activity_log
     where table_name = 'order_requests'
       and record_id = '00000000-0000-0000-0000-000000280105'
       and action = 'updated'
     order by id desc limit 1),
  '00000000-0000-0000-0000-000000280a01'::uuid,
  'esa edición sí lleva el actor_id real de quien la hizo');

select pg_temp.logout();

-- ── La cuarentena de imágenes (grupo 4) ────────────────────────────────────
-- `anon` puede escribir, y solo escribir, dentro de la carpeta de una
-- solicitud abierta. `order_request_open()` es la función `security definer`
-- que hace posible evaluar la condición sin darle a `anon` una política de
-- lectura sobre `order_requests` (hallazgo de la tarea 3.6).

select pg_temp.anon();

select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('order-requests',
             '00000000-0000-0000-0000-00000028000a/00000000-0000-0000-0000-000000280106/foto.jpg') $$,
  'subir a la carpeta propia de una solicitud abierta se acepta');

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('order-requests',
             '00000000-0000-0000-0000-00000028000a/00000000-0000-0000-0000-000000280102/foto.jpg') $$,
  '42501', null, 'subir a una solicitud ya recibida se rechaza');

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('order-requests',
             '00000000-0000-0000-0000-00000028000a/00000000-0000-0000-0000-000000280107/foto.jpg') $$,
  '42501', null, 'subir a una solicitud vencida se rechaza');

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('order-requests',
             '00000000-0000-0000-0000-00000028000a/00000000-0000-0000-0000-000000999999/foto.jpg') $$,
  '42501', null, 'subir a una carpeta de solicitud inexistente se rechaza');

select is(
  (select count(*)::int from storage.objects where bucket_id = 'order-requests'),
  0, 'anon no puede leer lo que acaba de subir: sin política SELECT');

select pg_temp.logout();

-- Quien tiene sesión en la organización sí ve la cuarentena.
select pg_temp.login('00000000-0000-0000-0000-000000280a01');

select is(
  (select count(*)::int from storage.objects
     where bucket_id = 'order-requests'
       and name like '00000000-0000-0000-0000-00000028000a/%'),
  1, 'un miembro de la organización sí ve el objeto subido a la cuarentena');

select pg_temp.logout();

select * from finish();
rollback;
