-- KAM-32 · Enlace público del pedido, de solo lectura y con comentarios.
-- Propuesta: openspec/changes/public-order-share/ (proposal.md, design.md,
-- specs/order-share, specs/notifications).
--
-- «Comentario del cliente» es un concepto nuevo, definido en
-- specs/PRD/kamay-especificacion-producto-v6.md §6.1 antes de esta migración
-- (convención nº 11): es contenido, no un evento de bitácora, y no convierte
-- al cliente en usuario. «Seguimiento público del pedido» ya figuraba en la
-- Fase 6 de la especificación; esta migración lo construye.
--
-- Comparte todo el aparato de KAM-28 (`20260920110000_order_requests.sql`):
-- token_hash + mensaje único de fallo, generar/regenerar/revocar como
-- escrituras de sesión sin función SQL, y `kamay.actor_label` — que
-- `log_activity()` ya lee cuando `auth.uid()` es nulo, sin necesitar otra
-- redefinición.

create table order_shares (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id),
  order_id          uuid not null references orders(id),

  -- sha256 del token; el token en claro nunca se guarda (design D5): la URL
  -- solo existe en el momento de generarla o regenerarla.
  token_hash        bytea not null,

  -- Vigencia larga (design D4): a diferencia de order_requests, este enlace
  -- se abre muchas veces mientras el pedido avanza. Revocar (archived_at) es
  -- el control principal; el vencimiento es una red de seguridad de fondo.
  expires_at        timestamptz not null,
  archived_at       timestamptz,

  created_by        uuid not null references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index on order_shares (token_hash);
create index on order_shares (organization_id, order_id);

-- Un pedido tiene como máximo un enlace vigente a la vez. Generar uno nuevo
-- cuando ya existe uno vigente es un error de la aplicación, no algo que la
-- base deba resolver en silencio: la acción revoca primero (design D4).
create unique index on order_shares (order_id) where archived_at is null;

create table order_comments (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id),
  -- Del pedido, no de la fila order_shares que lo recibió: así un comentario
  -- sobrevive a que el enlace se regenere (design D4).
  order_id          uuid not null references orders(id),
  author_name       text not null,
  body              text not null,
  occurred_at       timestamptz not null default now(),
  archived_at       timestamptz
);

create index on order_comments (organization_id, order_id, occurred_at desc);
-- La ventana del límite de envíos (design D7): cuántos comentarios lleva un
-- pedido en la última hora.
create index on order_comments (order_id, occurred_at desc);

create trigger audit after insert or update on order_shares
  for each row execute function log_activity();

create trigger audit after insert or update on order_comments
  for each row execute function log_activity();

-- `token_hash`/`expires_at` no cambian una vez revocado (design D4): mismo
-- patrón que `guard_order_request_updates` de KAM-28, para esta tabla.
create function guard_order_share_updates()
returns trigger
language plpgsql as $$
begin
  if old.archived_at is not null
     and (new.token_hash is distinct from old.token_hash
          or new.expires_at is distinct from old.expires_at) then
    raise exception 'Un enlace revocado no puede regenerarse'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

create trigger guard_updates before update on order_shares
  for each row execute function guard_order_share_updates();

-- ── Privilegios y RLS ───────────────────────────────────────────────────────

grant select, insert, update on order_shares to authenticated;
revoke delete on order_shares from authenticated, anon, service_role;
revoke insert, update on order_shares from anon;
revoke insert, update on order_shares from service_role;
grant select on order_shares to service_role;

alter table order_shares enable row level security;

create policy "order_shares: leer si es miembro"
  on order_shares for select to authenticated
  using (is_member(organization_id));

create policy "order_shares: crear si es miembro"
  on order_shares for insert to authenticated
  with check (is_member(organization_id));

create policy "order_shares: editar si es miembro"
  on order_shares for update to authenticated
  using (is_member(organization_id))
  with check (is_member(organization_id));

-- `order_comments`: un comentario lo escribe la función pública, nunca una
-- sesión. Con sesión solo se lee y se archiva — nunca se edita el cuerpo, ni
-- siquiera la organización dueña, porque un comentario es lo que el cliente
-- dijo, no lo que la organización querría que hubiera dicho.
grant select on order_comments to authenticated;
revoke insert, update, delete on order_comments from authenticated, anon;
revoke insert, update, delete on order_comments from service_role;
grant select on order_comments to service_role;

-- El orden importa (mismo motivo que `notifications`, KAM-17): revocar
-- primero, conceder después, para que la concesión por columna no quede en
-- decoración sobre un `update` de tabla completa ya otorgado.
grant update (archived_at) on order_comments to authenticated;

alter table order_comments enable row level security;

create policy "order_comments: leer si es miembro"
  on order_comments for select to authenticated
  using (is_member(organization_id));

create policy "order_comments: archivar si es miembro"
  on order_comments for update to authenticated
  using (is_member(organization_id))
  with check (is_member(organization_id));

-- Sin política DELETE en ninguna de las dos tablas: revocar y archivar
-- archivan, nunca borran.
-- Sin ninguna política para `anon`: las dos funciones de abajo, más la
-- política de `storage.objects`, bastan.

-- ── Resolver el enlace (sin sesión) ─────────────────────────────────────────
-- Devuelve solo lo público: nunca `orders.notes`, costo, margen ni proveedor
-- (spec `order-share` — Requirement: La resolución pública no expone nada de
-- más). Un token inválido, vencido, revocado, o de un pedido archivado
-- producen la misma respuesta.

create function resolve_order_share(p_token text)
returns table (
  organization_id     uuid,
  order_id            uuid,
  code                int,
  business_line_name  text,
  status_name         text,
  due_date            date,
  total               numeric,
  paid                numeric,
  balance             numeric,
  items               jsonb,
  attachments         jsonb
)
language plpgsql security definer set search_path = public as $$
declare
  v_share order_shares;
  v_order orders;
