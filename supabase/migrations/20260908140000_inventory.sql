-- KAM-18 · Inventario suave: movimientos, saldo derivado y entrada automática.
-- DDL canónico: specs/PRD/kamay-esquema-base-de-datos-supabase.md §10, §11, §16.
--
-- La idea entera cabe en una frase: **el saldo no existe como dato**. Existen
-- movimientos, y el saldo es su suma. De ahí salen las tres decisiones que
-- gobiernan este archivo:
--
--   1. La entrada de una compra la genera un trigger sobre `expense_items`,
--      no la función `create_expense` (design D1). El trigger cubre toda vía
--      de escritura presente y futura; una rama dentro de la función solo
--      cubre la que existía el día que se escribió.
--   2. La idempotencia la impone el índice único parcial, y el trigger absorbe
--      el conflicto (design D2). La misma compra sincronizada dos veces deja
--      una sola entrada y **no** rompe el alta con un error de restricción.
--   3. La inmutabilidad es un privilegio que no se concede, no un trigger que
--      vigila (design D3): `authenticated` recibe `select` e `insert`, y nada
--      más. Sin `update`, sin `delete`, sin `archived_at`. Una corrección es
--      siempre un movimiento nuevo, como en contabilidad.
--
-- Ninguna desviación del canónico. `items.min_stock` ya existía desde KAM-06 y
-- este archivo no la toca: lo que cambia es que a partir de ahora significa algo.

-- ── El documento ──────────────────────────────────────────────────────────

create table inventory_movements (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  item_id         uuid not null references items(id),
  variant_id      uuid references item_variants(id),
  kind            text not null check (kind in ('in','out','adjustment')),

  -- Con signo, y nunca cero: un movimiento que no mueve nada no es un
  -- movimiento. El ajuste por conteo que coincide con el saldo lo detecta la
  -- interfaz antes de llegar aquí (design D6).
  quantity        numeric(14,3) not null check (quantity <> 0),

  -- `order_item` queda declarado y **sin uso en KAM-18** (design D5): el
  -- índice único de abajo lo limitaría a un movimiento por línea de pedido, y
  -- consumir tres insumos distintos para la misma línea es el caso normal.
  -- Todo consumo humano nace `manual`, venga del ítem, del pedido o la tarea.
  source_type     text check (source_type in ('expense_item','order_item','manual','count')),
  source_id       uuid,

  -- La hora del hecho la fija el cliente (convención nº 9); `created_at`, el
  -- servidor. Un consumo encolado a las 15:40 y sincronizado a las 18:00
  -- conserva las 15:40.
  occurred_at     timestamptz not null default now(),
  note            text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),

  constraint sign_matches_kind check (
    (kind = 'in' and quantity > 0) or
    (kind = 'out' and quantity < 0) or
    (kind = 'adjustment')
  )
);

create index on inventory_movements (item_id, occurred_at desc);
create index on inventory_movements (organization_id, occurred_at desc);

-- El índice que sostiene el criterio nº 2 del backlog. Es la **única**
-- garantía de que una línea de compra no genere dos entradas: no hay
-- comprobación previa en ninguna capa, porque «leer y después escribir» es una
-- condición de carrera con nombre que dos vaciados de cola concurrentes
-- superan los dos.
create unique index on inventory_movements (source_type, source_id)
  where source_type in ('expense_item','order_item');

-- ── El derivado ───────────────────────────────────────────────────────────
-- Convención nº 4: nada derivado se almacena. `security_invoker` es
-- obligatorio en toda vista nueva; omitirlo es la forma más común de filtrar
-- datos entre organizaciones sin darse cuenta (esquema §11).
--
-- El `left join` no es un detalle: es lo que hace que un insumo sin ningún
-- movimiento aparezca con saldo cero en vez de desaparecer del listado, que es
-- justo lo que necesita la tarjeta del panel para no mentir por omisión.
--
-- `below_min` se calcula aquí y no en tres sitios: la tarjeta del panel, el
-- distintivo del catálogo y la sección de saldo de V11 leen la misma bandera y
-- no pueden discrepar (design D4).
--
-- Sin filtro de archivado a propósito: un insumo archivado con saldo pendiente
-- es exactamente lo que alguien quiere ver al buscar por qué el número no
-- cuadra. Filtrar es cosa de quien lista.

