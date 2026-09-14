-- KAM-26 · El super admin actúa como dueño en toda organización a través de
-- `is_member`/`is_owner`, sin membresía y sin política propia.
-- Escenarios del delta `tenant-isolation` → *Membership helper functions
-- decide all access* y de `platform-administration` → *A platform admin acts
-- as owner in every organization*.
begin;

set search_path to public, extensions;

select plan(20);

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
-- A: el super admin es ayudante ahí. B: no pertenece. fb01 revocado.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000fb01', 'acc-admin@kamay.test'),
  ('00000000-0000-0000-0000-00000000fb02', 'acc-revocado@kamay.test'),
  ('00000000-0000-0000-0000-00000000fb03', 'acc-duena-a@kamay.test'),
  ('00000000-0000-0000-0000-00000000fb04', 'acc-duena-b@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-00000000fb0a', 'Org Acceso A'),
  ('00000000-0000-0000-0000-00000000fb0b', 'Org Acceso B');

insert into memberships (id, organization_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000fbaa', '00000000-0000-0000-0000-00000000fb0a',
   '00000000-0000-0000-0000-00000000fb03', 'owner'),
  ('00000000-0000-0000-0000-00000000fbab', '00000000-0000-0000-0000-00000000fb0a',
   '00000000-0000-0000-0000-00000000fb01', 'assistant'),
  ('00000000-0000-0000-0000-00000000fbba', '00000000-0000-0000-0000-00000000fb0b',
   '00000000-0000-0000-0000-00000000fb04', 'owner');

insert into platform_admins (user_id, archived_at) values
  ('00000000-0000-0000-0000-00000000fb01', null),
  ('00000000-0000-0000-0000-00000000fb02', now());

insert into business_lines (id, organization_id, name, is_shared, position) values
  ('00000000-0000-0000-0000-00000000fbb1', '00000000-0000-0000-0000-00000000fb0b', 'General', true, 1),
  ('00000000-0000-0000-0000-00000000fba1', '00000000-0000-0000-0000-00000000fb0a', 'General', true, 1);

