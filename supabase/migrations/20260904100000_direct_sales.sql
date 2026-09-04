-- KAM-12 · Modo feria y venta rápida: alta de la venta directa y la cuadrícula
-- de más vendidos.
-- DDL canónico: specs/PRD/kamay-esquema-base-de-datos-supabase.md §9 (una sola
--   tabla `orders` con `kind`), § Vistas derivadas.
-- Requisitos: openspec/changes/kam-12-fair-mode-quick-sale/specs/fair-mode/spec.md
-- Decisiones: design.md D1 (reutilizar `orders`, sin tabla nueva), D2 (venta,
--   líneas y cobro en una transacción), D3 (estado de tipo `final` por menor
--   posición), D4 (la cuadrícula sale de una vista derivada).
--
-- Esta migración **no crea ninguna tabla ni columna**: `orders`, `order_items`
-- y `payments` ya sirven tal cual. El esquema canónico reservó `kind` para
-- esto precisamente para que ninguna consulta de ingresos tenga que unir dos
-- fuentes y mantenerlas sincronizadas.

-- ── Cuadrícula: qué se vende más, en los últimos 90 días ───────────────────
-- Convención nº 4: derivado, en una vista, nunca en una columna. La ventana
-- se declara **una sola vez, aquí**, para que KAM-20 la herede sin volver a
-- decidirla (design, decisión 4).
--
-- Suma pedidos y ventas directas por igual: lo que más se vende es lo que más
-- se vende, con o sin pedido de por medio.
--
-- La vista NO es la fuente de la cuadrícula, es su orden: la consulta parte
-- del catálogo vendible y hace `left join` con esto. Ordenar solo por aquí
-- dejaría invisible cualquier producto recién creado, que es justo el que más
-- falta hace mostrar.

create view best_selling_products with (security_invoker = true) as
select
  oi.organization_id,
  o.business_line_id,
  oi.item_id,
  oi.variant_id,
  sum(oi.quantity)  as quantity_sold,
  count(*)          as times_sold,
  max(o.occurred_at) as last_sold_at
from order_items oi
join orders o on o.id = oi.order_id
where oi.archived_at is null
  and o.archived_at is null
  and oi.item_id is not null
  and o.occurred_at >= now() - interval '90 days'
group by oi.organization_id, o.business_line_id, oi.item_id, oi.variant_id;

-- ── Alta de la venta directa ──────────────────────────────────────────────
-- Hermana de `create_order`, con tres diferencias deliberadas: el cliente es
-- opcional, la venta nace en un estado de tipo `final` —no recorre ningún
-- ciclo de producción— y acepta el cobro en la misma llamada.
--
-- El cobro va dentro y no en una segunda llamada porque una venta de feria
-- cobrada es **un solo hecho** (design, decisión 2). Separarlos obligaría a la
-- cola sin conexión a garantizar atomicidad entre dos elementos, y el primer
-- fallo de red dejaría ventas sin cobro que nadie va a reconciliar en un
-- puesto de feria.
--
-- `security invoker` como todas: RLS sigue siendo la autorización real y esta
-- función no puede hacer nada que quien la llama no pudiera hacer a mano.

create or replace function create_direct_sale(
  p_sale    jsonb,
  p_items   jsonb,
  p_payment jsonb default null
)
returns uuid
language plpgsql security invoker as $$
declare
  v_org        uuid := nullif(p_sale->>'organization_id', '')::uuid;
  v_line       uuid := nullif(p_sale->>'business_line_id', '')::uuid;
  v_id         uuid := coalesce(nullif(p_sale->>'id', '')::uuid, gen_random_uuid());
  v_occurred   timestamptz;
  v_status     uuid;
  v_existing   uuid;
  v_item       jsonb;
  v_amount     numeric(14,2);
