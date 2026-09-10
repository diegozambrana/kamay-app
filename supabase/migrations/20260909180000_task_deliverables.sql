-- KAM-21 · Entregables de tarea y cierre con entregables.
-- DDL canónico: specs/PRD/kamay-esquema-base-de-datos-supabase.md §12, §16, §18.
--
-- Cerrar una tarea deja de ser mover un rectángulo: lo que debía existir al
-- terminarla se declara al empezar y se crea al cerrar, en una sola operación.
--
-- Lo que esta migración **no** toca, porque ya está:
--   · `task_links` y su trigger de validación → KAM-15. Sí se le añade
--     `archived_at`, porque quitar un vínculo no existía hasta ahora.
--   · La rama `asset` de `validate_task_link()` → KAM-19 la cerró contra
--     `asset_details` en 20260908170000_asset_recovery.sql.
--   · `tasks.closed_without_deliverables` → la columna nació con KAM-15,
--     declarada inerte. Esta migración es la primera que la escribe.
--
-- Una desviación consciente del DDL canónico, la misma que KAM-15 documentó
-- para `task_tags` y `membership_lines`: `task_deliverables` lleva
-- `organization_id` aunque se deduzca de su tarea. La convención nº 2 lo exige
-- en toda tabla, y sin él `log_activity()` —que lo lee de la propia fila—
-- registraría el evento bajo una organización inexistente.

-- ── Entregables declarados y su cumplimiento ──────────────────────────────
create table task_deliverables (
  id               uuid primary key default gen_random_uuid(),
  task_id          uuid not null references tasks(id),
  organization_id  uuid not null references organizations(id),
  deliverable_type text not null check (deliverable_type in
                     ('product','supply','supplier','purchase','expenses','asset')),

  -- Qué se creó al cumplirlo. Los tres van juntos o ninguno: un entregable a
  -- medio cumplir no significa nada, y dejarlo posible invitaría a leer
  -- `fulfilled_id` sin comprobar `fulfilled_at`.
  fulfilled_type   text,
  fulfilled_id     uuid,
  fulfilled_at     timestamptz,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- Retirar un entregable declarado es archivarlo, nunca borrarlo
  -- (convención nº 3). El canon §12 no lo lleva porque no previó la retirada;
  -- sin él, «un entregable declarado SHALL poder retirarse» no tendría vía.
  archived_at      timestamptz,

  constraint fulfillment_is_whole check (
    (fulfilled_type is null and fulfilled_id is null and fulfilled_at is null)
    or (fulfilled_type is not null and fulfilled_id is not null and fulfilled_at is not null)
  )
);

-- Un entregable por tipo y por tarea (§12). Una tarea que deba producir dos
-- productos distintos declara *Nuevo producto* una vez y crea el segundo a
-- mano; encadenar entregables está fuera de alcance por decisión del backlog.
--
-- Parcial sobre los vigentes, por el mismo motivo que en `task_links`: un tipo
-- retirado y vuelto a declarar tiene que poder entrar sin chocar con su propio
-- historial.
create unique index on task_deliverables (task_id, deliverable_type)
  where archived_at is null;

create index on task_deliverables (task_id) where archived_at is null;
create index on task_deliverables (organization_id);

-- Para el ícono de la tarjeta y el filtro del tablero: qué tareas tienen algo
-- declarado sin cumplir.
create index on task_deliverables (task_id)
  where fulfilled_at is null and archived_at is null;

create trigger enforce_archive before update on task_deliverables
  for each row execute function enforce_archive_rules();

create trigger audit after insert or update on task_deliverables
  for each row execute function log_activity();

-- ── Privilegios y RLS ─────────────────────────────────────────────────────
-- Matriz de acceso §16: `task_deliverables` va «según la tarea», igual que
-- `task_links` y `task_tags`. Borrar, nadie (convención nº 3).

grant select, insert, update on task_deliverables to authenticated;
revoke delete on task_deliverables from authenticated, anon, service_role;
revoke insert, update on task_deliverables from anon;
revoke insert, update on task_deliverables from service_role;
grant select on task_deliverables to service_role;

