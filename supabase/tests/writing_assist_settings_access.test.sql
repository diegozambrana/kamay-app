-- KAM-30 · El interruptor de la asistencia de redacción solo lo escribe la
-- persona dueña. Escenario de la spec `org-configuration` → "Writing assist
-- is activated per organization, off by default" § "The assistant cannot
-- change the toggle".
--
-- La llave vive en `organizations.settings`. No hay política nueva que
-- escribir: la RLS de `organizations` (KAM-02/KAM-04) ya deja escribir solo al
-- dueño, igual que probó KAM-20 para la regla de reparto
-- (`allocation_rule_access.test.sql`); esta prueba verifica que sigue
-- alcanzando ahora que la llave nueva es `ai_writing_assist`.
begin;

set search_path to public, extensions;

select plan(4);

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
  ('00000000-0000-0000-0000-000000753a01', 'owner-assist@kamay.test'),
  ('00000000-0000-0000-0000-000000753a02', 'helper-assist@kamay.test');

insert into organizations (id, name, timezone, settings) values
  ('00000000-0000-0000-0000-00000075300a', 'Redacción con dueña', 'America/La_Paz',
   '{"ai_writing_assist": {"enabled": false}, "retention": {"days": 90}}'::jsonb);

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-00000075300a', '00000000-0000-0000-0000-000000753a01', 'owner'),
  ('00000000-0000-0000-0000-00000075300a', '00000000-0000-0000-0000-000000753a02', 'assistant');

-- ── El ayudante lee el interruptor, pero no lo escribe ────────────────────

select pg_temp.login('00000000-0000-0000-0000-000000753a02');

update organizations
   set settings = jsonb_set(settings, '{ai_writing_assist}', '{"enabled": true}'::jsonb)
 where id = '00000000-0000-0000-0000-00000075300a';

select is(
  (select settings->'ai_writing_assist'->>'enabled' from organizations
    where id = '00000000-0000-0000-0000-00000075300a'),
  'false', 'la escritura del ayudante no enciende el interruptor');

-- ── La dueña sí lo cambia, sin borrar lo demás de settings ────────────────

select pg_temp.login('00000000-0000-0000-0000-000000753a01');

update organizations
   set settings = jsonb_set(settings, '{ai_writing_assist}', '{"enabled": true}'::jsonb)
 where id = '00000000-0000-0000-0000-00000075300a';

select is(
  (select settings->'ai_writing_assist'->>'enabled' from organizations
    where id = '00000000-0000-0000-0000-00000075300a'),
  'true', 'la dueña sí enciende el interruptor');

select is(
  (select settings->'retention'->>'days' from organizations
    where id = '00000000-0000-0000-0000-00000075300a'),
  '90', 'encender el interruptor no borra lo que otra sección guarda en settings');

-- ── El cambio queda en la bitácora, con el trigger que ya existía ────────

select isnt_empty(
  $$ select 1 from activity_log
     where table_name = 'organizations'
       and record_id = '00000000-0000-0000-0000-00000075300a'
       and action = 'updated' $$,
  'activity_log: encender la asistencia de redacción queda registrado');

select * from finish();
rollback;