insert into statuses (id, organization_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-00000000fbb2', '00000000-0000-0000-0000-00000000fb0b', 'order', 'Registrado', 'initial', 1),
  ('00000000-0000-0000-0000-00000000fbb3', '00000000-0000-0000-0000-00000000fb0b', 'order', 'Entregado', 'final', 2);

insert into contacts (id, organization_id, name, is_customer) values
  ('00000000-0000-0000-0000-00000000fbb4', '00000000-0000-0000-0000-00000000fb0b', 'Cliente B', true);

insert into orders (id, organization_id, business_line_id, kind, contact_id, status_id) values
  ('00000000-0000-0000-0000-00000000fbb5', '00000000-0000-0000-0000-00000000fb0b',
   '00000000-0000-0000-0000-00000000fbb1', 'order',
   '00000000-0000-0000-0000-00000000fbb4', '00000000-0000-0000-0000-00000000fbb2');

insert into expense_categories (id, organization_id, name) values
  ('00000000-0000-0000-0000-00000000fbb7', '00000000-0000-0000-0000-00000000fb0b', 'Servicios'),
  ('00000000-0000-0000-0000-00000000fba7', '00000000-0000-0000-0000-00000000fb0a', 'Servicios');

insert into expenses (id, organization_id, business_line_id, kind, expense_category_id, amount) values
  ('00000000-0000-0000-0000-00000000fbb6', '00000000-0000-0000-0000-00000000fb0b',
   '00000000-0000-0000-0000-00000000fbb1', 'expense', '00000000-0000-0000-0000-00000000fbb7', 25),
  ('00000000-0000-0000-0000-00000000fba6', '00000000-0000-0000-0000-00000000fb0a',
   '00000000-0000-0000-0000-00000000fba1', 'expense', '00000000-0000-0000-0000-00000000fba7', 30);

-- ── Funciones auxiliares ──────────────────────────────────────────────────

-- Scenario: A platform admin is owner everywhere
select pg_temp.login('00000000-0000-0000-0000-00000000fb01');
select ok(is_member('00000000-0000-0000-0000-00000000fb0b'),
  'is_member: el super admin puede actuar en B sin pertenecer');
select ok(is_owner('00000000-0000-0000-0000-00000000fb0b'),
  'is_owner: el super admin es dueño en B');

-- Scenario: Strict membership ignores platform admin
select ok(not has_active_membership('00000000-0000-0000-0000-00000000fb0b'),
  'has_active_membership: el super admin no pertenece a B');
select ok(has_active_membership('00000000-0000-0000-0000-00000000fb0a'),
  'has_active_membership: el super admin sí pertenece a A');

-- Scenario: A revoked platform admin is back to their memberships
select pg_temp.login('00000000-0000-0000-0000-00000000fb02');
select ok(not is_member('00000000-0000-0000-0000-00000000fb0b'),
  'is_member: un super admin revocado no entra a B');
select ok(not is_owner('00000000-0000-0000-0000-00000000fb0b'),
  'is_owner: un super admin revocado no es dueño en B');

-- ── Lectura y escritura cruzadas ──────────────────────────────────────────

-- Scenario: Reads any organization
select pg_temp.login('00000000-0000-0000-0000-00000000fb01');
select is(
  (select count(*)::int from orders where organization_id = '00000000-0000-0000-0000-00000000fb0b'),
  1, 'el super admin lee los pedidos de B');
select is(
  (select count(*)::int from expenses where organization_id = '00000000-0000-0000-0000-00000000fb0b'),
  1, 'el super admin lee los egresos de B (tabla del dueño)');
select ok(
  (select count(*) from activity_log where organization_id = '00000000-0000-0000-0000-00000000fb0b') > 0,
  'el super admin lee la bitácora de B (solo del dueño)');
select is(
  (select count(*)::int from memberships where organization_id = '00000000-0000-0000-0000-00000000fb0b'),
  1, 'el super admin ve el equipo de B');

-- Scenario: Writes as an owner would
select lives_ok(
  $$insert into expenses (organization_id, business_line_id, kind, expense_category_id, amount)
    values ('00000000-0000-0000-0000-00000000fb0b', '00000000-0000-0000-0000-00000000fbb1',
            'expense', '00000000-0000-0000-0000-00000000fbb7', 12)$$,
  'el super admin registra un egreso en B como lo haría su dueña');

-- Scenario: A platform admin who is an assistant somewhere is still an owner there
select is(
  (select count(*)::int from expenses where organization_id = '00000000-0000-0000-0000-00000000fb0a'),
  1, 'el super admin ayudante en A ve los egresos de A como dueño');
select ok(is_owner('00000000-0000-0000-0000-00000000fb0a'),
  'is_owner: el super admin es dueño en A aunque su membresía sea de ayudante');

-- Scenario: Owner rules still apply
select throws_ok(
  $$delete from orders where id = '00000000-0000-0000-0000-00000000fbb5'$$,
  '42501', null,
  'el super admin no puede borrar un pedido, igual que la dueña');
select pg_temp.logout();
select is(
  (select count(*)::int from orders where id = '00000000-0000-0000-0000-00000000fbb5'),
  1, 'DELETE del super admin no borra nada');

select pg_temp.login('00000000-0000-0000-0000-00000000fb01');
select throws_ok(
  $$update memberships set archived_at = now()
     where id = '00000000-0000-0000-0000-00000000fbba'$$,
  '23514', null,
  'el super admin no puede archivar a la última dueña de B');

-- Scenario: Acting creates no membership
select pg_temp.logout();
select is(
  (select count(*)::int from memberships
    where organization_id = '00000000-0000-0000-0000-00000000fb0b'
      and user_id = '00000000-0000-0000-0000-00000000fb01'),
  0, 'trabajar en B no le crea membresía al super admin');

-- ── Quien no es super admin sigue aislado ─────────────────────────────────

select pg_temp.login('00000000-0000-0000-0000-00000000fb03');
select is(
  (select count(*)::int from orders where organization_id = '00000000-0000-0000-0000-00000000fb0b'),
  0, 'la dueña de A no ve pedidos de B, con un super admin presente');
select ok(not is_member('00000000-0000-0000-0000-00000000fb0b'),
  'is_member: la dueña de A no entra a B');

-- Un super admin revocado vuelve a su membresía y nada más.
select pg_temp.login('00000000-0000-0000-0000-00000000fb02');
select is(
  (select count(*)::int from expenses where organization_id = '00000000-0000-0000-0000-00000000fb0b'),
  0, 'un super admin revocado obtiene cero filas de B');

select * from finish();
rollback;
