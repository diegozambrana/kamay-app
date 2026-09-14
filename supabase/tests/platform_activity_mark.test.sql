-- KAM-26 · Lo que el super admin hace en una organización ajena queda marcado
-- en la bitácora de esa organización.
-- Escenarios del delta `platform-administration` → *Actions of a platform
-- admin are marked in the activity log* y *A platform admin creates an
-- organization ready to use* (creación registrada y marcada).
begin;

set search_path to public, extensions;

select plan(7);

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

-- ── Semilla ───────────────────────────────────────────────────────────────
-- El super admin es dueño de A y no pertenece a B.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000fd01', 'mark-admin@kamay.test'),
  ('00000000-0000-0000-0000-00000000fd02', 'mark-duena-b@kamay.test'),
  ('00000000-0000-0000-0000-00000000fd03', 'mark-nueva@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-00000000fd0a', 'Org Marca A'),
  ('00000000-0000-0000-0000-00000000fd0b', 'Org Marca B');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000fd0a', '00000000-0000-0000-0000-00000000fd01', 'owner'),
  ('00000000-0000-0000-0000-00000000fd0b', '00000000-0000-0000-0000-00000000fd02', 'owner');

insert into platform_admins (user_id) values
  ('00000000-0000-0000-0000-00000000fd01');

insert into business_lines (id, organization_id, name, is_shared, position) values
  ('00000000-0000-0000-0000-00000000fda1', '00000000-0000-0000-0000-00000000fd0a', 'General', true, 1),
  ('00000000-0000-0000-0000-00000000fdb1', '00000000-0000-0000-0000-00000000fd0b', 'General', true, 1);

insert into statuses (id, organization_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-00000000fda2', '00000000-0000-0000-0000-00000000fd0a', 'order', 'Registrado', 'initial', 1),
  ('00000000-0000-0000-0000-00000000fda3', '00000000-0000-0000-0000-00000000fd0a', 'order', 'Entregado', 'final', 2),
  ('00000000-0000-0000-0000-00000000fdb2', '00000000-0000-0000-0000-00000000fd0b', 'order', 'Registrado', 'initial', 1),
  ('00000000-0000-0000-0000-00000000fdb3', '00000000-0000-0000-0000-00000000fd0b', 'order', 'Entregado', 'final', 2);

insert into contacts (id, organization_id, name, is_customer) values
  ('00000000-0000-0000-0000-00000000fda4', '00000000-0000-0000-0000-00000000fd0a', 'Cliente A', true),
  ('00000000-0000-0000-0000-00000000fdb4', '00000000-0000-0000-0000-00000000fd0b', 'Cliente B', true);

insert into orders (id, organization_id, business_line_id, kind, contact_id, status_id) values
  ('00000000-0000-0000-0000-00000000fda5', '00000000-0000-0000-0000-00000000fd0a',
   '00000000-0000-0000-0000-00000000fda1', 'order',
   '00000000-0000-0000-0000-00000000fda4', '00000000-0000-0000-0000-00000000fda2'),
  ('00000000-0000-0000-0000-00000000fdb5', '00000000-0000-0000-0000-00000000fd0b',
   '00000000-0000-0000-0000-00000000fdb1', 'order',
   '00000000-0000-0000-0000-00000000fdb4', '00000000-0000-0000-0000-00000000fdb2');

-- ── Cambios del super admin ───────────────────────────────────────────────

select pg_temp.login('00000000-0000-0000-0000-00000000fd01');

-- Scenario: A foreign change is marked
update orders set status_id = '00000000-0000-0000-0000-00000000fdb3'
 where id = '00000000-0000-0000-0000-00000000fdb5';

-- Scenario: A member's own change is not marked
update orders set status_id = '00000000-0000-0000-0000-00000000fda3'
 where id = '00000000-0000-0000-0000-00000000fda5';

-- Un cambio de equipo hecho desde el detalle de la organización.
insert into memberships (organization_id, user_id, role, display_name) values
  ('00000000-0000-0000-0000-00000000fd0b', '00000000-0000-0000-0000-00000000fd03', 'assistant', 'Nueva');

select set_config('kam26.nueva', create_organization('Org Marca Nueva')::text, true);

select pg_temp.logout();

select is(
  (select actor_label from activity_log
    where record_id = '00000000-0000-0000-0000-00000000fdb5' and action = 'status_changed'),
  'Administrador de la plataforma',
  'el cambio en una organización ajena lleva la marca');

select is(
  (select actor_id from activity_log
    where record_id = '00000000-0000-0000-0000-00000000fdb5' and action = 'status_changed'),
  '00000000-0000-0000-0000-00000000fd01'::uuid,
  'y el super admin sigue siendo el autor');

select is(
  (select actor_label from activity_log
    where record_id = '00000000-0000-0000-0000-00000000fda5' and action = 'status_changed'),
  null,
  'el cambio en su propia organización no lleva marca');

select is(
  (select l.actor_label from activity_log l
     join memberships m on m.id = l.record_id
    where m.user_id = '00000000-0000-0000-0000-00000000fd03' and l.action = 'created'),
  'Administrador de la plataforma',
  'agregar a alguien al equipo ajeno también queda marcado');

-- Scenario: Creation is logged and marked
select is(
  (select actor_label from activity_log
    where table_name = 'organizations' and record_id = current_setting('kam26.nueva')::uuid and action = 'created'),
  'Administrador de la plataforma',
  'la creación de la organización queda marcada en su propia bitácora');

select is(
  (select count(*)::int from activity_log
    where organization_id = current_setting('kam26.nueva')::uuid
      and table_name in ('business_lines', 'statuses')
      and actor_label = 'Administrador de la plataforma'),
  6, 'la línea compartida y los cinco estados también quedan marcados');

-- La dueña de B ve la marca (la bitácora es solo del dueño).
select pg_temp.login('00000000-0000-0000-0000-00000000fd02');
select is(
  (select actor_label from activity_log
    where record_id = '00000000-0000-0000-0000-00000000fdb5' and action = 'status_changed'),
  'Administrador de la plataforma',
  'la dueña de B lee el evento con la marca');

select * from finish();
rollback;
