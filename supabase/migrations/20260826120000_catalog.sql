-- KAM-06 · Catálogo y directorio: contacts, items, item_variants.
-- DDL canónico: specs/PRD/kamay-esquema-base-de-datos-supabase.md §7, §16.
-- La base de datos del negocio —qué compro, qué vendo, con quién trato— antes
-- de la primera operación. Nada derivado se guarda aquí (convención nº 4):
-- saldo, último costo y margen llegarán como vistas sobre los documentos.

-- ── Búsqueda tolerante a acentos ──────────────────────────────────────────
-- El criterio es del usuario: escribe "sublimacion" y espera encontrar "Taza
-- para sublimación". `unaccent()` no es inmutable (depende del diccionario
-- instalado), así que no puede indexarse directamente: se envuelve.
-- pg_trgm y no to_tsvector porque la búsqueda es por subcadena mientras se
-- teclea ("subli"), y el texto completo solo acierta palabras enteras.

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create or replace function immutable_unaccent(text)
returns text
language sql immutable parallel safe strict as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, $1)
$$;

-- ── Contactos: proveedores, clientes, o ambos ─────────────────────────────

create table contacts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name            text not null,
  phone           text,
  email           text,
  address         text,
  is_supplier     boolean not null default false,
  is_customer     boolean not null default false,
  notes           text,
  -- Nombre normalizado para buscar: minúsculas y sin acentos. No es un dato
  -- derivado del negocio (convención nº 4) sino la misma cadena preparada
  -- para comparar; se genera en la base para que el cliente no pueda
  -- desincronizarla, y es lo que indexa el buscador.
  search_name     text generated always as (immutable_unaccent(lower(name))) stored,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  archived_at     timestamptz,

  -- Un contacto sin rol no es nadie: no aparecería en ningún buscador.
  constraint has_a_role check (is_supplier or is_customer)
);

-- ── Ítems: insumos, productos y activos en una sola tabla ─────────────────
-- Se distinguen por `kind`. Tres tablas separadas duplicarían las líneas de
-- documento, los movimientos y los reportes por el resto del proyecto.

create table items (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id),
  business_line_id uuid references business_lines(id),  -- null = compartido
  kind             text not null check (kind in ('supply','product','asset')),
  name             text not null,
  description      text,
  unit_id          uuid references units(id),
  category         text,
  sale_price       numeric(14,2),      -- precio de venta referencial, no costo
  min_stock        numeric(14,3),      -- solo aplica a insumos
  search_name      text generated always as (immutable_unaccent(lower(name))) stored,
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  archived_at      timestamptz
);

-- Nota deliberada (esquema §7): `items` no tiene `last_cost` ni
-- `current_stock`. Ambos son derivados y vivirán en vistas con
-- security_invoker. Guardarlos aquí es exactamente el error que hizo
-- inmantenible la versión anterior; catalog.test.sql lo vigila.

create table item_variants (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references items(id),
  name        text not null,          -- '11oz', 'Negro', 'XL'
  attributes  jsonb not null default '{}'::jsonb,
  sale_price  numeric(14,2),          -- si difiere del ítem base
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  archived_at timestamptz,
  unique (item_id, name)
);

-- Única desviación del DDL canónico §7: `organization_id` en `item_variants`.
-- La convención nº 2 la exige en toda tabla y toda consulta; sin ella, la
-- política de RLS y el trigger de archivado tendrían que saltar a `items` en
-- cada fila, y la bitácora genérica no sabría a qué organización pertenece
-- el evento.
alter table item_variants
  add column organization_id uuid not null references organizations(id);

-- ── Índices ───────────────────────────────────────────────────────────────
-- Listar lo vigente es la consulta de todas las pantallas.

create index on contacts (organization_id) where archived_at is null;
create index on items (organization_id, kind) where archived_at is null;
create index on items (organization_id, business_line_id) where archived_at is null;
create index on item_variants (item_id) where archived_at is null;

-- Búsqueda por nombre: el índice canónico de texto completo más el de
-- trigramas sobre el nombre normalizado, que es el que sirve al buscador
-- incremental.
create index on contacts using gin (to_tsvector('simple', name));
create index on contacts using gin (search_name extensions.gin_trgm_ops);
create index on items using gin (search_name extensions.gin_trgm_ops);

