-- KAM-30 · Cambio `task-body-writing-assist`: la tabla de solicitudes que
-- respalda el límite de uso, su RLS de miembro y la vista de conteo por
-- periodo. Escenarios de la spec `ai-writing-assist` → *El límite de uso por
-- organización y por periodo se hace cumplir*.
begin;

set search_path to public, extensions;

select plan(12);

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

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000750a01', 'owner-ai-a@kamay.test'),
  ('00000000-0000-0000-0000-000000750a02', 'assistant-ai-a@kamay.test'),
  ('00000000-0000-0000-0000-000000750b01', 'owner-ai-b@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-00000075000a', 'Asistencia A'),
  ('00000000-0000-0000-0000-00000075000b', 'Asistencia B');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-00000075000a', '00000000-0000-0000-0000-000000750a01', 'owner'),
  ('00000000-0000-0000-0000-00000075000a', '00000000-0000-0000-0000-000000750a02', 'assistant'),
  ('00000000-0000-0000-0000-00000075000b', '00000000-0000-0000-0000-000000750b01', 'owner');

-- ── Forma ─────────────────────────────────────────────────────────────────

select has_table('public', 'ai_writing_assist_requests', 'ai_writing_assist_requests existe');

select is(
  (select relrowsecurity from pg_class where oid = 'public.ai_writing_assist_requests'::regclass),
  true, 'ai_writing_assist_requests: RLS activa');

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'ai_writing_assist_requests'
      and cmd in ('DELETE', 'UPDATE')),
  0, 'ai_writing_assist_requests: no existen políticas DELETE ni UPDATE');

-- ── Cualquier miembro registra una solicitud de su propia organización ────

select pg_temp.login('00000000-0000-0000-0000-000000750a02');

select lives_ok(
  $$ insert into ai_writing_assist_requests (id, organization_id, requested_by)
     values ('00000000-0000-0000-0000-000000751a01', '00000000-0000-0000-0000-00000075000a',
             '00000000-0000-0000-0000-000000750a02') $$,
  'el ayudante registra una solicitud de su propia organización');

select throws_ok(
  $$ insert into ai_writing_assist_requests (organization_id, requested_by)
     values ('00000000-0000-0000-0000-00000075000b', '00000000-0000-0000-0000-000000750a02') $$,
  '42501', null, 'no registra una solicitud de una organización ajena');

select throws_ok(
  $$ insert into ai_writing_assist_requests (organization_id, requested_by)
     values ('00000000-0000-0000-0000-00000075000a', '00000000-0000-0000-0000-000000750a01') $$,
  '42501', null, 'no registra una solicitud a nombre de otra persona');

select throws_ok(
  $$ update ai_writing_assist_requests set requested_by = requested_by
     where id = '00000000-0000-0000-0000-000000751a01' $$,
  '42501', null, 'ninguna solicitud contada se corrige');

select throws_ok(
  $$ delete from ai_writing_assist_requests where id = '00000000-0000-0000-0000-000000751a01' $$,
  '42501', null, 'ninguna solicitud contada se retira');

select pg_temp.logout();

-- ── Más solicitudes del mismo mes, para el conteo ─────────────────────────

insert into ai_writing_assist_requests (organization_id, requested_by) values
  ('00000000-0000-0000-0000-00000075000a', '00000000-0000-0000-0000-000000750a01'),
  ('00000000-0000-0000-0000-00000075000a', '00000000-0000-0000-0000-000000750a01');

-- Una solicitud de la organización ajena, para comprobar que no se mezcla.
insert into ai_writing_assist_requests (organization_id, requested_by) values
  ('00000000-0000-0000-0000-00000075000b', '00000000-0000-0000-0000-000000750b01');

select pg_temp.login('00000000-0000-0000-0000-000000750a01');

select is(
  (select request_count from ai_writing_assist_usage_by_period
    where organization_id = '00000000-0000-0000-0000-00000075000a'
      and period_start = date_trunc('month', now())),
  3, 'la vista cuenta las tres solicitudes del mes en curso, de la propia organización');

select is(
  (select count(*)::int from ai_writing_assist_usage_by_period
    where organization_id = '00000000-0000-0000-0000-00000075000b'),
  0, 'la dueña de A no ve el conteo de B en la vista');

select pg_temp.logout();

-- ── El aislamiento entre organizaciones también en la tabla ───────────────

select pg_temp.login('00000000-0000-0000-0000-000000750b01');

select is(
  (select count(*)::int from ai_writing_assist_requests
    where organization_id = '00000000-0000-0000-0000-00000075000a'),
  0, 'la dueña de B obtiene cero filas de A');

select is(
  (select request_count from ai_writing_assist_usage_by_period
    where organization_id = '00000000-0000-0000-0000-00000075000b'
      and period_start = date_trunc('month', now())),
  1, 'la dueña de B ve el conteo de su propia organización');

select pg_temp.logout();

select * from finish();
rollback;
