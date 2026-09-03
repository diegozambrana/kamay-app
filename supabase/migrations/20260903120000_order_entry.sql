-- KAM-08 · Alta y edición de pedidos: archivado de líneas y las dos
-- operaciones atómicas que las escriben.
--
-- Requisitos: openspec/changes/kam-08-orders-create-edit/specs/orders/spec.md
-- Decisiones: design.md D1 (funciones de base), D2 (archivar líneas),
-- D3 (el estado inicial lo resuelve la base).

-- ── Las líneas se archivan, nunca se borran ───────────────────────────────
-- Única desviación del DDL canónico §9, con el mismo motivo que las de
-- `item_variants.organization_id` (20260826120000) y
-- `order_items.organization_id` (20260826200000): la convención nº 3 prohíbe
-- borrar, y editar un pedido tiene que poder quitarle una línea. Sin esta
-- columna la única salida sería cantidad 0 —que el `check` rechaza— o dejar
-- líneas fantasma sumando al total.

alter table order_items add column archived_at timestamptz;

create index on order_items (order_id) where archived_at is null;

-- `order_items` NO lleva `enforce_archive_rules`: ese trigger exige `is_owner`
-- para tocar `archived_at`, y la matriz de acceso §16 dice que el ayudante
-- edita pedidos y sus líneas. Quitar una línea es editar el pedido, no
-- archivar un registro maestro. Lo que protege la fila es la ausencia de
-- política `DELETE` y el archivado del pedido padre, que sí es del dueño y
-- congela la fila entera.

-- ── El total sigue derivándose, ahora sin las líneas archivadas ───────────
-- Convención nº 4. Misma técnica que KAM-07 previó para `paid` (design.md D3
-- de aquel cambio): la vista se reemplaza en una migración nueva, nunca
-- editando la que la creó.

create or replace view order_totals with (security_invoker = true) as
select
  o.id              as order_id,
  o.organization_id,
  o.business_line_id,
  o.kind,
  o.occurred_at,
  coalesce((select sum(oi.quantity * oi.unit_price)
            from order_items oi
            where oi.order_id = o.id
              and oi.archived_at is null), 0) as total
from orders o
where o.archived_at is null;

grant select on order_totals to authenticated, service_role;

-- ── Alta: pedido y líneas, o nada ─────────────────────────────────────────
-- PostgREST no ofrece transacciones entre llamadas, y sin política `DELETE`
-- no hay compensación posible: si el insert de las líneas fallara después del
-- del pedido, quedaría un pedido sin líneas que nadie puede borrar. Por eso
-- el alta es una función y no dos inserciones encadenadas (D1).
--
-- `security invoker` (el valor por defecto de plpgsql, explícito aquí para
-- que se lea): RLS sigue siendo la autorización real, así que la función no
-- puede hacer nada que quien la llama no pudiera hacer a mano.
--
-- El estado inicial lo decide esta función y no la aplicación (D3): es una
-- garantía de datos, como la numeración y el total, y vive donde no se puede
-- saltar. El `jsonb` no admite `status_id`, `code` ni `archived_at`.

create or replace function create_order(p_order jsonb, p_items jsonb)
returns uuid
language plpgsql security invoker as $$
declare
  v_org    uuid := nullif(p_order->>'organization_id', '')::uuid;
  v_line   uuid := nullif(p_order->>'business_line_id', '')::uuid;
  v_id     uuid := coalesce(nullif(p_order->>'id', '')::uuid, gen_random_uuid());
  v_status uuid;
  v_item   jsonb;
begin
  if v_org is null or v_line is null then
    raise exception 'El pedido necesita organización y línea de negocio'
      using errcode = 'check_violation';
  end if;

  -- Convención nº 2: la organización se comprueba explícitamente aunque RLS
  -- ya filtre fila a fila.
  if not is_member(v_org) then
    raise exception 'No perteneces a esa organización'
      using errcode = 'insufficient_privilege';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'Un pedido necesita al menos una línea'
      using errcode = 'check_violation';
  end if;

  -- Convención nº 5: se busca por `kind`, jamás por nombre. El juego lo
  -- resuelve la misma función que usa el tablero, así que un pedido nunca
  -- puede nacer en un estado que su línea no tenga.
  select s.id into v_status
  from resolve_statuses(v_org, v_line, 'order') s
  where s.kind = 'initial'
  order by s.position
  limit 1;

  if v_status is null then
    raise exception 'La línea no tiene un estado inicial configurado'
      using errcode = 'check_violation';
  end if;

  -- `kind` es siempre 'order': la venta directa tiene su propio flujo (V6,
  -- KAM-12) y no entra por aquí.
  insert into orders (
    id, organization_id, business_line_id, kind, contact_id, status_id,
    sales_channel_id, delivery_mode, due_date, occurred_at, notes, created_by
  ) values (
    v_id, v_org, v_line, 'order',
    nullif(p_order->>'contact_id', '')::uuid,
    v_status,
    nullif(p_order->>'sales_channel_id', '')::uuid,
    nullif(p_order->>'delivery_mode', ''),
    nullif(p_order->>'due_date', '')::date,
    -- La hora del hecho la fija el cliente (convención nº 9); `created_at`,
    -- el servidor.
    coalesce(nullif(p_order->>'occurred_at', '')::timestamptz, now()),
    nullif(p_order->>'notes', ''),
    auth.uid()
  );

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into order_items (
      id, organization_id, order_id, item_id, variant_id,
      description, quantity, unit_price
    ) values (
      coalesce(nullif(v_item->>'id', '')::uuid, gen_random_uuid()),
      v_org, v_id,
      nullif(v_item->>'item_id', '')::uuid,
      nullif(v_item->>'variant_id', '')::uuid,
      nullif(v_item->>'description', ''),
      (v_item->>'quantity')::numeric,
      -- El precio que se registró, no el que tenga el catálogo (esquema §2).
      (v_item->>'unit_price')::numeric
    );
  end loop;

  return v_id;
