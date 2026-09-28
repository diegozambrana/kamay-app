-- Cambio `fair-all-lines` · La bandera «Venta rápida con todas las líneas»
-- solo la escribe la persona dueña, y el cambio queda en la bitácora.
-- Escenarios del delta `org-configuration` → "Fair mode can show every line,
-- off by default": «The assistant cannot change the toggle», «Changes are
-- logged» y «Other settings are preserved».
--
-- La llave vive en `organizations.settings.fair`. No hay política nueva: la
-- RLS de `organizations` ya deja escribir solo al dueño; esta prueba verifica
-- que alcanza también a la llave nueva.
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
  ('00000000-0000-0000-0000-000000754a01', 'owner-fair-flag@kamay.test'),
  ('00000000-0000-0000-0000-000000754a02', 'helper-fair-flag@kamay.test');

insert into organizations (id, name, timezone, settings) values
  ('00000000-0000-0000-0000-00000075400a', 'Feria con dueña', 'America/La_Paz',
   '{"fair": {"all_lines": false}, "retention": {"days": 90}}'::jsonb);

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-00000075400a', '00000000-0000-0000-0000-000000754a01', 'owner'),
  ('00000000-0000-0000-0000-00000075400a', '00000000-0000-0000-0000-000000754a02', 'assistant');

-- ── El ayudante lee la bandera, pero no la escribe ────────────────────

select pg_temp.login('00000000-0000-0000-0000-000000754a02');

update organizations
   set settings = jsonb_set(settings, '{fair}', '{"all_lines": true}'::jsonb)
 where id = '00000000-0000-0000-0000-00000075400a';

select is(
  (select settings->'fair'->>'all_lines' from organizations
    where id = '00000000-0000-0000-0000-00000075400a'),
  'false', 'The assistant cannot change the toggle: su escritura no enciende la bandera');

-- ── La dueña sí lo cambia, sin borrar lo demás de settings ────────────────

select pg_temp.login('00000000-0000-0000-0000-000000754a01');

update organizations
   set settings = jsonb_set(settings, '{fair}', '{"all_lines": true}'::jsonb)
 where id = '00000000-0000-0000-0000-00000075400a';

select is(
  (select settings->'fair'->>'all_lines' from organizations
    where id = '00000000-0000-0000-0000-00000075400a'),
  'true', 'la dueña sí enciende la bandera');

select is(
  (select settings->'retention'->>'days' from organizations
    where id = '00000000-0000-0000-0000-00000075400a'),
  '90', 'Other settings are preserved: encender la bandera no borra lo demás de settings');

-- ── El cambio queda en la bitácora, con el trigger que ya existía ────────

select isnt_empty(
  $$ select 1 from activity_log
     where table_name = 'organizations'
       and record_id = '00000000-0000-0000-0000-00000075400a'
       and action = 'updated' $$,
  'Changes are logged: encender la bandera queda en la bitácora');

select * from finish();
rollback;
