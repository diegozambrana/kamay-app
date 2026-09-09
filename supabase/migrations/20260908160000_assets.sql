-- KAM-19 · Activos: tabla `asset_details` y pertenencia de un egreso a un
-- activo.
-- DDL canónico: specs/PRD/kamay-esquema-base-de-datos-supabase.md §7,
--   § Matriz de acceso.
-- Requisitos: openspec/changes/kam-19-assets-investment-recovery/specs/
--   assets/spec.md § Datos propios del activo, § Activos solo para la persona
--   dueña; specs/expenses/spec.md § Modelo de egreso con dos tipos en una
--   sola tabla.
-- Decisiones: design.md D1 (el activo es un ítem con datos propios), D2 (la
--   pertenencia es una columna de `expenses`, con papel explícito), D3
--   (`acquisition_cost` es un dato declarado), D10 (índices).
--
-- El catálogo acepta ítems de tipo activo desde KAM-06, y su especificación
-- aplaza allí el costo y la fecha: "esos datos llegan con los activos".
-- Llegan aquí.

-- ── Datos propios de la maquinaria ────────────────────────────────────────
-- `item_id` es clave primaria y foránea a la vez (§7): el activo no es una
-- entidad paralela al ítem, es el mismo registro con datos de más. De ahí
-- hereda nombre, línea, unidad y archivado, y por eso no lleva `archived_at`
-- propio: archivar la máquina es archivar su ítem.

create table asset_details (
  item_id          uuid primary key references items(id),

  -- Primera desviación del DDL canónico §7, con el mismo motivo que la de
  -- `item_variants` en 20260826120000: la convención nº 2 exige
  -- `organization_id` en toda tabla y toda consulta, y sin él la política de
  -- RLS tendría que saltar a `items` en cada fila y `log_activity()` —que lo
  -- lee de la propia fila— registraría el evento bajo una organización
  -- inexistente.
  organization_id  uuid not null references organizations(id),

  -- Segunda desviación, y la única razón por la que existe: `log_activity()`
  -- toma `record_id` del campo `id` de la fila, y `activity_log.record_id` es
  -- `not null`. Generada e igual a `item_id` para que la identidad del
  -- registro siga siendo una sola y el historial del activo se busque por el
  -- id de su ítem, sin una segunda clave que mantener sincronizada.
  id               uuid generated always as (item_id) stored,

  -- Dato declarado, no derivado (D3): cuando el activo nace de una compra la
  -- cifra se prellena desde su línea, pero sigue siendo editable —una compra
  -- puede traer la máquina y sus accesorios en el mismo documento—.
  acquisition_cost numeric(14,2) not null check (acquisition_cost >= 0),
  acquired_on      date not null,
  supplier_id      uuid references contacts(id),
  notes            text
);

create index on asset_details (organization_id);

-- ── Solo un ítem de tipo activo tiene datos de activo ─────────────────────
-- No puede ser un `check`: un `check` no consulta otra tabla. Sin este
-- trigger, `asset_details` aceptaría un costo de adquisición para un rollo de
-- vinilo y la pantalla de activos mostraría insumos (D1).

create or replace function validate_asset_details()
returns trigger
language plpgsql as $$
declare
  v_kind text;
  v_org  uuid;
begin
  select i.kind, i.organization_id into v_kind, v_org
  from items i where i.id = new.item_id;

  if v_kind is distinct from 'asset' then
    raise exception 'Solo un ítem de tipo activo puede tener datos de activo'
      using errcode = 'check_violation';
  end if;

  if new.organization_id is distinct from v_org then
    raise exception 'El activo y su ítem deben ser de la misma organización'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

create trigger validate before insert or update on asset_details
  for each row execute function validate_asset_details();

create trigger audit after insert or update on asset_details
  for each row execute function log_activity();

-- ── Un egreso puede pertenecer a un activo ────────────────────────────────
-- Una columna y no una tabla de vínculo: un egreso pertenece a lo sumo a un
-- activo, igual que se asigna a lo sumo a un pedido, y `order_id` ya resuelve
-- ese caso exacto en esta misma tabla (D2).
--
-- El papel es explícito y no deducido. La diferencia entre el egreso con el
-- que se compró la máquina y los que la mantienen es lo que evita el doble
-- conteo: el primero ya está representado por `acquisition_cost` y no vuelve
-- a sumar; los segundos sí suman al costo total. Deducirlo —"es adquisición
-- si es el más antiguo"— convertiría una regla del negocio en una adivinanza
-- de la consulta.

alter table expenses
  add column asset_id           uuid references asset_details(item_id),
  add column asset_expense_role text
    check (asset_expense_role in ('acquisition','maintenance')),
  -- Los dos juntos o ninguno: un activo sin papel no dice qué hace ese
  -- dinero, y un papel sin activo no dice de qué máquina habla.
  add constraint asset_role_declared_together
    check ((asset_id is null) = (asset_expense_role is null));

-- Restricción, no rendimiento: un activo tiene a lo sumo un egreso de
-- adquisición, y cualquier número de mantenimientos.
create unique index expenses_one_acquisition_per_asset
  on expenses (asset_id) where asset_expense_role = 'acquisition';

-- Lectura del mantenimiento de un activo y exclusión de la inversión del
-- margen de su línea (D10).
create index on expenses (asset_id) where asset_id is not null;

-- Una foránea sobre `item_id` no puede comprobar la organización: la
-- comprueba el trigger.
create or replace function validate_expense_asset()
returns trigger
language plpgsql as $$
declare
  v_org uuid;
begin
  if new.asset_id is null then return new; end if;

  select a.organization_id into v_org
  from asset_details a where a.item_id = new.asset_id;

  if v_org is distinct from new.organization_id then
    raise exception 'El activo pertenece a otra organización'
      using errcode = 'foreign_key_violation';
  end if;

  return new;
end $$;

create trigger validate_asset before insert or update on expenses
  for each row execute function validate_expense_asset();

-- ── Privilegios y RLS ─────────────────────────────────────────────────────
-- La matriz de acceso §16 marca `asset_details` como *sin acceso* para el
-- ayudante: el costo de la maquinaria es exactamente el dato que esta tabla
-- protege. Sin política para el ayudante, con RLS activo, lo que no tiene
-- política está prohibido.

grant select, insert, update on asset_details to authenticated;
grant select on asset_details to service_role;

alter table asset_details enable row level security;

create policy "asset_details: leer solo el dueño"
  on asset_details for select to authenticated
  using (is_owner(organization_id));

create policy "asset_details: crear solo el dueño"
  on asset_details for insert to authenticated
  with check (is_owner(organization_id));

create policy "asset_details: editar solo el dueño"
  on asset_details for update to authenticated
  using (is_owner(organization_id))
  with check (is_owner(organization_id));

-- Sin política DELETE: no se borra, se archiva el ítem (convención nº 3).
