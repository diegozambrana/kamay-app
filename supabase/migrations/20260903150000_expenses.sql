-- KAM-09 · Egresos: tablas `expenses` y `expense_items`, alta atómica,
-- total y último costo derivados.
-- DDL canónico: specs/PRD/kamay-esquema-base-de-datos-supabase.md §8, §11, §16.
-- Requisitos: openspec/changes/kam-09-expenses-purchases-costs/specs/expenses/spec.md
-- Decisiones: design.md D1 (sin `paid`), D2 (función de alta), D3
-- (`item_last_cost`), D7 (solo el dueño), D8 (`organization_id` en líneas).
--
-- Una sola bandeja para lo que sale de caja: la compra trae ítems y el gasto
-- no trae nada. Son dos conceptos del modelo 6.1 —"Egreso: compra o gasto"—
-- y no dos módulos: separarlos obligaría a que todo reporte de costos uniera
-- dos fuentes.

create table expenses (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references organizations(id),
  business_line_id     uuid not null references business_lines(id),
  kind                 text not null check (kind in ('purchase','expense')),
  contact_id           uuid references contacts(id),            -- proveedor
  expense_category_id  uuid references expense_categories(id),
  order_id             uuid references orders(id),              -- gasto asignado a un pedido
  -- Solo los gastos llevan monto propio; las compras suman sus líneas y el
  -- total vive en la vista `expense_totals` (convención nº 4).
  amount               numeric(14,2),
  -- La hora real del hecho la fija el cliente; `created_at`, el servidor
  -- (convención nº 9, requisito del modo sin conexión).
  occurred_at          timestamptz not null default now(),
  note                 text,
  created_by           uuid references auth.users(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  archived_at          timestamptz,

  -- Una compra siempre tiene a quién se le compró.
  constraint purchase_needs_supplier
    check (kind <> 'purchase' or contact_id is not null),
  -- Un gasto sin categoría ni monto no dice nada.
  constraint expense_needs_category_and_amount
    check (kind <> 'expense' or (expense_category_id is not null and amount is not null)),
  -- El total de una compra no se guarda: se calcula desde sus líneas.
  constraint purchase_has_no_own_amount
    check (kind <> 'purchase' or amount is null)
);

create index on expenses (organization_id, occurred_at desc) where archived_at is null;
create index on expenses (organization_id, business_line_id, occurred_at desc);

-- El precio vive en la línea del documento, nunca solo en el catálogo: es lo
-- que permite el último costo conocido sin reescribir la historia (§2).
create table expense_items (
  id          uuid primary key default gen_random_uuid(),
  expense_id  uuid not null references expenses(id),
  item_id     uuid not null references items(id),
  variant_id  uuid references item_variants(id),
  quantity    numeric(14,3) not null check (quantity > 0),
  unit_price  numeric(14,2) not null check (unit_price >= 0),
  created_at  timestamptz not null default now()
);

-- Única desviación del DDL canónico §8, con el mismo motivo que la de
-- `order_items` en 20260826200000: la convención nº 2 exige
-- `organization_id` en toda tabla y toda consulta, y sin él `log_activity()`
-- —que lo lee de la propia fila— registraría el evento bajo una organización
-- inexistente, además de obligar a la política de RLS a saltar a `expenses`
-- en cada fila.
alter table expense_items
  add column organization_id uuid not null references organizations(id);

create index on expense_items (expense_id);
create index on expense_items (item_id);
create index on expense_items (organization_id);

-- ── Alta: egreso y líneas, o nada ─────────────────────────────────────────
-- Mismo motivo y misma forma que `create_order` (20260903120000): PostgREST
-- no ofrece transacciones entre llamadas y sin política `DELETE` no hay
-- compensación posible. Si el insert de las líneas fallara después del del
-- encabezado, quedaría una compra vacía que nadie podría borrar (design D2).
--
-- `security invoker`: RLS sigue siendo la autorización real. La función no
-- puede hacer nada que quien la llama no pudiera hacer a mano.

create or replace function create_expense(p_expense jsonb, p_items jsonb)
returns uuid
language plpgsql security invoker as $$
declare
  v_org   uuid  := nullif(p_expense->>'organization_id', '')::uuid;
  v_line  uuid  := nullif(p_expense->>'business_line_id', '')::uuid;
  v_kind  text  := nullif(p_expense->>'kind', '');
  v_id    uuid  := coalesce(nullif(p_expense->>'id', '')::uuid, gen_random_uuid());
  v_items jsonb := coalesce(p_items, '[]'::jsonb);
  v_count int;
  v_item  jsonb;
begin
  if v_org is null or v_line is null then
    raise exception 'El egreso necesita organización y línea de negocio'
      using errcode = 'check_violation';
  end if;

  if v_kind is null or v_kind not in ('purchase', 'expense') then
    raise exception 'El tipo de egreso no es válido'
      using errcode = 'check_violation';
  end if;

  -- Convención nº 2 y matriz de acceso §16: los egresos son del dueño. Se
  -- comprueba explícitamente aunque RLS ya lo rechazaría fila a fila, para
  -- que el mensaje sea el mismo por cualquier camino.
  if not is_owner(v_org) then
    raise exception 'Solo la persona dueña registra egresos'
      using errcode = 'insufficient_privilege';
  end if;

  if jsonb_typeof(v_items) <> 'array' then
    raise exception 'Las líneas del egreso no tienen un formato válido'
      using errcode = 'check_violation';
  end if;

  v_count := jsonb_array_length(v_items);

  if v_kind = 'purchase' and v_count = 0 then
    raise exception 'Una compra necesita al menos una línea'
      using errcode = 'check_violation';
  end if;

  if v_kind = 'expense' and v_count > 0 then
    raise exception 'Un gasto no lleva líneas de insumo'
      using errcode = 'check_violation';
  end if;

  insert into expenses (
    id, organization_id, business_line_id, kind, contact_id,
    expense_category_id, order_id, amount, occurred_at, note, created_by
  ) values (
    v_id, v_org, v_line, v_kind,
    nullif(p_expense->>'contact_id', '')::uuid,
    nullif(p_expense->>'expense_category_id', '')::uuid,
    nullif(p_expense->>'order_id', '')::uuid,
    nullif(p_expense->>'amount', '')::numeric,
    -- La hora del hecho la fija el cliente (convención nº 9); `created_at`,
    -- el servidor.
    coalesce(nullif(p_expense->>'occurred_at', '')::timestamptz, now()),
    nullif(p_expense->>'note', ''),
    auth.uid()
  );

  for v_item in select * from jsonb_array_elements(v_items)
  loop
    insert into expense_items (
      id, organization_id, expense_id, item_id, variant_id, quantity, unit_price
    ) values (
      coalesce(nullif(v_item->>'id', '')::uuid, gen_random_uuid()),
      v_org, v_id,
      nullif(v_item->>'item_id', '')::uuid,
      nullif(v_item->>'variant_id', '')::uuid,
      (v_item->>'quantity')::numeric,
      -- El precio que se pagó, no el que tenga el catálogo (esquema §2).
      (v_item->>'unit_price')::numeric
    );
  end loop;

  return v_id;
end $$;

-- ── Derivados ─────────────────────────────────────────────────────────────
-- Convención nº 4: nada derivado se almacena. Ambas vistas con
-- `security_invoker` para que RLS siga decidiendo quién ve qué: al ayudante,
-- sin política de lectura sobre `expenses`, le devuelven cero filas sin una
-- línea de código de aplicación (esquema §16, "Cómo se ocultan los costos").
--
-- `expense_totals` nace SIN la columna `paid` de la definición canónica, igual
-- que `order_totals` en KAM-07: `paid` sale de `payments`, que llega con
-- KAM-10 y la añadirá al final con `create or replace view` en una migración
-- nueva. Por eso el orden de las columnas es el canónico y no se toca.

create view expense_totals with (security_invoker = true) as
select
  e.id              as expense_id,
  e.organization_id,
  e.business_line_id,
  e.kind,
  e.occurred_at,
  coalesce(e.amount, (select sum(ei.quantity * ei.unit_price)
                      from expense_items ei where ei.expense_id = e.id), 0) as total
from expenses e
where e.archived_at is null;

-- Último costo conocido de cada ítem. "Último" es por la fecha del hecho, no
-- por el orden de registro: una compra anotada tarde no puede volverse la
-- más reciente. Las compras archivadas no cuentan.
create view item_last_cost with (security_invoker = true) as
select distinct on (ei.item_id)
  ei.item_id,
  e.organization_id,
  ei.unit_price  as last_cost,
  e.occurred_at  as last_purchase_at,
  e.contact_id   as last_supplier_id
from expense_items ei
join expenses e on e.id = ei.expense_id
where e.archived_at is null
  and e.kind = 'purchase'
order by ei.item_id, e.occurred_at desc, ei.created_at desc;

-- ── Archivado y bitácora ──────────────────────────────────────────────────
-- Mismas reglas que el catálogo y los pedidos, con la función genérica de
-- 20260826120000: archivar es del dueño y un archivado no se edita.
-- `expense_items` no lleva `enforce_archive` porque no tiene `archived_at`:
-- lo protegen la ausencia de política `DELETE` y el archivado del egreso.

create trigger enforce_archive before update on expenses
  for each row execute function enforce_archive_rules();

create trigger audit after insert or update on expenses
  for each row execute function log_activity();

create trigger audit after insert or update on expense_items
  for each row execute function log_activity();

-- ── Privilegios y RLS ─────────────────────────────────────────────────────
-- Matriz de acceso §16: `expenses` y `expense_items` son SIN ACCESO para el
-- ayudante y todo para el dueño. Los costos de compra viven aquí, y la forma
-- de ocultárselos no es esconder columnas sino no darle política de lectura.
-- Borrar, nadie.

grant select, insert, update on expenses to authenticated;
grant select, insert, update on expense_items to authenticated;

revoke delete on expenses, expense_items from authenticated, anon, service_role;
revoke insert, update on expenses, expense_items from anon;
revoke insert, update on expenses, expense_items from service_role;
grant select on expenses, expense_items to service_role;

-- Las vistas no heredan el privilegio de lectura igual en todos los entornos
-- (la nota de 20260826200000): aquí el `grant` sí es el que decide.
grant select on expense_totals, item_last_cost to authenticated, service_role;

-- El privilegio de ejecución de una función nace en `public`: se revoca ahí
-- y se concede solo a quien tiene sesión.
revoke execute on function create_expense(jsonb, jsonb) from public;
grant execute on function create_expense(jsonb, jsonb) to authenticated;

alter table expenses enable row level security;
alter table expense_items enable row level security;

create policy "expenses: leer solo el dueño"
  on expenses for select to authenticated
  using (is_owner(organization_id));

create policy "expenses: crear solo el dueño"
  on expenses for insert to authenticated
  with check (is_owner(organization_id));

create policy "expenses: editar solo el dueño"
  on expenses for update to authenticated
  using (is_owner(organization_id))
  with check (is_owner(organization_id));

create policy "expense_items: leer solo el dueño"
  on expense_items for select to authenticated
  using (is_owner(organization_id));

create policy "expense_items: crear solo el dueño"
  on expense_items for insert to authenticated
  with check (is_owner(organization_id));

create policy "expense_items: editar solo el dueño"
  on expense_items for update to authenticated
  using (is_owner(organization_id))
  with check (is_owner(organization_id));

-- Sin política DELETE en ninguna de las dos: se archiva, nunca se borra.
