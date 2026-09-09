-- KAM-19 · Activos: vistas derivadas `line_cash_movements` y `asset_recovery`,
-- redefinición de `cash_flow_by_line_month` sobre la primera, y validación de
-- un activo como destino de vínculo de una tarea.
-- DDL canónico: specs/PRD/kamay-esquema-base-de-datos-supabase.md §11,
--   § Matriz de acceso.
-- Requisitos: openspec/changes/kam-19-assets-investment-recovery/specs/
--   payments/spec.md § Movimiento de caja con su línea y su activo;
--   specs/assets/spec.md § El costo total del activo suma su mantenimiento,
--   § El margen que recupera la inversión se mide en caja desde la fecha de
--   adquisición, § La inversión cuenta una sola vez, § Un activo es un destino
--   vinculable válido para una tarea.
-- Decisiones: design.md D4 (una vista de movimientos, dos lecturas), D5 (la
--   vista entrega ingredientes, el porcentaje lo calcula TypeScript), D6 (el
--   corte de fecha en la zona horaria de la organización), D7 (el recorte al
--   ayudante viaja en la vista).

-- ── Movimientos de caja con su línea y su activo ──────────────────────────
-- El empalme `payments → pedido | egreso → línea` es la definición de "dinero
-- de una línea". Hasta ahora vivía dentro de `cash_flow_by_line_month`, que
-- lo agregaba por mes. La recuperación de un activo necesita el mismo empalme
-- con un corte por fecha arbitraria —la de adquisición—, y un mes no sirve:
-- una máquina comprada el 20 de marzo se mediría contra el margen de todo
-- marzo, tres semanas anteriores a su existencia incluidas.
--
-- De ahí esta vista y no una segunda copia del empalme. Con dos copias, la
-- primera corrección que se haga en una y no en la otra hará que el panel y
-- los activos den dos márgenes distintos para la misma línea, y nadie lo
-- notará hasta que alguien los compare (D4).
--
-- Se conserva de la vista anterior todo lo que aquella documentó: `union all`
-- y no dos `left join` —un movimiento apunta a un pedido o a un egreso, nunca
-- a los dos—, el descarte de lo archivado en ambos extremos, y la condición
-- `is_owner()` dentro de la vista, porque el ayudante sí lee los cobros fila
-- a fila desde KAM-10 y `security_invoker` a secas le devolvería el agregado
-- que no puede ver.

create view line_cash_movements with (security_invoker = true) as
select
  p.organization_id,
  o.business_line_id,
  p.occurred_at,
  p.direction,
  p.amount,
  -- Un cobro nunca pertenece a un activo: el activo cuesta dinero, no lo trae.
  null::uuid as asset_id
from payments p
join orders o
  on o.id = p.order_id
 and o.organization_id = p.organization_id
where p.direction = 'in'
  and p.archived_at is null
  and o.archived_at is null
  and is_owner(p.organization_id)

union all

select
  p.organization_id,
  e.business_line_id,
  p.occurred_at,
  p.direction,
  p.amount,
  -- El activo al que pertenece el egreso pagado, o nulo. Es lo que permite
  -- que la recuperación descuente la inversión sin cambiar lo que el panel ve.
  e.asset_id
from payments p
join expenses e
  on e.id = p.expense_id
 and e.organization_id = p.organization_id
where p.direction = 'out'
  and p.archived_at is null
  and e.archived_at is null
  and is_owner(p.organization_id);

grant select on line_cash_movements to authenticated, service_role;

-- ── El agregado mensual pasa a derivarse de la vista de movimientos ───────
-- Mismas columnas, mismo recorte y mismo corte de mes en la zona horaria de
-- la organización que en 20260907070311: esto es un cambio de fuente, no de
-- significado. La prueba pgTAP de aquella migración no se toca, y es la
-- comprobación de que ninguna cifra del panel se movió.
--
-- No filtra por `asset_id`: comprar una impresora sí es dinero que salió de
-- caja, y el panel debe seguir diciéndolo. La exclusión de la inversión es
-- propia de la recuperación del activo y vive en `asset_recovery` (D4).

create or replace view cash_flow_by_line_month with (security_invoker = true) as
select
  m.organization_id,
  m.business_line_id,
  (date_trunc('month', m.occurred_at at time zone org.timezone))::date as month,
  coalesce(sum(m.amount) filter (where m.direction = 'in'),  0) as collected,
  coalesce(sum(m.amount) filter (where m.direction = 'out'), 0) as paid
