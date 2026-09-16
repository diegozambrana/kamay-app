-- Cambio `item-categories`: la tabla de categorías de ítem, la clave compuesta
-- de `items`, su RLS y la conversión desde el texto libre.
-- Escenarios de los deltas `org-configuration` y `catalog-directory`.
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

-- ── Semilla propia (como postgres, sin RLS) ───────────────────────────────
-- A: la organización principal. B: la ajena. C: solo para la conversión, así
-- se cuentan exactamente las categorías que crea.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000ca0a1', 'owner-icat-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000ca0a2', 'assistant-icat-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000ca0b1', 'owner-icat-b@kamay.test'),
  ('00000000-0000-0000-0000-0000000ca0c1', 'owner-icat-c@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-0000000ca00a', 'Categorías A'),
  ('00000000-0000-0000-0000-0000000ca00b', 'Categorías B'),
  ('00000000-0000-0000-0000-0000000ca00c', 'Categorías C');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000ca00a', '00000000-0000-0000-0000-0000000ca0a1', 'owner'),
  ('00000000-0000-0000-0000-0000000ca00a', '00000000-0000-0000-0000-0000000ca0a2', 'assistant'),
  ('00000000-0000-0000-0000-0000000ca00b', '00000000-0000-0000-0000-0000000ca0b1', 'owner'),
  ('00000000-0000-0000-0000-0000000ca00c', '00000000-0000-0000-0000-0000000ca0c1', 'owner');

insert into items (id, organization_id, kind, name) values
  ('00000000-0000-0000-0000-0000000ca1a1', '00000000-0000-0000-0000-0000000ca00a', 'supply',  'Taza para sublimación'),
  ('00000000-0000-0000-0000-0000000ca1a2', '00000000-0000-0000-0000-0000000ca00a', 'product', 'Taza personalizada');

insert into item_categories (id, organization_id, kind, name) values
  ('00000000-0000-0000-0000-0000000ca2b1', '00000000-0000-0000-0000-0000000ca00b', 'supply', 'Sustratos de B');

-- ── La categoría ya no es texto libre ─────────────────────────────────────

select has_column('public', 'items', 'category_id',
  'items: la categoría es una referencia (category_id)');
select hasnt_column('public', 'items', 'category',
  'items: ya no hay categoría en texto libre');

-- ── Forma de item_categories ──────────────────────────────────────────────

select throws_ok(
  $$ insert into item_categories (organization_id, kind, name)
     values ('00000000-0000-0000-0000-0000000ca00a', 'machine', 'Fuera del juego') $$,
  '23514', null, 'item_categories: un kind fuera de supply/product/asset se rechaza');

select lives_ok(
  $$ insert into item_categories (id, organization_id, kind, name)
     values ('00000000-0000-0000-0000-0000000ca2a1', '00000000-0000-0000-0000-0000000ca00a', 'supply', 'Sustratos') $$,
  'item_categories: la dueña define «Sustratos» para insumos');

select throws_ok(
  $$ insert into item_categories (organization_id, kind, name)
     values ('00000000-0000-0000-0000-0000000ca00a', 'supply', 'sustratos') $$,
  '23505', null, 'item_categories: el mismo nombre en el mismo tipo, en minúsculas, se rechaza');

select throws_ok(
  $$ insert into item_categories (organization_id, kind, name)
     values ('00000000-0000-0000-0000-0000000ca00a', 'supply', 'Tintas ') $$,
  '23514', null, 'item_categories: un nombre con espacios al borde se rechaza');

select lives_ok(
  $$ insert into item_categories (id, organization_id, kind, name)
     values ('00000000-0000-0000-0000-0000000ca2a2', '00000000-0000-0000-0000-0000000ca00a', 'product', 'Sustratos') $$,
  'item_categories: el mismo nombre en otro tipo se acepta');

-- ── La clave compuesta de items ───────────────────────────────────────────

select throws_ok(
  $$ update items set category_id = '00000000-0000-0000-0000-0000000ca2a2'
     where id = '00000000-0000-0000-0000-0000000ca1a1' $$,
  '23503', null, 'items: un insumo no apunta a una categoría de producto');

