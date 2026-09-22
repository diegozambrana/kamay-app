-- Cambio `catalog-custom-attributes`: la tabla de atributos de categoría, su
-- RLS, sus inmutables y la forma de los valores en `items` e `item_variants`.
-- Escenarios de los deltas `org-configuration` y `catalog-directory`.
begin;

set search_path to public, extensions;

select plan(32);

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
  ('00000000-0000-0000-0000-0000000ce0a1', 'owner-attr-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000ce0a2', 'assistant-attr-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000ce0b1', 'owner-attr-b@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-0000000ce00a', 'Atributos A'),
  ('00000000-0000-0000-0000-0000000ce00b', 'Atributos B');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000ce00a', '00000000-0000-0000-0000-0000000ce0a1', 'owner'),
  ('00000000-0000-0000-0000-0000000ce00a', '00000000-0000-0000-0000-0000000ce0a2', 'assistant'),
  ('00000000-0000-0000-0000-0000000ce00b', '00000000-0000-0000-0000-0000000ce0b1', 'owner');

insert into item_categories (id, organization_id, kind, name) values
  ('00000000-0000-0000-0000-0000000ce1a1', '00000000-0000-0000-0000-0000000ce00a', 'supply',  'Filamento'),
  ('00000000-0000-0000-0000-0000000ce1a2', '00000000-0000-0000-0000-0000000ce00a', 'product', 'Vajilla'),
  ('00000000-0000-0000-0000-0000000ce1b1', '00000000-0000-0000-0000-0000000ce00b', 'supply',  'Filamento de B');

insert into items (id, organization_id, kind, name) values
  ('00000000-0000-0000-0000-0000000ce3a1', '00000000-0000-0000-0000-0000000ce00a', 'supply', 'PLA Sunlu');

insert into item_variants (id, organization_id, item_id, name) values
  ('00000000-0000-0000-0000-0000000ce4a1', '00000000-0000-0000-0000-0000000ce00a', '00000000-0000-0000-0000-0000000ce3a1', 'Negro');

-- ── Forma ─────────────────────────────────────────────────────────────────

select has_table('public', 'item_category_attributes',
  'item_category_attributes: la tabla existe');

select throws_ok(
  $$ insert into item_category_attributes (organization_id, category_id, name, type, scope, position)
     values ('00000000-0000-0000-0000-0000000ce00a', '00000000-0000-0000-0000-0000000ce1a1', 'Fecha', 'date', 'item', 1) $$,
  '23514', null, 'An attribute outside the allowed types or scopes is rejected: tipo fuera del juego');

select throws_ok(
  $$ insert into item_category_attributes (organization_id, category_id, name, type, scope, position)
     values ('00000000-0000-0000-0000-0000000ce00a', '00000000-0000-0000-0000-0000000ce1a1', 'Marca', 'text', 'order', 1) $$,
  '23514', null, 'An attribute outside the allowed types or scopes is rejected: alcance fuera del juego');

select lives_ok(
  $$ insert into item_category_attributes (id, organization_id, category_id, name, type, options, required, scope, position)
     values ('00000000-0000-0000-0000-0000000ce2a1', '00000000-0000-0000-0000-0000000ce00a', '00000000-0000-0000-0000-0000000ce1a1',
             'Color', 'list', '["Negro","Rojo"]', true, 'variant', 1) $$,
  'item_category_attributes: «Color» como lista de variante en «Filamento»');

select throws_ok(
  $$ insert into item_category_attributes (organization_id, category_id, name, type, scope, position)
     values ('00000000-0000-0000-0000-0000000ce00a', '00000000-0000-0000-0000-0000000ce1a1', 'color', 'text', 'item', 2) $$,
  '23505', null, 'An attribute name differing only in case is rejected');

select lives_ok(
  $$ insert into item_category_attributes (organization_id, category_id, name, type, options, scope, position)
     values ('00000000-0000-0000-0000-0000000ce00a', '00000000-0000-0000-0000-0000000ce1a2', 'Color', 'list', '["Blanco"]', 'variant', 1) $$,
  'The same attribute name in two categories');

