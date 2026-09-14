-- KAM-26 · Administrador de la plataforma (super admin).
--
-- Una cuenta que no necesita pertenecer a ninguna organización, que ve y
-- administra todas, y que entra a cualquiera con la vista de su dueño.
-- Specs: `platform-administration`, `tenant-isolation` (delta); design D1–D5.
--
-- ── La idea ───────────────────────────────────────────────────────────────
-- Todo el acceso del sistema pasa por `is_member()` e `is_owner()`: ~84
-- políticas, las cuatro de Storage y las funciones que se protegen a mano.
-- En lugar de añadir `or is_platform_admin()` a cada una —y confiar en que la
-- tabla número treinta se acuerde—, las dos funciones reconocen al super
-- admin. Ninguna política se reescribe y ninguna acción de usuario usa el
-- service role: el super admin pasa por RLS como cualquiera.
--
-- **Cambio de significado.** Desde aquí `is_member(org)` quiere decir "puede
-- actuar en la organización", no "pertenece a ella". Donde importe la
-- pertenencia real está `has_active_membership(org)`.
--
-- Funciones que ya llamaban a `is_member`/`is_owner` (recorrido de `pg_proc`,
-- tarea 2.6) y por qué el nuevo significado es el correcto en cada una:
--   · create_order, update_order, create_direct_sale: compuerta "puede
--     registrar ventas aquí"; el super admin actúa como dueño.
--   · create_expense, enforce_archive_rules: compuerta "es dueño"; ídem.
--   · cash_flow_by_line_range, report_expense_breakdown, report_line_comparison,
--     report_low_stock, report_product_ranking, report_profitability: filtran
--     por `is_owner`; el super admin ve los reportes como el dueño.
--   · close_task_with_deliverables: solo lo menciona en un comentario; su
--     acceso lo decide RLS.
--   · record_export: "solo quien pertenece, y siempre a su nombre". El evento
--     queda a nombre del super admin, y `log_activity()` lo marca (abajo).
-- Ninguna necesita la pertenencia estricta.

-- ── Registro de administradores ───────────────────────────────────────────
-- La única tabla, además de `organizations`, sin `organization_id`: vive por
-- encima de las organizaciones. Sin disparador de auditoría (la bitácora
-- exige organización): su historia son `granted_at`, `note` y `archived_at`.
-- Solo la escribe el script del operador (`scripts/platform-admin.mjs`) con
-- el service role; ninguna pantalla concede ni retira.

create table platform_admins (
  user_id     uuid primary key references auth.users(id),
  granted_at  timestamptz not null default now(),
  note        text,
  archived_at timestamptz
);

alter table platform_admins enable row level security;

-- Cada cuenta puede preguntar por su propia fila y nada más: listar a los
-- demás administradores no es asunto de nadie dentro de la aplicación.
create policy "platform_admins: cada cuenta lee solo su fila"
  on platform_admins for select to authenticated
  using (user_id = auth.uid());

-- Privilegios explícitos. Nadie con sesión escribe aquí, ni siquiera un super
-- admin: una cuenta comprometida no puede fabricar otras. Tampoco el service
-- role borra: revocar es archivar.
revoke all on platform_admins from public, anon, authenticated, service_role;
grant select on platform_admins to authenticated;
grant select, insert, update on platform_admins to service_role;

create function is_platform_admin()
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.platform_admins pa
    where pa.user_id = auth.uid()
      and pa.archived_at is null
  );
$$;

revoke execute on function is_platform_admin() from public, anon;
grant execute on function is_platform_admin() to authenticated, service_role;

-- ── Funciones auxiliares ──────────────────────────────────────────────────

-- La pertenencia estricta: el cuerpo que `is_member` tuvo desde KAM-02.
create function has_active_membership(org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.organization_id = org
      and m.user_id = auth.uid()
      and m.archived_at is null
  );
$$;

create or replace function is_member(org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.organization_id = org
      and m.user_id = auth.uid()
      and m.archived_at is null
  ) or is_platform_admin();
$$;

create or replace function is_owner(org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.organization_id = org
      and m.user_id = auth.uid()
      and m.role = 'owner'
      and m.archived_at is null
  ) or is_platform_admin();
$$;

-- La política `INSERT` de `organizations` es `with check (is_owner(id))`.
-- Hasta aquí era falsa para toda fila nueva; ahora es verdadera solo para el
-- super admin, que es exactamente quien crea organizaciones. No se toca.