select throws_ok(
  $$ update items set category_id = '00000000-0000-0000-0000-0000000ca2b1'
     where id = '00000000-0000-0000-0000-0000000ca1a1' $$,
  '23503', null, 'items: un ítem no apunta a una categoría de otra organización');

select lives_ok(
  $$ update items set category_id = '00000000-0000-0000-0000-0000000ca2a1'
     where id = '00000000-0000-0000-0000-0000000ca1a1' $$,
  'items: un insumo apunta a una categoría de insumo de su organización');

select lives_ok(
  $$ update items set category_id = null
     where id = '00000000-0000-0000-0000-0000000ca1a1' $$,
  'items: «Sin categoría» es un valor válido');

-- ── RLS y privilegios ─────────────────────────────────────────────────────

select pg_temp.login('00000000-0000-0000-0000-0000000ca0a2');

select is(
  (select count(*)::int from item_categories
    where organization_id = '00000000-0000-0000-0000-0000000ca00a'),
  2, 'el ayudante lee las categorías de su organización');

select throws_ok(
  $$ insert into item_categories (organization_id, kind, name)
     values ('00000000-0000-0000-0000-0000000ca00a', 'supply', 'Del ayudante') $$,
  '42501', null, 'el ayudante no crea categorías');

update item_categories set name = 'Renombrada por el ayudante'
  where id = '00000000-0000-0000-0000-0000000ca2a1';

select pg_temp.logout();

select is(
  (select name from item_categories where id = '00000000-0000-0000-0000-0000000ca2a1'),
  'Sustratos', 'el ayudante no edita categorías (RLS deja la fila intacta)');

select pg_temp.login('00000000-0000-0000-0000-0000000ca0b1');

select is(
  (select count(*)::int from item_categories
    where organization_id = '00000000-0000-0000-0000-0000000ca00a'),
  0, 'otra organización no ve las categorías de A');

select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000ca0a1');

select throws_ok(
  $$ delete from item_categories where id = '00000000-0000-0000-0000-0000000ca2a1' $$,
  '42501', null, 'nadie borra categorías, tampoco la dueña');

-- ── El alta queda en la bitácora con su autoría ───────────────────────────

insert into item_categories (id, organization_id, kind, name)
  values ('00000000-0000-0000-0000-0000000ca2a3', '00000000-0000-0000-0000-0000000ca00a', 'asset', 'Maquinaria');

select pg_temp.logout();

select is(
  (select count(*)::int from activity_log
    where table_name = 'item_categories'
      and record_id = '00000000-0000-0000-0000-0000000ca2a3'
      and action = 'created'
      and actor_id = '00000000-0000-0000-0000-0000000ca0a1'),
  1, 'item_categories: el alta de la dueña queda en la bitácora a su nombre');

-- ── La conversión desde el texto libre ────────────────────────────────────
-- Los ítems de C los crea su dueña, así su alta queda en la bitácora y se
-- puede comprobar que la conversión no añade nada más.

select pg_temp.login('00000000-0000-0000-0000-0000000ca0c1');

insert into items (id, organization_id, kind, name) values
  ('00000000-0000-0000-0000-0000000ca1c1', '00000000-0000-0000-0000-0000000ca00c', 'supply',  'Taza blanca'),
  ('00000000-0000-0000-0000-0000000ca1c2', '00000000-0000-0000-0000-0000000ca00c', 'supply',  'Taza mágica'),
  ('00000000-0000-0000-0000-0000000ca1c3', '00000000-0000-0000-0000-0000000ca00c', 'supply',  'Caja de cartón'),
  ('00000000-0000-0000-0000-0000000ca1c4', '00000000-0000-0000-0000-0000000ca00c', 'supply',  'Tinta cian'),
  ('00000000-0000-0000-0000-0000000ca1c5', '00000000-0000-0000-0000-0000000ca00c', 'supply',  'Tinta magenta'),
  ('00000000-0000-0000-0000-0000000ca1c6', '00000000-0000-0000-0000-0000000ca00c', 'supply',  'Tinta amarilla'),
  ('00000000-0000-0000-0000-0000000ca1c7', '00000000-0000-0000-0000-0000000ca00c', 'product', 'Bolsa de regalo'),
  ('00000000-0000-0000-0000-0000000ca1c8', '00000000-0000-0000-0000-0000000ca00c', 'supply',  'Cinta');

