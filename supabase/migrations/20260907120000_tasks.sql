-- KAM-15 · Tareas: modelo y tablero.
-- DDL canónico: specs/PRD/kamay-esquema-base-de-datos-supabase.md §12, §16, §18.
--
-- El tablero de pedidos gestiona compromisos con clientes; este gestiona el
-- trabajo propio. La convención nº 10 es lo que los mantiene separados: no hay
-- —ni puede haber— ningún trigger entre `orders` y `tasks`, en ningún sentido.
--
-- Dos desviaciones conscientes del DDL canónico, ambas con el mismo motivo que
-- las de `item_variants` y `order_items` en sus migraciones:
--
--   1. La tabla auxiliar de líneas se llama `membership_lines`, no
--      `memberships_lines` como la nombra §16 de pasada. Es la forma que sigue
--      el resto del esquema —`order_items`, `expense_items`, `task_tags`—:
--      el primer término, en singular, califica al segundo.
--   2. `membership_lines` y `task_tags` llevan `organization_id` aunque se
--      pueda deducir de su padre. La convención nº 2 lo exige en toda tabla, y
--      sin él `log_activity()` —que lo lee de la propia fila— registraría el
--      evento bajo una organización inexistente.

-- ── Líneas de una membresía ───────────────────────────────────────────────
-- La tabla que §16 dejó planteada y que ninguna tarea anterior necesitó. Es lo
-- que da significado a «su línea» en la matriz de acceso: hasta hoy una
-- membresía solo tenía rol.

-- Lleva `id` propio, y no la llave compuesta que sería natural aquí, porque
-- `log_activity()` toma `record_id` del `id` de la fila: sin él, el trigger de
-- bitácora falla al insertar. La unicidad real la sigue fijando el `unique`.
create table membership_lines (
  id               uuid primary key default gen_random_uuid(),
  membership_id    uuid not null references memberships(id),
  business_line_id uuid not null references business_lines(id),
  organization_id  uuid not null references organizations(id),
  created_at       timestamptz not null default now(),
  archived_at      timestamptz
);

-- Retirar una línea a alguien es archivar la fila, no borrarla (convención
-- nº 3): quién pudo ver qué y desde cuándo es justamente lo que un permiso
-- necesita poder responder después. Por eso la unicidad es parcial — una línea
-- retirada y devuelta vuelve a insertarse sin chocar con su propio historial.
create unique index on membership_lines (membership_id, business_line_id)
  where archived_at is null;

create index on membership_lines (organization_id) where archived_at is null;
create index on membership_lines (business_line_id) where archived_at is null;

-- ¿Esta persona alcanza esta línea?
--
-- Tres condiciones, y la primera es la que decide el comportamiento por
-- omisión: **una membresía sin ninguna línea declarada las alcanza todas**.
-- La lectura contraria —sin filas, sin acceso— dejaría a ciegas al ayudante
-- que ya trabaja en las tres líneas en el momento de aplicar esta migración,
-- sin que nadie hubiese pedido restringirlo. Una restricción se declara; su
-- ausencia no es una restricción total.
--
-- La línea compartida (General) entra siempre: es donde vive lo transversal
-- por definición del modelo conceptual, y ocultarla a quien tiene líneas
-- asignadas abriría un agujero justo donde está lo que concierne a todos.

