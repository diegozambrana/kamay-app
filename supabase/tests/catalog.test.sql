-- KAM-06 · catalog-directory: la base de datos del negocio.
-- Escenarios del delta spec `catalog-directory`: forma de las tablas, rol
-- obligatorio del contacto, ausencia de columnas derivadas, archivado
-- reservado al dueño, edición de archivados, aislamiento, bitácora y
-- búsqueda tolerante a acentos.
begin;

set search_path to public, extensions;

select plan(44);

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
  ('00000000-0000-0000-0000-0000000006a1', 'owner-cat-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000006a2', 'assistant-cat-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000006b1', 'owner-cat-b@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-00000000006a', 'Catálogo A'),
  ('00000000-0000-0000-0000-00000000006b', 'Catálogo B');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000006a', '00000000-0000-0000-0000-0000000006a1', 'owner'),
  ('00000000-0000-0000-0000-00000000006a', '00000000-0000-0000-0000-0000000006a2', 'assistant'),
  ('00000000-0000-0000-0000-00000000006b', '00000000-0000-0000-0000-0000000006b1', 'owner');

insert into business_lines (id, organization_id, name, color) values
  ('00000000-0000-0000-0000-00000000061a', '00000000-0000-0000-0000-00000000006a', 'Sublimación', 'blue');

insert into units (id, organization_id, code, name) values
  ('00000000-0000-0000-0000-00000000064a', '00000000-0000-0000-0000-00000000006a', 'u', 'Unidad');

insert into items (id, organization_id, business_line_id, kind, name, unit_id) values
  ('00000000-0000-0000-0000-0000000069a1', '00000000-0000-0000-0000-00000000006a', '00000000-0000-0000-0000-00000000061a', 'supply', 'Taza para sublimación', '00000000-0000-0000-0000-00000000064a'),
  ('00000000-0000-0000-0000-0000000069a2', '00000000-0000-0000-0000-00000000006a', null,                                   'product', 'Llavero grabado',      '00000000-0000-0000-0000-00000000064a'),
  ('00000000-0000-0000-0000-0000000069a3', '00000000-0000-0000-0000-00000000006a', '00000000-0000-0000-0000-00000000061a', 'asset',   'Prensa de tazas',      '00000000-0000-0000-0000-00000000064a');

insert into items (id, organization_id, kind, name) values
  ('00000000-0000-0000-0000-0000000069b1', '00000000-0000-0000-0000-00000000006b', 'supply', 'Ítem de B');

insert into contacts (id, organization_id, name, is_supplier, is_customer) values
  ('00000000-0000-0000-0000-0000000068a1', '00000000-0000-0000-0000-00000000006a', 'Proveedor A', true,  false),
  ('00000000-0000-0000-0000-0000000068a2', '00000000-0000-0000-0000-00000000006a', 'Cliente A',   false, true);

insert into contacts (id, organization_id, name, is_customer) values
  ('00000000-0000-0000-0000-0000000068b1', '00000000-0000-0000-0000-00000000006b', 'Contacto de B', true);

insert into item_variants (id, organization_id, item_id, name) values
  ('00000000-0000-0000-0000-0000000067a1', '00000000-0000-0000-0000-00000000006a', '00000000-0000-0000-0000-0000000069a2', '11oz');

-- ── Scenario: Tipo de ítem fuera del juego permitido ──────────────────────

select throws_ok(
  $$ insert into items (organization_id, kind, name)
     values ('00000000-0000-0000-0000-00000000006a', 'machine', 'Fuera del juego') $$,
  '23514', null, 'items: un kind fuera de supply/product/asset se rechaza');

-- ── Scenario: Variante duplicada dentro del mismo ítem ────────────────────

select throws_ok(
  $$ insert into item_variants (organization_id, item_id, name)
     values ('00000000-0000-0000-0000-00000000006a',
             '00000000-0000-0000-0000-0000000069a2', '11oz') $$,
  '23505', null, 'item_variants: nombre duplicado en el mismo ítem se rechaza');

-- ── Scenario: Mismo nombre de variante en ítems distintos ─────────────────

