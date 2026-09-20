-- KAM-28 · Solicitudes de pedido por enlace público.
-- Propuesta: openspec/changes/public-order-intake/ (proposal.md, design.md,
-- specs/order-requests, specs/notifications, specs/data-export).
--
-- «Solicitud de pedido» es un concepto nuevo, definido en
-- specs/PRD/kamay-especificacion-producto-v6.md §6.1 antes de esta migración
-- (convención nº 11): datos de contacto e imágenes que un cliente manda por sí
-- mismo desde un enlace de un solo uso. **No es un pedido** — `orders` exige
-- `contact_id` para `kind = 'order'` (`order_needs_customer`) y quien llena el
-- formulario todavía no es un contacto.
--
-- El enlace es siempre dirigido: lo genera una persona de la organización para
-- un cliente concreto (design.md — Non-Goals). Por eso no hace falta captcha
-- ni límite de envíos por origen: el token ya es la puerta.

create table order_requests (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id),
  business_line_id  uuid not null references business_lines(id),

  -- sha256 del token; el token en claro nunca se guarda, igual que
  -- `invitations.token_hash`.
  token_hash        bytea not null,

  -- Elegido al generar el enlace, opcional (design D5): si está presente, el
  -- alta de pedido lo preselecciona al aceptar. Si no, se sugiere por
  -- teléfono, nunca se fusiona.
  contact_id        uuid references contacts(id),

  -- El prellenado que ve el formulario público. Es una foto del momento en
  -- que se generó el enlace, no una referencia viva a `contacts`: así la
  -- función de resolución (abajo) nunca necesita leer `contacts` para
  -- responderle a `anon`, y editar el contacto después no reescribe un
  -- enlace ya enviado.
  prefilled_name    text not null,
  prefilled_phone   text not null,

  -- Lo que el cliente realmente escribió al enviar. Nulos hasta el envío.
  declared_name     text,
  declared_phone    text,
  declared_note     text,

  expires_at        timestamptz not null,
  submitted_at      timestamptz,
  -- El pedido resultante, solo tras aceptar. Una vez fijado no cambia
  -- (`guard_order_request_updates` más abajo).
  order_id          uuid references orders(id),
  archived_at       timestamptz,

  created_by        uuid not null references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- La resolución pública busca por hash, igual que `accept_invitation`.
create index on order_requests (token_hash);

-- La bandeja: lo más reciente primero, por organización.
create index on order_requests (organization_id, created_at desc);

-- El caso que la bandeja activa filtra todo el tiempo: esperando al cliente.
create index on order_requests (organization_id)
  where submitted_at is null and archived_at is null;

-- ── Estado siempre derivado (convención nº 4) ──────────────────────────────
-- No hay columna de estado. La bandeja y la resolución del token lo calculan
-- de `submitted_at`, `expires_at`, `order_id` y `archived_at`:
--   esperando al cliente → recibida → aceptada | descartada.

create trigger audit after insert or update on order_requests
  for each row execute function log_activity();

-- Dos invariantes que la aplicación ya respeta, reforzadas en la base:
--
--   1. `order_id` no se reasigna una vez fijado (design D6): aceptar es
--      "crear pedido → copiar imágenes → fijar order_id", y ese último paso
--      no debe poder pisarse.
--   2. `token_hash`/`expires_at` no cambian una vez que la solicitud dejó de
--      esperar al cliente (design D9): "regenerar" solo tiene sentido en el
--      primer estado.
--
-- Deliberadamente **sin** `enforce_archive_rules()` (design D10): esa función
-- ata archivar a `is_owner()`, y aquí el ayudante tiene los mismos
-- privilegios que el dueño sobre toda la bandeja, descartar incluido.
create function guard_order_request_updates()
returns trigger
language plpgsql as $$
begin
  if old.order_id is not null and new.order_id is distinct from old.order_id then
    raise exception 'El pedido de una solicitud aceptada no se puede reasignar'
      using errcode = 'check_violation';
  end if;

  if (old.submitted_at is not null or old.archived_at is not null)
     and (new.token_hash is distinct from old.token_hash
          or new.expires_at is distinct from old.expires_at) then
    raise exception 'Una solicitud ya recibida o descartada no puede regenerar su enlace'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