-- La taza mágica está archivada: también debe quedar enlazada.
update items set archived_at = now()
  where id = '00000000-0000-0000-0000-0000000ca1c2';

select pg_temp.logout();

create temp table conversion_log_before as
  select count(*)::int as events from activity_log
  where table_name = 'items'
    and organization_id = '00000000-0000-0000-0000-0000000ca00c';

select is(
  backfill_item_categories($$[
    {"item_id": "00000000-0000-0000-0000-0000000ca1c1", "category": "Sustratos"},
    {"item_id": "00000000-0000-0000-0000-0000000ca1c2", "category": "sustratos "},
    {"item_id": "00000000-0000-0000-0000-0000000ca1c3", "category": "Embalaje"},
    {"item_id": "00000000-0000-0000-0000-0000000ca1c4", "category": "Tintas"},
    {"item_id": "00000000-0000-0000-0000-0000000ca1c5", "category": "tintas"},
    {"item_id": "00000000-0000-0000-0000-0000000ca1c6", "category": "tintas"},
    {"item_id": "00000000-0000-0000-0000-0000000ca1c7", "category": "Embalaje"},
    {"item_id": "00000000-0000-0000-0000-0000000ca1c8", "category": "   "}
  ]$$::jsonb),
  7, 'conversión: enlaza los siete ítems con texto y deja fuera el vacío');

select is(
  (select count(*)::int from item_categories
    where organization_id = '00000000-0000-0000-0000-0000000ca00c' and kind = 'supply'),
  3, 'conversión: tres categorías de insumo, una por nombre sin mayúsculas ni espacios');

select is(
  (select count(*)::int from item_categories
    where organization_id = '00000000-0000-0000-0000-0000000ca00c' and kind = 'product'),
  1, 'conversión: «Embalaje» de producto es otra categoría que la de insumo');

select is(
  (select c.name from items i join item_categories c on c.id = i.category_id
    where i.id = '00000000-0000-0000-0000-0000000ca1c2'),
  'Sustratos', 'conversión: «sustratos » se enlaza con «Sustratos»');

select is(
  (select count(distinct category_id)::int from items
    where id in ('00000000-0000-0000-0000-0000000ca1c1', '00000000-0000-0000-0000-0000000ca1c2')),
  1, 'conversión: las dos variantes comparten la misma categoría');

select is(
  (select c.name from items i join item_categories c on c.id = i.category_id
    where i.id = '00000000-0000-0000-0000-0000000ca1c4'),
  'tintas', 'conversión: gana la escritura más frecuente');

select ok(
  (select archived_at is not null and category_id is not null from items
    where id = '00000000-0000-0000-0000-0000000ca1c2'),
  'conversión: el ítem archivado queda enlazado y sigue archivado');

select is(
  (select category_id from items where id = '00000000-0000-0000-0000-0000000ca1c8'),
  null, 'conversión: un texto en blanco queda sin categoría');

select is(
  (select count(*)::int from activity_log
    where table_name = 'items'
      and organization_id = '00000000-0000-0000-0000-0000000ca00c'),
  (select events from conversion_log_before),
  'conversión: la bitácora no registra ediciones que nadie hizo');

select is(
  (select count(*)::int from activity_log
    where table_name = 'item_categories'
      and organization_id = '00000000-0000-0000-0000-0000000ca00c'),
  0, 'conversión: las categorías creadas por la conversión no aparecen como altas');

select is(
  (select count(*)::int from pg_trigger
    where tgrelid = 'items'::regclass
      and tgname in ('audit', 'enforce_archive')
      and tgenabled = 'O'),
  2, 'conversión: audit y enforce_archive de items quedan activos al terminar');

select is(
  (select count(*)::int from pg_trigger
    where tgrelid = 'item_categories'::regclass
      and tgname = 'audit'
      and tgenabled = 'O'),
  1, 'conversión: audit de item_categories queda activo al terminar');

select * from finish();
rollback;
