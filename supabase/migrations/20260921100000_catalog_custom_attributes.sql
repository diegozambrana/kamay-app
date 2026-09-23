-- Cambio `catalog-custom-attributes` (KAM-31) · Atributos de catálogo
-- definidos por la organización, y disponibilidad por variante.
--
-- Cada categoría de ítem declara qué datos describen a sus ítems o a sus
-- variantes —el color, la marca y las temperaturas de un filamento—, y el
-- saldo de un insumo se ve por variante. Nada derivado se guarda
-- (convención nº 4): el saldo por variante es una vista, y ninguna columna
-- guarda precio por kilo, último costo ni saldo.
-- Specs: `org-configuration`, `catalog-directory`, `inventory` (deltas);
-- design D1, D2 y D6.

-- ── Atributos de una categoría ────────────────────────────────────────────
-- Configuración como `item_categories`, colgada de una categoría de la misma
-- organización (D1). La clave compuesta necesita un destino único con
-- exactamente esas dos columnas: `unique (id, organization_id)` parece
-- redundante con la clave primaria, pero es ese destino.

alter table item_categories
  add constraint item_categories_id_org_key unique (id, organization_id);

create table item_category_attributes (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  category_id     uuid not null,
  name            text not null check (name = btrim(name) and name <> ''),
  type            text not null check (type in ('text', 'number', 'list')),
  -- '°C', 'mm/s': texto libre. No referencia `units`, que son unidades de
  -- stock y no de una temperatura.
  unit            text check (unit is null or (unit = btrim(unit) and unit <> '')),
  options         jsonb not null default '[]'::jsonb,
  required        boolean not null default false,
  scope           text not null check (scope in ('item', 'variant')),
  -- Orden de creación, asignado por el servicio. No es único: dos altas
  -- simultáneas empatan y desempata `created_at`.
  position        integer not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  archived_at     timestamptz,

  constraint item_category_attributes_category_fk
    foreign key (category_id, organization_id)
    references item_categories (id, organization_id),

  -- Una lista tiene opciones, y solo una lista las tiene. Que sean textos
  -- distintos y sin espacios al borde lo valida el servidor (D3); aquí la
  -- forma: un arreglo de textos.
  constraint options_match_type check (
    jsonb_typeof(options) = 'array'
    and ((type = 'list') = (jsonb_array_length(options) > 0))
    and not jsonb_path_exists(options, '$[*] ? (@.type() != "string")')
  ),
  constraint unit_only_for_numbers check (unit is null or type = 'number')
);

-- El nombre no se repite dentro de la categoría sin distinguir mayúsculas.
create unique index item_category_attributes_name_key
  on item_category_attributes (category_id, lower(name));

-- Los vigentes de unas categorías: la consulta de formularios y filtros.
create index on item_category_attributes (organization_id, category_id)
  where archived_at is null;

-- Procedimiento de supabase/README.md: el trigger se adjunta en la misma
-- migración que crea la tabla.
create trigger audit after insert or update on item_category_attributes
  for each row execute function log_activity();

-- Tipo, alcance y categoría no cambian después de creados (D1). Con el tipo
-- de una categoría alcanzaba con que el servicio no lo escribiera, porque la
-- clave compuesta de `items` protegía la categoría en uso. Aquí nada protege
-- los valores: pasar «Temperatura» de número a lista, o de ítem a variante,
-- dejaría valores guardados sin sentido.
create function guard_item_category_attribute_shape()
returns trigger
language plpgsql set search_path = public as $$
begin
  if new.type is distinct from old.type
     or new.scope is distinct from old.scope
     or new.category_id is distinct from old.category_id then
    raise exception 'El tipo, el alcance y la categoría de un atributo no cambian'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger guard_shape before update on item_category_attributes
  for each row execute function guard_item_category_attribute_shape();

-- Calcado de `item_categories`: la lee todo miembro, la escribe solo el
-- dueño, nadie la borra y ningún trabajo programado la toca.
grant select, insert, update on item_category_attributes to authenticated;
revoke delete on item_category_attributes from authenticated, anon, service_role;
revoke insert, update on item_category_attributes from anon, service_role;
grant select on item_category_attributes to service_role;

alter table item_category_attributes enable row level security;

create policy "item_category_attributes: leer si es miembro"
  on item_category_attributes for select to authenticated
  using (is_member(organization_id));

create policy "item_category_attributes: crear solo el dueño"
  on item_category_attributes for insert to authenticated
  with check (is_owner(organization_id));

create policy "item_category_attributes: editar solo el dueño"
  on item_category_attributes for update to authenticated
  using (is_owner(organization_id))
  with check (is_owner(organization_id));

-- ── Los valores ───────────────────────────────────────────────────────────
-- Un objeto por ítem y por variante, con el id del atributo como clave (D2):
-- renombrar un atributo no toca ningún ítem. La validación por tipo depende
-- de la definición vigente y del valor anterior, así que es del servidor
-- (D3); la base garantiza la forma.
--
-- `add column ... default` es un cambio de catálogo: no reescribe filas ni
-- dispara `audit`, así que la bitácora no registra ediciones que nadie hizo.

alter table items
  add column attributes jsonb not null default '{}'::jsonb
  constraint items_attributes_is_object check (jsonb_typeof(attributes) = 'object');

alter table item_variants
  add constraint item_variants_attributes_is_object
  check (jsonb_typeof(attributes) = 'object');

-- ── La variante de un movimiento es de su ítem ────────────────────────────
-- Sin esto, un movimiento cruzado sumaría a la variante de otro ítem y la
-- suma de las variantes dejaría de ser el saldo del ítem (D6). Con
-- `MATCH SIMPLE` un movimiento sin variante no se comprueba. Cubre también la
-- entrada automática de compra: una línea con una variante ajena hace fallar
-- la compra entera, y la acción de egresos lo avisa antes.

alter table item_variants
  add constraint item_variants_id_item_key unique (id, item_id);

alter table inventory_movements
  add constraint inventory_movements_variant_of_item_fk
  foreign key (variant_id, item_id) references item_variants (id, item_id);

-- ── Saldo por variante ────────────────────────────────────────────────────
-- Una fila por variante, vigente o archivada, con cero si nunca se movió; y
-- una fila sin variante con los movimientos que no la llevan, solo si
-- existen. La suma de las filas de un ítem es su saldo en `item_balances`,
-- que no cambia: el mínimo y la alerta siguen siendo del ítem (D6).

create view item_variant_balances with (security_invoker = true) as
select
  i.id                          as item_id,
  i.organization_id,
  v.id                          as variant_id,
  v.name                        as variant_name,
  v.archived_at                 as variant_archived_at,
  coalesce(sum(m.quantity), 0)  as balance
from items i
join item_variants v on v.item_id = i.id
left join inventory_movements m on m.variant_id = v.id
where i.kind = 'supply'
group by i.id, v.id
union all
select
  i.id,
  i.organization_id,
  null::uuid,
  null::text,
  null::timestamptz,
  sum(m.quantity)
from items i
join inventory_movements m on m.item_id = i.id and m.variant_id is null
where i.kind = 'supply'
group by i.id;

grant select on item_variant_balances to authenticated, service_role;