select lives_ok(
  $$ insert into item_variants (organization_id, item_id, name)
     values ('00000000-0000-0000-0000-00000000006a',
             '00000000-0000-0000-0000-0000000069a1', '11oz') $$,
  'item_variants: el mismo nombre en otro ítem se acepta');

-- ── Scenario: Contacto sin ningún rol ─────────────────────────────────────

select throws_ok(
  $$ insert into contacts (organization_id, name, is_supplier, is_customer)
     values ('00000000-0000-0000-0000-00000000006a', 'Sin rol', false, false) $$,
  '23514', null, 'contacts: sin rol no se guarda');

-- ── Scenario: Contacto que es proveedor y cliente a la vez ────────────────

select lives_ok(
  $$ insert into contacts (organization_id, name, is_supplier, is_customer)
     values ('00000000-0000-0000-0000-00000000006a', 'Ambos roles', true, true) $$,
  'contacts: proveedor y cliente a la vez se acepta');

-- ── Scenario: Quitar el último rol de un contacto existente ───────────────

select throws_ok(
  $$ update contacts set is_supplier = false
     where id = '00000000-0000-0000-0000-0000000068a1' $$,
  '23514', null, 'contacts: quitar el último rol se rechaza');

select is(
  (select is_supplier from contacts where id = '00000000-0000-0000-0000-0000000068a1'),
  true, 'contacts: el contacto conserva su rol anterior');

-- ── Scenario: Inspección de las columnas del catálogo ─────────────────────
-- Deliberadamente rígida: la tentación de guardar el último costo aquí
-- volverá con el inventario (KAM-18), y es exactamente lo que hizo
-- inmantenible la versión anterior.

select is(
  (select count(*)::int from information_schema.columns
    where table_schema = 'public'
      and table_name in ('items', 'item_variants')
      -- `min_stock` es canónico y no es derivado: lo fija la persona dueña.
      and column_name <> 'min_stock'
      and (column_name ~ '(stock|cost|costo|margin|margen|balance|saldo|average|promedio)')),
  0, 'items/item_variants: ninguna columna de saldo, costo ni margen');

-- ── Scenario: El ayudante crea y edita ────────────────────────────────────

select pg_temp.login('00000000-0000-0000-0000-0000000006a2');

select lives_ok(
  $$ insert into items (id, organization_id, kind, name)
     values ('00000000-0000-0000-0000-0000000069a9',
             '00000000-0000-0000-0000-00000000006a', 'supply', 'Creado por ayudante') $$,
  'items: el ayudante crea');

select lives_ok(
  $$ update items set name = 'Editado por ayudante'
     where id = '00000000-0000-0000-0000-0000000069a9' $$,
  'items: el ayudante edita');

select lives_ok(
  $$ insert into contacts (id, organization_id, name, is_customer)
     values ('00000000-0000-0000-0000-0000000068a9',
             '00000000-0000-0000-0000-00000000006a', 'Creado por ayudante', true) $$,
  'contacts: el ayudante crea');

select lives_ok(
  $$ update contacts set phone = '+591 700'
     where id = '00000000-0000-0000-0000-0000000068a9' $$,
  'contacts: el ayudante edita');

select lives_ok(
  $$ insert into item_variants (id, organization_id, item_id, name)
     values ('00000000-0000-0000-0000-0000000067a9',
             '00000000-0000-0000-0000-00000000006a',
             '00000000-0000-0000-0000-0000000069a2', 'XL') $$,
  'item_variants: el ayudante crea');

-- ── Scenario: El ayudante intenta archivar ────────────────────────────────

select throws_ok(
  $$ update items set archived_at = now()
     where id = '00000000-0000-0000-0000-0000000069a1' $$,
  '42501', 'Solo la persona dueña puede archivar o desarchivar',
  'items: el ayudante no archiva');

select throws_ok(
  $$ update contacts set archived_at = now()
     where id = '00000000-0000-0000-0000-0000000068a1' $$,
  '42501', 'Solo la persona dueña puede archivar o desarchivar',
  'contacts: el ayudante no archiva');

select throws_ok(
  $$ update item_variants set archived_at = now()
     where id = '00000000-0000-0000-0000-0000000067a1' $$,
  '42501', 'Solo la persona dueña puede archivar o desarchivar',
  'item_variants: el ayudante no archiva');

