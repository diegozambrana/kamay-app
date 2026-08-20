-- KAM-04 · org-configuration: la configuración la lee todo miembro y la escribe
-- solo el dueño. Escenarios del delta spec `org-configuration`:
-- "Only the owner writes configuration; every member reads it" y los dos
-- escenarios de bitácora de "Configuration tables exist…".
begin;

set search_path to public, extensions;

select plan(29);

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

-- ── Semilla (como postgres, sin RLS) ──────────────────────────────────────

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000004a1', 'owner-cfg-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000004a2', 'assistant-cfg-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000004b1', 'owner-cfg-b@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-00000000004a', 'Config A'),
  ('00000000-0000-0000-0000-00000000004b', 'Config B');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000004a', '00000000-0000-0000-0000-0000000004a1', 'owner'),
  ('00000000-0000-0000-0000-00000000004a', '00000000-0000-0000-0000-0000000004a2', 'assistant'),
  ('00000000-0000-0000-0000-00000000004b', '00000000-0000-0000-0000-0000000004b1', 'owner');

insert into business_lines (id, organization_id, name, color) values
  ('00000000-0000-0000-0000-00000000041a', '00000000-0000-0000-0000-00000000004a', 'Sublimación', 'blue'),
  ('00000000-0000-0000-0000-00000000041b', '00000000-0000-0000-0000-00000000004b', 'Línea de B', 'violet');

insert into sales_channels (id, organization_id, name) values
  ('00000000-0000-0000-0000-00000000042a', '00000000-0000-0000-0000-00000000004a', 'Feria'),
  ('00000000-0000-0000-0000-00000000042b', '00000000-0000-0000-0000-00000000004b', 'Canal de B');

insert into expense_categories (id, organization_id, name) values
  ('00000000-0000-0000-0000-00000000043a', '00000000-0000-0000-0000-00000000004a', 'Insumos'),
  ('00000000-0000-0000-0000-00000000043b', '00000000-0000-0000-0000-00000000004b', 'Categoría de B');

insert into units (id, organization_id, code, name) values
  ('00000000-0000-0000-0000-00000000044a', '00000000-0000-0000-0000-00000000004a', 'u', 'Unidad'),
  ('00000000-0000-0000-0000-00000000044b', '00000000-0000-0000-0000-00000000004b', 'kg', 'Kilogramo');

-- ── Scenario: Assistant reads configuration ───────────────────────────────

select pg_temp.login('00000000-0000-0000-0000-0000000004a2');

select is((select count(*)::int from business_lines), 1,
  'business_lines: el ayudante lee la configuración de su organización');
select is((select count(*)::int from sales_channels), 1,
  'sales_channels: el ayudante lee la configuración de su organización');
select is((select count(*)::int from expense_categories), 1,
  'expense_categories: el ayudante lee la configuración de su organización');
select is((select count(*)::int from units), 1,
  'units: el ayudante lee la configuración de su organización');

-- ── Scenario: Assistant cannot write configuration ────────────────────────

select throws_ok(
  $$ insert into business_lines (organization_id, name)
     values ('00000000-0000-0000-0000-00000000004a', 'Alfarería') $$,
  '42501', null, 'business_lines: el ayudante no puede crear');
select throws_ok(
  $$ insert into sales_channels (organization_id, name)
     values ('00000000-0000-0000-0000-00000000004a', 'Redes') $$,
  '42501', null, 'sales_channels: el ayudante no puede crear');
select throws_ok(
  $$ insert into expense_categories (organization_id, name)
     values ('00000000-0000-0000-0000-00000000004a', 'Servicios') $$,
  '42501', null, 'expense_categories: el ayudante no puede crear');
select throws_ok(
  $$ insert into units (organization_id, code, name)
     values ('00000000-0000-0000-0000-00000000004a', 'm', 'Metro') $$,
  '42501', null, 'units: el ayudante no puede crear');

-- El UPDATE no lanza error: la política de escritura simplemente no le muestra
-- ninguna fila, así que afecta cero filas.
update business_lines set name = 'tocada por ayudante';
update sales_channels set name = 'tocado por ayudante';
update expense_categories set name = 'tocada por ayudante';
update units set name = 'tocada por ayudante';

select pg_temp.logout();

select is(
  (select name from business_lines where id = '00000000-0000-0000-0000-00000000041a'),
  'Sublimación', 'business_lines: el ayudante no puede editar');
select is(
  (select name from sales_channels where id = '00000000-0000-0000-0000-00000000042a'),
  'Feria', 'sales_channels: el ayudante no puede editar');
select is(
  (select name from expense_categories where id = '00000000-0000-0000-0000-00000000043a'),
  'Insumos', 'expense_categories: el ayudante no puede editar');