create trigger guard_updates before update on order_requests
  for each row execute function guard_order_request_updates();

-- ── Privilegios y RLS ───────────────────────────────────────────────────────
-- Generar, regenerar, aceptar y descartar son escrituras normales de sesión
-- (`is_member`, igual que `orders`): no hay una función SQL para cada una.
-- Las únicas dos operaciones sin sesión —resolver el token y recibir el
-- envío— son las dos funciones `security definer` de más abajo, y son
-- también la única razón por la que `anon` aparece en este archivo.

grant select, insert, update on order_requests to authenticated;
revoke delete on order_requests from authenticated, anon, service_role;
revoke insert, update on order_requests from anon;
revoke insert, update on order_requests from service_role;
grant select on order_requests to service_role;

alter table order_requests enable row level security;

create policy "order_requests: leer si es miembro"
  on order_requests for select to authenticated
  using (is_member(organization_id));

create policy "order_requests: crear si es miembro"
  on order_requests for insert to authenticated
  with check (is_member(organization_id));

create policy "order_requests: editar si es miembro"
  on order_requests for update to authenticated
  using (is_member(organization_id))
  with check (is_member(organization_id));

-- Sin política DELETE: descartar archiva, nunca borra.
-- Sin ninguna política para `anon`: las dos funciones de abajo bastan, y el
-- criterio de aceptación 5 pide que el catálogo de políticas del esquema
-- `public` no conceda nada a `anon`.

-- ── Resolver el token (sin sesión) ──────────────────────────────────────────
-- Devuelve solo lo que la página pública necesita: nada de la fila completa,
-- nada de otra organización. Un token inválido, vencido, ya usado o de una
-- solicitud archivada produce exactamente la misma respuesta — no delata cuál
-- de los cuatro casos fue, ni si la organización existe.

create function resolve_order_request(p_token text)
returns table (
  organization_id    uuid,
  request_id         uuid,
  organization_name  text,
  business_line_name text,
  prefilled_name     text,
  prefilled_phone    text
)
language plpgsql security definer set search_path = public as $$
declare
  v_request order_requests;
begin
  select * into v_request
  from order_requests r
  where r.token_hash = sha256(convert_to(p_token, 'utf8'))
  limit 1;

  if v_request.id is null
     or v_request.submitted_at is not null
     or v_request.archived_at is not null
     or v_request.expires_at <= now() then
    raise exception 'El enlace no es válido' using errcode = 'check_violation';
  end if;

  return query
    select o.id, v_request.id, o.name, bl.name,
           v_request.prefilled_name, v_request.prefilled_phone
    from organizations o
    join business_lines bl on bl.id = v_request.business_line_id
    where o.id = v_request.organization_id;
end $$;

grant execute on function resolve_order_request(text) to anon;

-- ── Recibir el envío (sin sesión) ───────────────────────────────────────────
-- Marca la solicitud como recibida. No crea pedido ni contacto (criterio de
-- aceptación 2) y no escribe en `notifications`: el aviso lo genera
-- `services/notifications/emit-order-request-events.ts` desde la Server
-- Action que llama a esta función, con el cliente privilegiado que ya existe
-- para avisos (design D4) — nunca desde SQL, y `service-role-boundary.test.ts`
-- ya vigila esa frontera.
--
-- `actor_label` viaja por una variable de sesión local a la transacción
-- (`set_config(..., true)`), y `log_activity()` la lee más abajo solo cuando
-- `auth.uid()` es nulo — una condición que ninguna sesión autenticada puede
-- fingir (design D3).

