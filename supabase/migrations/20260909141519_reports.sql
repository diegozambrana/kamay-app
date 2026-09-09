-- KAM-20 · Reportes (V14): funciones derivadas de los cinco informes.
-- Requisitos: openspec/changes/kam-20-reports/specs/reports/spec.md,
--   .../specs/expenses/spec.md, .../specs/orders/spec.md,
--   .../specs/payments/spec.md.
-- Decisiones: design.md D2 (funciones con parámetros, no vistas), D3 (el
--   recorte al dueño va dentro), D4 (la agregación aquí, el reparto en
--   TypeScript), D6 (el costo son los egresos asignados), D10 (índices).
--
-- ── Por qué funciones y no vistas ─────────────────────────────────────────
-- Una vista no acepta parámetros y el periodo de V14 es un parámetro: un
-- rango puede empezar el día 12. Sumar vistas mensuales daría una cifra que
-- no es la pedida, y redondear el periodo al mes para que encaje sería
-- mentirle a quien eligió el rango.
--
-- La convención nº 4 dice "vistas con security_invoker"; su intención es
-- *nada se almacena y RLS sigue decidiendo*. `security invoker` en una
-- función da la misma garantía —no puede leer nada que quien la llama no
-- pudiera leer a mano— y es la herramienta que el proyecto ya usa cuando hace
-- falta un parámetro: `resolve_statuses` es el precedente. Aquí no se
-- almacena ninguna cifra.
--
-- ── El recorte al dueño ───────────────────────────────────────────────────
-- Cada función lleva su `is_owner(p_organization_id)`. No basta
-- `security invoker`: desde KAM-10 el ayudante SÍ lee cobros fila a fila
-- —los registra él—, así que un agregado que solo confiara en las políticas
-- heredadas le devolvería justo lo que la matriz de acceso §16 le niega.
-- Dentro de la función, el criterio 6 del backlog es una prueba pgTAP y no
-- una comprobación de navegador.
--
-- ── Los límites del rango ─────────────────────────────────────────────────
-- `p_from` inclusivo, `p_to` **exclusivo**. Los dos llegan ya resueltos como
-- instantes por `lib/reports/period.ts`, que corta el día en la zona horaria
-- de la organización. Aquí no se vuelve a decidir qué es "un día": hacerlo en
-- dos sitios es cómo se termina con dos respuestas distintas.

-- ── Índices (D10) ─────────────────────────────────────────────────────────
-- `payments (organization_id, occurred_at)` ya existe desde KAM-14.
-- `expenses (organization_id, occurred_at desc) where archived_at is null` y
-- `expenses (organization_id, business_line_id, occurred_at desc)` ya existen
-- desde KAM-09; no se duplican.
-- Lo que falta es el equivalente de pedidos y el del ranking por ítem.
create index if not exists orders_org_occurred_idx
  on orders (organization_id, occurred_at desc)
  where archived_at is null;

create index if not exists order_items_org_item_idx
  on order_items (organization_id, item_id)
  where archived_at is null;

-- ── `best_selling_products` NO se toca ────────────────────────────────────
-- Su ventana de 90 días está incrustada en la vista a propósito: alimenta la
-- retícula del modo feria (KAM-12), que no tiene selector de periodo y quiere
-- "lo que se vende ahora". `report_product_ranking` es otra pregunta —un
-- periodo elegido, con margen— y por eso es una función aparte y no un
-- parámetro añadido a aquélla. Si alguien encuentra las dos y le parecen
-- redundantes: no lo son, y cambiar una mirando la otra rompe una pantalla.

-- ── Flujo de caja por línea en un rango arbitrario ────────────────────────
-- Generaliza `cash_flow_by_line_month` (KAM-14), que sigue existiendo y sigue
-- sirviendo al panel: el panel no elige periodo y no gana nada llamando a una
-- función.
--
-- Se agrega sobre `line_cash_movements` (KAM-19), que ya hace lo difícil:
-- unir el movimiento con su pedido o su egreso para deducir la línea,
-- descartar lo archivado y recortar al dueño. Repetir aquí el `union all` de
-- dos ramas sería escribirlo por tercera vez, y ese es exactamente el punto
-- donde una corrección futura se aplica en dos sitios y se olvida en el
-- tercero.
create or replace function cash_flow_by_line_range(
  p_organization_id  uuid,
  p_from             timestamptz,
  p_to               timestamptz,
  p_business_line_id uuid default null
)
returns table (
  business_line_id uuid,
  collected        numeric,
  paid             numeric
)
language sql stable security invoker set search_path = public as $$
  select
    m.business_line_id,
    coalesce(sum(m.amount) filter (where m.direction = 'in'),  0) as collected,
    coalesce(sum(m.amount) filter (where m.direction = 'out'), 0) as paid
  from line_cash_movements m
  where m.organization_id = p_organization_id
    and m.occurred_at >= p_from
    and m.occurred_at <  p_to
    and (p_business_line_id is null or m.business_line_id = p_business_line_id)
    and is_owner(p_organization_id)
  group by m.business_line_id;