select throws_ok(
  $$ insert into item_category_attributes (organization_id, category_id, name, type, options, scope, position)
     values ('00000000-0000-0000-0000-0000000ce00a', '00000000-0000-0000-0000-0000000ce1a1', 'Acabado', 'list', '[]', 'item', 2) $$,
  '23514', null, 'A list attribute needs its options: una lista sin opciones se rechaza');

select throws_ok(
  $$ insert into item_category_attributes (organization_id, category_id, name, type, options, scope, position)
     values ('00000000-0000-0000-0000-0000000ce00a', '00000000-0000-0000-0000-0000000ce1a1', 'Acabado', 'list', '[1, 2]', 'item', 2) $$,
  '23514', null, 'item_category_attributes: las opciones son textos');

select throws_ok(
  $$ insert into item_category_attributes (organization_id, category_id, name, type, options, scope, position)
     values ('00000000-0000-0000-0000-0000000ce00a', '00000000-0000-0000-0000-0000000ce1a1', 'Marca', 'text', '["Sunlu"]', 'item', 2) $$,
  '23514', null, 'item_category_attributes: un texto no lleva opciones');

select throws_ok(
  $$ insert into item_category_attributes (organization_id, category_id, name, type, unit, scope, position)
     values ('00000000-0000-0000-0000-0000000ce00a', '00000000-0000-0000-0000-0000000ce1a1', 'Marca', 'text', 'kg', 'item', 2) $$,
  '23514', null, 'item_category_attributes: la unidad es solo para números');

select throws_ok(
  $$ insert into item_category_attributes (organization_id, category_id, name, type, scope, position)
     values ('00000000-0000-0000-0000-0000000ce00a', '00000000-0000-0000-0000-0000000ce1b1', 'Marca', 'text', 'item', 1) $$,
  '23503', null, 'An attribute cannot belong to a category of another organization');

-- ── Tipo color (20260922100000, design D11) ──────────────────────────────

select lives_ok(
  $$ insert into item_category_attributes (organization_id, category_id, name, type, scope, position)
     values ('00000000-0000-0000-0000-0000000ce00a', '00000000-0000-0000-0000-0000000ce1a1', 'Tono del rollo', 'color', 'variant', 3) $$,
  'A color attribute: un atributo de color sin unidad ni opciones se acepta');

select throws_ok(
  $$ insert into item_category_attributes (organization_id, category_id, name, type, options, scope, position)
     values ('00000000-0000-0000-0000-0000000ce00a', '00000000-0000-0000-0000-0000000ce1a1', 'Tono', 'color', '["#000000"]', 'variant', 4) $$,
  '23514', null, 'item_category_attributes: un color no lleva opciones');

select throws_ok(
  $$ insert into item_category_attributes (organization_id, category_id, name, type, unit, scope, position)
     values ('00000000-0000-0000-0000-0000000ce00a', '00000000-0000-0000-0000-0000000ce1a1', 'Tono', 'color', 'hex', 'variant', 4) $$,
  '23514', null, 'item_category_attributes: un color no lleva unidad');

-- ── Tipo, alcance y categoría no cambian ──────────────────────────────────

select throws_ok(
  $$ update item_category_attributes set type = 'text', options = '[]'
     where id = '00000000-0000-0000-0000-0000000ce2a1' $$,
  '23514', null, 'Type and scope cannot change: el tipo');

select throws_ok(
  $$ update item_category_attributes set scope = 'item'
     where id = '00000000-0000-0000-0000-0000000ce2a1' $$,
  '23514', null, 'Type and scope cannot change: el alcance');

select throws_ok(
  $$ update item_category_attributes set category_id = '00000000-0000-0000-0000-0000000ce1a2'
     where id = '00000000-0000-0000-0000-0000000ce2a1' $$,
  '23514', null, 'Type and scope cannot change: la categoría');

select lives_ok(
  $$ update item_category_attributes set name = 'Color de rollo', options = '["Negro","Rojo","Azul"]'
     where id = '00000000-0000-0000-0000-0000000ce2a1' $$,
  'item_category_attributes: renombrar y cambiar opciones sí se permite');

-- ── RLS y privilegios ─────────────────────────────────────────────────────

