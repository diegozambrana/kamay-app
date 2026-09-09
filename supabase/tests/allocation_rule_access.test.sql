-- KAM-20 · La regla de reparto solo la escribe la persona dueña.
-- Escenario del delta spec `org-configuration` § General settings of the
--   organization are editable: "The assistant cannot change the rule".
--
-- La regla vive en `organizations.settings`. No hay política nueva que
-- escribir: la RLS de `organizations` (KAM-02/KAM-04) ya deja escribir solo al
-- dueño, y esta prueba es la que verifica que eso sigue alcanzando cuando el
-- dato guardado deja de ser el nombre y pasa a ser dinero repartido.
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
  ('00000000-0000-0000-0000-0000000026a1', 'owner-rule@kamay.test'),
  ('00000000-0000-0000-0000-0000000026a2', 'helper-rule@kamay.test');

insert into organizations (id, name, timezone, settings) values
  ('00000000-0000-0000-0000-0000000026b0', 'Regla A', 'America/La_Paz',
   '{"allocation": {"rule": "revenue"}}'::jsonb);

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000026b0', '00000000-0000-0000-0000-0000000026a1', 'owner'),
  ('00000000-0000-0000-0000-0000000026b0', '00000000-0000-0000-0000-0000000026a2', 'assistant');

-- ── El ayudante lee la regla, pero no la escribe ─────────────────────────
-- Leerla sí: la necesita cualquier pantalla que muestre una línea, y no
-- revela ningún monto por sí misma.

select pg_temp.login('00000000-0000-0000-0000-0000000026a2');

select is(
  (select settings->'allocation'->>'rule' from organizations
   where id = '00000000-0000-0000-0000-0000000026b0'),
  'revenue',
  'El ayudante lee la regla vigente'
);

update organizations
   set settings = '{"allocation": {"rule": "equal"}}'::jsonb
 where id = '00000000-0000-0000-0000-0000000026b0';

select is(
  (select settings->'allocation'->>'rule' from organizations
   where id = '00000000-0000-0000-0000-0000000026b0'),
  'revenue',
  'La escritura del ayudante no cambia la regla guardada'
);

-- ── La dueña sí la cambia ────────────────────────────────────────────────
-- Sin esta comprobación, la anterior pasaría igual si la escritura estuviera
-- rota para todo el mundo.

select pg_temp.login('00000000-0000-0000-0000-0000000026a1');

update organizations
   set settings = jsonb_set(settings, '{allocation}',
         '{"rule": "manual", "shares": {"a": 60, "b": 40}}'::jsonb)
 where id = '00000000-0000-0000-0000-0000000026b0';

select is(
  (select settings->'allocation'->>'rule' from organizations
   where id = '00000000-0000-0000-0000-0000000026b0'),
  'manual',
  'La dueña sí cambia la regla'
);

-- Lo demás de `settings` sobrevive a un cambio de regla: el `jsonb` es
-- compartido con la retención de la bitácora y las preferencias de aviso.
update organizations
   set settings = settings || '{"retention": {"days": 90}}'::jsonb
 where id = '00000000-0000-0000-0000-0000000026b0';

update organizations
   set settings = jsonb_set(settings, '{allocation}', '{"rule": "equal"}'::jsonb)
 where id = '00000000-0000-0000-0000-0000000026b0';

select is(
  (select settings->'retention'->>'days' from organizations
   where id = '00000000-0000-0000-0000-0000000026b0'),
  '90',
  'Cambiar la regla no borra lo que otra tarea guarde en settings'
);

-- ── El cambio de regla queda en la bitácora ──────────────────────────────
-- No hay trigger nuevo que escribir: `organizations` ya tiene el genérico
-- desde KAM-03 (convención nº 7, un solo historial). Esta comprobación es la
-- que verifica que sigue alcanzando ahora que lo que cambia es dinero
-- repartido y no el nombre de la organización.

select isnt_empty(
  $$ select 1 from activity_log
     where table_name = 'organizations'
       and record_id = '00000000-0000-0000-0000-0000000026b0'
       and action = 'updated' $$,
  'Guardar la regla deja su evento de bitácora, con el trigger que ya existía'
);

select * from finish();
rollback;
