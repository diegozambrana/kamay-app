-- KAM-26 · Las dos funciones de plataforma: listar cuentas y crear una
-- organización lista para usar.
-- Escenarios del delta `platform-administration` → *The Users view lists
-- every account* y *A platform admin creates an organization ready to use*.
begin;

set search_path to public, extensions;

select plan(19);

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

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000fc01', 'fn-admin@kamay.test'),
  ('00000000-0000-0000-0000-00000000fc02', 'fn-duena@kamay.test'),
  ('00000000-0000-0000-0000-00000000fc03', 'fn-sin-org@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-00000000fc0a', 'Org Funciones');

insert into memberships (organization_id, user_id, role, display_name) values
  ('00000000-0000-0000-0000-00000000fc0a', '00000000-0000-0000-0000-00000000fc02', 'owner', 'Dueña Funciones');

insert into platform_admins (user_id) values
  ('00000000-0000-0000-0000-00000000fc01');

-- ── platform_list_users ───────────────────────────────────────────────────

select pg_temp.login('00000000-0000-0000-0000-00000000fc01');

select is(
  (select memberships->0->>'organization_name' from platform_list_users()
    where email = 'fn-duena@kamay.test'),
  'Org Funciones',
  'la lista trae el correo y la organización de cada cuenta');

select is(
  (select memberships from platform_list_users() where email = 'fn-sin-org@kamay.test'),
  '[]'::jsonb,
  'una cuenta sin organización aparece con la lista vacía');

select ok(
  (select is_platform_admin from platform_list_users() where email = 'fn-admin@kamay.test'),
  'la lista marca a los administradores de la plataforma');

select is(
  (select array_agg(email order by email)
     from platform_list_users('00000000-0000-0000-0000-00000000fc0a')),
  array['fn-duena@kamay.test'],
  'con una organización, solo las cuentas de esa organización');

-- Scenario: A non-admin cannot list accounts
select pg_temp.login('00000000-0000-0000-0000-00000000fc02');
select throws_ok(
  $$select * from platform_list_users()$$,
  '42501', null,
  'una dueña no puede listar las cuentas');

select pg_temp.login('00000000-0000-0000-0000-00000000fc01');
select is(
  (select array_agg(email order by email) from platform_list_users(p_query => 'dueña funciones')),
  array['fn-duena@kamay.test'],
  'busca por nombre visible, sin importar mayúsculas');

select is(
  (select array_agg(email order by email)
     from platform_list_users(p_query => 'fn-', p_without_organization => true)),
  array['fn-admin@kamay.test', 'fn-sin-org@kamay.test'],
  '«sin organización» deja solo cuentas sin membresía activa');

select is(
  (select count(*)::int from platform_list_users(p_query => 'fn-', p_limit => 2)),
  2, 'el límite acota la respuesta: ninguna vista pide la tabla entera');

select is(
  (select array_agg(email) from platform_list_users(p_user_id => '00000000-0000-0000-0000-00000000fc02')),
  array['fn-duena@kamay.test'],
  'con una cuenta, solo esa cuenta');

select pg_temp.logout();
select ok(
  not has_function_privilege('anon', 'public.platform_list_users(uuid, text, boolean, int, uuid)', 'EXECUTE'),
  'anon no puede ejecutar platform_list_users');

-- ── create_organization ───────────────────────────────────────────────────

-- Scenario: The new organization is usable
select pg_temp.login('00000000-0000-0000-0000-00000000fc01');
select lives_ok(
  $$select create_organization('Taller Norte PA', 'BOB', 'America/La_Paz')$$,
  'el super admin crea una organización');

select is(
  (select count(*)::int from business_lines b
     join organizations o on o.id = b.organization_id
    where o.name = 'Taller Norte PA' and b.is_shared),
  1, 'la organización nace con exactamente una línea compartida');

select is(
  (select string_agg(s.kind, ',' order by s.position) from statuses s
     join organizations o on o.id = s.organization_id
    where o.name = 'Taller Norte PA' and s.flow = 'order'),
  'initial,final,cancelled', 'estados de pedido: inicial, final y cancelado');

select is(
  (select string_agg(s.kind, ',' order by s.position) from statuses s
     join organizations o on o.id = s.organization_id
    where o.name = 'Taller Norte PA' and s.flow = 'task'),
  'initial,final', 'estados de tarea: inicial y final');

select is(
  (select count(*)::int from memberships m
     join organizations o on o.id = m.organization_id
    where o.name = 'Taller Norte PA'),
  0, 'crear la organización no le da membresía al super admin');

-- Nombre vacío
select throws_ok(
  $$select create_organization('   ')$$,
  '23514', null,
  'un nombre vacío se rechaza');

-- Scenario: Creation is all-or-nothing
select pg_temp.logout();
create function pg_temp.fail_statuses() returns trigger
language plpgsql as $$
begin
  if (select name from public.organizations where id = new.organization_id) = 'Falla PA' then
    raise exception 'fallo provocado';
  end if;
  return new;
end $$;
create trigger pg_temp_fail before insert on statuses
  for each row execute function pg_temp.fail_statuses();

select pg_temp.login('00000000-0000-0000-0000-00000000fc01');
select throws_ok(
  $$select create_organization('Falla PA')$$,
  'P0001', null,
  'si un paso falla, la creación falla entera');

select pg_temp.logout();
select is(
  (select count(*)::int from organizations where name = 'Falla PA'),
  0, 'no queda organización huérfana');
drop trigger pg_temp_fail on statuses;

-- Scenario: Only a platform admin creates organizations
select pg_temp.login('00000000-0000-0000-0000-00000000fc02');
select throws_ok(
  $$select create_organization('Intrusa PA')$$,
  '42501', null,
  'una dueña no puede crear organizaciones');

select * from finish();
rollback;
