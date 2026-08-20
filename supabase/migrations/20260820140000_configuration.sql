-- KAM-04 · Configuración: business_lines, sales_channels, expense_categories, units.
-- DDL canónico: specs/PRD/kamay-esquema-base-de-datos-supabase.md §6, §16.
-- Lo que aquí se declara es lo que hace configurable al sistema sin programar:
-- las cuatro tablas son datos de la organización, no constantes del código.

-- Líneas de negocio: Sublimación, Impresión 3D, Alfarería, General
create table business_lines (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name            text not null,
  color           text not null default 'zinc',
  icon            text,
  is_shared       boolean not null default false,  -- true solo para General/Compartido
  position        int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  archived_at     timestamptz,
  unique (organization_id, name)
);

-- Canales de venta: Feria, Redes, Pedido directo, Mostrador
create table sales_channels (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name            text not null,
  position        int not null default 0,
  archived_at     timestamptz,
  unique (organization_id, name)
);

-- Categorías de gasto
create table expense_categories (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name            text not null,
  archived_at     timestamptz,
  unique (organization_id, name)
);

-- Unidades de medida
create table units (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  code            text not null,      -- 'u', 'kg', 'm', 'l'
  name            text not null,
  archived_at     timestamptz,
  unique (organization_id, code)
);

-- Listar lo vigente es la consulta de todas las pantallas y de todos los
-- formularios: se indexa el filtro que siempre se aplica.
create index on business_lines (organization_id, position) where archived_at is null;
create index on sales_channels (organization_id, position) where archived_at is null;
create index on expense_categories (organization_id) where archived_at is null;
create index on units (organization_id) where archived_at is null;

-- ── Invariante de la línea compartida ─────────────────────────────────────
-- General/Compartido es el destino de todo lo que no pertenece a una sola
-- línea. Si desapareciera, esos registros quedarían huérfanos: por eso la
-- regla vive en la base y no en una Server Action que un script puede saltarse.

-- Como máximo una línea compartida activa por organización.
create unique index on business_lines (organization_id)
  where is_shared and archived_at is null;

create or replace function guard_shared_business_line()
returns trigger
language plpgsql as $$
begin
  -- La bandera es inmutable: convertir otra línea en compartida (o dejar de
  -- serlo) cambiaría el significado de los registros ya asociados a ella.
  if new.is_shared is distinct from old.is_shared then
    raise exception 'La línea compartida no puede dejar de serlo ni otra puede pasar a serlo'
      using errcode = 'check_violation';
  end if;

  if old.is_shared and new.archived_at is not null then
    raise exception 'La línea compartida no se puede archivar'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

create trigger guard_shared before update on business_lines
  for each row execute function guard_shared_business_line();

-- ── Bitácora ──────────────────────────────────────────────────────────────
-- Toda tabla auditable adjunta el trigger en su propia migración de creación
-- (procedimiento de supabase/README.md, convención nº 7).

create trigger audit after insert or update on business_lines
  for each row execute function log_activity();

create trigger audit after insert or update on sales_channels
  for each row execute function log_activity();

create trigger audit after insert or update on expense_categories
  for each row execute function log_activity();

create trigger audit after insert or update on units
  for each row execute function log_activity();

-- ── Privilegios y RLS ─────────────────────────────────────────────────────
-- Matriz de acceso §16: la configuración la lee todo miembro y la escribe solo
-- el dueño. DELETE no se concede a nadie: en Kamay se archiva, no se borra.

-- Esta imagen de Supabase concede por defecto todos los privilegios DML a
-- `anon`, `authenticated` y `service_role` sobre las tablas nuevas de `public`
-- (`alter default privileges`). Conceder lo que ya está concedido no hace nada:
-- lo que decide es el revoke.
grant select, insert, update
  on business_lines, sales_channels, expense_categories, units
  to authenticated;

-- Nadie borra configuración. Sin política DELETE la operación afectaría cero
-- filas, pero el privilegio revocado la corta antes y no depende de que una
-- política esté bien escrita (mismo criterio que activity_log en KAM-03).
revoke delete
  on business_lines, sales_channels, expense_categories, units
  from authenticated, anon, service_role;

-- `anon` no tiene ninguna política: sin sesión no se lee ni se escribe
-- configuración. Se le retira también el privilegio, no solo la política.
revoke insert, update
  on business_lines, sales_channels, expense_categories, units
  from anon;

-- service_role solo lee: ningún trabajo programado configura la organización.
revoke insert, update
  on business_lines, sales_channels, expense_categories, units
  from service_role;

grant select
  on business_lines, sales_channels, expense_categories, units
  to service_role;

alter table business_lines enable row level security;

create policy "business_lines: leer si es miembro"
  on business_lines for select to authenticated
  using (is_member(organization_id));

create policy "business_lines: crear solo el dueño"
  on business_lines for insert to authenticated
  with check (is_owner(organization_id));

create policy "business_lines: editar solo el dueño"
  on business_lines for update to authenticated
  using (is_owner(organization_id))
  with check (is_owner(organization_id));

alter table sales_channels enable row level security;

create policy "sales_channels: leer si es miembro"
  on sales_channels for select to authenticated
  using (is_member(organization_id));

create policy "sales_channels: crear solo el dueño"
  on sales_channels for insert to authenticated
  with check (is_owner(organization_id));

create policy "sales_channels: editar solo el dueño"
  on sales_channels for update to authenticated
  using (is_owner(organization_id))
  with check (is_owner(organization_id));

alter table expense_categories enable row level security;

create policy "expense_categories: leer si es miembro"
  on expense_categories for select to authenticated
  using (is_member(organization_id));

create policy "expense_categories: crear solo el dueño"
  on expense_categories for insert to authenticated
  with check (is_owner(organization_id));

create policy "expense_categories: editar solo el dueño"
  on expense_categories for update to authenticated
  using (is_owner(organization_id))
  with check (is_owner(organization_id));

alter table units enable row level security;

create policy "units: leer si es miembro"
  on units for select to authenticated
  using (is_member(organization_id));

create policy "units: crear solo el dueño"
  on units for insert to authenticated
  with check (is_owner(organization_id));

create policy "units: editar solo el dueño"
  on units for update to authenticated
  using (is_owner(organization_id))
  with check (is_owner(organization_id));

-- Sin política DELETE en ninguna de las cuatro: nada se elimina en Kamay.