end $$;

-- ── Edición: los mismos cambios, en una sola transacción ──────────────────
-- Actualiza solo lo editable. `business_line_id` no se toca nunca: cambiarla
-- cambiaría el flujo de estados del pedido. `status_id`, `code` y
-- `archived_at` tampoco: tienen sus propias vías (mover de estado, el trigger
-- de numeración, archivar).
--
-- Las líneas que no vengan en `p_items` se archivan (D2). Es deliberado que
-- la lista sea completa y no un diferencial: un diferencial obligaría al
-- cliente a llevar la cuenta de lo que quitó, y equivocarse ahí es peor.

create or replace function update_order(p_order jsonb, p_items jsonb)
returns void
language plpgsql security invoker as $$
declare
  v_id        uuid := nullif(p_order->>'id', '')::uuid;
  v_org       uuid := nullif(p_order->>'organization_id', '')::uuid;
  v_order     orders%rowtype;
  v_item      jsonb;
  v_item_id   uuid;
  v_kept      uuid[] := '{}';
  v_remaining bigint;
begin
  if v_id is null or v_org is null then
    raise exception 'No se pudo identificar el pedido'
      using errcode = 'check_violation';
  end if;

  if not is_member(v_org) then
    raise exception 'No perteneces a esa organización'
      using errcode = 'insufficient_privilege';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'Un pedido necesita al menos una línea'
      using errcode = 'check_violation';
  end if;

  select * into v_order
  from orders
  where id = v_id and organization_id = v_org
  for update;

  if not found then
    raise exception 'Ese pedido ya no está a tu alcance'
      using errcode = 'no_data_found';
  end if;

  -- `enforce_archive_rules` deja pasar una edición que solo toca
  -- `updated_at`, así que la puerta se cierra aquí explícitamente: el mismo
  -- mensaje que usa el trigger, para que la acción lo traduzca igual.
  if v_order.archived_at is not null then
    raise exception 'Un registro archivado no se puede editar: desarchívalo primero'
      using errcode = 'check_violation';
  end if;

  update orders set
    contact_id       = nullif(p_order->>'contact_id', '')::uuid,
    sales_channel_id = nullif(p_order->>'sales_channel_id', '')::uuid,
    delivery_mode    = nullif(p_order->>'delivery_mode', ''),
    due_date         = nullif(p_order->>'due_date', '')::date,
    notes            = nullif(p_order->>'notes', ''),
    updated_at       = now()
  where id = v_id and organization_id = v_org;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_item_id := coalesce(nullif(v_item->>'id', '')::uuid, gen_random_uuid());
    v_kept := v_kept || v_item_id;

    update order_items set
      item_id     = nullif(v_item->>'item_id', '')::uuid,
      variant_id  = nullif(v_item->>'variant_id', '')::uuid,
      description = nullif(v_item->>'description', ''),
      quantity    = (v_item->>'quantity')::numeric,
      unit_price  = (v_item->>'unit_price')::numeric,
      -- Una línea que vuelve deja de estar archivada.
      archived_at = null
    where id = v_item_id and order_id = v_id;

    if not found then
      insert into order_items (
        id, organization_id, order_id, item_id, variant_id,
        description, quantity, unit_price
      ) values (
        v_item_id, v_org, v_id,
        nullif(v_item->>'item_id', '')::uuid,
        nullif(v_item->>'variant_id', '')::uuid,
        nullif(v_item->>'description', ''),
        (v_item->>'quantity')::numeric,
        (v_item->>'unit_price')::numeric
      );
    end if;
  end loop;

  -- Lo que el formulario ya no lleva, se archiva. Nunca se borra.
  update order_items
  set archived_at = now()
  where order_id = v_id
    and archived_at is null
    and not (id = any(v_kept));

  select count(*) into v_remaining
  from order_items
  where order_id = v_id and archived_at is null;

  if v_remaining = 0 then
    raise exception 'Un pedido necesita al menos una línea'
      using errcode = 'check_violation';
  end if;
end $$;

-- ── Privilegios ───────────────────────────────────────────────────────────
-- Ninguna política nueva: con `security invoker`, RLS de KAM-07 sigue
-- decidiendo quién escribe cada fila.
--
-- El `revoke` es a `public` y no a `anon`: el privilegio de ejecución de una
-- función nace en `public`, así que revocárselo a un rol concreto no le
-- quitaría nada.

revoke execute on function create_order(jsonb, jsonb) from public;
revoke execute on function update_order(jsonb, jsonb) from public;

grant execute on function create_order(jsonb, jsonb) to authenticated;
grant execute on function update_order(jsonb, jsonb) to authenticated;
