-- KAM-04 · user-management: invitaciones de un solo uso, aceptación, cambio de
-- rol y archivado de membresía. Escenarios del delta spec `user-management`.
begin;

set search_path to public, extensions;

select plan(22);

-- ── Helpers ───────────────────────────────────────────────────────────────
-- `accept_invitation()` compara el correo de la sesión con el invitado, así que
-- la simulación de usuario incluye el claim `email`.

create function pg_temp.login(uid uuid, mail text) returns void
language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', uid, 'email', mail, 'role', 'authenticated')::text,
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

-- ── Semilla (como postgres, sin RLS) ──────────────────────────────────────

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000006a1', 'owner-inv-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000006a2', 'assistant-inv-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000006b1', 'owner-inv-b@kamay.test'),
  ('00000000-0000-0000-0000-0000000006c1', 'invitee@kamay.test'),
  ('00000000-0000-0000-0000-0000000006c2', 'intruso@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-00000000006a', 'Invita A'),
  ('00000000-0000-0000-0000-00000000006b', 'Invita B');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000006a', '00000000-0000-0000-0000-0000000006a1', 'owner'),
  ('00000000-0000-0000-0000-00000000006a', '00000000-0000-0000-0000-0000000006a2', 'assistant'),
  ('00000000-0000-0000-0000-00000000006b', '00000000-0000-0000-0000-0000000006b1', 'owner');

insert into invitations (id, organization_id, email, role, token_hash, expires_at, invited_by) values
  ('00000000-0000-0000-0000-00000000061a', '00000000-0000-0000-0000-00000000006a',
   'invitee@kamay.test', 'assistant', sha256(convert_to('token-ok', 'utf8')),
   now() + interval '7 days', '00000000-0000-0000-0000-0000000006a1'),
  ('00000000-0000-0000-0000-00000000062a', '00000000-0000-0000-0000-00000000006a',
   'caducada@kamay.test', 'assistant', sha256(convert_to('token-caducado', 'utf8')),
   now() - interval '1 day', '00000000-0000-0000-0000-0000000006a1'),
  ('00000000-0000-0000-0000-00000000063a', '00000000-0000-0000-0000-00000000006a',
   'revocada@kamay.test', 'assistant', sha256(convert_to('token-revocado', 'utf8')),
   now() + interval '7 days', '00000000-0000-0000-0000-0000000006a1'),
  ('00000000-0000-0000-0000-00000000061b', '00000000-0000-0000-0000-00000000006b',
   'de-b@kamay.test', 'assistant', sha256(convert_to('token-de-b', 'utf8')),
   now() + interval '7 days', '00000000-0000-0000-0000-0000000006b1');

-- ── Scenario: Assistant cannot see or create invitations ──────────────────

select pg_temp.login('00000000-0000-0000-0000-0000000006a2', 'assistant-inv-a@kamay.test');

select is((select count(*)::int from invitations), 0,
  'invitations: el ayudante no ve ninguna invitación');

select throws_ok(
  $$ insert into invitations (organization_id, email, role, token_hash, expires_at)
     values ('00000000-0000-0000-0000-00000000006a', 'nuevo@kamay.test', 'assistant',
             sha256(convert_to('x', 'utf8')), now() + interval '1 day') $$,
  '42501', null, 'invitations: el ayudante no puede crear invitaciones');

-- ── Scenario: Invitations of another organization are invisible ───────────

select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000006a1', 'owner-inv-a@kamay.test');

select is((select count(*)::int from invitations), 3,
  'invitations: el dueño ve solo las de su organización');

-- ── Una sola invitación pendiente por correo ──────────────────────────────

-- Scenario: A second pending invitation for the same email is rejected
select throws_ok(
  $$ insert into invitations (organization_id, email, role, token_hash, expires_at)
     values ('00000000-0000-0000-0000-00000000006a', 'invitee@kamay.test', 'owner',
             sha256(convert_to('token-duplicado', 'utf8')), now() + interval '7 days') $$,
  '23505', null,
  'invitations: una segunda invitación pendiente al mismo correo es rechazada');

-- ── Scenario: Revoking archives instead of deleting ───────────────────────

update invitations set archived_at = now()
  where id = '00000000-0000-0000-0000-00000000063a';

select is(
  (select count(*)::int from invitations
    where id = '00000000-0000-0000-0000-00000000063a' and archived_at is not null),
  1, 'invitations: revocar archiva la fila, no la borra');

select throws_ok(
  $$ delete from invitations $$, '42501', null,
  'invitations: ni el dueño puede borrar invitaciones');

-- Scenario: An invitation may be reissued after the previous one was resolved
select lives_ok(
  $$ insert into invitations (organization_id, email, role, token_hash, expires_at)
     values ('00000000-0000-0000-0000-00000000006a', 'revocada@kamay.test', 'assistant',
             sha256(convert_to('token-reemitido', 'utf8')), now() + interval '7 days') $$,
  'invitations: tras revocar se puede volver a invitar al mismo correo');

