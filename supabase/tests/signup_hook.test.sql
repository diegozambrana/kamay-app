-- KAM-23 · Solo una invitación vigente crea una cuenta
-- (20260911120000_signup_requires_invitation.sql).
--
-- La función del hook *before user created*, caso por caso. La prueba de
-- punta a punta contra la API de Auth vive en
-- `tests/integration/signup-invitation.test.ts`.
begin;

set search_path to public, extensions;

select plan(9);

create function pg_temp.hook(email text) returns jsonb
language sql as $$
  select public.hook_before_user_created(jsonb_build_object('user', jsonb_build_object('email', email)));
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000023a9', 'owner-hook@kamay.test');
insert into organizations (id, name) values
  ('00000000-0000-0000-0000-0000000023a8', 'Invitaciones');
insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000023a8', '00000000-0000-0000-0000-0000000023a9', 'owner');

insert into invitations (organization_id, email, role, token_hash, expires_at, accepted_at, invited_by, archived_at) values
  ('00000000-0000-0000-0000-0000000023a8', 'vigente@kamay.test',  'assistant', 'h1', now() + interval '7 days', null,  '00000000-0000-0000-0000-0000000023a9', null),
  ('00000000-0000-0000-0000-0000000023a8', 'aceptada@kamay.test', 'assistant', 'h2', now() + interval '7 days', now(), '00000000-0000-0000-0000-0000000023a9', null),
  ('00000000-0000-0000-0000-0000000023a8', 'vencida@kamay.test',  'assistant', 'h3', now() - interval '1 day',  null,  '00000000-0000-0000-0000-0000000023a9', null),
  ('00000000-0000-0000-0000-0000000023a8', 'retirada@kamay.test', 'assistant', 'h4', now() + interval '7 days', null,  '00000000-0000-0000-0000-0000000023a9', now());

-- Auth llama a la función como `supabase_auth_admin`, que puede ejecutarla.
-- (El corredor de pruebas no puede asumir ese rol: se llama como dueño, y la
-- lógica es la misma porque la función corre con su propio privilegio.)
select ok(has_function_privilege('supabase_auth_admin', 'public.hook_before_user_created(jsonb)', 'execute'),
  'Auth puede ejecutar el hook');

select is(pg_temp.hook('vigente@kamay.test'), '{}'::jsonb,
  'una invitación vigente deja crear la cuenta');

select is(pg_temp.hook('  Vigente@Kamay.TEST '), '{}'::jsonb,
  'el correo se compara sin mayúsculas ni espacios');

select is((pg_temp.hook('nadie@kamay.test') -> 'error' ->> 'http_code')::int, 403,
  'sin invitación, el alta se rechaza');

select is((pg_temp.hook('aceptada@kamay.test') -> 'error' ->> 'http_code')::int, 403,
  'una invitación ya aceptada no abre la puerta');

select is((pg_temp.hook('vencida@kamay.test') -> 'error' ->> 'http_code')::int, 403,
  'una invitación vencida no abre la puerta');

select is((pg_temp.hook('retirada@kamay.test') -> 'error' ->> 'http_code')::int, 403,
  'una invitación archivada no abre la puerta');

-- Nadie de la API puede preguntar qué correos tienen invitación.
select ok(not has_function_privilege('anon', 'public.hook_before_user_created(jsonb)', 'execute'),
  'anon no ejecuta el hook');
select ok(not has_function_privilege('authenticated', 'public.hook_before_user_created(jsonb)', 'execute'),
  'authenticated no ejecuta el hook');

select * from finish();
rollback;
