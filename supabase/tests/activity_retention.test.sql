-- KAM-22 · activity-retention: la purga resume, nunca borra, y solo la ejecuta
-- el sistema.
--
-- Escenarios del delta spec `activity-retention`:
--   § La purga resume, nunca borra → "El número de eventos no cambia",
--     "Todo salvo el detalle sobrevive".
--   § Solo se vacían los eventos vencidos de la organización tratada →
--     "Lo reciente conserva su detalle", "Otra organización no se toca".
--   § La retención solo la ejecuta el sistema → "Un usuario no puede purgar".
-- Y del delta spec `activity-log`:
--   § The activity log is immutable and owner-readable only →
--     "Retention may only empty the payload", "No row ever disappears".
--
-- La exportación previa no se comprueba aquí: no ocurre en la base. Lo que se
-- verifica es lo que esta función puede y no puede hacer cuando la llaman.
-- El «primero exporta, después vacía» se prueba en
-- tests/integration/activity-retention.test.ts, donde vive la orquestación.
begin;

set search_path to public, extensions;

select plan(12);

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

-- ── Semilla propia ────────────────────────────────────────────────────────
-- Dos organizaciones, para que «no cruza organizaciones» se pueda afirmar.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000022a1', 'owner-ret-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000022a2', 'helper-ret-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000022b1', 'owner-ret-b@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-0000000022c0', 'Retención A'),
  ('00000000-0000-0000-0000-0000000022c9', 'Retención B');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000022c0', '00000000-0000-0000-0000-0000000022a1', 'owner'),
  ('00000000-0000-0000-0000-0000000022c0', '00000000-0000-0000-0000-0000000022a2', 'assistant'),
  ('00000000-0000-0000-0000-0000000022c9', '00000000-0000-0000-0000-0000000022b1', 'owner');

-- Los eventos de la semilla los generó el trigger con `occurred_at = now()`.
-- Para tener historia vencida hace falta moverlos hacia atrás, y eso solo se
-- puede hacer como `postgres`, que es justo la prueba de que un usuario no
-- podría llegar aquí.
create temporary table ret_fixture (id bigint primary key, org uuid, vencido boolean);

with viejos as (
  update activity_log
     set occurred_at = now() - interval '18 months'
   where organization_id = '00000000-0000-0000-0000-0000000022c0'
     and id in (
       select id from activity_log
        where organization_id = '00000000-0000-0000-0000-0000000022c0'
        order by id limit 2)
  returning id, organization_id
)
insert into ret_fixture select id, organization_id, true from viejos;

insert into ret_fixture
select id, organization_id, false
  from activity_log
 where organization_id = '00000000-0000-0000-0000-0000000022c0'
   and id not in (select id from ret_fixture);

insert into ret_fixture
select id, organization_id, true
  from activity_log
 where organization_id = '00000000-0000-0000-0000-0000000022c9';

-- La organización B también tiene historia vencida, para poder afirmar que
-- purgar A no la toca.
update activity_log
   set occurred_at = now() - interval '18 months'
 where organization_id = '00000000-0000-0000-0000-0000000022c9';

-- Fotografía previa de un evento vencido de A, para comparar campo a campo.
create temporary table ret_antes as
select id, organization_id, business_line_id, actor_id, actor_label,
       table_name, record_id, action, origin, occurred_at, changes
  from activity_log
 where id = (select min(id) from ret_fixture where org = '00000000-0000-0000-0000-0000000022c0' and vencido);

create temporary table ret_conteos as
select (select count(*) from activity_log) as total,
       (select count(*) from activity_log
         where organization_id = '00000000-0000-0000-0000-0000000022c9'
           and changes is not null) as detalle_b;

-- ── Scenario: Un usuario no puede purgar ──────────────────────────────────
-- Ni el dueño ni el ayudante. El `revoke execute` es lo que lo garantiza, y
-- no depende de que una política esté bien escrita.

select pg_temp.login('00000000-0000-0000-0000-0000000022a1');

select throws_ok(
  $$ select purge_activity_detail('00000000-0000-0000-0000-0000000022c0',
                                  now() - interval '12 months') $$,
  '42501'::char(5), null::text,
  'la retención no la ejecuta el dueño');

select pg_temp.login('00000000-0000-0000-0000-0000000022a2');

select throws_ok(
  $$ select purge_activity_detail('00000000-0000-0000-0000-0000000022c0',
                                  now() - interval '12 months') $$,
  '42501'::char(5), null::text,
  'la retención tampoco la ejecuta el ayudante');

select pg_temp.logout();

-- La bitácora no se movió durante los dos intentos.
select is(
  (select count(*) from activity_log where changes is null and organization_id = '00000000-0000-0000-0000-0000000022c0'),
  0::bigint,
  'un intento fallido de purga no vacía nada');

-- ── La purga, ejecutada por el sistema ────────────────────────────────────

select is(
  purge_activity_detail('00000000-0000-0000-0000-0000000022c0', now() - interval '12 months'),
  2,
  'la purga informa cuántos eventos vació');

-- ── Scenario: El número de eventos no cambia ──────────────────────────────
-- Scenario (activity-log): No row ever disappears

select is(
  (select count(*) from activity_log),
  (select total from ret_conteos),
  'la purga no elimina ninguna fila de la bitácora');

-- ── Scenario: Todo salvo el detalle sobrevive ─────────────────────────────
-- Scenario (activity-log): Retention may only empty the payload

select is(
  (select changes from activity_log where id = (select id from ret_antes)),
  null::jsonb,
  'el detalle del evento vencido quedó vacío');

select ok(
  (select count(*) = 1
     from activity_log l join ret_antes a on a.id = l.id
    where l.organization_id  is not distinct from a.organization_id
      and l.business_line_id is not distinct from a.business_line_id
      and l.actor_id         is not distinct from a.actor_id
      and l.actor_label      is not distinct from a.actor_label
      and l.table_name       is not distinct from a.table_name
      and l.record_id        is not distinct from a.record_id
      and l.action           is not distinct from a.action
      and l.origin           is not distinct from a.origin
      and l.occurred_at      is not distinct from a.occurred_at),
  'autor, organización, línea, tabla, registro, acción, origen y momento siguen intactos');

select isnt(
  (select changes from ret_antes),
  null::jsonb,
  'el evento tenía detalle antes de la purga (la prueba no se prueba a sí misma)');

-- ── Scenario: Lo reciente conserva su detalle ─────────────────────────────

select is(
  (select count(*) from activity_log l join ret_fixture f on f.id = l.id
    where f.org = '00000000-0000-0000-0000-0000000022c0'
      and not f.vencido and l.changes is null),
  0::bigint,
  'ningún evento dentro del plazo perdió su detalle');

-- ── Scenario: Otra organización no se toca ────────────────────────────────
-- B tiene sus eventos igual de vencidos; purgar A no los alcanza.

select is(
  (select count(*) from activity_log
    where organization_id = '00000000-0000-0000-0000-0000000022c9'
      and changes is not null),
  (select detalle_b from ret_conteos),
  'la otra organización conserva su detalle aunque también esté vencida');

-- ── Cada organización se rige por su propio corte ─────────────────────────

select is(
  purge_activity_detail('00000000-0000-0000-0000-0000000022c9', now() - interval '24 months'),
  0,
  'un corte más antiguo que la historia de B no vacía nada de B');

select is(
  (select count(*) from activity_log
    where organization_id = '00000000-0000-0000-0000-0000000022c9'
      and changes is not null),
  (select detalle_b from ret_conteos),
  'B sigue con todo su detalle tras un corte que no la alcanza');

select * from finish();

rollback;