$$;

-- ── En qué se va el dinero ────────────────────────────────────────────────
-- Egresos del rango por categoría y línea. Las compras no llevan categoría de
-- gasto: van bajo una entrada propia con `expense_category_id` nulo y
-- `kind = 'purchase'`, identificable sin adivinar. Atribuirlas a una
-- categoría real las escondería; dejarlas fuera descuadraría el total contra
-- el comparativo, y el criterio 1 exige que cuadren.
--
-- Se apoya en `expense_totals` (KAM-09), que ya resuelve el total de cada
-- egreso —monto propio del gasto, o suma de las líneas de la compra— y ya
-- excluye lo archivado. Rehacer esa suma aquí sería una segunda definición de
-- "cuánto costó esto".
create or replace function report_expense_breakdown(
  p_organization_id  uuid,
  p_from             timestamptz,
  p_to               timestamptz,
  p_business_line_id uuid default null
)
returns table (
  expense_category_id uuid,
  business_line_id    uuid,
  kind                text,
  total               numeric
)
language sql stable security invoker set search_path = public as $$
  select
    e.expense_category_id,
    et.business_line_id,
    et.kind,
    sum(et.total) as total
  from expense_totals et
  join expenses e
    on e.id = et.expense_id
   and e.organization_id = et.organization_id
  where et.organization_id = p_organization_id
    and et.occurred_at >= p_from
    and et.occurred_at <  p_to
    and (p_business_line_id is null or et.business_line_id = p_business_line_id)
    and is_owner(p_organization_id)
  group by e.expense_category_id, et.business_line_id, et.kind;
$$;

-- ── El costo de materiales de un pedido ───────────────────────────────────
-- Los egresos asignados al pedido (`expenses.order_id`, KAM-09), por su total
-- derivado. **Nada más, y conviene dejar escrito por qué.**
--
-- Los consumos de inventario NO entran, y no es un olvido: KAM-18 graba todo
-- consumo con `source_type = 'manual'` cualquiera sea el punto de entrada, y
-- desde un pedido solo prellena la NOTA con su referencia —texto libre y
-- modificable—. Dejó `'order_item'` declarado y sin uso porque su índice
-- único habría limitado el enlace a un movimiento por línea de pedido, y
-- consumir tres insumos para la misma línea es el caso normal. Además
-- `inventory_movements` no lleva costo unitario.
--
-- Deducir el pedido desde el texto de la nota daría una cifra de margen que
-- depende de que nadie edite una nota: no es auditable. Enlazarlos de verdad
-- es un cambio de `inventory`, no de `reports` (design D6).
--
-- Consecuencia asumida: la mayoría de los pedidos no tendrá egreso asignado,
-- su costo será cero y su margen el 100 %. Por eso `has_cost` sale como
-- columna y no como cálculo del cliente: la pantalla la muestra y **filtra por
-- ella**, que es lo que impide leer "no lo sé" como "gané todo".
create or replace function report_profitability(
  p_organization_id  uuid,
  p_from             timestamptz,
  p_to               timestamptz,
  p_business_line_id uuid default null
)
returns table (
  order_id         uuid,
  business_line_id uuid,
  occurred_at      timestamptz,
  revenue          numeric,
  material_cost    numeric,
  has_cost         boolean
)
language sql stable security invoker set search_path = public as $$
  select
    ot.order_id,
    ot.business_line_id,
    ot.occurred_at,
    ot.total as revenue,
    coalesce(cost.total, 0) as material_cost,
    cost.total is not null  as has_cost
  from order_totals ot
  left join lateral (
    select sum(et.total) as total
    from expense_totals et
    join expenses e
      on e.id = et.expense_id
     and e.organization_id = et.organization_id
    where e.order_id = ot.order_id
      and e.organization_id = ot.organization_id
  ) cost on true
  where ot.organization_id = p_organization_id
    and ot.occurred_at >= p_from
    and ot.occurred_at <  p_to
    and (p_business_line_id is null or ot.business_line_id = p_business_line_id)
    and is_owner(p_organization_id)