-- ── Listar cuentas sin service role (design D3) ───────────────────────────
-- `auth.users` no es legible por `authenticated`. La función lo lee con
-- privilegio propio, pero solo para el super admin: cualquier otra cuenta
-- recibe un error, no una lista vacía, para que un fallo de permisos no se
-- confunda con "no hay nadie".

create function platform_list_users(
  p_organization_id      uuid    default null,
  p_query                text    default null,
  p_without_organization boolean default false,
  p_limit                int     default null,
  p_user_id              uuid    default null
)
returns table (
  user_id           uuid,
  email             text,
  created_at        timestamptz,
  last_sign_in_at   timestamptz,
  is_platform_admin boolean,
  memberships       jsonb
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_query text := nullif(btrim(p_query), '');
begin
  if not public.is_platform_admin() then
    raise exception 'Solo el administrador de la plataforma lista las cuentas'
      using errcode = 'insufficient_privilege';
  end if;

  -- Ninguna vista carga una tabla entera (spec `performance-budget`): la
  -- búsqueda, el filtro y el límite se aplican aquí, no en el cliente.
  return query
  select
    u.id,
    u.email::text,
    u.created_at,
    u.last_sign_in_at,
    exists (
      select 1 from public.platform_admins pa
      where pa.user_id = u.id and pa.archived_at is null
    ),
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'membership_id',     m.id,
               'organization_id',   m.organization_id,
               'organization_name', o.name,
               'role',              m.role,
               'display_name',      m.display_name,
               'archived_at',       m.archived_at
             ) order by o.name)
      from public.memberships m
      join public.organizations o on o.id = m.organization_id
      where m.user_id = u.id
    ), '[]'::jsonb)
  from auth.users u
  where (p_user_id is null or u.id = p_user_id)
    and (p_organization_id is null
         or exists (
           select 1 from public.memberships m
           where m.user_id = u.id and m.organization_id = p_organization_id
         ))
    and (v_query is null
         or u.email ilike '%' || v_query || '%'
         or exists (
           select 1 from public.memberships m
           where m.user_id = u.id and m.display_name ilike '%' || v_query || '%'
         ))
    and (not p_without_organization
         or not exists (
           select 1 from public.memberships m
           where m.user_id = u.id and m.archived_at is null
         ))
  order by u.email
  limit p_limit;
end $$;

revoke execute on function platform_list_users(uuid, text, boolean, int, uuid) from public, anon;
grant execute on function platform_list_users(uuid, text, boolean, int, uuid) to authenticated;

-- ── Crear una organización lista para usar (design D4) ────────────────────
-- `security invoker`: cada `insert` pasa por RLS con la sesión del super
-- admin (para él, `is_owner` ya es verdadero). La función no tiene privilegio
-- propio; solo junta los pasos en una transacción, para que no exista nunca
-- una organización sin su línea compartida (spec `org-configuration`).
-- El juego de estados es el mínimo que valida `assert_status_set_valid`; la
-- dueña lo ajusta después en Configuración.

create function create_organization(
  p_name     text,
  p_currency text default 'BOB',
  p_timezone text default 'America/La_Paz'
)
returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_org  uuid := gen_random_uuid();
  v_name text := nullif(btrim(p_name), '');
begin
  if not is_platform_admin() then
    raise exception 'Solo el administrador de la plataforma crea organizaciones'
      using errcode = 'insufficient_privilege';
  end if;

  if v_name is null then
    raise exception 'La organización necesita un nombre'
      using errcode = 'check_violation';
  end if;

  -- El id se genera aquí para no depender de `returning`, que exigiría además
  -- la política de lectura.
  insert into organizations (id, name, currency, timezone)
  values (v_org, v_name,
          coalesce(nullif(btrim(p_currency), ''), 'BOB'),
          coalesce(nullif(btrim(p_timezone), ''), 'America/La_Paz'));

  insert into business_lines (organization_id, name, color, is_shared, position)
  values (v_org, 'General', 'zinc', true, 1);

  insert into statuses (organization_id, flow, name, kind, position) values
    (v_org, 'order', 'Registrado', 'initial',   1),
    (v_org, 'order', 'Entregado',  'final',     2),
    (v_org, 'order', 'Cancelado',  'cancelled', 3),
    (v_org, 'task',  'Por hacer',  'initial',   1),
    (v_org, 'task',  'Hecho',      'final',     2);

  return v_org;
end $$;

revoke execute on function create_organization(text, text, text) from public, anon;
grant execute on function create_organization(text, text, text) to authenticated;

