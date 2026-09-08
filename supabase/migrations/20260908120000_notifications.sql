-- KAM-17 · Notificaciones y preferencias.
-- DDL canónico: specs/PRD/kamay-esquema-base-de-datos-supabase.md §15, §16.
--
-- Dos piezas con dueños distintos, y conviene no confundirlas:
--
--   `notifications`          — lo que el sistema tiene que decirle a alguien.
--   `notification_preferences` — lo que esa persona quiere que le digan.
--
-- Tres desviaciones conscientes, las tres explicadas donde ocurren:
--
--   1. La columna `dedupe_key`, que §15 no lista (design D3).
--   2. La tabla `notification_preferences` entera, que el canónico no previó
--      porque el backlog situaba las preferencias «en V15», del dueño; son de
--      la persona (design D1).
--   3. Ninguna de las dos lleva trigger de bitácora. La convención nº 7 lo
--      pide en las tablas *auditables*, y estas no lo son: un aviso no es un
--      hecho del negocio, es una consecuencia de otro hecho que ya se registró.
--      Auditarlas llenaría la bitácora de ruido derivado —y, en el caso del
--      resumen diario, de una fila por persona y día para siempre.

-- ── Notificaciones ────────────────────────────────────────────────────────

create table notifications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  user_id         uuid not null references auth.users(id),
  type            text not null check (type in
                    ('due_summary','task_assigned','task_review','task_overdue',
                     'task_stalled','stock_below_min')),
  title           text not null,
  body            text,
  entity_type     text,
  entity_id       uuid,

  -- La llave de idempotencia (design D3). No está en el canónico §15, y se
  -- añade porque sin ella «nunca dos avisos por lo mismo» solo se puede
  -- cumplir leyendo antes de escribir: dos pasadas concurrentes del trabajo
  -- programado se colarían por esa ventana. Con ella, generar es un
  -- `insert ... on conflict do nothing` y el trabajo es reejecutable.
  --
  -- Su forma la construye `lib/notifications/dedupe.ts`, no la base: la base
  -- solo garantiza que dos iguales no entran dos veces.
  dedupe_key      text not null,

  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

-- El índice que §15 pide: la consulta de la campana —«¿cuántas sin leer tengo?»
-- y «dame las últimas»— es la única que esta tabla sirve en caliente.
create index on notifications (user_id, read_at, created_at desc);

-- Lo que hace reejecutable al trabajo programado. Va por `user_id` y no por
-- organización porque la llave ya identifica el hecho y su destinatario: dos
-- personas avisadas de la misma tarea son dos filas legítimas.
create unique index on notifications (user_id, dedupe_key);

-- El trabajo programado recorre organización por organización.
create index on notifications (organization_id, created_at desc);

-- ── Preferencias de notificación ──────────────────────────────────────────
--
-- Una fila por persona y organización. La misma persona en dos organizaciones
-- tiene dos juegos: quien es dueño en su taller y ayudante en el de un amigo
-- no quiere el mismo resumen de ambos.
--
-- **Nadie tiene que sembrar estas filas.** La ausencia de fila significa «todo
-- activo, a la hora por omisión» (design D1): así una organización creada
-- antes de esta migración funciona sin migración de datos, y una invitación
-- nueva no tiene que acordarse de crear nada.

create table notification_preferences (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations(id),
  user_id               uuid not null references auth.users(id),

  -- Un interruptor por tipo, con el mismo nombre que el tipo. Son columnas y
  -- no un jsonb porque el trabajo programado filtra por ellas en SQL, y
  -- porque un tipo nuevo debe costar una migración —revisada— y no un dato.
  due_summary           boolean not null default true,
  task_assigned         boolean not null default true,
  task_review           boolean not null default true,
  task_overdue          boolean not null default true,
  task_stalled          boolean not null default true,
  -- Se declara sin generador: el inventario llega con KAM-18. El interruptor
  -- existe desde ya para no volver a alterar esta tabla entonces.
  stock_below_min       boolean not null default true,

  -- Hora local de la organización a la que se quiere el resumen, 0–23. El
  -- trabajo corre cada hora y atiende a quien coincide (design D4); por eso
  -- basta la hora y no hacen falta minutos.
  daily_summary_hour    int not null default 7
                          check (daily_summary_hour between 0 and 23),

  -- Apagar el correo deja intacto el aviso dentro de la aplicación.
  email_enabled         boolean not null default true,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  unique (organization_id, user_id)
);

