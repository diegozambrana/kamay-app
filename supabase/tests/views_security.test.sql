-- KAM-23 · Toda vista declara `security_invoker`.
--
-- Una vista sin esa opción se ejecuta con los permisos de quien la creó —el
-- dueño del esquema, que no está sujeto a RLS— y deja pasar las filas de
-- todas las organizaciones sin que ninguna política llegue a evaluarse. Es el
-- agujero más silencioso que puede tener este esquema: nada falla, la vista
-- simplemente devuelve de más.
--
-- La prueba interroga al catálogo en lugar de enumerar vistas. Una lista
-- escrita a mano falla en el único caso que importa —la vista que alguien
-- añade mañana y olvida apuntar—; `pg_class` no se olvida de nada.
--
-- Escenarios del delta `tenant-isolation` → *Every view declares
-- security_invoker*: «No view lacks the option», «A new view without the
-- option fails the build», «A view does not widen what its caller may read».
begin;

set search_path to public, extensions;

select plan(6);

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

-- Las vistas de la aplicación que no declaran `security_invoker = true`.
-- Devuelve nombres, no un conteo: si la prueba falla, el mensaje dice cuál.
create function pg_temp.views_without_invoker() returns name[]
language sql as $$
  select coalesce(array_agg(c.relname order by c.relname), '{}')
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind in ('v', 'm')
     and not coalesce('security_invoker=true' = any (c.reloptions), false);
$$;

-- Las relaciones con `organization_id` —vistas, o tablas si se pide— en las
-- que esta sesión ve alguna fila de la organización dada. Consulta dinámica
-- sobre el catálogo: una relación nueva entra en la comprobación sin tocar
-- este archivo.
create function pg_temp.views_showing(org uuid, kinds "char"[] default '{v,m}')
returns name[]
language plpgsql as $$
declare
  view_name name;
  seen boolean;
  result name[] := '{}';
begin
  for view_name in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = any (kinds)
       and exists (
         select 1 from pg_attribute a
          where a.attrelid = c.oid
            and a.attname = 'organization_id'
            and not a.attisdropped)
     order by c.relname
  loop
    execute format(
      'select exists (select 1 from public.%I where organization_id = $1)',
      view_name)
      into seen using org;
    if seen then
      result := result || view_name;
    end if;
  end loop;
  return result;
end;
$$;

-- ── El catálogo: ninguna vista sin la opción ──────────────────────────────

-- Que haya vistas que revisar, para que «ninguna falla» no sea verdad porque
-- el recorrido no encontró nada.
select cmp_ok(
  (select count(*)::int
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('v', 'm')),
  '>=', 10,
  'catálogo: el recorrido encuentra las vistas derivadas del esquema');

select is(
  pg_temp.views_without_invoker(),
  '{}'::name[],
  'catálogo: toda vista declara security_invoker = true');

-- ── Una vista nueva sin la opción no pasa inadvertida ─────────────────────

-- Se crea dentro de esta transacción, que se deshace al final: demuestra que
-- la comprobación de arriba detectaría exactamente el descuido que existe
-- para detectar, y con su nombre.
create view public.kam23_forgotten_view as
  select id, organization_id from public.orders;

select is(
  pg_temp.views_without_invoker(),
  array['kam23_forgotten_view']::name[],
  'catálogo: una vista creada sin security_invoker aparece por su nombre');

drop view public.kam23_forgotten_view;

-- ── Semilla: la organización B con datos que llegan a cada vista ──────────

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000023a1', 'owner-views-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000023b1', 'owner-views-b@kamay.test');

insert into organizations (id, name, timezone) values
  ('00000000-0000-0000-0000-00000000023a', 'Vistas A', 'America/La_Paz'),
  ('00000000-0000-0000-0000-00000000023b', 'Vistas B', 'America/La_Paz');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000023a', '00000000-0000-0000-0000-0000000023a1', 'owner'),
  ('00000000-0000-0000-0000-00000000023b', '00000000-0000-0000-0000-0000000023b1', 'owner');

insert into business_lines (id, organization_id, name, position) values
  ('00000000-0000-0000-0000-0000000023c1', '00000000-0000-0000-0000-00000000023b', 'Sublimación', 1);

insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-0000000023d1', '00000000-0000-0000-0000-00000000023b',
   '00000000-0000-0000-0000-0000000023c1', 'order', 'Registrado', 'initial', 1);

insert into contacts (id, organization_id, name, is_customer, is_supplier) values
  ('00000000-0000-0000-0000-0000000023e1', '00000000-0000-0000-0000-00000000023b', 'Cliente B',   true,  false),
  ('00000000-0000-0000-0000-0000000023e2', '00000000-0000-0000-0000-00000000023b', 'Proveedor B', false, true);

