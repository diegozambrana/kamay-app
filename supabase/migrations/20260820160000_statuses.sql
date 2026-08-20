-- KAM-05 · Estados configurables por línea.
-- DDL canónico: specs/PRD/kamay-esquema-base-de-datos-supabase.md § Estados.
-- Los nombres de estado son datos del dueño; el único contrato estable para el
-- código es `kind` (convención nº 5: jamás se compara por nombre).

create table statuses (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id),
  business_line_id uuid references business_lines(id),  -- null = juego de la organización
  flow             text not null check (flow in ('order','task')),
  name             text not null,
  kind             text not null check (kind in ('initial','in_progress','waiting','final','cancelled')),
  color            text not null default 'zinc',
  position         int not null default 0,
  is_queue         boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  archived_at      timestamptz,

  -- Solo un estado de espera puede ser cola (En cola de sublimación)
  constraint queue_only_when_waiting
    check (not is_queue or kind = 'waiting'),

  -- PostgreSQL 15+: trata los null como iguales para la unicidad
  unique nulls not distinct (organization_id, business_line_id, flow, name)
);

-- Resolver el juego vigente es la consulta de todos los tableros.
create index on statuses (organization_id, flow, business_line_id)
  where archived_at is null;

-- ── Resolución del juego aplicable ────────────────────────────────────────
-- Si la línea tiene juego propio se usa ese completo; si no, el de la
-- organización. La regla vive aquí y solo aquí: ningún servicio la
-- reimplementa en TypeScript.

create or replace function resolve_statuses(org uuid, line uuid, p_flow text)
returns setof statuses
language sql stable as $$
  select * from statuses s
  where s.organization_id = org and s.flow = p_flow and s.archived_at is null
    and s.business_line_id is not distinct from case
      when exists (
        select 1 from statuses x
        where x.organization_id = org and x.flow = p_flow
          and x.business_line_id = line and x.archived_at is null
      ) then line else null end
  order by s.position;
$$;

-- ── Integridad del juego: al menos un inicial y un final ──────────────────
-- Trigger de restricción diferido: "restaurar valores por defecto" y "usar el
-- juego de la organización" archivan y crean estados en varias sentencias
-- dentro de una transacción; el juego se valida completo al confirmar, no
-- fila a fila. La interfaz (V22) avisa antes, pero la base no confía en eso.

create or replace function assert_status_set_valid(p_org uuid, p_line uuid, p_flow text)
returns void
language plpgsql as $$
begin
  -- Un juego vacío es válido: la línea vuelve a resolver el de la organización.
  if exists (
    select 1 from statuses t
    where t.organization_id = p_org
      and t.business_line_id is not distinct from p_line
      and t.flow = p_flow
      and t.archived_at is null
  ) and (
    not exists (
      select 1 from statuses t
      where t.organization_id = p_org
        and t.business_line_id is not distinct from p_line
        and t.flow = p_flow
        and t.archived_at is null
        and t.kind = 'initial'
    )
    or not exists (
      select 1 from statuses t
      where t.organization_id = p_org
        and t.business_line_id is not distinct from p_line
        and t.flow = p_flow
        and t.archived_at is null
        and t.kind = 'final'
    )
  ) then
    raise exception 'Todo juego de estados necesita al menos un estado inicial y uno final'
      using errcode = 'check_violation';
  end if;
end $$;

create or replace function check_status_set_integrity()
returns trigger
language plpgsql as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform assert_status_set_valid(new.organization_id, new.business_line_id, new.flow);
  end if;

  -- Un UPDATE puede mover la fila de juego (línea o flujo): se validan ambos.
  if tg_op = 'DELETE' or (
    tg_op = 'UPDATE' and
    (old.organization_id, old.business_line_id, old.flow)
      is distinct from (new.organization_id, new.business_line_id, new.flow)
  ) then
    perform assert_status_set_valid(old.organization_id, old.business_line_id, old.flow);
  end if;

  return null;
end $$;

create constraint trigger status_set_integrity
  after insert or update or delete on statuses
  deferrable initially deferred
  for each row execute function check_status_set_integrity();

-- ── Archivar con reasignación: ningún registro queda huérfano ─────────────
-- La garantía vive en la base, no repartida por servicios. Hoy ninguna tabla
-- referencia estados (orders y tasks llegan en KAM-07 y KAM-15): la función
-- descubre las FK por catálogo, así que esas tablas quedarán cubiertas sin
-- tocar esta migración. Corre con los privilegios del invocador: RLS decide
-- qué registros puede mover.

create or replace function archive_status(p_status_id uuid, p_move_to uuid default null)
returns void
language plpgsql as $$
declare
  v_status statuses%rowtype;
  v_target statuses%rowtype;
  ref record;
  ref_count bigint;
  in_use bigint := 0;
