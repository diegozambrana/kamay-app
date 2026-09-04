-- KAM-11 · Infraestructura sin conexión: las dos garantías que la captura
-- sin red necesita de la base de datos.
--
-- Requisitos: openspec/changes/kam-11-offline-infrastructure/specs/orders/spec.md
--             y .../specs/activity-log/spec.md
-- Decisiones: design.md — decisión 5 (la no duplicación se garantiza en la
--             base, no en el cliente) y decisión 6 (la bitácora toma la hora
--             del registro cuando el registro la tiene).
--
-- Esta migración no crea ni altera ninguna tabla, ninguna política y ningún
-- `grant`: solo redefine dos funciones, conservando sus firmas exactas para
-- que los `grant execute` de KAM-08 y de KAM-03 sigan vigentes.

-- ── 1. `create_order` se vuelve idempotente ───────────────────────────────
-- La cola de sincronización reintenta un envío cuya respuesta no llegó,
-- aunque la escritura sí se hubiera guardado. Sin esta cláusula, ese reintento
-- muere en `unique_violation` y la persona ve un error por un pedido que en
-- realidad ya existe. ARCHITECTURE.md (§ Modo sin conexión) ya anunciaba
-- `on conflict do nothing` como la red de seguridad; aquí se escribe.
--
-- La garantía vive aquí y no en el cliente porque el cliente puede perder la
-- respuesta, reiniciarse o reintentar de más, y porque la semilla, las pruebas
-- y cualquier cliente futuro escriben por esta misma puerta.
--
-- Salvo el bloque de idempotencia, la función es la de `20260903120000`.

create or replace function create_order(p_order jsonb, p_items jsonb)
returns uuid
language plpgsql security invoker as $$
declare
  v_org      uuid := nullif(p_order->>'organization_id', '')::uuid;
  v_line     uuid := nullif(p_order->>'business_line_id', '')::uuid;
  v_id       uuid := coalesce(nullif(p_order->>'id', '')::uuid, gen_random_uuid());
  v_status   uuid;
  v_item     jsonb;
  v_existing uuid;
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
  --
  -- `on conflict (id) do nothing`: reenviar un pedido ya guardado no crea un
  -- segundo, no consume otro número visible y no vuelve a disparar el trigger
  -- de bitácora. El identificador lo genera el cliente (convención nº 9), así
  -- que es el mismo en todos los reintentos.
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
    -- el servidor. Un pedido registrado a las 15:40 sin señal y sincronizado
    -- a las 21:00 conserva las 15:40.
    coalesce(nullif(p_order->>'occurred_at', '')::timestamptz, now()),
    nullif(p_order->>'notes', ''),
    auth.uid()
  )
  on conflict (id) do nothing;

  -- Un `do nothing` silencioso sobre un identificador que pertenece a OTRA
  -- organización convertiría un pedido ajeno en un «ya existe, todo bien».
  -- La comprobación lo vuelve un rechazo explícito. `security invoker` hace
  -- que RLS oculte la fila ajena, así que la ausencia también es rechazo.
  select o.id into v_existing
  from orders o
  where o.id = v_id and o.organization_id = v_org;

  if v_existing is null then
    raise exception 'Ese identificador ya pertenece a otro pedido'
      using errcode = 'insufficient_privilege';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    -- También idempotente: cuando el pedido ya existía, el `insert` de arriba
    -- no insertó nada y este bucle se ejecuta igual. Sin la cláusula, el
    -- reenvío moriría aquí, en la primera línea.
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
    )
    on conflict (id) do nothing;
  end loop;

  return v_id;
end $$;

-- ── 2. La bitácora fecha con la hora del hecho, no con la de la llegada ───
-- La especificación funcional (§ Bitácora) lo pide sin matices: «fecha y hora
-- del hecho real, no de la sincronización». Sin esto, veinte ventas de feria
-- sincronizadas juntas aparecerían todas a la hora de la reconexión.
--
-- Genérico a propósito: sirve para `orders` hoy y para `payments` y las ventas
-- de feria mañana, sin volver a tocar la función.
--
-- **Solo el evento `created`.** Para `updated`, `archived` y `status_changed`
-- no existe ninguna columna que lleve la hora real del gesto —`updated_at` la
-- pone el servidor al recibirlo—, así que inventarla haría mentir a la
-- bitácora en la dirección contraria. Esos eventos conservan `now()`, y con
-- ellos la ventana de fusión de ruido, que solo mira eventos `updated`.
--
-- Salvo el `occurred_at` del `insert` final, la función es la de
-- `20260820120000`.

