-- KAM-06b · Adjuntos: tabla `attachments`, buckets de Storage y sus políticas.
-- DDL canónico: specs/PRD/kamay-esquema-base-de-datos-supabase.md §13.
-- La primera necesidad es la foto del ítem del catálogo, pero la tabla es la
-- que el esquema ya definía para tareas, pedidos, egresos y contactos: se
-- instala completa para no volver a tocarla cuando lleguen los demás.

create table attachments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  entity_type     text not null check (entity_type in ('task','order','expense','item','contact')),
  -- Referencia polimórfica: apunta a cinco tablas, así que no lleva llave
  -- foránea. Se sostiene porque en Kamay nada se elimina.
  entity_id       uuid not null,
  bucket          text not null,
  storage_path    text not null,      -- {organization_id}/{entity_type}/{entity_id}/{uuid}.ext
  file_name       text not null,
  mime_type       text,
  size_bytes      bigint,
  uploaded_by     uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  archived_at     timestamptz,
  unique (bucket, storage_path)
);

create index on attachments (entity_type, entity_id);
create index on attachments (organization_id) where archived_at is null;

-- ── Política de crecimiento (especificación funcional) ────────────────────
-- Máximo 5 MB por archivo. El límite se valida en el cliente para avisar
-- pronto, en el bucket para que no dependa del cliente, y aquí para que la
-- fila no pueda mentir sobre el tamaño de lo que subió.
alter table attachments
  add constraint size_within_limit
  check (size_bytes is null or size_bytes <= 5 * 1024 * 1024);

-- La ruta empieza siempre con el organization_id: es lo que hace verificable
-- la política de Storage (esquema §13).
alter table attachments
  add constraint path_starts_with_organization
  check (storage_path like organization_id::text || '/%');

-- Mismas reglas de archivado que el catálogo: archivar es del dueño y un
-- archivado no se edita (la función es genérica desde 20260826120000).
create trigger enforce_archive before update on attachments
  for each row execute function enforce_archive_rules();

create trigger audit after insert or update on attachments
  for each row execute function log_activity();

grant select, insert, update on attachments to authenticated;

revoke delete on attachments from authenticated, anon, service_role;
revoke insert, update on attachments from anon;
revoke insert, update on attachments from service_role;
grant select on attachments to service_role;

alter table attachments enable row level security;

create policy "attachments: leer si es miembro"
  on attachments for select to authenticated
  using (is_member(organization_id));

create policy "attachments: crear si es miembro"
  on attachments for insert to authenticated
  with check (is_member(organization_id));

create policy "attachments: editar si es miembro"
  on attachments for update to authenticated
  using (is_member(organization_id))
  with check (is_member(organization_id));

-- Sin política DELETE: un adjunto se archiva, nunca se borra.

-- ── Buckets de Storage ────────────────────────────────────────────────────
-- Los cuatro del esquema §13, todos privados. Se declaran juntos aunque hoy
-- solo se use `item-photos`: crear un bucket más tarde obliga a repetir las
-- políticas, y las políticas son lo que hay que revisar una sola vez.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('item-photos',  'item-photos',  false, 5242880, array['image/jpeg','image/png','image/webp','image/avif']),
  ('attachments',  'attachments',  false, 5242880, null),
  ('receipts',     'receipts',     false, 5242880, null),
  ('org-logos',    'org-logos',    false, 5242880, array['image/jpeg','image/png','image/webp','image/svg+xml'])
on conflict (id) do nothing;

-- ── Políticas de Storage ──────────────────────────────────────────────────
-- La ruta empieza con el organization_id, y eso es todo lo que la política
-- necesita comprobar: `is_member` sobre la primera carpeta. Simple y
-- verificable, que es justo lo que pide el esquema.
--
-- Sin política DELETE, igual que en las tablas: retirar un adjunto lo archiva
-- en `attachments`; el objeto sigue en el bucket, porque la historia de un
-- pedido no se reescribe cuando alguien borra una foto.

create policy "storage: leer solo la propia organización"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('attachments','receipts','item-photos','org-logos')
    and is_member((storage.foldername(name))[1]::uuid)
  );

create policy "storage: subir solo a la propia organización"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('attachments','receipts','item-photos','org-logos')
    and is_member((storage.foldername(name))[1]::uuid)
  );

create policy "storage: actualizar solo la propia organización"
  on storage.objects for update to authenticated
  using (
    bucket_id in ('attachments','receipts','item-photos','org-logos')
    and is_member((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id in ('attachments','receipts','item-photos','org-logos')
    and is_member((storage.foldername(name))[1]::uuid)
  );