select pg_temp.login('00000000-0000-0000-0000-0000000ce0a2');

select is(
  (select count(*)::int from item_category_attributes
    where organization_id = '00000000-0000-0000-0000-0000000ce00a'),
  3, 'Assistant reads configuration: el ayudante lee los atributos de su organización');

select throws_ok(
  $$ insert into item_category_attributes (organization_id, category_id, name, type, scope, position)
     values ('00000000-0000-0000-0000-0000000ce00a', '00000000-0000-0000-0000-0000000ce1a1', 'Del ayudante', 'text', 'item', 9) $$,
  '42501', null, 'The assistant cannot define attributes: no inserta');

update item_category_attributes set archived_at = now()
  where id = '00000000-0000-0000-0000-0000000ce2a1';

select pg_temp.logout();

select is(
  (select archived_at from item_category_attributes where id = '00000000-0000-0000-0000-0000000ce2a1'),
  null, 'Assistant cannot write configuration: el ayudante no archiva (RLS deja la fila intacta)');

select pg_temp.login('00000000-0000-0000-0000-0000000ce0b1');

select is(
  (select count(*)::int from item_category_attributes
    where organization_id = '00000000-0000-0000-0000-0000000ce00a'),
  0, 'Definitions of another organization are invisible');

select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000ce0a1');

select throws_ok(
  $$ delete from item_category_attributes where id = '00000000-0000-0000-0000-0000000ce2a1' $$,
  '42501', null, 'No one can delete configuration: tampoco la dueña borra atributos');

-- ── El alta queda en la bitácora con su autoría ───────────────────────────

insert into item_category_attributes (id, organization_id, category_id, name, type, unit, scope, position)
  values ('00000000-0000-0000-0000-0000000ce2a2', '00000000-0000-0000-0000-0000000ce00a',
          '00000000-0000-0000-0000-0000000ce1a1', 'Temperatura mínima', 'number', '°C', 'item', 2);

select pg_temp.logout();

select is(
  (select count(*)::int from activity_log
    where table_name = 'item_category_attributes'
      and record_id = '00000000-0000-0000-0000-0000000ce2a2'
      and action = 'created'
      and actor_id = '00000000-0000-0000-0000-0000000ce0a1'),
  1, 'Creating a configuration row is logged: el alta de un atributo queda a nombre de la dueña');

-- ── Los valores ───────────────────────────────────────────────────────────

select col_not_null('public', 'items', 'attributes',
  'items.attributes: no admite nulos');

select col_default_is('public', 'items', 'attributes', '{}'::jsonb,
  'Los ítems existentes quedan con atributos vacíos: el valor por omisión es un objeto vacío');

select is(
  (select count(*)::int from items where jsonb_typeof(attributes) <> 'object'),
  0, 'Los ítems existentes quedan con atributos vacíos: ningún ítem queda sin objeto');

select throws_ok(
  $$ update items set attributes = '[]' where id = '00000000-0000-0000-0000-0000000ce3a1' $$,
  '23514', null, 'Los atributos no admiten algo que no sea un objeto: arreglo en items');

select throws_ok(
  $$ update items set attributes = '"Sunlu"' where id = '00000000-0000-0000-0000-0000000ce3a1' $$,
  '23514', null, 'Los atributos no admiten algo que no sea un objeto: texto en items');

select throws_ok(
  $$ update item_variants set attributes = '[]' where id = '00000000-0000-0000-0000-0000000ce4a1' $$,
  '23514', null, 'Los atributos no admiten algo que no sea un objeto: arreglo en item_variants');

select throws_ok(
  $$ update item_variants set attributes = null where id = '00000000-0000-0000-0000-0000000ce4a1' $$,
  '23502', null, 'Los atributos no admiten algo que no sea un objeto: nulo en item_variants');

-- ── El saldo por variante no recorre todos los movimientos ───────────────
-- (20260921110000). Que la vista dé las mismas cifras lo vigila
-- derived_values.test.sql; aquí, que el índice exista.

select has_index('public', 'inventory_movements', 'inventory_movements_variant_idx',
  'inventory_movements: índice parcial por variante para el saldo por variante');

select * from finish();
rollback;
