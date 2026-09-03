-- KAM-07 · Pedidos: tablas `orders` y `order_items`, numeración por
-- organización, cola y total derivado.
-- DDL canónico: specs/PRD/kamay-esquema-base-de-datos-supabase.md §9, §16.
--
-- Una sola tabla para pedido y venta directa (decisión del esquema §9): en el
-- flujo de trabajo son distintos —uno atraviesa estados durante días, el otro
-- se cobra en quince segundos— pero en almacenamiento comparten cliente,
-- líneas, precios y cobros. Separarlas obligaría a que todo reporte de
-- ingresos uniera dos fuentes y las mantuviera sincronizadas.

create table orders (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id),
  business_line_id  uuid not null references business_lines(id),
  kind              text not null check (kind in ('order','direct_sale')),
  -- Número visible (#142). Lo asigna el trigger de abajo, no el cliente.
  code              int not null,
  contact_id        uuid references contacts(id),
  status_id         uuid not null references statuses(id),
  sales_channel_id  uuid references sales_channels(id),
  delivery_mode     text check (delivery_mode in ('pickup','delivery')),
  due_date          date,
  -- La hora real del hecho la fija el cliente; `created_at`, el servidor
  -- (convención nº 9, requisito del modo sin conexión).
  occurred_at       timestamptz not null default now(),
  -- Entrada a la columna de cola. Lo mantiene un trigger, no la aplicación.
  queued_at         timestamptz,
  notes             text,
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  archived_at       timestamptz,

  -- Un pedido es un compromiso con alguien; una venta de feria puede no
  -- tener cliente.
  constraint order_needs_customer
    check (kind <> 'order' or contact_id is not null),

  unique (organization_id, code)
);

create index on orders (organization_id, status_id) where archived_at is null;
create index on orders (organization_id, business_line_id, occurred_at desc);
create index on orders (organization_id, due_date) where archived_at is null;

-- El precio vive en la línea del documento, nunca solo en el catálogo: un
-- cambio de precio no puede reescribir la historia (esquema §2).
create table order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id),
  item_id     uuid references items(id),
  variant_id  uuid references item_variants(id),
  description text,
  quantity    numeric(14,3) not null check (quantity > 0),
  unit_price  numeric(14,2) not null check (unit_price >= 0),
  created_at  timestamptz not null default now()
);

-- Única desviación del DDL canónico §9, con el mismo motivo que la de
-- `item_variants` en 20260826120000: la convención nº 2 exige
-- `organization_id` en toda tabla y toda consulta, y sin él `log_activity()`
-- —que lo lee de la propia fila— registraría el evento bajo una organización
-- inexistente, además de obligar a la política de RLS a saltar a `orders` en
-- cada fila.
alter table order_items
  add column organization_id uuid not null references organizations(id);

create index on order_items (order_id);
create index on order_items (item_id);
create index on order_items (organization_id);

-- ── Numeración por organización ───────────────────────────────────────────
-- Cada organización numera desde #1, así que una secuencia global no sirve.
-- El bloqueo de la fila de la organización serializa solo a quienes insertan
-- en esa misma organización; dos organizaciones distintas no se estorban.
-- `unique (organization_id, code)` queda como red, no como mecanismo.
--
-- El máximo se toma incluidos los archivados: un número que reaparece
-- señalando otro pedido rompe la referencia humana ("el #142") que es
-- justamente su razón de ser.

create or replace function assign_order_code()
returns trigger
language plpgsql as $$
begin
  if new.code is not null then
    return new;   -- la semilla y las migraciones pueden fijarlo
  end if;

  perform 1 from organizations where id = new.organization_id for update;

  select coalesce(max(code), 0) + 1 into new.code
  from orders where organization_id = new.organization_id;

  return new;
end $$;

create trigger assign_code before insert on orders
  for each row execute function assign_order_code();

-- ── La cola ───────────────────────────────────────────────────────────────
-- `queued_at` es el momento de entrada a la columna de cola: es lo que
-- permite ordenar por llegada sin depender de `updated_at`, que cambia con
-- cualquier edición.
--
-- El trigger actúa SOLO cuando cambia `status_id`. Reordenar la cola escribe
-- `queued_at` directamente y no debe ser pisado (design.md D4).