-- ── Reglas de archivado ───────────────────────────────────────────────────
-- Dos reglas que una política de RLS no puede expresar, porque ambas comparan
-- la fila vieja con la nueva y `using`/`with check` ven solo una cada uno:
--   1. Archivar y desarchivar son del dueño (matriz de acceso §16: el
--      ayudante lee, crea y edita, pero no archiva).
--   2. Un registro archivado no se edita sin desarchivarlo primero
--      (especificación funcional §6.5).
-- La interfaz avisa antes; la base no confía en eso.

create or replace function enforce_archive_rules()
returns trigger
language plpgsql as $$
begin
  -- Sin actor autenticado no hay rol que comprobar: es la semilla, una
  -- migración o mantenimiento como `postgres`. Los roles de aplicación
  -- (`anon`, `service_role`) no tienen privilegio de escritura aquí.
  if auth.uid() is null then
    return new;
  end if;

  if new.archived_at is distinct from old.archived_at then
    if not is_owner(new.organization_id) then
      raise exception 'Solo la persona dueña puede archivar o desarchivar'
        using errcode = 'insufficient_privilege';
    end if;
    return new;
  end if;

  if old.archived_at is not null
     and to_jsonb(new) - 'updated_at' is distinct from to_jsonb(old) - 'updated_at' then
    raise exception 'Un registro archivado no se puede editar: desarchívalo primero'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

create trigger enforce_archive before update on contacts
  for each row execute function enforce_archive_rules();

create trigger enforce_archive before update on items
  for each row execute function enforce_archive_rules();

create trigger enforce_archive before update on item_variants
  for each row execute function enforce_archive_rules();

-- ── Bitácora ──────────────────────────────────────────────────────────────
-- Procedimiento de supabase/README.md: el trigger se adjunta en la misma
-- migración que crea la tabla. Un historial no se reconstruye hacia atrás.

create trigger audit after insert or update on contacts
  for each row execute function log_activity();

create trigger audit after insert or update on items
  for each row execute function log_activity();

create trigger audit after insert or update on item_variants
  for each row execute function log_activity();

-- ── Privilegios y RLS ─────────────────────────────────────────────────────
-- Matriz de acceso §16: `contacts`, `items` e `item_variants` son las primeras
-- tablas que el ayudante escribe. Leer, crear y editar todo miembro; archivar
-- solo el dueño (lo decide el trigger de arriba); borrar, nadie.

grant select, insert, update on contacts to authenticated;
grant select, insert, update on items to authenticated;
grant select, insert, update on item_variants to authenticated;

revoke delete on contacts, items, item_variants from authenticated, anon, service_role;
revoke insert, update on contacts, items, item_variants from anon;
revoke insert, update on contacts, items, item_variants from service_role;
grant select on contacts, items, item_variants to service_role;

alter table contacts enable row level security;
alter table items enable row level security;
alter table item_variants enable row level security;

create policy "contacts: leer si es miembro"
  on contacts for select to authenticated
  using (is_member(organization_id));

create policy "contacts: crear si es miembro"
  on contacts for insert to authenticated
  with check (is_member(organization_id));

create policy "contacts: editar si es miembro"
  on contacts for update to authenticated
  using (is_member(organization_id))
  with check (is_member(organization_id));

create policy "items: leer si es miembro"
  on items for select to authenticated
  using (is_member(organization_id));

create policy "items: crear si es miembro"
  on items for insert to authenticated
  with check (is_member(organization_id));

create policy "items: editar si es miembro"
  on items for update to authenticated
  using (is_member(organization_id))
  with check (is_member(organization_id));

create policy "item_variants: leer si es miembro"
  on item_variants for select to authenticated
  using (is_member(organization_id));

create policy "item_variants: crear si es miembro"
  on item_variants for insert to authenticated
  with check (is_member(organization_id));

create policy "item_variants: editar si es miembro"
  on item_variants for update to authenticated
  using (is_member(organization_id))
  with check (is_member(organization_id));

-- Sin política DELETE en ninguna de las tres: se archiva, nunca se borra.
