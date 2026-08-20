-- KAM-03 · Bitácora: activity_log, trigger genérico log_activity() y su inmutabilidad.
-- DDL canónico: specs/PRD/kamay-esquema-base-de-datos-supabase.md §14, §16.
-- Se instala antes de que exista una sola fila de datos reales: un historial no
-- se reconstruye hacia atrás.

create table activity_log (
  id               bigint generated always as identity primary key,
  organization_id  uuid not null references organizations(id),
  business_line_id uuid,
  actor_id         uuid references auth.users(id),
  actor_label      text,                    -- 'sistema' o nombre de plataforma externa
  table_name       text not null,
  record_id        uuid not null,
  action           text not null check (action in
                     ('created','updated','status_changed','archived','unarchived')),
  changes          jsonb,                   -- solo los campos que cambiaron
  origin           text,                    -- 'mobile' | 'desktop' | 'external'
  occurred_at      timestamptz not null default now()
);

create index on activity_log (organization_id, occurred_at desc);
create index on activity_log (table_name, record_id, occurred_at desc);
create index on activity_log (organization_id, business_line_id, occurred_at desc);
create index on activity_log using gin (changes);

-- El trigger genérico. Sirve a cualquier tabla auditable sin conocerla: deduce
-- la acción, guarda solo lo que cambió y fusiona el ruido de ediciones seguidas.
-- security definer: las inserciones ocurren aquí y solo aquí — ningún rol de
-- aplicación tiene privilegio de escritura sobre activity_log.
create or replace function log_activity()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb; v_new jsonb; v_changes jsonb; v_delta jsonb;
  v_action text; v_org uuid; v_line uuid;
  v_ignored text[] := array['updated_at','created_at'];
  v_actor uuid; v_record uuid;
  v_merge_id bigint; v_merge_changes jsonb;
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

  -- Agrupación de ruido: ediciones sucesivas del mismo autor sobre el mismo
  -- registro dentro de 5 minutos se consolidan en un solo evento. Creación,
  -- archivado, desarchivado y cambio de estado nunca se fusionan.
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
                            table_name, record_id, action, changes, origin)
  values (v_org, v_line, v_actor, tg_table_name,
          v_record, v_action, v_changes,
          nullif(current_setting('request.headers', true), '')::json->>'x-client-origin');

  return new;
end $$;

-- Inalterable de verdad: ni siquiera el dueño puede modificarla. La lectura la
-- limita RLS; la escritura la corta el revoke, que no depende de que una política
-- esté bien escrita.
alter table activity_log enable row level security;

create policy "activity_log: solo el dueño lee"
  on activity_log for select to authenticated
  using (is_owner(organization_id));

-- Privilegios explícitos: las imágenes recientes de Supabase ya no otorgan
-- privilegios por defecto a `authenticated`. Solo lectura, y quien decide qué
-- filas se ven es la política de arriba.
grant select on activity_log to authenticated;

-- service_role tampoco escribe: la bitácora entra por el trigger y por nada más.
-- (La purga de retención de KAM-22 pedirá su propio privilegio cuando llegue.)
grant select on activity_log to service_role;

-- Sin políticas ni privilegios de INSERT, UPDATE o DELETE para usuarios.
revoke insert, update, delete on activity_log from authenticated, anon;

-- Tablas auditadas hoy. Toda tabla auditable futura adjunta este mismo trigger
-- en su propia migración de creación (ver supabase/README.md).
create trigger audit after insert or update on organizations
  for each row execute function log_activity();

create trigger audit after insert or update on memberships
  for each row execute function log_activity();