create or replace function has_line_access(org uuid, line uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select
    -- (a) sin líneas declaradas: las alcanza todas
    not exists (
      select 1 from membership_lines ml
      join memberships m on m.id = ml.membership_id
      where m.organization_id = org
        and m.user_id = auth.uid()
        and m.archived_at is null
        and ml.archived_at is null
    )
    -- (b) la línea está entre las declaradas
    or exists (
      select 1 from membership_lines ml
      join memberships m on m.id = ml.membership_id
      where m.organization_id = org
        and m.user_id = auth.uid()
        and m.archived_at is null
        and ml.archived_at is null
        and ml.business_line_id = line
    )
    -- (c) es la línea compartida
    or exists (
      select 1 from business_lines bl
      where bl.id = line and bl.organization_id = org and bl.is_shared
    );
$$;

create trigger enforce_archive before update on membership_lines
  for each row execute function enforce_archive_rules();

create trigger audit after insert or update on membership_lines
  for each row execute function log_activity();

grant select, insert, update on membership_lines to authenticated;
revoke delete on membership_lines from authenticated, anon, service_role;
revoke insert, update on membership_lines from anon;
grant select on membership_lines to service_role;

alter table membership_lines enable row level security;

create policy "membership_lines: leer si es miembro"
  on membership_lines for select to authenticated
  using (is_member(organization_id));

create policy "membership_lines: crear solo el dueño"
  on membership_lines for insert to authenticated
  with check (is_owner(organization_id));

create policy "membership_lines: editar solo el dueño"
  on membership_lines for update to authenticated
  using (is_owner(organization_id))
  with check (is_owner(organization_id));

-- ── Tareas ────────────────────────────────────────────────────────────────
-- La tabla nace con su DDL canónico completo, columnas incluidas que esta
-- tarea no escribe (KAM-15, design D1). La alternativa era un `alter table`
-- por tarea posterior —cuatro migraciones para llegar al mismo sitio, con
-- `reminder_needs_due_date` separada de la columna que restringe—.
--
-- Inerte significa inerte: ninguna consulta de KAM-15 las nombra.
--   · body_markdown               → la escribe KAM-16 (detalle y Markdown)
--   · remind_at                   → la escribe KAM-17 (recordatorios y avisos)
--   · closed_without_deliverables → la escribe KAM-21 (cierre con entregables)

create table tasks (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id),
  business_line_id  uuid not null references business_lines(id),
  status_id         uuid not null references statuses(id),
  title             text not null,
  body_markdown     text,
  assignee_id       uuid references auth.users(id),
  due_at            timestamptz,
  remind_at         timestamptz,
  closed_at         timestamptz,
  closed_without_deliverables boolean not null default false,
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  archived_at       timestamptz,

  -- Con título y línea ya se guarda, pero el título tiene que decir algo:
  -- una tarjeta en blanco en el tablero no es una tarea, es un despiste.
  constraint task_needs_title check (length(btrim(title)) > 0),

  constraint reminder_needs_due_date check (remind_at is null or due_at is not null)
);

create index on tasks (organization_id, status_id) where archived_at is null;
create index on tasks (organization_id, due_at) where archived_at is null and closed_at is null;
create index on tasks (assignee_id) where archived_at is null and closed_at is null;

-- ── Estado inicial ────────────────────────────────────────────────────────
-- Lo resuelve la base, no la aplicación: es lo que permite que el alta rápida
-- mande dos campos —título y línea— sin consultar antes cuál es el estado
-- inicial de esa línea, y lo que impide que dos vías de alta lo resuelvan
-- distinto. Se identifica por `kind`, jamás por nombre (convención nº 5).

create or replace function assign_initial_task_status()
returns trigger
language plpgsql as $$
begin
  if new.status_id is not null then
    return new;   -- la semilla y el formulario pueden fijarlo
  end if;

  select id into new.status_id
  from resolve_statuses(new.organization_id, new.business_line_id, 'task')
  where kind = 'initial'
  order by position
  limit 1;

  if new.status_id is null then
    raise exception 'La línea no tiene ningún estado inicial de tarea configurado'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

create trigger assign_initial_status before insert on tasks
  for each row execute function assign_initial_task_status();

-- ── Cierre derivado de la posición ────────────────────────────────────────
-- `closed_at` registra el instante de un hecho, como `queued_at` en pedidos:
-- no resume ni agrega nada, así que la convención nº 4 no lo alcanza.
--
-- Que lo lleve un trigger y no la aplicación es lo que hace que «arrastrar de
-- vuelta reabre la tarea» sea cierto por construcción y no por una rama que
-- alguien recordó escribir. Cada vía futura de cambio de estado —el detalle
-- de KAM-16, el cierre de KAM-21, *Mis pendientes* de KAM-17— lo hereda.

create or replace function maintain_task_closed_at()
returns trigger
language plpgsql as $$
declare
  v_kind text;