$$;

-- ── Qué se vende más ──────────────────────────────────────────────────────
-- Unidades, ingresos, costo atribuido y margen por ítem en el rango. Las dos
-- columnas que importan —unidades y margen— salen juntas siempre, porque el
-- propósito declarado del informe es distinguir el producto que vende mucho y
-- deja poco: ordenar por una y perder la otra lo haría imposible.
--
-- El ingreso es `quantity * unit_price` de la línea: **el precio que se
-- registró**, no el que el catálogo tenga hoy. Un producto que subió de precio
-- en agosto no reescribe lo que se ganó en marzo.
--
-- El costo del pedido se prorratea entre sus ítems **en proporción a su
-- ingreso**. Es la única atribución defendible sin fichas de producto: sin
-- receta no hay forma de saber qué insumo entró en qué producto. Un pedido sin
-- egreso asignado atribuye cero, no una estimación.
--
-- Las ventas directas cuentan igual que los pedidos: `order_totals` ya las
-- incluye y aquí se lee `orders` sin filtrar por `kind`, que es el mismo
-- criterio con el que las consultas de ingresos ya las incluyen.
create or replace function report_product_ranking(
  p_organization_id  uuid,
  p_from             timestamptz,
  p_to               timestamptz,
  p_business_line_id uuid default null
)
returns table (
  item_id          uuid,
  units_sold       numeric,
  revenue          numeric,
  attributed_cost  numeric,
  top_channel_id   uuid
)
language sql stable security invoker set search_path = public as $$
  with line as (
    select
      oi.item_id,
      o.id                          as order_id,
      o.sales_channel_id,
      oi.quantity,
      oi.quantity * oi.unit_price   as revenue
    from order_items oi
    join orders o
      on o.id = oi.order_id
     and o.organization_id = oi.organization_id
    where oi.organization_id = p_organization_id
      and oi.item_id is not null
      and oi.archived_at is null
      and o.archived_at is null
      and o.occurred_at >= p_from
      and o.occurred_at <  p_to
      and (p_business_line_id is null or o.business_line_id = p_business_line_id)
      and is_owner(p_organization_id)
  ),
  -- El ingreso total de cada pedido dentro del rango: el denominador del
  -- prorrateo. Se calcula sobre las mismas líneas que se están sumando, no
  -- sobre `order_totals`, para que ambas cifras hablen del mismo conjunto.
  order_revenue as (
    select order_id, sum(revenue) as total from line group by order_id
  ),
  order_cost as (
    select
      e.order_id,
      sum(et.total) as total
    from expense_totals et
    join expenses e
      on e.id = et.expense_id
     and e.organization_id = et.organization_id
    where e.organization_id = p_organization_id
      and e.order_id is not null
    group by e.order_id
  )
  select
    l.item_id,
    sum(l.quantity) as units_sold,
    sum(l.revenue)  as revenue,
    -- `nullif` en el denominador: un pedido cuyo ingreso es cero no puede
    -- prorratear nada, y dividir por cero aquí tumbaría el informe entero.
    coalesce(sum(
      coalesce(oc.total, 0) * l.revenue / nullif(orv.total, 0)
    ), 0) as attributed_cost,
    (
      select l2.sales_channel_id
      from line l2
      where l2.item_id = l.item_id and l2.sales_channel_id is not null
      group by l2.sales_channel_id
      order by sum(l2.quantity) desc, l2.sales_channel_id
      limit 1
    ) as top_channel_id
  from line l
  join order_revenue orv on orv.order_id = l.order_id
  left join order_cost  oc on oc.order_id = l.order_id
  group by l.item_id;
$$;