create function submit_order_request(
  p_token text,
  p_name  text,
  p_phone text,
  p_note  text default null
)
returns table (organization_id uuid, request_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_request order_requests;
begin
  select * into v_request
  from order_requests r
  where r.token_hash = sha256(convert_to(p_token, 'utf8'))
  limit 1;

  if v_request.id is null
     or v_request.submitted_at is not null
     or v_request.archived_at is not null
     or v_request.expires_at <= now() then
    raise exception 'El enlace no es válido' using errcode = 'check_violation';
  end if;

  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'Falta el nombre' using errcode = 'check_violation';
  end if;

  if btrim(coalesce(p_phone, '')) = '' then
    raise exception 'Falta el teléfono' using errcode = 'check_violation';
  end if;

  perform set_config('kamay.actor_label', 'Formulario público', true);

  update order_requests
     set declared_name  = btrim(p_name),
         declared_phone = btrim(p_phone),
         declared_note  = nullif(btrim(coalesce(p_note, '')), ''),
         submitted_at   = now()
   where id = v_request.id;

  return query select v_request.organization_id, v_request.id;
end $$;

grant execute on function submit_order_request(text, text, text, text) to anon;

-- ── `log_activity()`, cuarta redefinición ──────────────────────────────────
-- Única adición: cuando no hay actor autenticado, se lee `kamay.actor_label`
-- (fijada arriba, dentro de la misma transacción). Fuera de esa condición el
-- comportamiento es idéntico al de 20260914120000_platform_admins.sql.
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

  -- KAM-28: sin actor autenticado, la etiqueta —si alguna función la dejó en
  -- esta transacción— identifica el origen externo. Solo se lee cuando no hay
  -- `auth.uid()`, así que una sesión autenticada no puede fijarla y heredarla.
  if v_actor is null then
    v_label := nullif(current_setting('kamay.actor_label', true), '');
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

-- ── Bucket de cuarentena ────────────────────────────────────────────────────
-- Privado, propio (no comparte políticas con `attachments`/`receipts`/
-- `item-photos`/`org-logos`): la única política de `insert` que necesita
-- conceder a `anon` en todo el cambio vive aquí y en ningún otro bucket.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'order-requests', 'order-requests', false, 5242880,
  array['image/jpeg','image/png','image/webp','image/avif']
)
on conflict (id) do nothing;

-- Una política de RLS se evalúa con los privilegios de quien llama, y `anon`
-- no tiene ninguna política de lectura sobre `order_requests` (a propósito:
-- es justo lo que el criterio de aceptación 5 exige). Un `exists (select ...
-- from order_requests ...)` corriendo como `anon` vería siempre cero filas y
-- la subida fallaría siempre. La comprobación necesita el mismo rodeo que
-- `is_member`/`is_owner`: una función `security definer` que sí puede leer la
-- tabla, y que solo devuelve un booleano — nunca una fila.
create function order_request_open(p_organization_id uuid, p_request_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from order_requests r
    where r.id = p_request_id
      and r.organization_id = p_organization_id
      and r.submitted_at is null
      and r.archived_at is null
      and r.expires_at > now()
  );
$$;

-- `anon` puede escribir, y solo escribir, dentro de la carpeta de una
-- solicitud que sigue esperando al cliente y no ha vencido.
--
-- La carpeta es `<organization_id>/<request_id>/<archivo>`: el primer
-- segmento identifica la organización (igual que en `attachments`), el
-- segundo, la solicitud dentro de ella.
create policy "order-requests: subir solo a una solicitud abierta"
  on storage.objects for insert to anon
  with check (
    bucket_id = 'order-requests'
    and order_request_open(
      (storage.foldername(name))[1]::uuid,
      (storage.foldername(name))[2]::uuid
    )
  );

-- Sin `select`, `update` ni `delete` para `anon`: no puede leer lo que subió,
-- ni sobrescribirlo, ni enumerar la carpeta.

-- Quien tiene sesión en la organización sí puede leer la cuarentena, para
-- mostrar las imágenes en la bandeja antes de aceptar.
create policy "order-requests: leer solo la propia organización"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'order-requests'
    and is_member((storage.foldername(name))[1]::uuid)
  );

-- ── El séptimo tipo de notificación ─────────────────────────────────────────
-- Delta spec `notifications` — Requirement: Modelo de notificación con tipo
-- cerrado; Requirement: Preferencias de notificación por persona, con cada
-- tipo apagable.

alter table notifications drop constraint notifications_type_check;

alter table notifications add constraint notifications_type_check
  check (type in (
    'due_summary', 'task_assigned', 'task_review', 'task_overdue',
    'task_stalled', 'stock_below_min', 'order_request_received'
  ));

alter table notification_preferences
  add column order_request_received boolean not null default true;