begin
  select * into v_status from statuses where id = p_status_id;
  if not found then
    raise exception 'El estado no existe o no está a tu alcance'
      using errcode = 'no_data_found';
  end if;
  if v_status.archived_at is not null then
    return;  -- ya estaba archivado: no hay nada que hacer
  end if;

  if p_move_to is not null then
    select * into v_target from statuses where id = p_move_to;
    if not found
       or v_target.id = v_status.id
       or v_target.archived_at is not null
       or v_target.organization_id <> v_status.organization_id
       or v_target.flow <> v_status.flow then
      raise exception 'El estado de destino debe ser otro estado activo del mismo flujo'
        using errcode = 'check_violation';
    end if;
  end if;

  for ref in
    select con.conrelid::regclass as table_name, att.attname as column_name
    from pg_constraint con
    join pg_attribute att
      on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
    where con.contype = 'f'
      and con.confrelid = 'public.statuses'::regclass
      and array_length(con.conkey, 1) = 1
  loop
    if p_move_to is null then
      execute format(
        'select count(*) from %s where %I = $1',
        ref.table_name, ref.column_name
      ) into ref_count using p_status_id;
      in_use := in_use + ref_count;
    else
      execute format(
        'update %s set %I = $1 where %I = $2',
        ref.table_name, ref.column_name, ref.column_name
      ) using p_move_to, p_status_id;
    end if;
  end loop;

  if p_move_to is null and in_use > 0 then
    raise exception 'El estado está en uso: indica a qué estado mover sus registros'
      using errcode = 'check_violation';
  end if;

  update statuses
  set archived_at = now(), updated_at = now()
  where id = p_status_id;
end $$;

-- ── Restaurar valores por defecto ─────────────────────────────────────────
-- Los juegos por defecto viven en el código (lib/statuses/default-sets.ts) y
-- llegan como jsonb; la función existe porque la operación necesita una sola
-- transacción — supabase-js no las ofrece— y porque la unicidad de nombre
-- incluye lo archivado: restaurar reactiva por nombre en vez de insertar a
-- ciegas, conservando la identidad (y la historia) de los estados que vuelven.

create or replace function restore_default_statuses(
  p_org uuid, p_line uuid, p_flow text, p_defaults jsonb
)
returns void
language plpgsql as $$
declare
  d record;
  extra record;
begin
  if p_defaults is null or jsonb_typeof(p_defaults) <> 'array'
     or jsonb_array_length(p_defaults) = 0 then
    raise exception 'El juego por defecto llegó vacío'
      using errcode = 'check_violation';
  end if;

  for d in
    select *
    from jsonb_to_recordset(p_defaults)
      as x(name text, kind text, color text, is_queue boolean, position int)
  loop
    update statuses
    set kind = d.kind, color = d.color, is_queue = coalesce(d.is_queue, false),
        position = d.position, archived_at = null, updated_at = now()
    where organization_id = p_org
      and business_line_id is not distinct from p_line
      and flow = p_flow
      and name = d.name;

    if not found then
      insert into statuses
        (organization_id, business_line_id, flow, name, kind, color, is_queue, position)
      values
        (p_org, p_line, p_flow, d.name, d.kind, coalesce(d.color, 'zinc'),
         coalesce(d.is_queue, false), d.position);
    end if;
  end loop;

  -- Lo que no pertenece al juego por defecto se archiva; si está en uso,
  -- archive_status exige destino y la transacción entera se rechaza.
  for extra in
    select s.id from statuses s
    where s.organization_id = p_org
      and s.business_line_id is not distinct from p_line
      and s.flow = p_flow
      and s.archived_at is null
      and s.name not in (
        select x.name from jsonb_to_recordset(p_defaults) as x(name text)
      )
  loop
    perform archive_status(extra.id);
  end loop;
end $$;

-- ── Volver al juego de la organización ────────────────────────────────────
-- Archiva el juego propio de la línea completo, en una sola transacción; la
-- línea vuelve a resolver el de la organización. Si algún estado está en uso,
-- archive_status corta la operación entera.

create or replace function use_organization_statuses(p_org uuid, p_line uuid, p_flow text)
returns void
language plpgsql as $$
declare
  own record;
begin
  if p_line is null then
    raise exception 'El juego de la organización no puede renunciar a sí mismo'
      using errcode = 'check_violation';
  end if;

  for own in
    select s.id from statuses s
    where s.organization_id = p_org
      and s.business_line_id = p_line
      and s.flow = p_flow
      and s.archived_at is null
  loop
    perform archive_status(own.id);
  end loop;
end $$;

-- ── Bitácora ──────────────────────────────────────────────────────────────
-- Procedimiento de supabase/README.md: el trigger se adjunta en la misma
-- migración que crea la tabla.

create trigger audit after insert or update on statuses
  for each row execute function log_activity();

-- ── Privilegios y RLS ─────────────────────────────────────────────────────
-- Matriz de acceso §16, igual que el resto de la configuración: todo miembro
-- lee, solo el dueño escribe, nadie borra.

grant select, insert, update on statuses to authenticated;

revoke delete on statuses from authenticated, anon, service_role;
revoke insert, update on statuses from anon;
revoke insert, update on statuses from service_role;
grant select on statuses to service_role;

alter table statuses enable row level security;

create policy "statuses: leer si es miembro"
  on statuses for select to authenticated
  using (is_member(organization_id));

create policy "statuses: crear solo el dueño"
  on statuses for insert to authenticated
  with check (is_owner(organization_id));

create policy "statuses: editar solo el dueño"
  on statuses for update to authenticated
  using (is_owner(organization_id))
  with check (is_owner(organization_id));

-- Sin política DELETE: los estados se archivan, nunca se borran.