-- ── Insumos por acabarse ──────────────────────────────────────────────────
-- Sin parámetro de rango, y eso es deliberado: "estoy por quedarme sin esto"
-- es una pregunta sobre HOY, no sobre un periodo. La pantalla lo dice junto al
-- informe para que su indiferencia al selector no se lea como un fallo.
--
-- `below_min` ya lo deriva `item_balances` (KAM-18) y aquí se lee, no se
-- recalcula: un insumo sin mínimo declarado nunca da `true`, así que la regla
-- "sin mínimo no aparece" ya está impuesta en la fuente.
create or replace function report_low_stock(
  p_organization_id  uuid,
  p_business_line_id uuid default null
)
returns table (
  item_id           uuid,
  balance           numeric,
  min_stock         numeric,
  missing           numeric,
  last_cost         numeric,
  last_supplier_id  uuid
)
language sql stable security invoker set search_path = public as $$
  select
    b.item_id,
    b.balance,
    b.min_stock,
    b.min_stock - b.balance as missing,
    lc.last_cost,
    lc.last_supplier_id
  from item_balances b
  join items i
    on i.id = b.item_id
   and i.organization_id = b.organization_id
  left join item_last_cost lc
    on lc.item_id = b.item_id
   and lc.organization_id = b.organization_id
  where b.organization_id = p_organization_id
    and b.below_min
    and i.archived_at is null
    -- Un insumo puede ser compartido (sin línea propia): con una línea
    -- elegida, se muestran los suyos y los compartidos, porque quedarse sin
    -- un insumo compartido también deja parada a esa línea.
    and (
      p_business_line_id is null
      or i.business_line_id is null
      or i.business_line_id = p_business_line_id
    )
    and is_owner(p_organization_id);
$$;

-- ── Comparativo entre líneas ──────────────────────────────────────────────
-- Ingresos y egresos propios de cada línea en el rango, más la línea
-- compartida en su propia fila identificable por `is_shared`.
--
-- **No reparte** (design D4). El reparto es aritmética pequeña con muchos
-- casos límite —ingresos cero, una sola línea activa, línea archivada, línea
-- nueva sin porcentaje, redondeo que no cuadra— y vive en
-- `lib/reports/allocation.ts`, donde cada uno es una prueba unitaria de tres
-- líneas en vez de un `db reset` por caso. Además la regla vive en
-- `organizations.settings`, que la aplicación ya lee para componer la leyenda,
-- y KAM-19 necesitará el mismo reparto para la recuperación por línea.
--
-- Toda línea no archivada devuelve fila, aunque no haya tenido movimiento: su
-- ausencia de la tabla y su ausencia de actividad son dos lecturas distintas,
-- y el `left join` es lo que las mantiene separadas.
create or replace function report_line_comparison(
  p_organization_id uuid,
  p_from            timestamptz,
  p_to              timestamptz
)
returns table (
  business_line_id uuid,
  is_shared        boolean,
  collected        numeric,
  paid             numeric
)
language sql stable security invoker set search_path = public as $$
  select
    bl.id        as business_line_id,
    bl.is_shared,
    coalesce(f.collected, 0) as collected,
    coalesce(f.paid, 0)      as paid
  from business_lines bl
  left join cash_flow_by_line_range(p_organization_id, p_from, p_to) f
    on f.business_line_id = bl.id
  where bl.organization_id = p_organization_id
    and bl.archived_at is null
    and is_owner(p_organization_id)
  order by bl.is_shared, bl.position;
$$;

-- ── Privilegios ───────────────────────────────────────────────────────────
-- El `revoke` es a `public` y no a `anon`: el privilegio de ejecución nace en
-- `public`, así que revocárselo a un rol concreto no le quitaría nada. Es el
-- mismo patrón de `create_direct_sale` (KAM-12).
revoke execute on function cash_flow_by_line_range(uuid, timestamptz, timestamptz, uuid) from public;
revoke execute on function report_expense_breakdown(uuid, timestamptz, timestamptz, uuid) from public;
revoke execute on function report_profitability(uuid, timestamptz, timestamptz, uuid)     from public;
revoke execute on function report_product_ranking(uuid, timestamptz, timestamptz, uuid)   from public;
revoke execute on function report_low_stock(uuid, uuid)                                   from public;
revoke execute on function report_line_comparison(uuid, timestamptz, timestamptz)         from public;

grant execute on function cash_flow_by_line_range(uuid, timestamptz, timestamptz, uuid) to authenticated;
grant execute on function report_expense_breakdown(uuid, timestamptz, timestamptz, uuid) to authenticated;
grant execute on function report_profitability(uuid, timestamptz, timestamptz, uuid)     to authenticated;
grant execute on function report_product_ranking(uuid, timestamptz, timestamptz, uuid)   to authenticated;
grant execute on function report_low_stock(uuid, uuid)                                   to authenticated;
grant execute on function report_line_comparison(uuid, timestamptz, timestamptz)         to authenticated;
