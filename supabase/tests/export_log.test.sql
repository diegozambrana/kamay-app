-- KAM-23 · La exportación queda en la bitácora, a nombre de quien exporta y
-- solo para su organización (spec `data-export` → *Exporting is recorded in
-- the activity log* → «A completed export leaves a trace»).
begin;

set search_path to public, extensions;

select plan(5);

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

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000023f1', 'owner-log-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000023f2', 'owner-log-b@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-0000000023f0', 'Registro A'),
  ('00000000-0000-0000-0000-0000000023f9', 'Registro B');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000023f0', '00000000-0000-0000-0000-0000000023f1', 'owner'),
  ('00000000-0000-0000-0000-0000000023f9', '00000000-0000-0000-0000-0000000023f2', 'owner');

select pg_temp.login('00000000-0000-0000-0000-0000000023f1');

select lives_ok(
  $$ select record_export('00000000-0000-0000-0000-0000000023f0') $$,
  'un miembro registra la exportación de su organización');

select is(
  (select actor_id from activity_log
    where organization_id = '00000000-0000-0000-0000-0000000023f0' and action = 'exported'),
  '00000000-0000-0000-0000-0000000023f1'::uuid,
  'el evento queda a nombre de quien exportó');

-- La bitácora sigue inmutable: la función registra, pero a mano no se puede.
select throws_ok(
  $$ insert into activity_log (organization_id, table_name, record_id, action)
     values ('00000000-0000-0000-0000-0000000023f0', 'organizations',
             '00000000-0000-0000-0000-0000000023f0', 'exported') $$,
  '42501', null,
  'nadie inserta un evento de exportación a mano');

select throws_ok(
  $$ select record_export('00000000-0000-0000-0000-0000000023f9') $$,
  '42501', null,
  'nadie registra una exportación en una organización ajena');

reset role;
set local role anon;
select throws_ok(
  $$ select record_export('00000000-0000-0000-0000-0000000023f0') $$,
  '42501', null,
  'sin sesión no se registra nada');

select * from finish();
rollback;
