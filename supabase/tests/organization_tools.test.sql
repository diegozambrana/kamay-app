-- KAM-27 · Cambio `tenant-tools-registry`: la tabla de herramientas activas,
-- su RLS solo-dueño, la función que dice qué está activo y la bitácora.
-- Escenarios de la spec `tenant-tools` → *La activación de herramientas se
-- guarda por organización*, *Solo la dueña lee y escribe la activación* y
-- *Activar, desactivar y cambiar parámetros queda en la bitácora*.
begin;

set search_path to public, extensions;

select plan(22);

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

-- ── Semilla propia (como postgres, sin RLS) ───────────────────────────────
-- A: la organización principal, con dueña y ayudante. B: la ajena.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000700a01', 'owner-tools-a@kamay.test'),
  ('00000000-0000-0000-0000-000000700a02', 'assistant-tools-a@kamay.test'),
  ('00000000-0000-0000-0000-000000700b01', 'owner-tools-b@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-00000070000a', 'Herramientas A'),
  ('00000000-0000-0000-0000-00000070000b', 'Herramientas B');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-00000070000a', '00000000-0000-0000-0000-000000700a01', 'owner'),
  ('00000000-0000-0000-0000-00000070000a', '00000000-0000-0000-0000-000000700a02', 'assistant'),
  ('00000000-0000-0000-0000-00000070000b', '00000000-0000-0000-0000-000000700b01', 'owner');

-- ── Forma ─────────────────────────────────────────────────────────────────

select has_table('public', 'organization_tools', 'organization_tools existe');

select is(
  (select relrowsecurity from pg_class where oid = 'public.organization_tools'::regclass),
  true, 'organization_tools: RLS activa');

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'organization_tools' and cmd = 'DELETE'),
  0, 'organization_tools: no existe política DELETE');

-- ── La dueña activa, y solo ella ──────────────────────────────────────────

select pg_temp.login('00000000-0000-0000-0000-000000700a01');

select lives_ok(
  $$ insert into organization_tools (id, organization_id, slug, config)
     values ('00000000-0000-0000-0000-000000701a01', '00000000-0000-0000-0000-00000070000a',
             'print-cost-3d', '{"filamentPricePerKg": 175}') $$,
  'la dueña activa una herramienta con sus parámetros');

select throws_ok(
  $$ insert into organization_tools (organization_id, slug)
     values ('00000000-0000-0000-0000-00000070000a', 'print-cost-3d') $$,
  '23505', null, 'no hay dos filas para la misma organización y herramienta');

select throws_ok(
  $$ insert into organization_tools (organization_id, slug)
     values ('00000000-0000-0000-0000-00000070000a', 'Print Cost') $$,
  '23514', null, 'un slug mal formado se rechaza');

select throws_ok(
  $$ insert into organization_tools (organization_id, slug, config)
     values ('00000000-0000-0000-0000-00000070000a', 'otra', '[]') $$,
  '23514', null, 'los parámetros son un objeto, no una lista');

select throws_ok(
  $$ insert into organization_tools (organization_id, slug)
     values ('00000000-0000-0000-0000-00000070000b', 'print-cost-3d') $$,
  '42501', null, 'la dueña de A no activa nada en B');

-- Una segunda herramienta, que quedará archivada: para comprobar que la
-- función solo devuelve las vigentes.
insert into organization_tools (id, organization_id, slug)
  values ('00000000-0000-0000-0000-000000701a02', '00000000-0000-0000-0000-00000070000a', 'retirada');
update organization_tools set archived_at = now()
  where id = '00000000-0000-0000-0000-000000701a02';

select throws_ok(
  $$ delete from organization_tools where id = '00000000-0000-0000-0000-000000701a01' $$,
  '42501', null, 'nadie borra una activación, tampoco la dueña');

select is(
  (select string_agg(s, ',') from active_tool_slugs('00000000-0000-0000-0000-00000070000a') s),
  'print-cost-3d', 'la dueña ve activa solo la vigente, no la archivada');

-- ── El ayudante: sabe qué está activo, no con qué parámetros ──────────────

select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-000000700a02');

select is(
  (select count(*)::int from organization_tools),
  0, 'el ayudante lee cero filas de activación de su propia organización');

select is(
  (select string_agg(s, ',') from active_tool_slugs('00000000-0000-0000-0000-00000070000a') s),
  'print-cost-3d', 'el ayudante sí recibe los slugs activos');

select throws_ok(
  $$ insert into organization_tools (organization_id, slug)
     values ('00000000-0000-0000-0000-00000070000a', 'del-ayudante') $$,
  '42501', null, 'el ayudante no activa herramientas');

-- Bajo RLS un update sobre filas invisibles no lanza: afecta cero filas.
update organization_tools set config = '{"hack": true}'
  where id = '00000000-0000-0000-0000-000000701a01';

-- ── La organización ajena ─────────────────────────────────────────────────

select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-000000700b01');

select is(
  (select count(*)::int from organization_tools),
  0, 'la dueña de B obtiene cero filas de A');

select is(
  (select count(*)::int from active_tool_slugs('00000000-0000-0000-0000-00000070000a')),
  0, 'la dueña de B obtiene cero slugs de A');

update organization_tools set archived_at = now()
  where id = '00000000-0000-0000-0000-000000701a01';

select pg_temp.logout();

select is(
  (select config::text || '|' || coalesce(archived_at::text, 'vigente')
     from organization_tools where id = '00000000-0000-0000-0000-000000701a01'),
  '{"filamentPricePerKg": 175}|vigente',
  'ni el ayudante ni la organización ajena cambiaron la fila');

-- ── Desactivar conserva los parámetros; reactivar los devuelve ────────────

select pg_temp.login('00000000-0000-0000-0000-000000700a01');

update organization_tools set config = '{"filamentPricePerKg": 190}'
  where id = '00000000-0000-0000-0000-000000701a01';
update organization_tools set archived_at = now()
  where id = '00000000-0000-0000-0000-000000701a01';

select is(
  (select count(*)::int from active_tool_slugs('00000000-0000-0000-0000-00000070000a')),
  0, 'desactivada, ya no figura entre las activas');

update organization_tools set archived_at = null
  where id = '00000000-0000-0000-0000-000000701a01';

select is(
  (select config->>'filamentPricePerKg' from organization_tools
    where id = '00000000-0000-0000-0000-000000701a01'),
  '190', 'reactivada, vuelve con el parámetro que la dueña había dejado');

select pg_temp.logout();

-- ── La bitácora ───────────────────────────────────────────────────────────

select is(
  (select count(*)::int from activity_log
    where table_name = 'organization_tools'
      and record_id = '00000000-0000-0000-0000-000000701a01'
      and action = 'created'
      and actor_id = '00000000-0000-0000-0000-000000700a01'),
  1, 'la activación queda en la bitácora a nombre de la dueña');

select is(
  (select changes->'config'->'despues'->>'filamentPricePerKg' from activity_log
    where table_name = 'organization_tools'
      and record_id = '00000000-0000-0000-0000-000000701a01'
      and action = 'updated'),
  '190', 'el cambio de parámetros queda con su antes y su después');

select is(
  (select count(*)::int from activity_log
    where table_name = 'organization_tools'
      and record_id = '00000000-0000-0000-0000-000000701a01'
      and action = 'archived'),
  1, 'la desactivación queda como archivado');

select is(
  (select count(*)::int from activity_log
    where table_name = 'organization_tools'
      and record_id = '00000000-0000-0000-0000-000000701a01'
      and action = 'unarchived'),
  1, 'la reactivación queda como desarchivado');

select * from finish();
rollback;
