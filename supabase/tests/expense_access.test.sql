-- KAM-09 · expenses: aislamiento, roles y archivado.
-- Escenarios del delta spec `expenses`: "Aislamiento, roles y archivado de
-- egresos", "El ayudante no obtiene costos", "Gasto en General" y "Solo la
-- propia organización ve el comprobante". Viven aquí y no en `no_delete` o
-- `rls_roles` (KAM-02/KAM-04) por el mismo criterio que `order_access`: cada
-- suite cubre su propia capacidad.
begin;

set search_path to public, extensions;

select plan(26);

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
  ('00000000-0000-0000-0000-0000000008a1', 'owner-exa-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000008a2', 'assistant-exa-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000008b1', 'owner-exa-b@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-00000000008a', 'Egresos acceso A'),
  ('00000000-0000-0000-0000-00000000008b', 'Egresos acceso B');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000008a', '00000000-0000-0000-0000-0000000008a1', 'owner'),
  ('00000000-0000-0000-0000-00000000008a', '00000000-0000-0000-0000-0000000008a2', 'assistant'),
  ('00000000-0000-0000-0000-00000000008b', '00000000-0000-0000-0000-0000000008b1', 'owner');

insert into business_lines (id, organization_id, name, is_shared, position) values
  ('00000000-0000-0000-0000-00000000081a', '00000000-0000-0000-0000-00000000008a', 'Sublimación', false, 1),
  ('00000000-0000-0000-0000-00000000081b', '00000000-0000-0000-0000-00000000008a', 'General',     true,  2),
  ('00000000-0000-0000-0000-00000000081c', '00000000-0000-0000-0000-00000000008b', 'Línea de B',  false, 1);

insert into expense_categories (id, organization_id, name) values
  ('00000000-0000-0000-0000-00000000082a', '00000000-0000-0000-0000-00000000008a', 'Servicios');

insert into contacts (id, organization_id, name, is_supplier, is_customer) values
  ('00000000-0000-0000-0000-00000000083a', '00000000-0000-0000-0000-00000000008a', 'Proveedor A', true, false);

insert into items (id, organization_id, kind, name) values
  ('00000000-0000-0000-0000-00000000084a', '00000000-0000-0000-0000-00000000008a', 'supply', 'Taza');

-- Una compra con dos líneas (a 8.50 hace un mes y a 9.20 hace una semana) y
-- un gasto en General, todos de A.
insert into expenses (id, organization_id, business_line_id, kind, contact_id, expense_category_id, amount, occurred_at) values
  ('00000000-0000-0000-0000-00000000085a', '00000000-0000-0000-0000-00000000008a',
   '00000000-0000-0000-0000-00000000081a', 'purchase', '00000000-0000-0000-0000-00000000083a', null, null,
   now() - interval '30 days'),
  ('00000000-0000-0000-0000-00000000085b', '00000000-0000-0000-0000-00000000008a',
   '00000000-0000-0000-0000-00000000081a', 'purchase', '00000000-0000-0000-0000-00000000083a', null, null,
   now() - interval '7 days'),
  ('00000000-0000-0000-0000-00000000085c', '00000000-0000-0000-0000-00000000008a',
   '00000000-0000-0000-0000-00000000081b', 'expense', null, '00000000-0000-0000-0000-00000000082a', 120,
   now() - interval '2 days');

insert into expense_items (id, organization_id, expense_id, item_id, quantity, unit_price) values
  ('00000000-0000-0000-0000-00000000086a', '00000000-0000-0000-0000-00000000008a',
   '00000000-0000-0000-0000-00000000085a', '00000000-0000-0000-0000-00000000084a', 10, 8.50),
  ('00000000-0000-0000-0000-00000000086b', '00000000-0000-0000-0000-00000000008a',
   '00000000-0000-0000-0000-00000000085b', '00000000-0000-0000-0000-00000000084a', 5, 9.20);

-- Un comprobante de A en el bucket privado: la fila y el objeto.
insert into attachments (id, organization_id, entity_type, entity_id, bucket, storage_path, file_name) values
  ('00000000-0000-0000-0000-00000000087a', '00000000-0000-0000-0000-00000000008a', 'expense',
   '00000000-0000-0000-0000-00000000085c', 'receipts',
   '00000000-0000-0000-0000-00000000008a/expense/00000000-0000-0000-0000-00000000085c/recibo.jpg',
   'recibo.jpg');

insert into storage.objects (bucket_id, name) values
  ('receipts', '00000000-0000-0000-0000-00000000008a/expense/00000000-0000-0000-0000-00000000085c/recibo.jpg');

-- ── Scenario: El ayudante consulta egresos / no obtiene costos ────────────

select pg_temp.login('00000000-0000-0000-0000-0000000008a2');

select is((select count(*)::int from expenses), 0,
  'expenses: el ayudante obtiene cero filas');
select is((select count(*)::int from expense_items), 0,
  'expense_items: el ayudante obtiene cero filas');
select is((select count(*)::int from expense_totals), 0,
  'expense_totals: el ayudante obtiene cero filas (security_invoker)');
select is((select count(*)::int from item_last_cost), 0,
  'item_last_cost: el ayudante obtiene cero filas (security_invoker)');

-- ── Scenario: El ayudante intenta registrar ───────────────────────────────

