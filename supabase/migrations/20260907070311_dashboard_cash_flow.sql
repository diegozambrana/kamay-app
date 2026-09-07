-- KAM-14 · Panel principal: vista derivada `cash_flow_by_line_month`.
-- DDL canónico: specs/PRD/kamay-esquema-base-de-datos-supabase.md § Vistas
--   derivadas, § Matriz de acceso.
-- Requisitos: openspec/changes/kam-14-dashboard-assistant-variant/specs/
--   payments/spec.md § Flujo de caja del periodo por línea.
-- Decisiones: design.md D1 (los indicadores se miden en caja), D2 (una vista
--   y no un cálculo en el servicio), D3 (`union all` y no dos `left join`),
--   D4 (el recorte al dueño va dentro de la vista), D11 (índice).
--
-- `receivables_by_line` y `payables_by_line` (KAM-10) responden "cuánto se
-- debe": son saldos vivos, sin periodo. El panel pregunta otra cosa —"cuánto
-- entró y cuánto salió este mes"— y esa pregunta no se puede componer desde
-- las dos anteriores. De ahí esta tercera vista, y no una columna más en
-- aquellas: mezclar un saldo con un flujo en la misma fila deja una de las
-- dos cifras sin sentido en cuanto V14 pida otro periodo.

-- ── Cómo consulta el panel ────────────────────────────────────────────────
-- `payments` tiene índices por destino (`order_id`, `expense_id`), que es
-- como la consulta el detalle del pedido. La vista consulta por organización
-- y fecha, y para eso no había ninguno.
create index on payments (organization_id, occurred_at);

-- ── La vista ──────────────────────────────────────────────────────────────
-- Dos ramas unidas y no dos `left join`: un movimiento apunta a un pedido o a
-- un egreso, nunca a los dos (`exactly_one_target`), así que con `left join`
-- cada fila arrastraría dos columnas de línea de las que una es siempre nula,
-- y el `coalesce` que las junta sería justo el punto donde un error futuro
-- pasa desapercibido (D3). `direction_matches_target` garantiza además que
-- ninguna fila cae en las dos ramas.
--
-- La línea sale del destino porque `payments` no la declara: el dinero no
-- tiene línea propia, la tiene el pedido o el egreso que lo originó.
--
-- El mes se corta en la zona horaria de la organización y no en la del
-- servidor: un cobro de las 21:00 en La Paz pertenece a ese día para el
-- taller, aunque en UTC ya sea el siguiente —y el último día del mes, al
-- siguiente mes—. Es el mismo criterio con el que `lib/orders/overdue`
-- decide qué es "hoy".
--
-- Lo archivado no cuenta, ni el movimiento ni su destino: así es como anular
-- un cobro devuelve el saldo (KAM-10, D4) y como archivar una venta directa
-- retira su ingreso (`order_totals` hace lo mismo).
--
-- Un mes sin movimiento no produce fila. Generar la serie de meses aquí
-- dentro para devolver ceros sería mucha maquinaria para algo que quien
-- consume resuelve con un `?? 0`.

create view cash_flow_by_line_month with (security_invoker = true) as
with movement as (
  select
    p.organization_id,
    o.business_line_id,
    p.occurred_at,
    p.direction,
    p.amount
  from payments p
  join orders o
    on o.id = p.order_id
   and o.organization_id = p.organization_id
  where p.direction = 'in'
    and p.archived_at is null
    and o.archived_at is null

  union all

  select
    p.organization_id,
    e.business_line_id,
    p.occurred_at,
    p.direction,
    p.amount
  from payments p
  join expenses e
    on e.id = p.expense_id
   and e.organization_id = p.organization_id
  where p.direction = 'out'
    and p.archived_at is null
    and e.archived_at is null
)
select
  m.organization_id,
  m.business_line_id,
  (date_trunc('month', m.occurred_at at time zone org.timezone))::date as month,
  coalesce(sum(m.amount) filter (where m.direction = 'in'),  0) as collected,
  coalesce(sum(m.amount) filter (where m.direction = 'out'), 0) as paid
from movement m
join organizations org on org.id = m.organization_id
-- ── Por qué esta condición y no solo `security_invoker` ───────────────────
-- Es la única línea que hace cumplible el criterio 3 del backlog: el ayudante
-- no ve montos "ni por consulta directa". Con `security_invoker` a secas no
-- bastaría, porque desde KAM-10 el ayudante SÍ lee los cobros fila a fila
-- —los registra él (D5 de aquella tarea)—, así que esta vista le devolvería
-- exactamente el agregado que no puede ver.
--
-- La rama de pagos ya le da cero por su cuenta (`expenses` no tiene ninguna
-- política de lectura para el ayudante); esta condición es la que cierra la
-- de cobros. Ponerla aquí, y no en el servicio, convierte el criterio en una
-- prueba pgTAP en vez de una comprobación de navegador (D4).
--
-- Precio aceptado: la vista no sirve a una futura pantalla de ingresos para
-- el ayudante. No existe tal pantalla ni puede existir: la matriz de acceso
-- §16 se lo prohíbe.
where is_owner(m.organization_id)
group by m.organization_id, m.business_line_id, 3;

-- Las vistas no heredan el privilegio de lectura igual en todos los entornos
-- (nota de 20260826200000): aquí el `grant` sí es el que decide.
grant select on cash_flow_by_line_month to authenticated, service_role;
