-- Cambio `fair-product-photos-visibility-cart-drawer`: la columna
-- `items.show_in_fair` y que cambiarla quede en la bitácora.
-- Escenarios del delta `catalog-directory`.
begin;

set search_path to public, extensions;

select plan(7);

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
  ('00000000-0000-0000-0000-0000000f5a01', 'owner-fair-visibility@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-0000000f5a0a', 'Visibilidad en feria');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000f5a0a', '00000000-0000-0000-0000-0000000f5a01', 'owner');

insert into items (id, organization_id, kind, name, sale_price) values
  ('00000000-0000-0000-0000-0000000f5a11', '00000000-0000-0000-0000-0000000f5a0a', 'product', 'Taza azul', 35);

-- ── Forma ─────────────────────────────────────────────────────────────────

select has_column('public', 'items', 'show_in_fair',
  'items.show_in_fair existe');

select col_not_null('public', 'items', 'show_in_fair',
  'El ajuste de venta rápida no admite nulo: la columna es not null');

select col_default_is('public', 'items', 'show_in_fair', 'true',
  'Los ítems existentes quedan visibles en la venta rápida: el valor por omisión es verdadero');

select is(
  (select show_in_fair from items where id = '00000000-0000-0000-0000-0000000f5a11'),
  true, 'Un producto nuevo se muestra por omisión');

select is(
  (select count(*)::int from items where show_in_fair is null),
  0, 'Los ítems existentes quedan visibles en la venta rápida: ningún ítem queda sin valor');

select throws_ok(
  $$ update items set show_in_fair = null where id = '00000000-0000-0000-0000-0000000f5a11' $$,
  '23502', null, 'El ajuste de venta rápida no admite nulo');

-- ── Ocultarlo queda en la bitácora ────────────────────────────────────────

select pg_temp.login('00000000-0000-0000-0000-0000000f5a01');

update items set show_in_fair = false where id = '00000000-0000-0000-0000-0000000f5a11';

select pg_temp.logout();

select is(
  (select count(*)::int from activity_log
    where table_name = 'items'
      and record_id = '00000000-0000-0000-0000-0000000f5a11'
      and action = 'updated'
      and changes ? 'show_in_fair'
      and actor_id = '00000000-0000-0000-0000-0000000f5a01'),
  1, 'Ocultar un producto de la venta rápida: la bitácora registra el cambio');

select * from finish();
rollback;
