-- KAM-24 · Autoedición del nombre visible: escenarios del delta spec
-- `user-management` (A member edits their own display name).
begin;

set search_path to public, extensions;

select plan(11);

-- ── Helpers ───────────────────────────────────────────────────────────────

create function pg_temp.login(uid uuid, mail text) returns void
language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', uid, 'email', mail, 'role', 'authenticated')::text,
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

-- ── Semilla (como postgres, sin RLS) ──────────────────────────────────────

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000024001', 'owner-self-a@kamay.test'),
  ('00000000-0000-0000-0000-000000024002', 'assistant-self-a@kamay.test'),
  ('00000000-0000-0000-0000-000000024003', 'multi-org-self@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-00000002440a', 'Autoedición A'),
  ('00000000-0000-0000-0000-00000002440b', 'Autoedición B');

insert into memberships (id, organization_id, user_id, role, display_name) values
  ('00000000-0000-0000-0000-000000024011', '00000000-0000-0000-0000-00000002440a',
   '00000000-0000-0000-0000-000000024001', 'owner', 'Dueña A'),
  ('00000000-0000-0000-0000-000000024012', '00000000-0000-0000-0000-00000002440a',
   '00000000-0000-0000-0000-000000024002', 'assistant', 'Ayudante Original'),
  ('00000000-0000-0000-0000-000000024013', '00000000-0000-0000-0000-00000002440a',
   '00000000-0000-0000-0000-000000024003', 'assistant', 'Multi Org A'),
  ('00000000-0000-0000-0000-000000024014', '00000000-0000-0000-0000-00000002440b',
   '00000000-0000-0000-0000-000000024003', 'assistant', 'Multi Org B');

-- ── Scenario: A member renames themselves ──────────────────────────────────

select pg_temp.login('00000000-0000-0000-0000-000000024002', 'assistant-self-a@kamay.test');

select lives_ok(
  $$ select set_my_display_name('00000000-0000-0000-0000-00000002440a', 'Ayudante Nuevo') $$,
  'set_my_display_name: el ayudante se renombra a sí mismo sin error');

select pg_temp.logout();

select is(
  (select display_name from memberships where id = '00000000-0000-0000-0000-000000024012'),
  'Ayudante Nuevo', 'set_my_display_name: el nombre visible queda actualizado');

-- ── Scenario: A member cannot change their own role this way ──────────────
-- La función no recibe `role` ni `archived_at` como argumento: no hay forma
-- de que la llamada los toque, y estas dos comprobaciones lo dejan explícito.

select is(
  (select role from memberships where id = '00000000-0000-0000-0000-000000024012'),
  'assistant', 'set_my_display_name: el rol no cambia');

select is(
  (select archived_at from memberships where id = '00000000-0000-0000-0000-000000024012'),
  null, 'set_my_display_name: archived_at no cambia');

-- ── Scenario: A member cannot rename someone else ──────────────────────────
-- La función solo puede tocar la fila de `auth.uid()`: no admite un id de
-- membresía ajeno como argumento. Esto se comprueba por omisión: el nombre
-- de la dueña de la misma organización queda intacto tras la llamada anterior.

select is(
  (select display_name from memberships where id = '00000000-0000-0000-0000-000000024011'),
  'Dueña A', 'set_my_display_name: el nombre de otro miembro no cambia');

-- ── Scenario: The change does not cross organizations ──────────────────────

select pg_temp.login('00000000-0000-0000-0000-000000024003', 'multi-org-self@kamay.test');

select set_my_display_name('00000000-0000-0000-0000-00000002440a', 'Multi Org A renombrado');

select pg_temp.logout();

select is(
  (select display_name from memberships where id = '00000000-0000-0000-0000-000000024013'),
  'Multi Org A renombrado',
  'set_my_display_name: la membresía de la organización activa se actualiza');

select is(
  (select display_name from memberships where id = '00000000-0000-0000-0000-000000024014'),
  'Multi Org B',
  'set_my_display_name: la membresía de la otra organización no cambia');

-- ── Scenario: Renaming oneself is logged ────────────────────────────────────

select is(
  (select count(*)::int from activity_log
    where table_name = 'memberships'
      and record_id = '00000000-0000-0000-0000-000000024013'
      and action = 'updated'
      and changes->'display_name'->>'despues' = 'Multi Org A renombrado'),
  1, 'set_my_display_name: el cambio queda en la bitácora con el nombre nuevo');

select is(
  (select actor_id from activity_log
    where table_name = 'memberships'
      and record_id = '00000000-0000-0000-0000-000000024013'
      and action = 'updated'),
  '00000000-0000-0000-0000-000000024003'::uuid,
  'set_my_display_name: el autor registrado es quien se renombró');

-- ── Rechazo: sin membresía activa en esa organización ───────────────────────

select pg_temp.login('00000000-0000-0000-0000-000000024002', 'assistant-self-a@kamay.test');

select throws_ok(
  $$ select set_my_display_name('00000000-0000-0000-0000-00000002440b', 'Intento cruzado') $$,
  '23514', null,
  'set_my_display_name: rechaza cuando no hay membresía activa en esa organización');

-- ── La política UPDATE directa sigue restringida al dueño ───────────────────
-- RLS no lanza excepción cuando la fila no pasa el `using`: el UPDATE
-- simplemente no alcanza ninguna fila. Por eso se comprueba por el resultado,
-- no con `throws_ok`.

update memberships set display_name = 'Directo'
  where id = '00000000-0000-0000-0000-000000024012';

select is(
  (select display_name from memberships
    where id = '00000000-0000-0000-0000-000000024012'),
  'Ayudante Nuevo',
  'memberships: el UPDATE directo no alcanza la propia fila, ni siquiera solo display_name');

select pg_temp.logout();

select * from finish();

rollback;