create or replace function log_activity()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb; v_new jsonb; v_changes jsonb; v_delta jsonb;
  v_action text; v_org uuid; v_line uuid;
  v_ignored text[] := array['updated_at','created_at'];
  v_actor uuid; v_record uuid;
  v_merge_id bigint; v_merge_changes jsonb;
  v_occurred timestamptz;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new); v_action := 'created'; v_changes := v_new;
  else
    v_old := to_jsonb(old); v_new := to_jsonb(new);

    if v_old->>'archived_at' is null and v_new->>'archived_at' is not null then
      v_action := 'archived';
    elsif v_old->>'archived_at' is not null and v_new->>'archived_at' is null then
      v_action := 'unarchived';
    elsif v_old->>'status_id' is distinct from v_new->>'status_id' then
      v_action := 'status_changed';
    else
      v_action := 'updated';
    end if;

    -- solo los campos que realmente cambiaron; created_at y updated_at nunca cuentan
    select jsonb_object_agg(e.key, jsonb_build_object('antes', v_old->e.key,
                                                      'despues', v_new->e.key))
    into v_changes
    from jsonb_each(v_new) e
    where v_new->e.key is distinct from v_old->e.key
      and not (e.key = any(v_ignored));

    if v_changes is null then return new; end if;   -- nada relevante cambió
  end if;

  -- Toda tabla de negocio lleva organization_id; en `organizations` la
  -- organización es la fila misma.
  v_org    := coalesce((v_new->>'organization_id')::uuid, (v_new->>'id')::uuid);
  v_line   := nullif(v_new->>'business_line_id','')::uuid;
  v_actor  := auth.uid();
  v_record := (v_new->>'id')::uuid;

  -- La hora del hecho. En una creación, la del registro si la trae; en todo
  -- lo demás, la de ahora. Una tabla auditada sin `occurred_at` se comporta
  -- exactamente como antes.
  v_occurred := case
    when v_action = 'created'
      then coalesce(nullif(v_new->>'occurred_at','')::timestamptz, now())
    else now()
  end;

  -- Agrupación de ruido: ediciones sucesivas del mismo autor sobre el mismo
  -- registro dentro de 5 minutos se consolidan en un solo evento. Creación,
  -- archivado, desarchivado y cambio de estado nunca se fusionan, así que un
  -- `created` fechado en el pasado no entra en esta ventana ni la altera.
  if v_action = 'updated' then
    select l.id, l.changes into v_merge_id, v_merge_changes
    from activity_log l
    where l.table_name = tg_table_name
      and l.record_id = v_record
      and l.action = 'updated'
      and l.actor_id is not distinct from v_actor
      and l.occurred_at > now() - interval '5 minutes'
    order by l.occurred_at desc, l.id desc
    limit 1;

    if v_merge_id is not null then
      -- El evento fusionado representa el diff neto de la ventana: por cada
      -- campo se conserva el valor anterior más viejo y el nuevo más reciente.
      select jsonb_object_agg(e.key,
               case when v_merge_changes ? e.key
                 then jsonb_build_object('antes',   v_merge_changes->e.key->'antes',
                                         'despues', e.value->'despues')
                 else e.value
               end)
      into v_delta
      from jsonb_each(v_changes) e;

      update activity_log
        set changes = v_merge_changes || v_delta
      where id = v_merge_id;

      return new;
    end if;
  end if;

  insert into activity_log (organization_id, business_line_id, actor_id,
                            table_name, record_id, action, changes, origin,
                            occurred_at)
  values (v_org, v_line, v_actor, tg_table_name,
          v_record, v_action, v_changes,
          nullif(current_setting('request.headers', true), '')::json->>'x-client-origin',
          v_occurred);

  return new;
end $$;