alter table task_deliverables enable row level security;

-- El `exists` sobre `tasks` vuelve a pasar por la política de tareas, que es
-- la que sabe de rol y de línea. Repetirlo aquí en vez de factorizarlo es
-- deliberado: son cuatro líneas que una prueba de aislamiento tiene que poder
-- leer de un vistazo.
create policy "task_deliverables: según la tarea"
  on task_deliverables for select to authenticated
  using (exists (select 1 from tasks t where t.id = task_id));

create policy "task_deliverables: crear según la tarea"
  on task_deliverables for insert to authenticated
  with check (
    is_member(organization_id)
    and exists (select 1 from tasks t where t.id = task_id)
  );

create policy "task_deliverables: editar según la tarea"
  on task_deliverables for update to authenticated
  using (exists (select 1 from tasks t where t.id = task_id))
  with check (
    is_member(organization_id)
    and exists (select 1 from tasks t where t.id = task_id)
  );

-- ── Quitar un vínculo es archivarlo ───────────────────────────────────────
-- KAM-15 creó `task_links` sin `archived_at` porque su única vía de escritura
-- —*Crear tarea para este pedido*— no tenía forma de deshacerse. KAM-21 abre
-- el buscador, y con él la necesidad de quitar lo que se puso.
--
-- Quitar **no** es borrar: la convención nº 3 no admite política `DELETE` en
-- ninguna tabla, y `revoke delete` ya lo impide aquí. Se archiva, exactamente
-- como `membership_lines` hace con las líneas de una membresía.
--
-- Y por eso la unicidad pasa a ser parcial, con el mismo motivo que allí: un
-- destino quitado y vuelto a vincular tiene que poder insertarse otra vez sin
-- chocar contra su propio historial.

alter table task_links add column archived_at timestamptz;

alter table task_links drop constraint task_links_task_id_entity_type_entity_id_key;

create unique index on task_links (task_id, entity_type, entity_id)
  where archived_at is null;

create index on task_links (task_id) where archived_at is null;

-- `enforce_archive_rules()` decide quién puede archivar, como en toda tabla
-- que lleva `archived_at`. Sin este trigger, quitar un vínculo sería la única
-- operación de archivado del sistema sin regla de rol.
create trigger enforce_archive before update on task_links
  for each row execute function enforce_archive_rules();

-- ── Reabrir retira la marca ───────────────────────────────────────────────
-- `create or replace` sobre la función de KAM-15, sin editar su migración
-- (convención nº 6). Se le añade una línea: salir de un estado `final` baja
-- `closed_without_deliverables` igual que borra `closed_at`.
--
-- Que lo lleve el trigger y no la aplicación es lo que hace que «reabrir retira
-- la marca» sea cierto por cualquier vía de reapertura, incluidas las que aún
-- no existen. Lo que se creó, creado queda: la marca dice cómo se cerró, no
-- qué hay en el sistema.

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
    new.closed_without_deliverables := false;
  end if;

  return new;
end $$;

-- ── Cierre con entregables ────────────────────────────────────────────────
-- Una sola transacción. El requisito es «o se crean los marcados y se cierra,
-- o no se crea ninguno y la tarea sigue abierta»: eso es una transacción, y el
-- proyecto ya decidió tres veces —`create_order`, `create_expense`,
-- `create_direct_sale`— que las escrituras multi-tabla viven en la base.
--
-- `security invoker` y no `definer`: no hay nada que saltarse. Corre como la
-- persona, así que RLS decide qué puede crear y sobre qué tarea. Un `definer`
-- aquí sería un agujero con la forma exacta de `p_task_id`.
--
-- Los adjuntos llegan **ya copiados** en Storage: plpgsql no habla con Storage,
-- y `attachments` lleva `unique (bucket, storage_path)`, así que compartir el
-- objeto entre dos filas no es posible. La acción copia antes, pasa las filas
-- aquí, y retira los objetos si esto falla.
--
-- Forma de `p_deliverables` (array; vacío = cerrar sin crear nada):
--   [{ "deliverable_type": "product",
--      "new_id": "<uuid generado fuera>",
--      "payload": { … según el tipo … },
--      "attachments": [{ "bucket": …, "storage_path": …, "file_name": …,
--                        "mime_type": …, "size_bytes": … }] }]