insert into items (id, organization_id, business_line_id, kind, name, min_stock) values
  ('00000000-0000-0000-0000-0000000023f1', '00000000-0000-0000-0000-00000000023b',
   '00000000-0000-0000-0000-0000000023c1', 'product', 'Taza blanca', null),
  ('00000000-0000-0000-0000-0000000023f2', '00000000-0000-0000-0000-00000000023b',
   '00000000-0000-0000-0000-0000000023c1', 'supply', 'Tinta', 10),
  ('00000000-0000-0000-0000-0000000023f3', '00000000-0000-0000-0000-00000000023b',
   '00000000-0000-0000-0000-0000000023c1', 'asset', 'Plancha', null);

insert into asset_details (item_id, organization_id, acquisition_cost, acquired_on) values
  ('00000000-0000-0000-0000-0000000023f3', '00000000-0000-0000-0000-00000000023b', 3500, date '2026-01-10');

-- Un pedido cobrado a medias: aparece en totales, por cobrar, caja y más vendido.
-- Fechado hace días y no en una fecha fija: `best_selling_products` solo mira
-- los últimos 90 días, y una fecha fija dejaría de alcanzarla con el tiempo.
insert into orders (id, organization_id, business_line_id, kind, contact_id, status_id, occurred_at) values
  ('00000000-0000-0000-0000-000000002311', '00000000-0000-0000-0000-00000000023b',
   '00000000-0000-0000-0000-0000000023c1', 'order', '00000000-0000-0000-0000-0000000023e1',
   '00000000-0000-0000-0000-0000000023d1', now() - interval '5 days');

insert into order_items (organization_id, order_id, item_id, quantity, unit_price) values
  ('00000000-0000-0000-0000-00000000023b', '00000000-0000-0000-0000-000000002311',
   '00000000-0000-0000-0000-0000000023f1', 2, 60);

-- Una compra de insumo pagada a medias: aparece en totales, por pagar, caja,
-- último costo y —por el disparador de entrada de KAM-18— en existencias.
insert into expenses (id, organization_id, business_line_id, kind, contact_id, occurred_at) values
  ('00000000-0000-0000-0000-000000002321', '00000000-0000-0000-0000-00000000023b',
   '00000000-0000-0000-0000-0000000023c1', 'purchase', '00000000-0000-0000-0000-0000000023e2',
   '2026-02-02 12:00:00-04');

insert into expense_items (organization_id, expense_id, item_id, quantity, unit_price) values
  ('00000000-0000-0000-0000-00000000023b', '00000000-0000-0000-0000-000000002321',
   '00000000-0000-0000-0000-0000000023f2', 4, 25);

insert into payments (id, organization_id, direction, order_id, expense_id, amount, occurred_at) values
  ('00000000-0000-0000-0000-000000002331', '00000000-0000-0000-0000-00000000023b', 'in',
   '00000000-0000-0000-0000-000000002311', null, 50, '2026-02-03 12:00:00-04'),
  ('00000000-0000-0000-0000-000000002332', '00000000-0000-0000-0000-00000000023b', 'out',
   null, '00000000-0000-0000-0000-000000002321', 40, '2026-02-04 12:00:00-04');

-- Que la semilla alcance de verdad cada vista: sin esto, «cero filas de B»
-- podría ser cierto solo porque B no tiene nada que mostrar. Se comprueba
-- como la persona dueña de B y no como `postgres`, porque varias vistas
-- filtran por `is_owner()` y sin sesión no devuelven nada. De paso demuestra
-- que la vista filtra por quien consulta y no está vacía para todo el mundo.
select pg_temp.login('00000000-0000-0000-0000-0000000023b1');

select is(
  pg_temp.views_showing('00000000-0000-0000-0000-00000000023b'),
  (select array_agg(c.relname order by c.relname)
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('v', 'm')),
  'semilla: la organización B tiene filas en cada vista derivada');

-- ── La organización A no ve nada de B a través de ninguna vista ───────────

select pg_temp.login('00000000-0000-0000-0000-0000000023a1');

select is(
  pg_temp.views_showing('00000000-0000-0000-0000-00000000023b'),
  '{}'::name[],
  'aislamiento: un miembro de A obtiene cero filas de B en toda vista derivada');

-- Y lo mismo sobre las tablas: la semilla de B alcanza configuración,
-- directorio, catálogo, activos, pedidos, egresos, cobros, inventario y
-- bitácora; las que no alcanza las cubren las pruebas de acceso de cada
-- dominio (`docs/anexo-bd-verificacion.md`, punto 9).
select is(
  pg_temp.views_showing('00000000-0000-0000-0000-00000000023b', '{r,p}'),
  '{}'::name[],
  'aislamiento: un miembro de A obtiene cero filas de B en toda tabla');

select * from finish();
rollback;
