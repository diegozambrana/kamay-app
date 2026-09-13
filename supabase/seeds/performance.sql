-- ── Kamay Rendimiento · un año de trabajo de un taller real (KAM-23) ───────
--
-- La semilla contra la que se mide el presupuesto de carga del panel (spec
-- `performance-budget` → *The performance seed contains twelve months of
-- data*). «Kamay Histórico» (seed.sql, KAM-14) ya tiene doce meses, pero con
-- un pedido por línea y por mes: treinta y seis en todo el año. Un taller
-- que vive de esto hace varios por semana, y es ese volumen el que encarece
-- las vistas derivadas —totales, saldos, caja por mes, comparativo— y el que
-- el criterio 7 del backlog quiere acotar.
--
-- Organización propia, como toda semilla de prueba: nada de lo que aquí se
-- inserta cambia lo que ven las suites de Geeko ni las cifras exactas que
-- afirman las de Kamay Histórico.
--
-- **Determinista.** Ningún `random()`: cantidades, precios, estados y fechas
-- salen de aritmética sobre el número de fila, y los identificadores de
-- `md5()`, de modo que dos `supabase db reset` producen lo mismo y dos
-- mediciones son comparables. Las fechas son relativas a `now()` porque el
-- año que se mide es siempre el último.
--
-- Volumen (por año): 624 pedidos con 1.248 líneas y sus cobros, 156
-- compras con 312 líneas —que generan sus entradas de inventario—, 52 gastos
-- y sus pagos, 156 tareas y 60 avisos. La bitácora se llena sola: cada
-- inserción pasa por el disparador de auditoría.
--
-- Usuario: rendimiento@kamay.test (contraseña común de desarrollo).

insert into organizations (id, name) values
  ('10000000-0000-0000-0000-000000000005', 'Kamay Rendimiento');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current
) values (
  '00000000-0000-0000-0000-000000000000',
  '20000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated',
  'rendimiento@kamay.test',
  extensions.crypt('kamay123', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  now(), now(),
  '', '', '', '', ''
);

insert into auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(), '20000000-0000-0000-0000-000000000007',
  jsonb_build_object('sub', '20000000-0000-0000-0000-000000000007', 'email', 'rendimiento@kamay.test', 'email_verified', true),
  'email', '20000000-0000-0000-0000-000000000007',
  now(), now(), now()
);

insert into memberships (organization_id, user_id, role, display_name) values
  ('10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000007', 'owner', 'Dueña Rendimiento');