begin
  if v_org is null or v_line is null then
    raise exception 'La venta necesita organización y línea de negocio'
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
    raise exception 'Una venta necesita al menos una línea'
      using errcode = 'check_violation';
  end if;

  -- La hora del hecho la fija el cliente (convención nº 9); `created_at`, el
  -- servidor. Una venta de las 15:40 sin señal, sincronizada a las 21:00,
  -- conserva las 15:40 — y su cobro también, por eso se resuelve una sola vez
  -- y se reutiliza abajo.
  v_occurred := coalesce(nullif(p_sale->>'occurred_at', '')::timestamptz, now());

  -- Convención nº 5: se busca por `kind`, jamás por nombre. Es la misma
  -- función que resuelve las columnas del tablero, así que una venta nunca
  -- puede nacer en un estado que su línea no tenga. El flujo consultado sigue
  -- siendo 'order': no existe un flujo 'direct_sale' (design, decisión 3).
  select s.id into v_status
  from resolve_statuses(v_org, v_line, 'order') s
  where s.kind = 'final'
  order by s.position
  limit 1;

  -- `assert_status_set_valid` garantiza desde KAM-05 que todo juego tiene al
  -- menos un `final`, así que esto no debería ocurrir nunca. Se comprueba
  -- igual: una garantía que no se verifica deja de serlo en cuanto alguien
  -- toca la otra migración.
  if v_status is null then
    raise exception 'La línea no tiene un estado final configurado'
      using errcode = 'check_violation';
  end if;

  -- `on conflict (id) do nothing`: reenviar una venta ya guardada no crea una
  -- segunda, no consume otro número visible y no vuelve a disparar la
  -- bitácora. El identificador lo genera el cliente (convención nº 9), así que
  -- es el mismo en todos los reintentos de la cola.
  --
  -- `contact_id` opcional: la restricción `order_needs_customer` solo exige
  -- cliente cuando `kind = 'order'`. `delivery_mode` y `due_date` se quedan
  -- nulos: una venta de feria se entrega en el acto.
  insert into orders (
    id, organization_id, business_line_id, kind, contact_id, status_id,
    sales_channel_id, occurred_at, notes, created_by
  ) values (
    v_id, v_org, v_line, 'direct_sale',
    nullif(p_sale->>'contact_id', '')::uuid,
    v_status,
    nullif(p_sale->>'sales_channel_id', '')::uuid,
    v_occurred,
    nullif(p_sale->>'notes', ''),
    auth.uid()
  )
  on conflict (id) do nothing;

  -- Un `do nothing` silencioso sobre un identificador que pertenece a OTRA
  -- organización convertiría una venta ajena en un «ya existe, todo bien».
  -- `security invoker` hace que RLS oculte la fila ajena, así que la ausencia
  -- también es rechazo.
  select o.id into v_existing
  from orders o
  where o.id = v_id and o.organization_id = v_org;

  if v_existing is null then
    raise exception 'Ese identificador ya pertenece a otra venta o pedido'
      using errcode = 'insufficient_privilege';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    -- También idempotente: cuando la venta ya existía, el `insert` de arriba
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
      -- El precio que se registró, no el que tenga el catálogo hoy.
      (v_item->>'unit_price')::numeric
    )
    on conflict (id) do nothing;
  end loop;

  -- ── El cobro, dentro de la misma transacción ────────────────────────────
  -- `p_payment` nulo registra la venta sin cobro: es el caso raro, no el
  -- imposible. Un monto de cero se trata igual que ausente — la restricción
  -- `amount > 0` de KAM-10 lo rechazaría, y registrar «cobré nada» no es un
  -- hecho, es la ausencia de uno.
  --
  -- `direction = 'in'` literal: `direction_matches_target` de KAM-10 ya lo
  -- exige para cualquier movimiento contra un pedido, y una venta directa es
  -- un pedido a efectos de la tabla.
  if p_payment is not null and jsonb_typeof(p_payment) <> 'null' then
    v_amount := nullif(p_payment->>'amount', '')::numeric;

    -- Un monto negativo NO es «no hubo cobro»: es una llamada equivocada, y
    -- tragársela en silencio dejaría la venta registrada como si se hubiera
    -- cobrado bien. Se rechaza aquí, en vez de dejar que la restricción
    -- `amount > 0` de KAM-10 lo diga con un mensaje que no menciona la venta.
    if v_amount is not null and v_amount < 0 then
      raise exception 'El cobro de una venta no puede ser negativo'
        using errcode = 'check_violation';
    end if;

    if v_amount is not null and v_amount > 0 then
      insert into payments (
        id, organization_id, direction, order_id, amount, method,
        occurred_at, note, created_by
      ) values (
        coalesce(nullif(p_payment->>'id', '')::uuid, gen_random_uuid()),
        v_org, 'in', v_id, v_amount,
        nullif(p_payment->>'method', ''),
        -- La misma hora del hecho que la venta: se cobró al venderla.
        coalesce(nullif(p_payment->>'occurred_at', '')::timestamptz, v_occurred),
        nullif(p_payment->>'note', ''),
        auth.uid()
      )
      on conflict (id) do nothing;
    end if;
  end if;

  return v_id;
end $$;

-- ── Privilegios ───────────────────────────────────────────────────────────
-- Ninguna política nueva: con `security invoker`, las políticas de `orders`
-- (KAM-07), `order_items` (KAM-07) y `payments` (KAM-10) siguen decidiendo
-- quién escribe cada fila. El ayudante puede vender porque puede crear
-- pedidos y cobros; no hace falta escribir eso otra vez aquí.
--
-- El `revoke` es a `public` y no a `anon`: el privilegio de ejecución nace en
-- `public`, así que revocárselo a un rol concreto no le quitaría nada.

revoke execute on function create_direct_sale(jsonb, jsonb, jsonb) from public;
grant execute on function create_direct_sale(jsonb, jsonb, jsonb) to authenticated;

grant select on best_selling_products to authenticated, service_role;