-- ── La marca en la bitácora (design D5) ───────────────────────────────────
-- La función es la de `20260903210000_offline_sync.sql` con un único añadido:
-- cuando el autor es un super admin sin membresía activa en la organización,
-- el evento lleva `actor_label = 'Administrador de la plataforma'`, además de
-- su `actor_id`. Así la dueña distingue un cambio que no vino de su equipo.
-- Si el super admin sí es miembro, el evento es suyo como el de cualquiera.
-- La fusión de ruido sigue agrupando por `actor_id`, sin cambios.

create or replace function log_activity()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb; v_new jsonb; v_changes jsonb; v_delta jsonb;
  v_action text; v_org uuid; v_line uuid;
  v_ignored text[] := array['updated_at','created_at'];
  v_actor uuid; v_record uuid;
  v_merge_id bigint; v_merge_changes jsonb;
  v_occurred timestamptz;
  v_label text;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new); v_action := 'created'; v_changes := v_new;
  else
    v_old := to_jsonb(old); v_new := to_jsonb(new);

    if v_old->>'archived_at' is null and v_new->>'archived_at' is not null then
      v_action := 'archived';
    elsif v_old->>'archived_at' is not null and v_new->>'archived_at' is null then
      v_action := 'unarchived';
    elsif v_old->>'status_id' is distinct from v_new->>'status_id' then
      v_action := 'status_changed';
    else
      v_action := 'updated';
    end if;

    -- solo los campos que realmente cambiaron; created_at y updated_at nunca cuentan
    select jsonb_object_agg(e.key, jsonb_build_object('antes', v_old->e.key,
                                                      'despues', v_new->e.key))
    into v_changes
    from jsonb_each(v_new) e
    where v_new->e.key is distinct from v_old->e.key
      and not (e.key = any(v_ignored));

    if v_changes is null then return new; end if;   -- nada relevante cambió
  end if;

  -- Toda tabla de negocio lleva organization_id; en `organizations` la
  -- organización es la fila misma.
  v_org    := coalesce((v_new->>'organization_id')::uuid, (v_new->>'id')::uuid);
  v_line   := nullif(v_new->>'business_line_id','')::uuid;
  v_actor  := auth.uid();
  v_record := (v_new->>'id')::uuid;

  -- KAM-26: el super admin que actúa en una organización ajena queda marcado.
  if v_actor is not null
     and is_platform_admin()
     and not has_active_membership(v_org) then
    v_label := 'Administrador de la plataforma';
  end if;

  -- La hora del hecho. En una creación, la del registro si la trae; en todo
  -- lo demás, la de ahora. Una tabla auditada sin `occurred_at` se comporta
  -- exactamente como antes.
  v_occurred := case
    when v_action = 'created'
      then coalesce(nullif(v_new->>'occurred_at','')::timestamptz, now())
    else now()
  end;

  -- Agrupación de ruido: ediciones sucesivas del mismo autor sobre el mismo
  -- registro dentro de 5 minutos se consolidan en un solo evento. Creación,
  -- archivado, desarchivado y cambio de estado nunca se fusionan, así que un
  -- `created` fechado en el pasado no entra en esta ventana ni la altera.
  if v_action = 'updated' then
    select l.id, l.changes into v_merge_id, v_merge_changes
    from activity_log l
    where l.table_name = tg_table_name
      and l.record_id = v_record
      and l.action = 'updated'
      and l.actor_id is not distinct from v_actor
      and l.occurred_at > now() - interval '5 minutes'
    order by l.occurred_at desc, l.id desc
    limit 1;

    if v_merge_id is not null then
      -- El evento fusionado representa el diff neto de la ventana: por cada
      -- campo se conserva el valor anterior más viejo y el nuevo más reciente.
      select jsonb_object_agg(e.key,
               case when v_merge_changes ? e.key
                 then jsonb_build_object('antes',   v_merge_changes->e.key->'antes',
                                         'despues', e.value->'despues')
                 else e.value
               end)
      into v_delta
      from jsonb_each(v_changes) e;

      update activity_log
        set changes = v_merge_changes || v_delta
      where id = v_merge_id;

      return new;
    end if;
  end if;

  insert into activity_log (organization_id, business_line_id, actor_id,
                            actor_label, table_name, record_id, action,
                            changes, origin, occurred_at)
  values (v_org, v_line, v_actor, v_label, tg_table_name,
          v_record, v_action, v_changes,
          nullif(current_setting('request.headers', true), '')::json->>'x-client-origin',
          v_occurred);

  return new;
end $$;