-- Todo lo que sigue vive en una función, como Geeko y Kamay Histórico en
-- seed.sql: la medición y las pruebas de listas acotadas trabajan cada una
-- sobre su propia copia (`e2e.clone_rendimiento()`, KAM-23). Para Kamay
-- Rendimiento conserva los identificadores de siempre.
create function e2e.seed_rendimiento(p_org uuid, p_owner uuid) returns void
language plpgsql set search_path = public, extensions as $rendimiento$
begin
  -- ── Configuración ─────────────────────────────────────────────────────────

  insert into business_lines (id, organization_id, name, color, is_shared, position) values
    (e2e.gid(p_org, '32000000-0000-0000-0000-000000000001'), p_org, 'Sublimación',  'blue',   false, 1),
    (e2e.gid(p_org, '32000000-0000-0000-0000-000000000002'), p_org, 'Impresión 3D', 'violet', false, 2),
    (e2e.gid(p_org, '32000000-0000-0000-0000-000000000003'), p_org, 'Alfarería',    'orange', false, 3);

  insert into sales_channels (id, organization_id, name, position) values
    (e2e.gid(p_org, '42000000-0000-0000-0000-000000000001'), p_org, 'Feria',     1),
    (e2e.gid(p_org, '42000000-0000-0000-0000-000000000002'), p_org, 'Tienda',    2),
    (e2e.gid(p_org, '42000000-0000-0000-0000-000000000003'), p_org, 'Instagram', 3);

  insert into expense_categories (id, organization_id, name) values
    (e2e.gid(p_org, '52000000-0000-0000-0000-000000000001'), p_org, 'Servicios'),
    (e2e.gid(p_org, '52000000-0000-0000-0000-000000000002'), p_org, 'Transporte'),
    (e2e.gid(p_org, '52000000-0000-0000-0000-000000000003'), p_org, 'Alquiler');

  insert into units (id, organization_id, code, name) values
    (e2e.gid(p_org, '62000000-0000-0000-0000-000000000001'), p_org, 'u', 'Unidad');

  -- Cinco estados de pedido por línea, con su cola, y el juego de tareas de la
  -- organización. Cada juego en una sola sentencia: la validación de
  -- `status_integrity` exige inicial y final a la vez.
  insert into statuses (id, organization_id, business_line_id, flow, name, kind, is_queue, position)
  select e2e.gid(p_org, md5('perf-status-' || l.n || '-' || s.kind)::uuid),
         p_org, l.id, 'order', s.name, s.kind, s.kind = 'waiting', s.position
  from (values
    (1, e2e.gid(p_org, '32000000-0000-0000-0000-000000000001')::uuid),
    (2, e2e.gid(p_org, '32000000-0000-0000-0000-000000000002')::uuid),
    (3, e2e.gid(p_org, '32000000-0000-0000-0000-000000000003')::uuid)
  ) as l(n, id)
  cross join (values
    ('Registrado',    'initial',     1),
    ('En producción', 'in_progress', 2),
    ('En cola',       'waiting',     3),
    ('Entregado',     'final',       4),
    ('Cancelado',     'cancelled',   5)
  ) as s(name, kind, position);

  insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
    (e2e.gid(p_org, md5('perf-task-initial')::uuid),     p_org, null, 'task', 'Por hacer', 'initial',     1),
    (e2e.gid(p_org, md5('perf-task-in_progress')::uuid), p_org, null, 'task', 'Haciendo',  'in_progress', 2),
    (e2e.gid(p_org, md5('perf-task-final')::uuid),       p_org, null, 'task', 'Hecho',     'final',       3);

  -- ── Directorio y catálogo ─────────────────────────────────────────────────

  insert into contacts (id, organization_id, name, phone, is_customer, is_supplier)
  select e2e.gid(p_org, md5('perf-customer-' || n)::uuid), p_org,
         'Cliente ' || lpad(n::text, 2, '0'), '+591 7' || lpad((1000000 + n * 7919)::text, 7, '0'),
         true, false
  from generate_series(1, 60) as n;

  insert into contacts (id, organization_id, name, is_customer, is_supplier)
  select e2e.gid(p_org, md5('perf-supplier-' || n)::uuid), p_org,
         'Proveedor ' || lpad(n::text, 2, '0'), false, true
  from generate_series(1, 10) as n;

  -- Seis productos y cinco insumos por línea.
  insert into items (id, organization_id, business_line_id, kind, name, unit_id, sale_price, min_stock)
  select e2e.gid(p_org, md5('perf-product-' || l.n || '-' || p)::uuid), p_org, l.id,
         'product', l.name || ' · producto ' || p, e2e.gid(p_org, '62000000-0000-0000-0000-000000000001'),
         25 + p * 10 + l.n * 5, null
  from (values
    (1, e2e.gid(p_org, '32000000-0000-0000-0000-000000000001')::uuid, 'Sublimación'),
    (2, e2e.gid(p_org, '32000000-0000-0000-0000-000000000002')::uuid, 'Impresión 3D'),
    (3, e2e.gid(p_org, '32000000-0000-0000-0000-000000000003')::uuid, 'Alfarería')
  ) as l(n, id, name)
  cross join generate_series(1, 6) as p;

  insert into items (id, organization_id, business_line_id, kind, name, unit_id, sale_price, min_stock)
  select e2e.gid(p_org, md5('perf-supply-' || l.n || '-' || s)::uuid), p_org, l.id,
         'supply', l.name || ' · insumo ' || s, e2e.gid(p_org, '62000000-0000-0000-0000-000000000001'),
         null, 20
  from (values
    (1, e2e.gid(p_org, '32000000-0000-0000-0000-000000000001')::uuid, 'Sublimación'),
    (2, e2e.gid(p_org, '32000000-0000-0000-0000-000000000002')::uuid, 'Impresión 3D'),
    (3, e2e.gid(p_org, '32000000-0000-0000-0000-000000000003')::uuid, 'Alfarería')
  ) as l(n, id, name)
  cross join generate_series(1, 5) as s;

  -- ── Pedidos: cuatro por línea y por semana, un año ────────────────────────
  --
  -- Las dos últimas semanas quedan abiertas —registrados, en producción y en
  -- cola—; lo anterior está entregado, salvo uno de cada veinte, cancelado.
  --
  -- El generador de pedidos (`perf_orders`) se repite como CTE en cada
  -- sentencia que lo usa: la CLI envía la semilla en un solo lote de sentencias
  -- preparadas, y un objeto creado en el mismo lote todavía no existe cuando
  -- se analiza la siguiente.


  with perf_orders as (
    select
      row_number() over (order by w, l.n, k) as code,
      w, k, l.n as line_n, l.id as line_id,
      e2e.gid(p_org, md5('perf-order-' || w || '-' || l.n || '-' || k)::uuid) as id,
      now() - ((w * 7 - k) * interval '1 day') - (l.n * interval '3 hours') as occurred_at
    from generate_series(1, 52) as w
    cross join generate_series(1, 4) as k
    cross join (values
      (1, e2e.gid(p_org, '32000000-0000-0000-0000-000000000001')::uuid),
      (2, e2e.gid(p_org, '32000000-0000-0000-0000-000000000002')::uuid),
      (3, e2e.gid(p_org, '32000000-0000-0000-0000-000000000003')::uuid)
    ) as l(n, id)
  )
  insert into orders (
    id, organization_id, business_line_id, kind, code, contact_id, status_id,
    sales_channel_id, delivery_mode, due_date, occurred_at, queued_at
  )
  select
    o.id, p_org, o.line_id, 'order', o.code,
    e2e.gid(p_org, md5('perf-customer-' || (1 + o.code % 60))::uuid),
    e2e.gid(p_org, md5('perf-status-' || o.line_n || '-' || s.kind)::uuid),
    e2e.gid(p_org, ('42000000-0000-0000-0000-00000000000' || (1 + o.code % 3))::uuid),
    case when o.code % 2 = 0 then 'delivery' else 'pickup' end,
    (o.occurred_at + interval '7 days')::date,
    o.occurred_at,
    case when s.kind = 'waiting' then o.occurred_at + interval '1 day' end
  from perf_orders o
  cross join lateral (
    select case
      when o.w <= 2 then (array['initial', 'in_progress', 'waiting'])[1 + o.k % 3]
      when o.code % 20 = 0 then 'cancelled'
      else 'final'
    end as kind
  ) as s;

  -- Dos líneas por pedido, de los productos de su línea.
  with perf_orders as (
    select
      row_number() over (order by w, l.n, k) as code,
      w, k, l.n as line_n, l.id as line_id,
      e2e.gid(p_org, md5('perf-order-' || w || '-' || l.n || '-' || k)::uuid) as id,
      now() - ((w * 7 - k) * interval '1 day') - (l.n * interval '3 hours') as occurred_at
    from generate_series(1, 52) as w
    cross join generate_series(1, 4) as k
    cross join (values
      (1, e2e.gid(p_org, '32000000-0000-0000-0000-000000000001')::uuid),
      (2, e2e.gid(p_org, '32000000-0000-0000-0000-000000000002')::uuid),
      (3, e2e.gid(p_org, '32000000-0000-0000-0000-000000000003')::uuid)
    ) as l(n, id)
  )
  insert into order_items (id, organization_id, order_id, item_id, quantity, unit_price)
  select
    e2e.gid(p_org, md5('perf-order-item-' || o.code || '-' || i)::uuid),
    p_org, o.id,
    e2e.gid(p_org, md5('perf-product-' || o.line_n || '-' || (1 + (o.code + i) % 6))::uuid),
    1 + (o.code * i) % 5,
    25 + (1 + (o.code + i) % 6) * 10 + o.line_n * 5
  from perf_orders o
  cross join generate_series(1, 2) as i;

  -- Lo entregado se cobró entero a los tres días; lo abierto dejó un anticipo.
  -- El importe sale de las líneas, como lo calcularía `order_totals`.
  with perf_orders as (
    select
      row_number() over (order by w, l.n, k) as code,
      w, k, l.n as line_n, l.id as line_id,
      e2e.gid(p_org, md5('perf-order-' || w || '-' || l.n || '-' || k)::uuid) as id,
      now() - ((w * 7 - k) * interval '1 day') - (l.n * interval '3 hours') as occurred_at
    from generate_series(1, 52) as w
    cross join generate_series(1, 4) as k
    cross join (values
      (1, e2e.gid(p_org, '32000000-0000-0000-0000-000000000001')::uuid),
      (2, e2e.gid(p_org, '32000000-0000-0000-0000-000000000002')::uuid),
      (3, e2e.gid(p_org, '32000000-0000-0000-0000-000000000003')::uuid)
    ) as l(n, id)
  )
  insert into payments (id, organization_id, direction, order_id, amount, method, occurred_at)
  select
    e2e.gid(p_org, md5('perf-payment-in-' || o.code)::uuid),
    p_org, 'in', o.id,
    case when o.w <= 2 then round(t.total / 2, 2) else t.total end,
    case when o.code % 3 = 0 then 'transfer' else 'cash' end,
    least(o.occurred_at + interval '3 days', now())
  from perf_orders o
  join (
    select order_id, sum(quantity * unit_price) as total
    from order_items
    where organization_id = p_org
    group by order_id
  ) as t on t.order_id = o.id
  where o.code % 20 <> 0;

  -- ── Egresos: tres compras cada dos semanas por línea y un gasto semanal ───

  insert into expenses (id, organization_id, business_line_id, kind, contact_id, occurred_at, note)
  select
    e2e.gid(p_org, md5('perf-purchase-' || w || '-' || l.n)::uuid),
    p_org, l.id, 'purchase',
    e2e.gid(p_org, md5('perf-supplier-' || (1 + (w + l.n) % 10))::uuid),
    now() - (w * 7 * interval '1 day') + (l.n * interval '1 day'),
    'Reposición de insumos.'
  from generate_series(1, 52) as w
  cross join (values
    (1, e2e.gid(p_org, '32000000-0000-0000-0000-000000000001')::uuid),
    (2, e2e.gid(p_org, '32000000-0000-0000-0000-000000000002')::uuid),
    (3, e2e.gid(p_org, '32000000-0000-0000-0000-000000000003')::uuid)
  ) as l(n, id);

  -- Cada compra trae dos insumos; el disparador de KAM-18 registra su entrada.
  insert into expense_items (id, organization_id, expense_id, item_id, quantity, unit_price)
  select
    e2e.gid(p_org, md5('perf-purchase-item-' || w || '-' || l.n || '-' || i)::uuid),
    p_org,
    e2e.gid(p_org, md5('perf-purchase-' || w || '-' || l.n)::uuid),
    e2e.gid(p_org, md5('perf-supply-' || l.n || '-' || (1 + (w + i) % 5))::uuid),
    10 + (w * i) % 15,
    3 + ((w + l.n + i) % 7)
  from generate_series(1, 52) as w
  cross join generate_series(1, 2) as i
  cross join (values (1), (2), (3)) as l(n);

  insert into expenses (id, organization_id, business_line_id, kind, expense_category_id, amount, occurred_at, note)
  select
    e2e.gid(p_org, md5('perf-cost-' || w)::uuid),
    p_org,
    e2e.gid(p_org, ('32000000-0000-0000-0000-00000000000' || (1 + w % 3))::uuid),
    'expense',
    e2e.gid(p_org, ('52000000-0000-0000-0000-00000000000' || (1 + w % 3))::uuid),
    40 + (w * 17) % 160,
    now() - (w * 7 * interval '1 day') + interval '4 days',
    'Gasto de la semana.'
  from generate_series(1, 52) as w;

  -- Todo egreso se pagó a los dos días.
  insert into payments (id, organization_id, direction, expense_id, amount, method, occurred_at)
  select
    e2e.gid(p_org, md5('perf-payment-out-' || e.id)::uuid),
    p_org, 'out', e.id,
    coalesce(e.amount, t.total),
    'transfer',
    least(e.occurred_at + interval '2 days', now())
  from expenses e
  left join (
    select expense_id, sum(quantity * unit_price) as total
    from expense_items
    where organization_id = p_org
    group by expense_id
  ) as t on t.expense_id = e.id
  where e.organization_id = p_org;

  -- ── Tareas y avisos ───────────────────────────────────────────────────────

  -- Tres por semana. Lo de las dos últimas semanas sigue abierto; lo anterior,
  -- hecho. El cierre (`closed_at`) lo pone el disparador de KAM-15 al entrar en
  -- un estado final.
  insert into tasks (id, organization_id, business_line_id, title, status_id, assignee_id, due_at, created_at)
  select
    e2e.gid(p_org, md5('perf-task-' || w || '-' || k)::uuid),
    p_org,
    e2e.gid(p_org, ('32000000-0000-0000-0000-00000000000' || (1 + (w + k) % 3))::uuid),
    'Tarea ' || w || '.' || k || ' del taller',
    case when w <= 2 then e2e.gid(p_org, md5('perf-task-in_progress')::uuid) else e2e.gid(p_org, md5('perf-task-final')::uuid) end,
    p_owner,
    (now() - (w * 7 - k * 2) * interval '1 day')::date,
    now() - (w * 7) * interval '1 day'
  from generate_series(1, 52) as w
  cross join generate_series(1, 3) as k;

  insert into notifications (id, organization_id, user_id, type, title, dedupe_key, read_at, created_at)
  select
    e2e.gid(p_org, md5('perf-notification-' || n)::uuid),
    p_org,
    p_owner,
    (array['due_summary', 'task_assigned', 'task_overdue', 'task_stalled'])[1 + n % 4],
    'Aviso ' || n,
    'perf-' || n,
    case when n > 10 then now() - (n * interval '1 day') end,
    now() - (n * interval '1 day')
  from generate_series(1, 60) as n;
end
$rendimiento$;

do $$ begin
  perform e2e.seed_rendimiento('10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000007');
end $$;

create function e2e.clone_rendimiento() returns jsonb
language plpgsql set search_path = public, extensions as $$
declare
  v_org uuid := gen_random_uuid();
  v_owner uuid := gen_random_uuid();
  v_owner_email text := 'rendimiento+' || substr(replace(v_org::text, '-', ''), 1, 12) || '@kamay.test';
begin
  insert into organizations (id, name) values (v_org, 'Kamay Rendimiento');
  perform e2e.create_user(v_owner, v_owner_email);
  insert into memberships (organization_id, user_id, role, display_name)
    values (v_org, v_owner, 'owner', 'Dueña Rendimiento');
  perform e2e.seed_rendimiento(v_org, v_owner);
  return jsonb_build_object('organizationId', v_org, 'owner', v_owner_email);
end
$$;

revoke execute on all functions in schema e2e from public;