select throws_ok(
  $$ insert into expenses (organization_id, business_line_id, kind, expense_category_id, amount)
     values ('00000000-0000-0000-0000-00000000008a', '00000000-0000-0000-0000-00000000081a', 'expense',
             '00000000-0000-0000-0000-00000000082a', 10) $$,
  '42501', null, 'expenses: el ayudante no puede insertar (RLS)');

select throws_ok(
  $$ select create_expense(
       '{"organization_id":"00000000-0000-0000-0000-00000000008a",
         "business_line_id":"00000000-0000-0000-0000-00000000081a",
         "kind":"expense","expense_category_id":"00000000-0000-0000-0000-00000000082a","amount":10}'::jsonb,
       '[]'::jsonb) $$,
  '42501', 'Solo la persona dueña registra egresos',
  'create_expense: al ayudante lo rechaza la función con el mismo mensaje');

-- Bajo RLS un `update` sobre filas invisibles no falla: no alcanza ninguna.
-- Que de verdad no archivó nada lo comprueba el dueño más abajo.
select lives_ok(
  $$ update expenses set archived_at = now() where id = '00000000-0000-0000-0000-00000000085a' $$,
  'expenses: el intento del ayudante de archivar no alcanza ninguna fila');

-- ── Scenario: Solo la propia organización ve el comprobante (ayudante de A sí) ──

select is(
  (select count(*)::int from storage.objects
    where bucket_id = 'receipts'
      and name like '00000000-0000-0000-0000-00000000008a/%'),
  1, 'storage: un miembro de la organización lee el objeto del comprobante');

-- ── Scenario: Miembro de otra organización ────────────────────────────────

select pg_temp.login('00000000-0000-0000-0000-0000000008b1');

select is((select count(*)::int from expenses), 0,
  'expenses: la otra organización no ve ni un egreso');
select is((select count(*)::int from expense_totals), 0,
  'expense_totals: la otra organización no ve ni un total');
select is((select count(*)::int from item_last_cost), 0,
  'item_last_cost: la otra organización no ve ni un costo');

select is(
  (select count(*)::int from storage.objects
    where bucket_id = 'receipts'
      and name like '00000000-0000-0000-0000-00000000008a/%'),
  0, 'storage: la otra organización no lee el objeto del comprobante por su ruta');

-- ── El dueño: lectura, borrado, archivado ─────────────────────────────────

select pg_temp.login('00000000-0000-0000-0000-0000000008a1');

select is((select count(*)::int from expenses), 3,
  'expenses: el dueño ve los tres egresos de su organización');

select is(
  (select archived_at from expenses where id = '00000000-0000-0000-0000-00000000085a'),
  null::timestamptz,
  'expenses: el intento del ayudante no archivó nada');

-- Scenario: Intento de borrado
select throws_ok(
  $$ delete from expenses where id = '00000000-0000-0000-0000-00000000085c' $$,
  '42501', null, 'expenses: nadie borra — el privilegio está revocado');
select throws_ok(
  $$ delete from expense_items where id = '00000000-0000-0000-0000-00000000086a' $$,
  '42501', null, 'expense_items: nadie borra — el privilegio está revocado');

-- Scenario: Gasto en General
select is(
  (select business_line_id from expense_totals
    where expense_id = '00000000-0000-0000-0000-00000000085c'),
  '00000000-0000-0000-0000-00000000081b'::uuid,
  'expense_totals: el gasto de General sale con la línea compartida, sin repartir');

-- Scenario: El egreso archivado conserva su historia
select is(
  (select last_cost from item_last_cost where item_id = '00000000-0000-0000-0000-00000000084a'),
  9.20::numeric(14,2),
  'item_last_cost: antes de archivar manda la compra más reciente');

select lives_ok(
  $$ update expenses set archived_at = now() where id = '00000000-0000-0000-0000-00000000085b' $$,
  'expenses: el dueño archiva');

select is(
  (select count(*)::int from expense_totals where expense_id = '00000000-0000-0000-0000-00000000085b'),
  0, 'expense_totals: el egreso archivado desaparece de la vista');

select is(
  (select last_cost from item_last_cost where item_id = '00000000-0000-0000-0000-00000000084a'),
  8.50::numeric(14,2),
  'item_last_cost: archivada la última compra, manda la anterior');

select is(
  (select count(*)::int from expense_items where expense_id = '00000000-0000-0000-0000-00000000085b'),
  1, 'expense_items: las líneas del egreso archivado siguen ahí');

select ok(
  exists (select 1 from activity_log
           where table_name = 'expenses'
             and record_id = '00000000-0000-0000-0000-00000000085b'
             and action = 'archived'),
  'activity_log: archivar deja su evento en la bitácora');

select throws_ok(
  $$ update expenses set note = 'tocado' where id = '00000000-0000-0000-0000-00000000085b' $$,
  '23514', 'Un registro archivado no se puede editar: desarchívalo primero',
  'expenses: un egreso archivado no se edita sin desarchivarlo');

-- Scenario: Desarchivar
select lives_ok(
  $$ update expenses set archived_at = null where id = '00000000-0000-0000-0000-00000000085b' $$,
  'expenses: el dueño desarchiva');

select is(
  (select last_cost from item_last_cost where item_id = '00000000-0000-0000-0000-00000000084a'),
  9.20::numeric(14,2),
  'item_last_cost: desarchivado, vuelve a mandar la compra más reciente');

select pg_temp.logout();

select * from finish();

rollback;