from line_cash_movements m
join organizations org on org.id = m.organization_id
group by m.organization_id, m.business_line_id, 3;

-- ── Recuperación de inversión ─────────────────────────────────────────────
-- La vista entrega ingredientes, no porcentaje (D5). El criterio 6 del
-- backlog pide la fórmula en un solo lugar *del código* y las pruebas
-- requeridas la piden *unitaria*: un `case when total_cost = 0` escondido en
-- un `select` no se prueba unitariamente, no se lee sin abrir la migración, y
-- corregirlo obligaría a una migración nueva (convención nº 6). Vive en
-- `lib/assets/recovery.ts`.
--
-- `maintenance_cost` sale de `expense_totals`, que ya excluye lo archivado:
-- archivar un gasto de mantenimiento lo retira del costo del activo sin
-- ninguna regla de más. El egreso de adquisición NO suma —su importe ya está
-- representado por `acquisition_cost` declarado— y por eso el filtro nombra
-- explícitamente el papel `maintenance`.

create view asset_recovery with (security_invoker = true) as
select
  a.item_id,
  a.organization_id,
  i.business_line_id,
  i.name,
  a.acquired_on,
  a.acquisition_cost,
  coalesce(maintenance.total, 0)                          as maintenance_cost,
  a.acquisition_cost + coalesce(maintenance.total, 0)     as total_cost,
  coalesce(flow.collected, 0) - coalesce(flow.paid, 0)    as line_margin_since
from asset_details a
join items i         on i.id = a.item_id
join organizations o on o.id = a.organization_id

left join lateral (
  select sum(et.total) as total
  from expenses e
  join expense_totals et on et.expense_id = e.id
  where e.asset_id = a.item_id
    and e.asset_expense_role = 'maintenance'
) maintenance on true

left join lateral (
  select
    sum(m.amount) filter (where m.direction = 'in')  as collected,
    sum(m.amount) filter (where m.direction = 'out') as paid
  from line_cash_movements m
  where m.organization_id = a.organization_id
    and m.business_line_id = i.business_line_id
    -- La inversión cuenta una sola vez: lo que ya es costo de algún activo no
    -- vuelve a restar del margen con el que se mide. Sin esta línea, una
    -- máquina tendría que generar dos veces su costo para llenar su barra.
    and m.asset_id is null
    -- El día se corta en la zona del taller, no en la del servidor (D6): un
    -- cobro de las 21:00 en La Paz el día de la compra cuenta para esa compra,
    -- aunque en UTC ya sea el día siguiente.
    and (m.occurred_at at time zone o.timezone)::date >= a.acquired_on
) flow on true

-- Misma razón que en `line_cash_movements`: el ayudante lee cobros fila a
-- fila, así que `security_invoker` no basta para negarle el agregado. Aquí
-- además `asset_details` ya le da cero filas por su RLS; la condición es la
-- que impide que una futura reescritura del `join` se lo devuelva (D7).
where is_owner(a.organization_id);

grant select on asset_recovery to authenticated, service_role;

-- ── Un activo es un destino vinculable válido para una tarea ──────────────
-- La versión de 20260907120000 rechazaba todo vínculo `asset` con un
-- comentario que nombraba a esta tarea: "`asset_details` llega con KAM-19;
-- hasta entonces no hay a qué apuntar". Ya llega. Solo cambia esa rama; el
-- resto de la función se conserva palabra por palabra, incluido el `else` que
-- deja opinar al `check` de la tabla.

create or replace function validate_task_link()
returns trigger
language plpgsql as $$
declare
  v_exists boolean;
begin
  case new.entity_type
    when 'order'   then select exists (select 1 from orders        where id = new.entity_id) into v_exists;
    when 'contact' then select exists (select 1 from contacts      where id = new.entity_id) into v_exists;
    when 'item'    then select exists (select 1 from items         where id = new.entity_id) into v_exists;
    when 'expense' then select exists (select 1 from expenses      where id = new.entity_id) into v_exists;
    when 'asset'   then select exists (select 1 from asset_details where item_id = new.entity_id) into v_exists;
    -- Un tipo fuera del dominio no es asunto de este trigger: lo rechaza el
    -- `check` de la tabla. Sin este `else`, el `case` levantaría un
    -- `case_not_found` antes de que la restricción llegara a opinar, y el
    -- error hablaría de plpgsql en vez de del dato.
    else return new;
  end case;

  if not coalesce(v_exists, false) then
    raise exception 'El registro vinculado no existe'
      using errcode = 'foreign_key_violation';
  end if;

  return new;
end $$;