select is(
  (select name from units where id = '00000000-0000-0000-0000-00000000044a'),
  'Unidad', 'units: el ayudante no puede editar');

-- ── Scenario: Configuration of another organization is invisible ──────────

select pg_temp.login('00000000-0000-0000-0000-0000000004a1');

select is(
  (select count(*)::int from business_lines
    where organization_id = '00000000-0000-0000-0000-00000000004b'),
  0, 'business_lines: cero filas de la otra organización');
select is(
  (select count(*)::int from sales_channels
    where organization_id = '00000000-0000-0000-0000-00000000004b'),
  0, 'sales_channels: cero filas de la otra organización');
select is(
  (select count(*)::int from expense_categories
    where organization_id = '00000000-0000-0000-0000-00000000004b'),
  0, 'expense_categories: cero filas de la otra organización');
select is(
  (select count(*)::int from units
    where organization_id = '00000000-0000-0000-0000-00000000004b'),
  0, 'units: cero filas de la otra organización');

-- ── Scenario: No one can delete configuration ─────────────────────────────
-- Ni siquiera el dueño: el privilegio de DELETE no se concede a nadie.

select throws_ok(
  $$ delete from business_lines $$, '42501', null,
  'business_lines: el dueño tampoco puede borrar');
select throws_ok(
  $$ delete from sales_channels $$, '42501', null,
  'sales_channels: el dueño tampoco puede borrar');
select throws_ok(
  $$ delete from expense_categories $$, '42501', null,
  'expense_categories: el dueño tampoco puede borrar');
select throws_ok(
  $$ delete from units $$, '42501', null,
  'units: el dueño tampoco puede borrar');

-- ── El dueño sí escribe ───────────────────────────────────────────────────

select lives_ok(
  $$ insert into business_lines (id, organization_id, name, color)
     values ('00000000-0000-0000-0000-0000000041aa',
             '00000000-0000-0000-0000-00000000004a', 'Impresión 3D', 'violet') $$,
  'business_lines: el dueño crea en su organización');
select lives_ok(
  $$ insert into sales_channels (id, organization_id, name)
     values ('00000000-0000-0000-0000-0000000042aa',
             '00000000-0000-0000-0000-00000000004a', 'Mostrador') $$,
  'sales_channels: el dueño crea en su organización');
select lives_ok(
  $$ insert into expense_categories (id, organization_id, name)
     values ('00000000-0000-0000-0000-0000000043aa',
             '00000000-0000-0000-0000-00000000004a', 'Transporte') $$,
  'expense_categories: el dueño crea en su organización');
select lives_ok(
  $$ insert into units (id, organization_id, code, name)
     values ('00000000-0000-0000-0000-0000000044aa',
             '00000000-0000-0000-0000-00000000004a', 'kg', 'Kilogramo') $$,
  'units: el dueño crea en su organización');

-- ── Scenario: Creating a configuration row is logged ──────────────────────
-- Assert obligatorio del procedimiento de auditoría (supabase/README.md).

-- Archivar antes de salir del rol: la acción queda registrada como `archived`.
update business_lines set archived_at = now()
  where id = '00000000-0000-0000-0000-0000000041aa';

select pg_temp.logout();

select is(
  (select count(*)::int from activity_log
    where table_name = 'business_lines'
      and record_id = '00000000-0000-0000-0000-0000000041aa'
      and action = 'created'
      and actor_id = '00000000-0000-0000-0000-0000000004a1'),
  1, 'business_lines: el INSERT queda registrado con su autor');
select is(
  (select count(*)::int from activity_log
    where table_name = 'sales_channels'
      and record_id = '00000000-0000-0000-0000-0000000042aa'
      and action = 'created'),
  1, 'sales_channels: el INSERT queda registrado en la bitácora');
select is(
  (select count(*)::int from activity_log
    where table_name = 'expense_categories'
      and record_id = '00000000-0000-0000-0000-0000000043aa'
      and action = 'created'),
  1, 'expense_categories: el INSERT queda registrado en la bitácora');
select is(
  (select count(*)::int from activity_log
    where table_name = 'units'
      and record_id = '00000000-0000-0000-0000-0000000044aa'
      and action = 'created'),
  1, 'units: el INSERT queda registrado en la bitácora');

-- Scenario: Archiving is logged as archived
select is(
  (select count(*)::int from activity_log
    where table_name = 'business_lines'
      and record_id = '00000000-0000-0000-0000-0000000041aa'
      and action = 'archived'),
  1, 'business_lines: archivar se registra como `archived`, no como `updated`');

select * from finish();

rollback;
