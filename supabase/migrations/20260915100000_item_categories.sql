-- Cambio `item-categories` · Categorías de ítem definidas por la organización.
--
-- La categoría de un ítem era texto libre (`items.category`, esquema canónico
-- §7): «Sustratos», «sustrato» y «Sustrato » quedaban como tres categorías, y
-- no había forma de definir la lista ni de filtrar por ella. Desde aquí la
-- organización define sus categorías **por tipo de ítem** —insumo, producto,
-- activo— y cada ítem apunta a una de su tipo, o a ninguna.
-- Specs: `org-configuration`, `catalog-directory` (deltas); design D1–D3.

-- ── La tabla ──────────────────────────────────────────────────────────────
-- Configuración como `expense_categories`, con el tipo dentro (D1). El nombre
-- no se repite dentro del tipo sin distinguir mayúsculas: evitar las variantes
-- de escritura es la razón de este cambio. Los espacios al borde no llegan
-- nunca: los rechaza el `check`.
--
-- `unique (id, organization_id, kind)` parece redundante con la clave
-- primaria, pero es el destino de la clave compuesta de `items` (D2).

create table item_categories (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  kind            text not null check (kind in ('supply', 'product', 'asset')),
  name            text not null check (name = btrim(name) and name <> ''),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  archived_at     timestamptz,
  unique (id, organization_id, kind)
);

create unique index item_categories_name_key
  on item_categories (organization_id, kind, lower(name));

-- Listar las vigentes de un tipo es la consulta del formulario, del filtro y
-- de la sección de configuración.
create index on item_categories (organization_id, kind) where archived_at is null;

-- Procedimiento de supabase/README.md: el trigger se adjunta en la misma
-- migración que crea la tabla.
create trigger audit after insert or update on item_categories
  for each row execute function log_activity();

-- ── Privilegios y RLS ─────────────────────────────────────────────────────
-- Calcado de `20260820140000_configuration.sql`: la lee todo miembro, la
-- escribe solo el dueño, nadie la borra y ningún trabajo programado la toca.

grant select, insert, update on item_categories to authenticated;
revoke delete on item_categories from authenticated, anon, service_role;
revoke insert, update on item_categories from anon, service_role;
grant select on item_categories to service_role;

alter table item_categories enable row level security;

create policy "item_categories: leer si es miembro"
  on item_categories for select to authenticated
  using (is_member(organization_id));

create policy "item_categories: crear solo el dueño"
  on item_categories for insert to authenticated
  with check (is_owner(organization_id));

create policy "item_categories: editar solo el dueño"
  on item_categories for update to authenticated
  using (is_owner(organization_id))
  with check (is_owner(organization_id));

-- ── El ítem apunta a una categoría de su organización y de su tipo ────────
-- Con `MATCH SIMPLE` (el valor por defecto) un `category_id` nulo no se
-- comprueba: «Sin categoría» sigue siendo válido. Con valor, la base exige la
-- misma organización **y el mismo tipo** sin un solo trigger (D2). De paso
-- protege el tipo de los dos lados: ni una categoría con ítems ni un ítem con
-- categoría pueden cambiar de tipo.

alter table items add column category_id uuid;

alter table items add constraint items_category_fk
  foreign key (category_id, organization_id, kind)
  references item_categories (id, organization_id, kind);

create index on items (organization_id, category_id) where archived_at is null;

-- ── De texto libre a categoría ────────────────────────────────────────────
-- La conversión vive en una función para poder probarla: una migración
-- aplicada no se vuelve a ejecutar desde pgTAP, esta función sí (D3).
--
-- Recibe pares `{item_id, category}` y:
--   1. crea una categoría por `(organización, tipo, nombre sin mayúsculas ni
--      espacios al borde)`; de las variantes de escritura gana la más
--      frecuente y, si empatan, la que tiene mayúscula;
--   2. enlaza cada ítem con la suya.
--
-- Todo con los triggers de usuario de `items` e `item_categories` apagados:
--   · `audit` escribiría una «edición» sin autor por cada ítem, y una
--     migración de esquema no es un cambio que alguien hizo;
--   · `enforce_archive` impediría enlazar los ítems archivados.
-- `disable trigger user` no apaga los triggers internos de las claves
-- foráneas: la clave compuesta se comprueba igual. Si algo falla, la
-- transacción deshace también el `disable`.

create function backfill_item_categories(p_rows jsonb)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_linked integer;
begin
  alter table items disable trigger user;
  alter table item_categories disable trigger user;

  with source as (
    select i.organization_id, i.kind, btrim(r.category) as name
    from jsonb_to_recordset(p_rows) as r(item_id uuid, category text)
    join items i on i.id = r.item_id
    where btrim(coalesce(r.category, '')) <> ''
  ),
  spellings as (
    select organization_id, kind, lower(name) as key, name, count(*) as uses
    from source
    group by organization_id, kind, lower(name), name
  ),
  chosen as (
    select distinct on (organization_id, kind, key) organization_id, kind, name
    from spellings
    -- `collate "C"`: en empate, la escritura con mayúscula va primero
    -- («Sustratos» antes que «sustratos»). La collation de la base pondría
    -- la minúscula delante.
    order by organization_id, kind, key, uses desc, name collate "C"
  )
  insert into item_categories (organization_id, kind, name)
  select organization_id, kind, name from chosen
  on conflict (organization_id, kind, (lower(name))) do nothing;

  update items i
  set category_id = c.id
  from jsonb_to_recordset(p_rows) as r(item_id uuid, category text),
       item_categories c
  where i.id = r.item_id
    and btrim(coalesce(r.category, '')) <> ''
    and c.organization_id = i.organization_id
    and c.kind = i.kind
    and lower(c.name) = lower(btrim(r.category));

  get diagnostics v_linked = row_count;

  alter table item_categories enable trigger user;
  alter table items enable trigger user;

  return v_linked;
end $$;

-- Solo `postgres` la invoca: la migración y pgTAP.
revoke execute on function backfill_item_categories(jsonb)
  from public, anon, authenticated, service_role;

-- Los textos se leen antes de llamar a la función, en su propia sentencia:
-- si la misma sentencia leyera `items`, la función no podría apagar sus
-- triggers ("is being used by active queries in this session").
do $$
declare
  v_rows jsonb;
begin
  select coalesce(
           jsonb_agg(jsonb_build_object('item_id', id, 'category', category)),
           '[]'::jsonb
         )
    into v_rows
    from items
   where btrim(coalesce(category, '')) <> '';

  perform backfill_item_categories(v_rows);
end $$;

-- Una sola fuente de verdad: el texto ya vive en `item_categories`, y un
-- `join` por `category_id` lo reconstruye si hiciera falta volver atrás.
alter table items drop column category;