-- El trabajo programado pregunta «¿quién quiere su resumen a esta hora?» una
-- vez por organización y pasada.
create index on notification_preferences (organization_id, daily_summary_hour);

-- ── Privilegios y RLS ─────────────────────────────────────────────────────
--
-- Estas dos tablas son las primeras del sistema cuyo alcance no es la
-- organización sino la persona: `is_member` no basta, porque un compañero de
-- la misma organización tampoco debe ver mis avisos ni tocar mis preferencias.
-- De ahí el `user_id = auth.uid()` en todas las políticas.

-- Nadie inserta notificaciones desde una sesión: las crea el generador con
-- service role (design D5). Lo único que una persona hace con una notificación
-- suya es marcarla leída, y por eso el `update` está restringido a esa columna:
-- así «la única transición es marcarla leída» lo garantiza el privilegio y no
-- la buena conducta de una Server Action.
-- El orden importa: `authenticated` llega con privilegios de tabla completa
-- por las concesiones por omisión de Supabase, así que hay que **revocar
-- primero y conceder después**. Un `grant update (read_at)` sobre un `update`
-- de tabla ya concedido no estrecha nada — amplía sobre lo que ya estaba, y
-- la restricción por columna quedaría en decoración.
revoke insert, update, delete on notifications from authenticated, anon;
revoke delete on notifications from service_role;

grant select on notifications to authenticated;
grant update (read_at) on notifications to authenticated;

-- El generador. Es la única tabla del esquema donde service_role escribe.
grant select, insert on notifications to service_role;

-- Mismo orden por el mismo motivo: revocar lo que las concesiones por omisión
-- reparten, y volver a conceder solo lo que hace falta.
revoke all on notification_preferences from authenticated, anon, service_role;

-- Aquí sí se concede la tabla entera a `authenticated`: lo que recorta el
-- alcance a las filas propias es la RLS, no el privilegio, porque toda persona
-- tiene que poder crear y editar las suyas.
grant select, insert, update on notification_preferences to authenticated;

-- El trabajo programado necesita leerlas para decidir a quién avisar, y nada más.
grant select on notification_preferences to service_role;

alter table notifications enable row level security;
alter table notification_preferences enable row level security;

create policy "notifications: cada quien ve las suyas"
  on notifications for select to authenticated
  using (is_member(organization_id) and user_id = auth.uid());

-- Sin `with check` sobre `user_id` la política de arriba ya impide alcanzar la
-- fila ajena; el `with check` repetido evita además reasignar la propia a otro.
create policy "notifications: marcar leída la propia"
  on notifications for update to authenticated
  using (is_member(organization_id) and user_id = auth.uid())
  with check (is_member(organization_id) and user_id = auth.uid());

create policy "notification_preferences: cada quien lee las suyas"
  on notification_preferences for select to authenticated
  using (is_member(organization_id) and user_id = auth.uid());

-- Crear y editar las propias, incluido el ayudante: son preferencias de la
-- persona, no configuración del taller (design D1). Es la razón por la que
-- aquí no aparece `is_owner` en ninguna parte, a diferencia del resto de la
-- configuración de la organización.
create policy "notification_preferences: cada quien crea las suyas"
  on notification_preferences for insert to authenticated
  with check (is_member(organization_id) and user_id = auth.uid());

create policy "notification_preferences: cada quien edita las suyas"
  on notification_preferences for update to authenticated
  using (is_member(organization_id) and user_id = auth.uid())
  with check (is_member(organization_id) and user_id = auth.uid());

-- `updated_at` lo fija quien escribe, como en el resto del esquema: no hay
-- ninguna función de sello en la base y no se inventa una aquí para una sola
-- tabla. `PreferenceService.save()` lo incluye en su `upsert`.
