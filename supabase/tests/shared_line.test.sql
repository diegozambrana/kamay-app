-- KAM-04 · org-configuration: el invariante de la línea compartida y la
-- unicidad de nombres por organización. Escenarios del delta spec
-- `org-configuration`: "Exactly one shared business line exists and cannot be
-- archived" y los dos escenarios de unicidad de "Configuration tables exist…".
begin;

set search_path to public, extensions;

select plan(8);

-- ── Semilla (como postgres: el invariante no depende de RLS) ──────────────

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-00000000005a', 'Compartida A'),
  ('00000000-0000-0000-0000-00000000005b', 'Compartida B');

insert into business_lines (id, organization_id, name, color, is_shared) values
  ('00000000-0000-0000-0000-00000000051a', '00000000-0000-0000-0000-00000000005a',
   'General', 'zinc', true),
  ('00000000-0000-0000-0000-00000000052a', '00000000-0000-0000-0000-00000000005a',
   'Sublimación', 'blue', false);

-- ── Scenario: A second shared line is rejected ────────────────────────────

select throws_ok(
  $$ insert into business_lines (organization_id, name, is_shared)
     values ('00000000-0000-0000-0000-00000000005a', 'General 2', true) $$,
  '23505', null,
  'business_lines: una segunda línea compartida activa es rechazada');

select lives_ok(
  $$ insert into business_lines (organization_id, name, is_shared)
     values ('00000000-0000-0000-0000-00000000005b', 'General', true) $$,
  'business_lines: cada organización tiene su propia línea compartida');

-- ── Scenario: The shared line cannot be archived ──────────────────────────

select throws_ok(
  $$ update business_lines set archived_at = now()
     where id = '00000000-0000-0000-0000-00000000051a' $$,
  '23514', null,
  'business_lines: archivar la línea compartida es rechazado');

select is(
  (select archived_at from business_lines
    where id = '00000000-0000-0000-0000-00000000051a'),
  null, 'business_lines: la línea compartida sigue activa');

-- La bandera es inmutable en ambos sentidos: ni se cede ni se toma.
select throws_ok(
  $$ update business_lines set is_shared = false
     where id = '00000000-0000-0000-0000-00000000051a' $$,
  '23514', null,
  'business_lines: la línea compartida no puede dejar de serlo');

select throws_ok(
  $$ update business_lines set is_shared = true
     where id = '00000000-0000-0000-0000-00000000052a' $$,
  '23514', null,
  'business_lines: otra línea no puede pasar a ser la compartida');

-- ── Unicidad de nombre por organización ───────────────────────────────────

-- Scenario: Duplicate name in the same organization is rejected
select throws_ok(
  $$ insert into business_lines (organization_id, name)
     values ('00000000-0000-0000-0000-00000000005a', 'Sublimación') $$,
  '23505', null,
  'business_lines: nombre duplicado en la misma organización es rechazado');

-- Scenario: The same name is allowed in a different organization
select lives_ok(
  $$ insert into business_lines (organization_id, name)
     values ('00000000-0000-0000-0000-00000000005b', 'Sublimación') $$,
  'business_lines: el mismo nombre en otra organización es válido');

select * from finish();

rollback;