begin
  select * into v_share
  from order_shares s
  where s.token_hash = sha256(convert_to(p_token, 'utf8'))
  limit 1;

  if v_share.id is null
     or v_share.archived_at is not null
     or v_share.expires_at <= now() then
    raise exception 'El enlace no es válido' using errcode = 'check_violation';
  end if;

  select * into v_order from orders o where o.id = v_share.order_id;

  if v_order.id is null or v_order.archived_at is not null then
    raise exception 'El enlace no es válido' using errcode = 'check_violation';
  end if;

  return query
    select
      v_order.organization_id,
      v_order.id,
      v_order.code,
      bl.name,
      st.name,
      v_order.due_date,
      ot.total,
      ot.paid,
      ot.total - ot.paid,
      (select coalesce(jsonb_agg(jsonb_build_object(
                 'description', coalesce(i.name, oi.description, 'Sin detalle'),
                 'quantity', oi.quantity,
                 'unitPrice', oi.unit_price
               ) order by oi.created_at), '[]'::jsonb)
         from order_items oi
         left join items i on i.id = oi.item_id
        where oi.order_id = v_order.id and oi.archived_at is null),
      (select coalesce(jsonb_agg(jsonb_build_object(
                 'id', a.id,
                 'fileName', a.file_name,
                 'storagePath', a.storage_path
               ) order by a.created_at), '[]'::jsonb)
         from attachments a
        where a.entity_type = 'order' and a.entity_id = v_order.id
          and a.archived_at is null)
    from business_lines bl, statuses st, order_totals ot
   where bl.id = v_order.business_line_id
     and st.id = v_order.status_id
     and ot.order_id = v_order.id;
end $$;

grant execute on function resolve_order_share(text) to anon;

-- ── Recibir un comentario (sin sesión) ──────────────────────────────────────
-- No escribe en `notifications`: el aviso lo genera
-- `services/notifications/emit-order-comment-events.ts` desde la Server
-- Action que llama a esta función, nunca desde SQL — mismo patrón que
-- `submit_order_request` de KAM-28 (design D4 de esa propuesta,
-- `service-role-boundary.test.ts` vigila la frontera).

create function submit_order_comment(
  p_token text,
  p_name  text,
  p_body  text
)
returns table (organization_id uuid, order_id uuid, comment_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_share order_shares;
  v_count int;
  v_comment_id uuid := gen_random_uuid();
begin
  select * into v_share
  from order_shares s
  where s.token_hash = sha256(convert_to(p_token, 'utf8'))
  limit 1;

  if v_share.id is null
     or v_share.archived_at is not null
     or v_share.expires_at <= now() then
    raise exception 'El enlace no es válido' using errcode = 'check_violation';
  end if;

  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'Falta el nombre' using errcode = 'check_violation';
  end if;

  if btrim(coalesce(p_body, '')) = '' then
    raise exception 'Falta el comentario' using errcode = 'check_violation';
  end if;

  -- El límite es del pedido, no de esta fila de order_shares: regenerar el
  -- enlace no reinicia el conteo (design D7).
  select count(*) into v_count
    from order_comments c
   where c.order_id = v_share.order_id
     and c.occurred_at > now() - interval '1 hour';

  if v_count >= 5 then
    raise exception 'Ya se mandaron demasiados comentarios. Intenta más tarde.'
      using errcode = 'check_violation';
  end if;

  perform set_config('kamay.actor_label', 'Cliente', true);

  insert into order_comments (id, organization_id, order_id, author_name, body)
  values (v_comment_id, v_share.organization_id, v_share.order_id, btrim(p_name), btrim(p_body));

  return query select v_share.organization_id, v_share.order_id, v_comment_id;
end $$;

grant execute on function submit_order_comment(text, text, text) to anon;

-- ── Lectura pública de imágenes (sin service role) ──────────────────────────
-- Mismo hallazgo que KAM-28: la política de `storage.objects` no puede leer
-- `order_shares` con un `exists` directo porque `anon` no tiene ninguna
-- política sobre esa tabla — hace falta una función `security definer` de
-- apoyo, igual que `order_request_open()`.

create function order_share_attachment_open(
  p_organization_id uuid,
  p_entity_type     text,
  p_entity_id       uuid
)
returns boolean
language sql stable security definer set search_path = public as $$
  select p_entity_type = 'order' and exists (
    select 1 from order_shares s
    where s.order_id = p_entity_id
      and s.organization_id = p_organization_id
      and s.archived_at is null
      and s.expires_at > now()
  );
$$;

-- Solo el bucket `attachments`: es el único donde un adjunto puede ser la
-- imagen de referencia de un pedido. `receipts`, `item-photos` y `org-logos`
-- no ganan ninguna política nueva.
create policy "attachments: leer pública con enlace de pedido vigente"
  on storage.objects for select to anon
  using (
    bucket_id = 'attachments'
    and order_share_attachment_open(
      (storage.foldername(name))[1]::uuid,
      (storage.foldername(name))[2],
      (storage.foldername(name))[3]::uuid
    )
  );

-- ── El octavo tipo de notificación ──────────────────────────────────────────
-- Delta spec `notifications` de este cambio — asume que `order_request_received`
-- (KAM-28) ya está en el catálogo: ver design.md, nota de orden de archivado.

alter table notifications drop constraint notifications_type_check;

alter table notifications add constraint notifications_type_check
  check (type in (
    'due_summary', 'task_assigned', 'task_review', 'task_overdue',
    'task_stalled', 'stock_below_min', 'order_request_received',
    'order_comment_received'
  ));

alter table notification_preferences
  add column order_comment_received boolean not null default true;
