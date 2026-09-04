-- KAM-10 · Cobros y pagos: tabla `payments`, `paid` en los totales derivados
-- e indicadores Por cobrar / Por pagar.
-- DDL canónico: specs/PRD/kamay-esquema-base-de-datos-supabase.md
--   § Cobros y pagos, § Vistas derivadas, § Matriz de acceso.
-- Requisitos: openspec/changes/kam-10-payments-collections/specs/payments/spec.md
-- Decisiones: design.md D1 (las invariantes en la base), D2 (`create or
--   replace view`), D4 (anular = archivar), D5 (permiso partido del ayudante),
--   D6 (`UPDATE` solo del dueño y solo `archived_at`), D7 (dos vistas).
--
-- Pedido entregado ≠ pedido cobrado (modelo 6.1). Este es el único hecho que
-- faltaba para cerrar el ciclo del dinero: todo lo demás —saldo, estado de
-- pago, por cobrar, por pagar— se deriva de aquí y no se almacena en ninguna
-- columna (convención nº 4).

create table payments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  direction       text not null check (direction in ('in','out')),
  order_id        uuid,
  expense_id      uuid,
  -- Siempre positivo: la dirección la expresa `direction`, nunca el signo.
  -- Es también lo que hace inviable anular con una fila en negativo (D4).
  amount          numeric(14,2) not null check (amount > 0),
  method          text check (method in ('cash','transfer','other')),
  -- La hora real del hecho la fija el cliente (convención nº 9, requisito del
  -- modo sin conexión); `created_at`, el servidor.
  occurred_at     timestamptz not null default now(),
  note            text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  archived_at     timestamptz,

  -- Un movimiento apunta a un pedido o a un egreso, nunca a los dos ni a
  -- ninguno. Criterio 4 del backlog: lo impide la base de datos.
  constraint exactly_one_target check (
    (order_id is not null)::int + (expense_id is not null)::int = 1
  ),
  -- Un cobro siempre `in`, un pago siempre `out`. Criterio 5 del backlog.
  constraint direction_matches_target check (
    (order_id is not null and direction = 'in') or
    (expense_id is not null and direction = 'out')
  )
);

-- Única desviación del DDL canónico § Cobros y pagos, con el mismo motivo que
-- las de `order_items` y `expense_items`: el canon declara `order_id
-- references orders(id)` a secas, y con eso un movimiento podría apuntar a un
-- pedido de otra organización que su propio `organization_id`. La referencia
-- compuesta lo impide de forma declarativa, sin trigger y para `insert` y
-- `update` por igual. Exige la clave única de destino que se añade aquí
-- mismo; sobre la primaria `id` es redundante en datos y solo existe para que
-- la referencia compuesta tenga a qué apuntar.

alter table orders   add constraint orders_id_organization_key   unique (id, organization_id);
alter table expenses add constraint expenses_id_organization_key unique (id, organization_id);

alter table payments
  add constraint payments_order_same_organization
    foreign key (order_id, organization_id)
    references orders (id, organization_id),
  add constraint payments_expense_same_organization
    foreign key (expense_id, organization_id)
    references expenses (id, organization_id);

create index on payments (order_id);
create index on payments (expense_id);

-- ── Un movimiento de dinero es un hecho, no un borrador ───────────────────
-- Convención nº 3 llevada un paso más allá: además de no borrarse, no se
-- edita. Un importe corregido en silencio deja la bitácora mintiendo, así que
-- la única corrección disponible es anular y volver a registrar (D6). Lo
-- único que puede cambiar es `archived_at`, y de eso ya se ocupa
-- `enforce_archive_rules` (20260826120000): exige dueño y congela la fila
-- archivada. Los dos triggers son complementarios y corren ambos.

create or replace function enforce_payment_immutable()
returns trigger
language plpgsql as $$
begin
  if to_jsonb(new) - 'archived_at' is distinct from to_jsonb(old) - 'archived_at' then
    raise exception 'Un movimiento de dinero no se edita: anúlalo y registra otro'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger enforce_archive before update on payments
  for each row execute function enforce_archive_rules();

create trigger enforce_immutable before update on payments
  for each row execute function enforce_payment_immutable();

create trigger audit after insert or update on payments
  for each row execute function log_activity();

-- ── Derivados: `paid` llega a los dos totales ─────────────────────────────
-- Convención nº 4 y decisión D2. Ambas vistas nacieron sin `paid` a propósito
-- —KAM-07 y KAM-09 lo dejaron escrito— porque exponer un `paid = 0` que en
-- realidad significaba "todavía no se sabe" era una mentira que algún reporte
-- acabaría sumando. Ahora sí se sabe.
--
-- `create or replace view` exige conservar nombre, tipo y orden de las
-- columnas que ya existían: `paid` se añade AL FINAL. La prueba pgTAP
-- comprueba la lista de columnas para que un reordenamiento futuro falle
-- donde se entiende.