-- ── Scenario: Otra organización no ve nada ────────────────────────────────

select is(
  (select count(*)::int from items
    where organization_id = '00000000-0000-0000-0000-00000000006b'),
  0, 'items: cero filas de la otra organización');
select is(
  (select count(*)::int from contacts
    where organization_id = '00000000-0000-0000-0000-00000000006b'),
  0, 'contacts: cero filas de la otra organización');
select is(
  (select count(*)::int from item_variants
    where organization_id = '00000000-0000-0000-0000-00000000006b'),
  0, 'item_variants: cero filas de la otra organización');

-- ── Scenario: Nadie borra ─────────────────────────────────────────────────
-- Como en `statuses`: el privilegio DELETE está revocado, así que la orden
-- ni siquiera llega a buscar filas.

select throws_ok(
  $$ delete from items $$,
  '42501', null, 'items: el ayudante no puede borrar — privilegio revocado');
select throws_ok(
  $$ delete from contacts $$,
  '42501', null, 'contacts: el ayudante no puede borrar');
select throws_ok(
  $$ delete from item_variants $$,
  '42501', null, 'item_variants: el ayudante no puede borrar');

select pg_temp.logout();

-- ── Scenario: El dueño archiva ────────────────────────────────────────────

select pg_temp.login('00000000-0000-0000-0000-0000000006a1');

select throws_ok(
  $$ delete from items $$,
  '42501', null, 'items: tampoco el dueño puede borrar');

select is((select count(*)::int from items
            where organization_id = '00000000-0000-0000-0000-00000000006a'),
  4, 'items: ninguna fila desapareció');

select lives_ok(
  $$ update contacts set archived_at = now()
     where id = '00000000-0000-0000-0000-0000000068a2' $$,
  'contacts: el dueño archiva');

select lives_ok(
  $$ update items set archived_at = now()
     where id = '00000000-0000-0000-0000-0000000069a1' $$,
  'items: el dueño archiva');

-- ── Scenario: Intento de editar un registro archivado ─────────────────────

select throws_ok(
  $$ update items set name = 'Nombre nuevo'
     where id = '00000000-0000-0000-0000-0000000069a1' $$,
  '23514', 'Un registro archivado no se puede editar: desarchívalo primero',
  'items: un archivado no se edita');

-- ── Scenario: Desarchivar desde el filtro ─────────────────────────────────

select lives_ok(
  $$ update items set archived_at = null
     where id = '00000000-0000-0000-0000-0000000069a1' $$,
  'items: el dueño desarchiva');

select is(
  (select name from items where id = '00000000-0000-0000-0000-0000000069a1'),
  'Taza para sublimación', 'items: el registro vuelve intacto');

select is(
  (select count(*)::int from item_variants
    where item_id = '00000000-0000-0000-0000-0000000069a1' and archived_at is null),
  1, 'items: sus variantes siguen ahí tras el viaje de archivado');

-- ── Scenario: El ayudante intenta desarchivar ─────────────────────────────

select pg_temp.login('00000000-0000-0000-0000-0000000006a2');

select throws_ok(
  $$ update contacts set archived_at = null
     where id = '00000000-0000-0000-0000-0000000068a2' $$,
  '42501', 'Solo la persona dueña puede archivar o desarchivar',
  'contacts: el ayudante no desarchiva');

select pg_temp.logout();

-- ── Scenario: La referencia histórica sobrevive al archivado ──────────────
-- Todavía no hay documentos (pedidos y egresos llegan en KAM-07 y KAM-09):
-- se comprueba con una tabla temporal que referencia el ítem archivado.

-- Tabla real dentro de la transacción (como `status_refs_probe`): una
-- temporal no puede tener clave foránea a una permanente. El rollback final
-- la borra.
create table documento_historico (
  id      int primary key,
  item_id uuid not null references items(id)
);

update items set archived_at = now()
  where id = '00000000-0000-0000-0000-0000000069a3';

insert into documento_historico (id, item_id)
  values (1, '00000000-0000-0000-0000-0000000069a3');