create or replace function close_task_with_deliverables(
  p_task_id       uuid,
  p_deliverables  jsonb,
  p_status_id     uuid
)
returns uuid
language plpgsql security invoker as $$
declare
  v_org      uuid;
  v_line     uuid;
  v_archived timestamptz;
  v_kind     text;
  v_list     jsonb := coalesce(p_deliverables, '[]'::jsonb);
  v_entry    jsonb;
  v_type     text;
  v_new_id   uuid;
  v_payload  jsonb;
  v_link     text;
  v_created  int := 0;
  v_pending  int;
  v_att      jsonb;
begin
  -- La tarea, si es que quien llama la alcanza. RLS ya filtra: una tarea ajena
  -- simplemente no aparece, y el mensaje es el mismo que si no existiera.
  select organization_id, business_line_id, archived_at
    into v_org, v_line, v_archived
    from tasks where id = p_task_id;

  if v_org is null then
    raise exception 'La tarea no existe o no está a tu alcance'
      using errcode = 'no_data_found';
  end if;

  if v_archived is not null then
    raise exception 'Una tarea archivada no se cierra'
      using errcode = 'check_violation';
  end if;

  select kind into v_kind from statuses where id = p_status_id;

  if v_kind is null then
    raise exception 'El estado destino no existe'
      using errcode = 'foreign_key_violation';
  end if;

  -- Convención nº 5: se compara por el tipo del estado, nunca por su nombre.
  if v_kind <> 'final' then
    raise exception 'El cierre con entregables exige un estado de tipo final'
      using errcode = 'check_violation';
  end if;

  if jsonb_typeof(v_list) <> 'array' then
    raise exception 'Los entregables no tienen un formato válido'
      using errcode = 'check_violation';
  end if;

  for v_entry in select * from jsonb_array_elements(v_list)
  loop
    v_type    := nullif(v_entry->>'deliverable_type', '');
    v_new_id  := coalesce(nullif(v_entry->>'new_id', '')::uuid, gen_random_uuid());
    v_payload := coalesce(v_entry->'payload', '{}'::jsonb);

    -- Que el entregable siga sin cumplir se comprueba **aquí dentro**, no en
    -- el navegador: dos personas cerrando la misma tarea a la vez llegarían
    -- las dos con el mismo entregable pendiente. La segunda no crea nada.
    if not exists (
      select 1 from task_deliverables
      where task_id = p_task_id
        and deliverable_type = v_type
        and fulfilled_at is null
        and archived_at is null
    ) then
      continue;
    end if;

    case v_type
      when 'product', 'supply', 'asset' then
        insert into items (id, organization_id, business_line_id, kind, name,
                           description, unit_id, sale_price, created_by)
        values (
          v_new_id, v_org,
          nullif(v_payload->>'business_line_id', '')::uuid,
          case v_type when 'product' then 'product'
                      when 'supply'  then 'supply'
                      else 'asset' end,
          v_payload->>'name',
          nullif(v_payload->>'description', ''),
          nullif(v_payload->>'unit_id', '')::uuid,
          nullif(v_payload->>'sale_price', '')::numeric,
          auth.uid()
        );

        if v_type = 'asset' then
          -- `asset_details` es del dueño: sus políticas van bajo `is_owner()`,
          -- así que un ayudante no llega aquí — RLS rechaza la fila.
          insert into asset_details (item_id, organization_id, acquisition_cost,
                                     acquired_on, supplier_id, notes)
          values (
            v_new_id, v_org,
            coalesce(nullif(v_payload->>'acquisition_cost', '')::numeric, 0),
            coalesce(nullif(v_payload->>'acquired_on', '')::date, current_date),
            nullif(v_payload->>'supplier_id', '')::uuid,
            nullif(v_payload->>'notes', '')
          );
          v_link := 'asset';
        else
          v_link := 'item';
        end if;

      when 'supplier' then
        insert into contacts (id, organization_id, name, phone, is_supplier,
                              notes, created_by)
        values (
          v_new_id, v_org, v_payload->>'name',
          nullif(v_payload->>'phone', ''), true,
          nullif(v_payload->>'notes', ''), auth.uid()
        );
        v_link := 'contact';

      when 'purchase', 'expenses' then
        -- Se delega en la RPC que ya sabe crear egresos con sus líneas, sus
        -- validaciones y su comprobación de rol. Escribir aquí un segundo
        -- camino de alta de egreso sería la manera de que los dos se separen.
        v_new_id := create_expense(
          jsonb_build_object(
            'id',                  v_new_id,
            'organization_id',     v_org,
            'business_line_id',    coalesce(nullif(v_payload->>'business_line_id', '')::uuid, v_line),
            'kind',                case v_type when 'purchase' then 'purchase' else 'expense' end,
            'contact_id',          v_payload->>'contact_id',
            'expense_category_id', v_payload->>'expense_category_id',
            'amount',              v_payload->>'amount',
            'occurred_at',         v_payload->>'occurred_at',
            'note',                v_payload->>'note'
          ),
          coalesce(v_payload->'items', '[]'::jsonb)
        );
        v_link := 'expense';

      else
        raise exception 'Tipo de entregable desconocido: %', v_type
          using errcode = 'check_violation';
    end case;

    -- Lo creado queda colgado de la tarea que lo originó, y la tarea aparece
    -- en las *Tareas relacionadas* de lo creado. Es la misma fila que escribe
    -- el buscador de vínculos: no hay un segundo mecanismo.
    insert into task_links (task_id, organization_id, entity_type, entity_id)
    values (p_task_id, v_org, v_link, v_new_id)
    on conflict (task_id, entity_type, entity_id) where archived_at is null
    do nothing;

    for v_att in select * from jsonb_array_elements(coalesce(v_entry->'attachments', '[]'::jsonb))
    loop
      insert into attachments (organization_id, entity_type, entity_id, bucket,
                               storage_path, file_name, mime_type, size_bytes,
                               uploaded_by)
      values (
        v_org,
        case when v_link = 'asset' then 'item' else v_link end,
        v_new_id,
        v_att->>'bucket', v_att->>'storage_path', v_att->>'file_name',
        nullif(v_att->>'mime_type', ''),
        nullif(v_att->>'size_bytes', '')::bigint,
        auth.uid()
      );
    end loop;

    update task_deliverables
       set fulfilled_type = v_link,
           fulfilled_id   = v_new_id,
           fulfilled_at   = now(),
           updated_at     = now()
     where task_id = p_task_id
       and deliverable_type = v_type
       and archived_at is null;

    v_created := v_created + 1;
  end loop;

  select count(*) into v_pending
    from task_deliverables
   where task_id = p_task_id
     and fulfilled_at is null
     and archived_at is null;

  -- La marca solo significa algo cuando había algo que crear: una tarea que
  -- nunca declaró nada no cerró sin cumplir, es que no había nada que cumplir.
  -- Se calcula aquí y no llega del cliente, que es la diferencia entre una
  -- marca que significa algo y una casilla que el navegador puede mentir.
  update tasks
     set status_id = p_status_id,
         closed_without_deliverables = (v_pending > 0 and v_created = 0),
         updated_at = now()
   where id = p_task_id;

  return p_task_id;
end $$;

comment on function close_task_with_deliverables(uuid, jsonb, uuid) is
  'Crea los entregables marcados, los enlaza a la tarea y la cierra, en una sola transacción. Los adjuntos llegan ya copiados en Storage.';