create view item_balances with (security_invoker = true) as
select
  i.id                                   as item_id,
  i.organization_id,
  coalesce(sum(m.quantity), 0)           as balance,
  i.min_stock,
  (i.min_stock is not null and coalesce(sum(m.quantity), 0) < i.min_stock) as below_min
from items i
left join inventory_movements m on m.item_id = i.id
where i.kind = 'supply'
group by i.id;

-- ── La entrada automática ─────────────────────────────────────────────────

create or replace function record_purchase_stock_entry()
returns trigger
language plpgsql security invoker set search_path = public as $$
declare
  v_kind text;
  v_occurred timestamptz;
begin
  -- Solo los insumos mueven inventario (design D1). `item_balances` solo
  -- contempla `kind = 'supply'`, así que una entrada de producto o de activo
  -- no aparecería en ningún saldo y solo ensuciaría el historial de un ítem
  -- que no tiene saldo que explicar. Comprar una impresora es una adquisición,
  -- y eso lo registra KAM-19.
  select i.kind into v_kind from items i where i.id = new.item_id;
  if v_kind is distinct from 'supply' then
    return new;
  end if;

  -- Solo las compras. Un gasto no lleva líneas de insumo —`create_expense` ya
  -- lo rechaza—, pero el trigger cuelga de la tabla y no de la función, así
  -- que comprueba lo suyo en vez de suponerlo.
  select e.occurred_at into v_occurred
  from expenses e
  where e.id = new.expense_id and e.kind = 'purchase';

  if v_occurred is null then
    return new;
  end if;

  -- La fecha del movimiento es la del hecho que lo causó, no la de este
  -- `insert`: una compra anotada tarde entra al inventario con su fecha real.
  --
  -- `on conflict do nothing` es la mitad de la decisión D2. Sin él, la segunda
  -- llegada de la misma compra rompería el alta con un error de restricción
  -- que la persona no puede interpretar, y el criterio nº 2 pide que siga
  -- existiendo una sola entrada, no que la compra falle.
  insert into inventory_movements (
    organization_id, item_id, variant_id, kind, quantity,
    source_type, source_id, occurred_at, created_by
  ) values (
    new.organization_id, new.item_id, new.variant_id, 'in', new.quantity,
    'expense_item', new.id, v_occurred, auth.uid()
  )
  on conflict do nothing;

  return new;
end $$;

-- `after` y no `before`: la línea tiene que existir antes de que otra fila la
-- referencie por `source_id`.
create trigger record_stock_entry after insert on expense_items
  for each row execute function record_purchase_stock_entry();

-- ── Bitácora ──────────────────────────────────────────────────────────────
-- Convención nº 7: un solo historial. La sección *Movimientos* de V11 lee el
-- propio documento; quién hizo qué vive aquí. No hay —ni habrá— una segunda
-- tabla de historial de inventario.
--
-- `enforce_archive_rules()` **no** se engancha: no hay `archived_at` que
-- vigilar (design D3).

create trigger audit after insert on inventory_movements
  for each row execute function log_activity();

-- ── Privilegios y RLS ─────────────────────────────────────────────────────
-- Matriz de acceso §16: `inventory_movements` es *Leer, crear* para el
-- ayudante y todo para el dueño. «Todo» aquí también excluye editar y borrar:
-- la inmutabilidad no distingue de rol.

revoke all on inventory_movements from authenticated, anon, service_role;

-- Las dos únicas cosas que se pueden hacer con un movimiento. La ausencia de
-- `update` es la implementación literal de «los movimientos no se editan»
-- (criterio nº 7 del backlog), igual que la ausencia de política `DELETE`
-- implementa «nada se elimina» en el resto del esquema.
grant select, insert on inventory_movements to authenticated;
grant select on inventory_movements to service_role;

alter table inventory_movements enable row level security;

create policy "inventory_movements: leer los de la organización"
  on inventory_movements for select to authenticated
  using (is_member(organization_id));

-- Crear, ambos roles: es el ayudante quien está delante del estante.
create policy "inventory_movements: crear en la organización"
  on inventory_movements for insert to authenticated
  with check (is_member(organization_id));

-- Sin política UPDATE y sin política DELETE. Con RLS activo, lo que no tiene
-- política está prohibido; el privilegio revocado lo prohíbe otra vez. Las dos
-- vallas son deliberadas.

-- Las vistas no heredan el privilegio de lectura igual en todos los entornos
-- (la nota de 20260826200000): aquí el `grant` sí es el que decide.
grant select on item_balances to authenticated, service_role;
