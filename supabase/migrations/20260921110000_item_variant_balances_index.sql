-- Cambio `catalog-custom-attributes` · El saldo por variante sin recorrer
-- todos los movimientos.
--
-- `item_variant_balances` (20260921100000) unía los movimientos por
-- `variant_id`, que no tenía índice: para leer los saldos de un solo ítem, la
-- base recorría todos los movimientos de todas las organizaciones y evaluaba
-- RLS en cada uno. En la base local compartida (≈40.000 movimientos) eso eran
-- 2 segundos por lectura.
--
-- Dos arreglos, y el segundo basta por sí solo para la lectura por ítem:
--   1. un índice parcial por variante, para quien filtre por ella;
--   2. la vista une por ítem **y** variante, así que usa el índice
--      `(item_id, occurred_at)` que ya existe desde KAM-18.
-- La clave compuesta `(variant_id, item_id)` garantiza que las dos
-- condiciones dicen lo mismo: ningún movimiento de una variante es de otro
-- ítem.
--
-- Mismas columnas, mismo orden y mismas filas: `create or replace view`.

create index inventory_movements_variant_idx
  on inventory_movements (variant_id)
  where variant_id is not null;

create or replace view item_variant_balances with (security_invoker = true) as
select
  i.id                          as item_id,
  i.organization_id,
  v.id                          as variant_id,
  v.name                        as variant_name,
  v.archived_at                 as variant_archived_at,
  coalesce(sum(m.quantity), 0)  as balance
from items i
join item_variants v on v.item_id = i.id
left join inventory_movements m on m.item_id = i.id and m.variant_id = v.id
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
