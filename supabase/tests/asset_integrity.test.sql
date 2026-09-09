-- KAM-19 · assets: restricciones del modelo de `asset_details`.
-- Escenarios del delta spec `assets`, requisito "Datos propios del activo":
-- "Datos de activo aceptados", "Un ítem que no es activo no tiene datos de
-- activo", "Un solo juego de datos por activo", "Costo negativo rechazado",
-- "El costo declarado se puede corregir", "Un activo del catálogo sin datos
-- todavía".
begin;

set search_path to public, extensions;

select plan(10);

-- ── Semilla propia (como postgres, sin RLS) ───────────────────────────────

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000019a1', 'owner-asset-a@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-0000000019aa', 'Activos A'),
  ('00000000-0000-0000-0000-0000000019bb', 'Activos B');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000019aa', '00000000-0000-0000-0000-0000000019a1', 'owner');

insert into business_lines (id, organization_id, name, is_shared, position) values
  ('00000000-0000-0000-0000-000000001911', '00000000-0000-0000-0000-0000000019aa', 'Impresión 3D', false, 1);

insert into items (id, organization_id, business_line_id, kind, name) values
  ('00000000-0000-0000-0000-000000001941', '00000000-0000-0000-0000-0000000019aa',
   '00000000-0000-0000-0000-000000001911', 'asset',  'Impresora 3D'),
  ('00000000-0000-0000-0000-000000001942', '00000000-0000-0000-0000-0000000019aa',
   '00000000-0000-0000-0000-000000001911', 'supply', 'Filamento'),
  -- Un activo del catálogo al que nadie ha declarado costo ni fecha.
  ('00000000-0000-0000-0000-000000001943', '00000000-0000-0000-0000-0000000019aa',
   '00000000-0000-0000-0000-000000001911', 'asset',  'Horno');

-- ── Scenario: Datos de activo aceptados ───────────────────────────────────

select lives_ok(
  $$insert into asset_details
      (item_id, organization_id, acquisition_cost, acquired_on)
    values ('00000000-0000-0000-0000-000000001941',
            '00000000-0000-0000-0000-0000000019aa', 7000, date '2026-01-15')$$,
  'Un ítem de tipo activo acepta costo de adquisición y fecha'
);

select is(
  (select acquisition_cost from asset_details
    where item_id = '00000000-0000-0000-0000-000000001941'),
  7000::numeric(14,2),
  'El costo declarado queda registrado contra su ítem'
);

-- ── Scenario: Un ítem que no es activo no tiene datos de activo ───────────

select throws_ok(
  $$insert into asset_details
      (item_id, organization_id, acquisition_cost, acquired_on)
    values ('00000000-0000-0000-0000-000000001942',
            '00000000-0000-0000-0000-0000000019aa', 100, date '2026-01-15')$$,
  '23514',
  'Solo un ítem de tipo activo puede tener datos de activo',
  'Un insumo no admite datos de activo'
);

-- ── Scenario: Un solo juego de datos por activo ───────────────────────────

select throws_ok(
  $$insert into asset_details
      (item_id, organization_id, acquisition_cost, acquired_on)
    values ('00000000-0000-0000-0000-000000001941',
            '00000000-0000-0000-0000-0000000019aa', 9000, date '2026-02-01')$$,
  '23505',
  null,
  'Un segundo juego de datos para el mismo activo se rechaza'
);

-- ── Scenario: Costo negativo rechazado ────────────────────────────────────

select throws_ok(
  $$insert into asset_details
      (item_id, organization_id, acquisition_cost, acquired_on)
    values ('00000000-0000-0000-0000-000000001943',
            '00000000-0000-0000-0000-0000000019aa', -1, date '2026-01-15')$$,
  '23514',
  null,
  'Un costo de adquisición negativo se rechaza'
);

-- El activo y su ítem son de la misma organización: sin esta comprobación la
-- foránea a `items` dejaría pasar un activo declarado bajo otra organización.

select throws_ok(
  $$insert into asset_details
      (item_id, organization_id, acquisition_cost, acquired_on)
    values ('00000000-0000-0000-0000-000000001943',
            '00000000-0000-0000-0000-0000000019bb', 500, date '2026-01-15')$$,
  '23514',
  'El activo y su ítem deben ser de la misma organización',
  'Un activo no se declara bajo la organización de otro'
);

-- ── Scenario: El costo declarado se puede corregir ────────────────────────

select lives_ok(
  $$update asset_details set acquisition_cost = 7500
     where item_id = '00000000-0000-0000-0000-000000001941'$$,
  'El costo de adquisición se puede corregir'
);

select is(
  (select acquisition_cost from asset_details
    where item_id = '00000000-0000-0000-0000-000000001941'),
  7500::numeric(14,2),
  'La corrección queda guardada y es la que verá la barra'
);

-- ── Scenario: Un activo del catálogo sin datos todavía ────────────────────

select is(
  (select count(*) from asset_details
    where item_id = '00000000-0000-0000-0000-000000001943'),
  0::bigint,
  'Un activo sin datos declarados no tiene fila en asset_details'
);

select is(
  (select archived_at is null from items
    where id = '00000000-0000-0000-0000-000000001943'),
  true,
  'Y su ítem sigue siendo válido en el catálogo'
);

select * from finish();
rollback;