create or replace function maintain_order_queued_at()
returns trigger
language plpgsql as $$
declare
  v_is_queue boolean;
begin
  if new.status_id is not distinct from old.status_id then
    return new;
  end if;

  select is_queue into v_is_queue from statuses where id = new.status_id;

  if coalesce(v_is_queue, false) then
    new.queued_at := now();
  else
    new.queued_at := null;
  end if;

  return new;
end $$;

create trigger maintain_queued_at before update on orders
  for each row execute function maintain_order_queued_at();

-- Al insertar, el mismo criterio: nace en la cola o no.
create or replace function set_initial_order_queued_at()
returns trigger
language plpgsql as $$
declare
  v_is_queue boolean;
begin
  if new.queued_at is not null then
    return new;   -- la semilla fija la llegada explícitamente
  end if;

  select is_queue into v_is_queue from statuses where id = new.status_id;
  if coalesce(v_is_queue, false) then
    new.queued_at := now();
  end if;

  return new;
end $$;

create trigger set_queued_at before insert on orders
  for each row execute function set_initial_order_queued_at();

-- ── Total derivado ────────────────────────────────────────────────────────
-- Convención nº 4: nada derivado se almacena. El total se calcula desde las
-- líneas, en una vista con `security_invoker` para que RLS siga decidiendo
-- quién ve qué.
--
-- La definición canónica del esquema incluye además `paid` sobre `payments`,
-- tabla que llega en KAM-10. Se añadirá entonces con `create or replace view`
-- en una migración nueva: exponer hoy un `paid = 0` que en realidad significa
-- "todavía no se sabe" es una mentira que algún reporte acabaría sumando.

create view order_totals with (security_invoker = true) as
select
  o.id              as order_id,
  o.organization_id,
  o.business_line_id,
  o.kind,
  o.occurred_at,
  coalesce((select sum(oi.quantity * oi.unit_price)
            from order_items oi where oi.order_id = o.id), 0) as total
from orders o
where o.archived_at is null;

-- ── Archivado y bitácora ──────────────────────────────────────────────────
-- Mismas reglas que el catálogo, con la función genérica de 20260826120000:
-- archivar es del dueño y un archivado no se edita.
-- `order_items` no lleva `enforce_archive` porque no tiene `archived_at`: lo
-- protegen la ausencia de política `DELETE` y el archivado del pedido padre.

create trigger enforce_archive before update on orders
  for each row execute function enforce_archive_rules();

create trigger audit after insert or update on orders
  for each row execute function log_activity();

create trigger audit after insert or update on order_items
  for each row execute function log_activity();

-- ── Privilegios y RLS ─────────────────────────────────────────────────────
-- Matriz de acceso §16: `orders` y `order_items` son leer, crear y editar
-- para todo miembro —el ayudante incluido—; archivar solo el dueño (lo
-- decide el trigger de arriba); borrar, nadie.

grant select, insert, update on orders to authenticated;
grant select, insert, update on order_items to authenticated;

revoke delete on orders, order_items from authenticated, anon, service_role;
revoke insert, update on orders, order_items from anon;
revoke insert, update on orders, order_items from service_role;
grant select on orders, order_items to service_role;

alter table orders enable row level security;
alter table order_items enable row level security;

create policy "orders: leer si es miembro"
  on orders for select to authenticated
  using (is_member(organization_id));

create policy "orders: crear si es miembro"
  on orders for insert to authenticated
  with check (is_member(organization_id));

create policy "orders: editar si es miembro"
  on orders for update to authenticated
  using (is_member(organization_id))
  with check (is_member(organization_id));

create policy "order_items: leer si es miembro"
  on order_items for select to authenticated
  using (is_member(organization_id));

create policy "order_items: crear si es miembro"
  on order_items for insert to authenticated
  with check (is_member(organization_id));

create policy "order_items: editar si es miembro"
  on order_items for update to authenticated
  using (is_member(organization_id))
  with check (is_member(organization_id));
