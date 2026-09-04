-- KAM-02 · tenant-isolation: aislamiento por RLS, funciones de membresía y
-- restricciones del modelo. Escenarios del delta spec `tenant-isolation`.
begin;

set search_path to public, extensions;

select plan(18);

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

-- ── Semilla (como postgres, sin RLS) ──────────────────────────────────────

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'assistant-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'archived-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner-b@kamay.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'invitee@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-00000000000a', 'Org A'),
  ('00000000-0000-0000-0000-00000000000b', 'Org B');

insert into memberships (organization_id, user_id, role, archived_at) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'owner', null),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 'assistant', null),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 'owner', now()),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'owner', null);

-- Un cobro de la organización B, con lo justo para que exista: línea,
-- estado inicial, cliente y pedido (KAM-10).
insert into business_lines (id, organization_id, name, position) values
  ('00000000-0000-0000-0000-0000000000bb', '00000000-0000-0000-0000-00000000000b', 'Sublimación', 1);

insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-0000000000bc', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000bb', 'order', 'Registrado', 'initial', 1);

insert into contacts (id, organization_id, name, is_customer) values
  ('00000000-0000-0000-0000-0000000000bd', '00000000-0000-0000-0000-00000000000b', 'Cliente B', true);

insert into orders (id, organization_id, business_line_id, kind, contact_id, status_id) values
  ('00000000-0000-0000-0000-0000000000be', '00000000-0000-0000-0000-00000000000b',
   '00000000-0000-0000-0000-0000000000bb', 'order',
   '00000000-0000-0000-0000-0000000000bd', '00000000-0000-0000-0000-0000000000bc');

insert into payments (id, organization_id, direction, order_id, amount) values
  ('00000000-0000-0000-0000-0000000000bf', '00000000-0000-0000-0000-00000000000b', 'in',
   '00000000-0000-0000-0000-0000000000be', 40);

-- ── Funciones de membresía ────────────────────────────────────────────────

-- Scenario: Active member is recognized
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select ok(is_member('00000000-0000-0000-0000-00000000000a'),
  'is_member: miembro activo reconocido');
select ok(is_owner('00000000-0000-0000-0000-00000000000a'),
  'is_owner: dueño activo reconocido');

-- Scenario: Archived membership grants nothing
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
select ok(not is_member('00000000-0000-0000-0000-00000000000a'),
  'is_member: membresía archivada no cuenta');
select ok(not is_owner('00000000-0000-0000-0000-00000000000a'),
  'is_owner: membresía archivada no cuenta');

-- Scenario: Assistant is not owner
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select ok(is_member('00000000-0000-0000-0000-00000000000a'),
  'is_member: ayudante activo es miembro');
select ok(not is_owner('00000000-0000-0000-0000-00000000000a'),
  'is_owner: ayudante no es dueño');

-- ── Lecturas entre organizaciones ─────────────────────────────────────────

-- Scenario: Cross-organization reads return zero rows
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from organizations), 1,
  'organizations: el miembro de A ve exactamente su organización');
select is(
  (select count(*)::int from organizations where id = '00000000-0000-0000-0000-00000000000b'),
  0, 'organizations: cero filas de la organización B');
select is(
  (select count(*)::int from memberships where organization_id = '00000000-0000-0000-0000-00000000000b'),
  0, 'memberships: cero filas de la organización B');
select is(
  (select count(*)::int from payments where organization_id = '00000000-0000-0000-0000-00000000000b'),
  0, 'payments: cero movimientos de dinero de la organización B');

-- ── Escrituras entre organizaciones ───────────────────────────────────────

-- Scenario: Cross-organization writes are rejected
select throws_ok(
  $$ insert into memberships (organization_id, user_id, role)
     values ('00000000-0000-0000-0000-00000000000b',
             '00000000-0000-0000-0000-0000000000a1', 'owner') $$,
  '42501', null,
  'memberships: insertar en otra organización viola RLS');

update organizations set name = 'hackeada'
  where id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.logout();
select is(
  (select name from organizations where id = '00000000-0000-0000-0000-00000000000b'),
  'Org B', 'organizations: actualizar otra organización afecta cero filas');

-- ── Escrituras del ayudante (solo dueño escribe, D2) ──────────────────────

-- Scenario: Assistant cannot modify the organization
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select throws_ok(
  $$ insert into memberships (organization_id, user_id, role)
     values ('00000000-0000-0000-0000-00000000000a',
             '00000000-0000-0000-0000-0000000000c1', 'assistant') $$,
  '42501', null,
  'memberships: el ayudante no puede insertar membresías');

update organizations set name = 'renombrada por ayudante'
  where id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.logout();
select is(
  (select name from organizations where id = '00000000-0000-0000-0000-00000000000a'),
  'Org A', 'organizations: el ayudante no puede editar la organización');

-- Scenario: Owner can manage memberships
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select lives_ok(
  $$ insert into memberships (organization_id, user_id, role)
     values ('00000000-0000-0000-0000-00000000000a',
             '00000000-0000-0000-0000-0000000000c1', 'assistant') $$,
  'memberships: el dueño puede insertar membresías en su organización');
select is(
  (select count(*)::int from memberships
    where user_id = '00000000-0000-0000-0000-0000000000c1'),
  1, 'memberships: la membresía creada por el dueño existe');
select pg_temp.logout();

-- ── Restricciones del modelo (como postgres) ──────────────────────────────

-- Scenario: Membership roles are constrained
select throws_ok(
  $$ insert into memberships (organization_id, user_id, role)
     values ('00000000-0000-0000-0000-00000000000a',
             '00000000-0000-0000-0000-0000000000b1', 'admin') $$,
  '23514', null,
  'memberships: rol fuera de owner/assistant es rechazado');

-- Scenario: A user cannot be member of the same organization twice
select throws_ok(
  $$ insert into memberships (organization_id, user_id, role)
     values ('00000000-0000-0000-0000-00000000000a',
             '00000000-0000-0000-0000-0000000000a1', 'assistant') $$,
  '23505', null,
  'memberships: duplicar (organización, usuario) es rechazado');

select * from finish();

rollback;