begin
  if tg_op = 'UPDATE' and new.status_id is not distinct from old.status_id then
    return new;   -- editar responsable o fecha no cierra ni reabre nada
  end if;

  select kind into v_kind from statuses where id = new.status_id;

  if v_kind = 'final' then
    -- Al insertar ya cerrada, la semilla puede fijar el instante.
    if new.closed_at is null then
      new.closed_at := now();
    end if;
  else
    new.closed_at := null;
  end if;

  return new;
end $$;

create trigger maintain_closed_at before insert or update on tasks
  for each row execute function maintain_task_closed_at();

create trigger enforce_archive before update on tasks
  for each row execute function enforce_archive_rules();

create trigger audit after insert or update on tasks
  for each row execute function log_activity();

-- ── Etiquetas ─────────────────────────────────────────────────────────────
-- Agrupación transversal y efímera (`hornada-07`, `feria-agosto`). Se crean al
-- vuelo desde el selector, con el mismo patrón de búsqueda tolerante a tildes
-- del catálogo: `search_name` generada, `immutable_unaccent(lower(name))`.
--
-- El `unique` es sobre `name` y no sobre `search_name`: «Hornada-07» y
-- «hornada-07» son la misma para buscar y distintas para guardar. Unificarlas
-- en la escritura obligaría a decidir qué mayúsculas ganan; el selector, que
-- busca normalizado, ya ofrece la existente antes de que nadie teclee la
-- variante.

create table tags (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name            text not null,
  search_name     text generated always as (immutable_unaccent(lower(name))) stored,
  created_at      timestamptz not null default now(),
  unique (organization_id, name)
);

create index on tags (organization_id, search_name);

create table task_tags (
  task_id         uuid not null references tasks(id),
  tag_id          uuid not null references tags(id),
  organization_id uuid not null references organizations(id),
  created_at      timestamptz not null default now(),
  primary key (task_id, tag_id)
);

create index on task_tags (tag_id);
create index on task_tags (organization_id);

create trigger audit after insert or update on tags
  for each row execute function log_activity();

-- `task_tags` no lleva `audit`: es una tabla de unión con llave compuesta y sin
-- `id`, que es lo que `log_activity()` necesita para su `record_id`. El canon
-- (§14) tampoco la incluye en la lista de tablas auditables, y el historial de
-- una tarea lee `table_name = 'tasks'`, así que estas filas no las leería
-- nadie. Etiquetar y desetiquetar no queda en la bitácora, a propósito.

-- ── Vínculos ──────────────────────────────────────────────────────────────
-- La tabla nace con su `check` canónico de cinco tipos, pero KAM-15 solo
-- escribe `order` y solo desde la acción *Crear tarea para este pedido*: el
-- buscador de vínculos, los bloques «Tareas relacionadas» y los otros cuatro
-- tipos son de KAM-21. Guardar el vínculo desde el primer día es lo que evita
-- que las tareas creadas antes de esa tarea nazcan huérfanas de la relación
-- que las originó.
--
-- La referencia polimórfica no puede tener llave foránea, porque apunta a
-- cinco tablas. Se mitiga con el trigger de abajo y con que en Kamay nada se
-- elimina: un vínculo nunca queda apuntando al vacío.

create table task_links (
  id              uuid primary key default gen_random_uuid(),
  task_id         uuid not null references tasks(id),
  organization_id uuid not null references organizations(id),
  entity_type     text not null check (entity_type in ('order','contact','item','expense','asset')),
  entity_id       uuid not null,
  created_at      timestamptz not null default now(),
  unique (task_id, entity_type, entity_id)
);

create index on task_links (entity_type, entity_id);
create index on task_links (task_id);
create index on task_links (organization_id);

create or replace function validate_task_link()
returns trigger
language plpgsql as $$
declare
  v_exists boolean;
begin
  case new.entity_type
    when 'order'   then select exists (select 1 from orders   where id = new.entity_id) into v_exists;
    when 'contact' then select exists (select 1 from contacts where id = new.entity_id) into v_exists;
    when 'item'    then select exists (select 1 from items    where id = new.entity_id) into v_exists;
    when 'expense' then select exists (select 1 from expenses where id = new.entity_id) into v_exists;
    -- `asset_details` llega con KAM-19; hasta entonces no hay a qué apuntar.
    when 'asset'   then v_exists := false;
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