create or replace view order_totals with (security_invoker = true) as
select
  o.id              as order_id,
  o.organization_id,
  o.business_line_id,
  o.kind,
  o.occurred_at,
  coalesce((select sum(oi.quantity * oi.unit_price)
            from order_items oi
            where oi.order_id = o.id
              and oi.archived_at is null), 0) as total,
  -- Lo archivado no cuenta: así es como anular devuelve el saldo (D4).
  coalesce((select sum(p.amount)
            from payments p
            where p.order_id = o.id
              and p.archived_at is null), 0) as paid
from orders o
where o.archived_at is null;

create or replace view expense_totals with (security_invoker = true) as
select
  e.id              as expense_id,
  e.organization_id,
  e.business_line_id,
  e.kind,
  e.occurred_at,
  coalesce(e.amount, (select sum(ei.quantity * ei.unit_price)
                      from expense_items ei where ei.expense_id = e.id), 0) as total,
  coalesce((select sum(p.amount)
            from payments p
            where p.expense_id = e.id
              and p.archived_at is null), 0) as paid
from expenses e
where e.archived_at is null;

-- ── Indicadores Por cobrar y Por pagar ────────────────────────────────────
-- Dos vistas y no una con columna `direction` (D7): al ayudante, Por pagar
-- tiene que darle cero, y con dos vistas eso ocurre solo por
-- `security_invoker` —no ve `expenses`, no ve la fila— sin una sola línea de
-- lógica de permisos en la aplicación, que es justo donde estos permisos se
-- filtran.
--
-- `greatest(..., 0)`: un pedido sobrepagado aporta cero, no resta. El cliente
-- que pagó de más no reduce lo que otro debe. El pedido sigue mostrando su
-- saldo negativo real en su propio detalle; el recorte es solo del agregado.
-- La regla vive aquí y en ningún otro sitio, para que KAM-20 la herede.

create view receivables_by_line with (security_invoker = true) as
select
  ot.organization_id,
  ot.business_line_id,
  coalesce(sum(greatest(ot.total - ot.paid, 0)), 0) as outstanding
from order_totals ot
group by ot.organization_id, ot.business_line_id;

create view payables_by_line with (security_invoker = true) as
select
  et.organization_id,
  et.business_line_id,
  coalesce(sum(greatest(et.total - et.paid, 0)), 0) as outstanding
from expense_totals et
group by et.organization_id, et.business_line_id;

-- ── Privilegios y RLS ─────────────────────────────────────────────────────
-- Matriz de acceso §16: `payments` es la única tabla con permiso partido —el
-- ayudante crea cobros (`direction = 'in'`) y no pagos—. La regla entera es la
-- cláusula `direction = 'in' or is_owner(...)` de la política: el diálogo que
-- no le ofrece "Registrar pago" es cortesía, no seguridad (D5).
--
-- La lectura va partida por el mismo motivo: el importe pagado a un proveedor
-- es información de costo, y ocultarla es no darle política, no esconder
-- columnas (§16, "Cómo se ocultan los costos al ayudante").
--
-- Borrar, nadie: se anula archivando (convención nº 3).

grant select, insert, update on payments to authenticated;

revoke delete on payments from authenticated, anon, service_role;
revoke insert, update on payments from anon;
revoke insert, update on payments from service_role;
grant select on payments to service_role;

-- Las vistas no heredan el privilegio de lectura igual en todos los entornos
-- (la nota de 20260826200000): aquí el `grant` sí es el que decide.
grant select on receivables_by_line, payables_by_line to authenticated, service_role;

alter table payments enable row level security;

create policy "payments: leer cobros todo miembro, pagos solo el dueño"
  on payments for select to authenticated
  using (
    is_member(organization_id)
    and (direction = 'in' or is_owner(organization_id))
  );

create policy "payments: crear cobros todo miembro, pagos solo el dueño"
  on payments for insert to authenticated
  with check (
    is_member(organization_id)
    and (direction = 'in' or is_owner(organization_id))
  );

-- Editar es, en la práctica, solo archivar: lo demás lo bloquea
-- `enforce_immutable`. Quién archiva lo decide `enforce_archive_rules` —solo
-- el dueño—, igual que en el catálogo, los pedidos y los egresos.
--
-- La política deja pasar a todo miembro a propósito. Restringirla a
-- `is_owner` también impediría al ayudante anular, pero de la peor manera:
-- RLS descarta la fila en silencio, el `update` afecta a cero filas y la
-- interfaz no tiene nada que contarle a quien lo intentó. Dejando pasar la
-- fila, el trigger levanta `insufficient_privilege` con su mensaje.
create policy "payments: editar si es miembro; archivar lo filtra el trigger"
  on payments for update to authenticated
  using (is_member(organization_id))
  with check (is_member(organization_id));

-- Sin política DELETE: un movimiento de dinero no se borra jamás.