select is(
  (select i.name from documento_historico d
     join items i on i.id = d.item_id where d.id = 1),
  'Prensa de tazas',
  'items: un documento histórico sigue leyendo el ítem archivado');

-- ── Scenario: Alta y cambio quedan en la bitácora ─────────────────────────

select is(
  (select count(*)::int from activity_log
    where table_name = 'contacts'
      and record_id = '00000000-0000-0000-0000-0000000068a9'
      and action = 'created'),
  1, 'contacts: el alta queda en la bitácora');

select is(
  (select count(*)::int from activity_log
    where table_name = 'contacts'
      and record_id = '00000000-0000-0000-0000-0000000068a9'
      and action = 'updated'
      and changes ? 'phone'),
  1, 'contacts: el cambio de teléfono queda con el campo que cambió');

select is(
  (select count(*)::int from activity_log
    where table_name = 'items'
      and record_id = '00000000-0000-0000-0000-0000000069a1'
      and action = 'archived'),
  1, 'items: el archivado queda en la bitácora');

-- ── Scenario: Búsqueda tolerante a acentos ────────────────────────────────

select is(
  (select count(*)::int from items
    where organization_id = '00000000-0000-0000-0000-00000000006a'
      and archived_at is null
      and search_name like '%' || immutable_unaccent(lower('sublimacion')) || '%'),
  1, 'búsqueda: "sublimacion" sin tilde encuentra el ítem con tilde');

insert into items (id, organization_id, kind, name)
  values ('00000000-0000-0000-0000-0000000069a4',
          '00000000-0000-0000-0000-00000000006a', 'supply', 'Tinta de sublimacion');

select is(
  (select count(*)::int from items
    where organization_id = '00000000-0000-0000-0000-00000000006a'
      and archived_at is null
      and search_name like '%' || immutable_unaccent(lower('sublimación')) || '%'),
  2, 'búsqueda: "sublimación" con tilde encuentra también lo guardado sin tilde');

select is(
  (select count(*)::int from items
    where organization_id = '00000000-0000-0000-0000-00000000006a'
      and archived_at is null
      and search_name like '%' || immutable_unaccent(lower('TAZA')) || '%'),
  1, 'búsqueda: las mayúsculas son indiferentes');

update items set archived_at = now()
  where id = '00000000-0000-0000-0000-0000000069a4';

select is(
  (select count(*)::int from items
    where organization_id = '00000000-0000-0000-0000-00000000006a'
      and archived_at is null
      and search_name like '%' || immutable_unaccent(lower('sublimacion')) || '%'),
  1, 'búsqueda: un ítem archivado no aparece entre los resultados');

-- ── Scenario: Semilla presente tras el reinicio ───────────────────────────
-- Como seed_geeko.test.sql: lee lo que dejó `supabase db reset`, no crea nada.

select bag_eq(
  $$ select distinct kind from items
     where organization_id = '10000000-0000-0000-0000-000000000003' $$,
  $$ values ('supply'), ('product'), ('asset') $$,
  'semilla: Geeko Store tiene ítems de los tres tipos');

select cmp_ok(
  (select count(*)::int from items
    where organization_id = '10000000-0000-0000-0000-000000000003'
      and business_line_id is null),
  '>=', 1, 'semilla: al menos un ítem compartido entre líneas');

select cmp_ok(
  (select count(*)::int from item_variants
    where organization_id = '10000000-0000-0000-0000-000000000003'),
  '>=', 2, 'semilla: al menos un ítem con variantes');

select bag_eq(
  $$ select is_supplier, is_customer from contacts
     where id between '80000000-0000-0000-0000-000000000001'
                  and '80000000-0000-0000-0000-000000000003' $$,
  $$ values (true, false), (false, true), (true, true) $$,
  'semilla: los tres casos de rol de contacto');

select cmp_ok(
  (select count(*)::int from items
    where organization_id = '10000000-0000-0000-0000-000000000003'
      and search_name like '%' || immutable_unaccent(lower('sublimacion')) || '%'
      and name <> immutable_unaccent(name)),
  '>=', 1, 'semilla: "sublimacion" encuentra un nombre con tilde');

select * from finish();
rollback;