create trigger validate_link before insert or update on task_links
  for each row execute function validate_task_link();

create trigger audit after insert or update on task_links
  for each row execute function log_activity();

-- ── Privilegios y RLS ─────────────────────────────────────────────────────
-- Matriz de acceso §16: `tasks` es «solo de su línea o asignadas a él» para el
-- ayudante y «todo» para el dueño; `task_links` y `task_tags` van «según la
-- tarea»; archivar lo decide `enforce_archive_rules()`; borrar, nadie.

grant select, insert, update on tasks, tags, task_tags, task_links to authenticated;
revoke delete on tasks, tags, task_tags, task_links from authenticated, anon, service_role;
revoke insert, update on tasks, tags, task_tags, task_links from anon;
revoke insert, update on tasks, tags, task_tags, task_links from service_role;
grant select on tasks, tags, task_tags, task_links to service_role;

alter table tasks enable row level security;
alter table tags enable row level security;
alter table task_tags enable row level security;
alter table task_links enable row level security;

-- La condición del esquema §16, con `has_line_access` en el hueco que dejó
-- abierto. El `assignee_id = auth.uid()` va primero a propósito: una tarea
-- asignada a alguien la ve esa persona **aunque sea de una línea que no le
-- toca**, que es el caso que el criterio nombra con su «o asignadas a él».
create policy "tasks: ayudante ve su línea o lo asignado"
  on tasks for select to authenticated
  using (
    is_owner(organization_id)
    or (is_member(organization_id) and (
          assignee_id = auth.uid()
          or has_line_access(organization_id, business_line_id)
       ))
  );

create policy "tasks: crear dentro de lo que ve"
  on tasks for insert to authenticated
  with check (
    is_owner(organization_id)
    or (is_member(organization_id) and (
          assignee_id = auth.uid()
          or has_line_access(organization_id, business_line_id)
       ))
  );

create policy "tasks: editar dentro de lo que ve"
  on tasks for update to authenticated
  using (
    is_owner(organization_id)
    or (is_member(organization_id) and (
          assignee_id = auth.uid()
          or has_line_access(organization_id, business_line_id)
       ))
  )
  with check (
    is_owner(organization_id)
    or (is_member(organization_id) and (
          assignee_id = auth.uid()
          or has_line_access(organization_id, business_line_id)
       ))
  );

-- Una etiqueta es un nombre de la organización, sin nada sensible dentro, y el
-- ayudante la necesita para etiquetar: se lee y se crea siendo miembro. Lo que
-- recorta qué tareas la llevan es la política de `task_tags`, no esta.
create policy "tags: leer si es miembro"
  on tags for select to authenticated
  using (is_member(organization_id));

create policy "tags: crear si es miembro"
  on tags for insert to authenticated
  with check (is_member(organization_id));

create policy "tags: editar si es miembro"
  on tags for update to authenticated
  using (is_member(organization_id))
  with check (is_member(organization_id));

-- `task_tags` y `task_links` heredan la visibilidad de su tarea: el `exists`
-- sobre `tasks` vuelve a pasar por la política de arriba.
create policy "task_tags: según la tarea"
  on task_tags for select to authenticated
  using (exists (select 1 from tasks t where t.id = task_id));

create policy "task_tags: crear según la tarea"
  on task_tags for insert to authenticated
  with check (
    is_member(organization_id)
    and exists (select 1 from tasks t where t.id = task_id)
  );

create policy "task_tags: editar según la tarea"
  on task_tags for update to authenticated
  using (exists (select 1 from tasks t where t.id = task_id))
  with check (
    is_member(organization_id)
    and exists (select 1 from tasks t where t.id = task_id)
  );

create policy "task_links: según la tarea"
  on task_links for select to authenticated
  using (exists (select 1 from tasks t where t.id = task_id));

create policy "task_links: crear según la tarea"
  on task_links for insert to authenticated
  with check (
    is_member(organization_id)
    and exists (select 1 from tasks t where t.id = task_id)
  );

create policy "task_links: editar según la tarea"
  on task_links for update to authenticated
  using (exists (select 1 from tasks t where t.id = task_id))
  with check (
    is_member(organization_id)
    and exists (select 1 from tasks t where t.id = task_id)
  );