-- ── Aceptación ────────────────────────────────────────────────────────────

select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000006c1', 'invitee@kamay.test');

-- Scenario: Expired invitation is rejected
select throws_ok(
  $$ select accept_invitation('token-caducado') $$,
  '23514', 'La invitación no es válida',
  'accept_invitation: una invitación caducada es rechazada');

-- Scenario: Another user cannot claim someone else's invitation
select throws_ok(
  $$ select accept_invitation('token-de-b') $$,
  '23514', 'La invitación no es válida',
  'accept_invitation: una invitación dirigida a otro correo es rechazada');

-- Revocada y token inexistente devuelven exactamente el mismo error: la ruta
-- no delata qué invitaciones existen.
select throws_ok(
  $$ select accept_invitation('token-inexistente') $$,
  '23514', 'La invitación no es válida',
  'accept_invitation: un token inexistente da el mismo error genérico');

select throws_ok(
  $$ select accept_invitation('token-revocado') $$,
  '23514', 'La invitación no es válida',
  'accept_invitation: una invitación revocada da el mismo error genérico');

-- Ninguno de los cuatro rechazos dejó membresía alguna.
select pg_temp.logout();
select is(
  (select count(*)::int from memberships
    where user_id = '00000000-0000-0000-0000-0000000006c1'),
  0, 'accept_invitation: ningún rechazo creó una membresía');
select pg_temp.login('00000000-0000-0000-0000-0000000006c1', 'invitee@kamay.test');

-- Scenario: Valid invitation grants membership
select is(
  (select accept_invitation('token-ok')),
  '00000000-0000-0000-0000-00000000006a'::uuid,
  'accept_invitation: la invitación válida devuelve su organización');

select ok(is_member('00000000-0000-0000-0000-00000000006a'),
  'accept_invitation: quien aceptó queda como miembro activo');
select ok(not is_owner('00000000-0000-0000-0000-00000000006a'),
  'accept_invitation: queda con el rol invitado (ayudante), no con otro');

-- Scenario: A token cannot be used twice
select throws_ok(
  $$ select accept_invitation('token-ok') $$,
  '23514', 'La invitación no es válida',
  'accept_invitation: el mismo token no sirve dos veces');

select pg_temp.logout();
select is(
  (select count(*)::int from memberships
    where user_id = '00000000-0000-0000-0000-0000000006c1'),
  1, 'accept_invitation: no se creó una segunda membresía');

-- Assert obligatorio del procedimiento de auditoría (supabase/README.md).
select is(
  (select count(*)::int from activity_log
    where table_name = 'invitations'
      and record_id = '00000000-0000-0000-0000-00000000061a'
      and action = 'created'),
  1, 'invitations: el INSERT queda registrado en la bitácora');

-- ── Cambio de rol y archivado de membresía ────────────────────────────────

-- Scenario: Assistant is promoted to owner
select pg_temp.login('00000000-0000-0000-0000-0000000006a1', 'owner-inv-a@kamay.test');
update memberships set role = 'owner'
  where organization_id = '00000000-0000-0000-0000-00000000006a'
    and user_id = '00000000-0000-0000-0000-0000000006c1';
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-0000000006c1', 'invitee@kamay.test');
select ok(is_owner('00000000-0000-0000-0000-00000000006a'),
  'memberships: el cambio de rol surte efecto en la siguiente petición');

-- Scenario: Archived member loses access
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000006a1', 'owner-inv-a@kamay.test');
update memberships set archived_at = now()
  where organization_id = '00000000-0000-0000-0000-00000000006a'
    and user_id = '00000000-0000-0000-0000-0000000006a2';
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-0000000006a2', 'assistant-inv-a@kamay.test');
select is((select count(*)::int from organizations), 0,
  'memberships: la membresía archivada deja al usuario sin acceso');
select pg_temp.logout();

-- Scenario: The last active owner cannot be archived
-- Invita B tiene un solo dueño: archivarlo dejaría la organización sin gobierno.
select throws_ok(
  $$ update memberships set archived_at = now()
     where organization_id = '00000000-0000-0000-0000-00000000006b'
       and user_id = '00000000-0000-0000-0000-0000000006b1' $$,
  '23514', 'La organización debe conservar al menos un dueño activo',
  'memberships: archivar al último dueño activo es rechazado');

select is(
  (select archived_at from memberships
    where organization_id = '00000000-0000-0000-0000-00000000006b'
      and user_id = '00000000-0000-0000-0000-0000000006b1'),
  null, 'memberships: el último dueño sigue activo');

select * from finish();

rollback;
