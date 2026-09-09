-- KAM-20 · Función derivada `report_profitability`.
-- Escenario del delta spec `reports` § Informe de rentabilidad: "Un consumo
--   de inventario no cuenta como costo del pedido".
--
-- Esta prueba existe para que nadie "arregle" la decisión D6 dentro de seis
-- meses creyendo que es un fallo. KAM-18 graba todo consumo con
-- `source_type = 'manual'` y solo prellena la nota con la referencia del
-- pedido: no hay enlace que consultar, y deducirlo del texto de una nota
-- modificable daría un margen que nadie puede auditar. Si algún día se
-- enlazan de verdad, esta prueba es la que hay que cambiar a conciencia.
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

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000025a1', 'owner-profit@kamay.test');

insert into organizations (id, name, timezone) values
  ('00000000-0000-0000-0000-0000000025b0', 'Rentabilidad A', 'America/La_Paz');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000025b0', '00000000-0000-0000-0000-0000000025a1', 'owner');

insert into business_lines (id, organization_id, name, position) values
  ('00000000-0000-0000-0000-0000000025c1', '00000000-0000-0000-0000-0000000025b0', 'Sublimación', 1);

insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-0000000025d1', '00000000-0000-0000-0000-0000000025b0', '00000000-0000-0000-0000-0000000025c1', 'order', 'Registrado', 'initial', 1);

insert into expense_categories (id, organization_id, name) values
  ('00000000-0000-0000-0000-0000000025e1', '00000000-0000-0000-0000-0000000025b0', 'Insumos');

insert into contacts (id, organization_id, name, is_customer) values
  ('00000000-0000-0000-0000-0000000025f1', '00000000-0000-0000-0000-0000000025b0', 'Cliente', true);

insert into items (id, organization_id, business_line_id, kind, name) values
  ('00000000-0000-0000-0000-000000002501', '00000000-0000-0000-0000-0000000025b0', '00000000-0000-0000-0000-0000000025c1', 'product', 'Taza'),
  ('00000000-0000-0000-0000-000000002502', '00000000-0000-0000-0000-0000000025b0', '00000000-0000-0000-0000-0000000025c1', 'supply',  'Papel');

-- O1 · con egreso asignado: 1.000 de ingreso, 400 de costo.
insert into orders (id, organization_id, business_line_id, kind, contact_id, status_id, occurred_at) values
  ('00000000-0000-0000-0000-000000025101', '00000000-0000-0000-0000-0000000025b0', '00000000-0000-0000-0000-0000000025c1', 'order', '00000000-0000-0000-0000-0000000025f1', '00000000-0000-0000-0000-0000000025d1', '2026-03-10 12:00:00-04'),
  -- O2 · sin egreso asignado, pero CON un consumo registrado desde él.
  ('00000000-0000-0000-0000-000000025102', '00000000-0000-0000-0000-0000000025b0', '00000000-0000-0000-0000-0000000025c1', 'order', '00000000-0000-0000-0000-0000000025f1', '00000000-0000-0000-0000-0000000025d1', '2026-03-11 12:00:00-04');

insert into order_items (organization_id, order_id, item_id, quantity, unit_price) values
  ('00000000-0000-0000-0000-0000000025b0', '00000000-0000-0000-0000-000000025101', '00000000-0000-0000-0000-000000002501', 1, 1000),
  ('00000000-0000-0000-0000-0000000025b0', '00000000-0000-0000-0000-000000025102', '00000000-0000-0000-0000-000000002501', 1, 500);

insert into expenses (id, organization_id, business_line_id, kind, expense_category_id, order_id, amount, occurred_at) values
  ('00000000-0000-0000-0000-000000025201', '00000000-0000-0000-0000-0000000025b0', '00000000-0000-0000-0000-0000000025c1', 'expense', '00000000-0000-0000-0000-0000000025e1', '00000000-0000-0000-0000-000000025101', 400.00, '2026-03-10 13:00:00-04');

-- El consumo tal como lo graba KAM-18 desde el detalle de un pedido: origen
-- `manual`, sin `source_id` al pedido, y con la referencia en la NOTA.
insert into inventory_movements (organization_id, item_id, kind, quantity, source_type, note, occurred_at) values
  ('00000000-0000-0000-0000-0000000025b0', '00000000-0000-0000-0000-000000002502', 'out', -5, 'manual',
   'Consumo para el pedido 00000000-0000-0000-0000-000000025102', '2026-03-11 13:00:00-04');

select pg_temp.login('00000000-0000-0000-0000-0000000025a1');

-- ── El pedido con egreso asignado sí tiene costo ──────────────────────────

select is(
  (select material_cost from report_profitability(
     '00000000-0000-0000-0000-0000000025b0',
     '2026-03-01 00:00:00-04', '2026-04-01 00:00:00-04')
   where order_id = '00000000-0000-0000-0000-000000025101'),
  400::numeric,
  'El egreso asignado al pedido es su costo de materiales'
);

select is(
  (select has_cost from report_profitability(
     '00000000-0000-0000-0000-0000000025b0',
     '2026-03-01 00:00:00-04', '2026-04-01 00:00:00-04')
   where order_id = '00000000-0000-0000-0000-000000025101'),
  true,
  'Ese pedido no lleva la marca de sin costo registrado'
);

select is(
  (select revenue - material_cost from report_profitability(
     '00000000-0000-0000-0000-0000000025b0',
     '2026-03-01 00:00:00-04', '2026-04-01 00:00:00-04')
   where order_id = '00000000-0000-0000-0000-000000025101'),
  600::numeric,
  'Su margen es 600'
);

-- ── Un consumo de inventario no cuenta como costo del pedido ─────────────
-- El consumo existe, se registró desde ese pedido y su nota lo nombra. Aun
-- así el costo es cero: no hay enlace consultable, y la nota no es un enlace.

select is(
  (select material_cost from report_profitability(
     '00000000-0000-0000-0000-0000000025b0',
     '2026-03-01 00:00:00-04', '2026-04-01 00:00:00-04')
   where order_id = '00000000-0000-0000-0000-000000025102'),
  0::numeric,
  'El consumo registrado desde el pedido no suma a su costo'
);

select is(
  (select has_cost from report_profitability(
     '00000000-0000-0000-0000-0000000025b0',
     '2026-03-01 00:00:00-04', '2026-04-01 00:00:00-04')
   where order_id = '00000000-0000-0000-0000-000000025102'),
  false,
  'Y el pedido queda marcado como sin costo registrado, no como 100 % de margen'
);

-- La marca es columna y no cálculo del cliente: por eso se puede filtrar.

select is(
  (select count(*) from report_profitability(
     '00000000-0000-0000-0000-0000000025b0',
     '2026-03-01 00:00:00-04', '2026-04-01 00:00:00-04')
   where not has_cost),
  1::bigint,
  'Se puede filtrar por los pedidos sin costo capturado'
);

select * from finish();
rollback;
