-- KAM-15 · tags: unicidad por organización y búsqueda tolerante a tildes.
-- Escenarios del delta spec `tasks` — requisito "Etiquetas por organización
-- creadas al vuelo" → «La misma etiqueta no se duplica», «Etiquetas de otra
-- organización», «Búsqueda tolerante a tildes».
begin;

set search_path to public, extensions;

select plan(7);

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-000000015b01', 'Etiquetas A'),
  ('00000000-0000-0000-0000-000000015b02', 'Etiquetas B');

insert into tags (id, organization_id, name) values
  ('00000000-0000-0000-0000-00000015b101', '00000000-0000-0000-0000-000000015b01', 'Hornada-07'),
  ('00000000-0000-0000-0000-00000015b102', '00000000-0000-0000-0000-000000015b01', 'Feria de Agosto');

-- ── Scenario: La misma etiqueta no se duplica ─────────────────────────────

select throws_ok(
  $$ insert into tags (organization_id, name)
     values ('00000000-0000-0000-0000-000000015b01', 'Hornada-07') $$,
  '23505', null, 'tags: el mismo nombre no se repite dentro de la organización');

-- ── Scenario: Etiquetas de otra organización ──────────────────────────────
-- El mismo nombre en otra organización es otra etiqueta: la unicidad es por
-- organización, no global.

select lives_ok(
  $$ insert into tags (organization_id, name)
     values ('00000000-0000-0000-0000-000000015b02', 'Hornada-07') $$,
  'tags: el mismo nombre en otra organización se acepta');

-- ── Scenario: Búsqueda tolerante a tildes ─────────────────────────────────
-- `search_name` es generada: quien escribe "agosto" sin tilde y en minúscula
-- encuentra "Feria de Agosto" sin que ningún servicio normalice por su cuenta.

select is(
  (select search_name from tags where id = '00000000-0000-0000-0000-00000015b102'),
  'feria de agosto', 'tags: search_name normaliza mayúsculas');

insert into tags (id, organization_id, name) values
  ('00000000-0000-0000-0000-00000015b103', '00000000-0000-0000-0000-000000015b01', 'Sublimación');

select is(
  (select search_name from tags where id = '00000000-0000-0000-0000-00000015b103'),
  'sublimacion', 'tags: search_name quita las tildes');

select is(
  (select count(*)::int from tags
   where organization_id = '00000000-0000-0000-0000-000000015b01'
     and search_name like '%sublimacion%'),
  1, 'tags: buscar "sublimacion" sin tilde encuentra "Sublimación"');

-- `search_name` es derivada y se recalcula sola: no es un dato que nadie
-- escriba a mano (convención nº 4).
update tags set name = 'Sublimación Textil'
where id = '00000000-0000-0000-0000-00000015b103';

select is(
  (select search_name from tags where id = '00000000-0000-0000-0000-00000015b103'),
  'sublimacion textil', 'tags: renombrar recalcula search_name sin tocarlo');

select is(
  (select count(*)::int from information_schema.columns
   where table_schema = 'public' and table_name = 'tags'
     and column_name = 'search_name' and is_generated = 'ALWAYS'),
  1, 'tags: search_name está declarada como columna generada');

select * from finish();
rollback;
