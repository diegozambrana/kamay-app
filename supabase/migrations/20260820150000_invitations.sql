-- KAM-04 · Invitaciones: cómo entra alguien al equipo sin registro público.
-- Modelo: specs/PRD/kamay-esquema-base-de-datos-supabase.md §6 (Invitaciones), §16.
-- El dueño genera un enlace de un solo uso y lo entrega por su medio habitual;
-- quien lo abre crea su cuenta y queda con la membresía que el dueño le asignó.

create table invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  email           text not null,
  role            text not null check (role in ('owner','assistant')),
  token_hash      bytea not null,           -- sha256 del token; el token en claro nunca se guarda
  expires_at      timestamptz not null,
  accepted_at     timestamptz,
  invited_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  archived_at     timestamptz               -- revocar es archivar
);

-- Una sola invitación pendiente por correo y organización. Aceptada, revocada
-- o caducada deja de estorbar: se puede volver a invitar.
create unique index on invitations (organization_id, lower(email))
  where accepted_at is null and archived_at is null;

-- La aceptación busca por hash; es la única lectura que ocurre fuera de RLS.
create index on invitations (token_hash);

create trigger audit after insert or update on invitations
  for each row execute function log_activity();

-- ── Aceptación ────────────────────────────────────────────────────────────
-- Es una función y no una política porque quien acepta todavía no es miembro:
-- ninguna política de `memberships` podría dejarlo insertarse a sí mismo.

create or replace function accept_invitation(p_token text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_invitation invitations;
  v_email text;
begin
  v_email := auth.email();
  if v_email is null then
    raise exception 'La invitación no es válida' using errcode = 'check_violation';
  end if;

  select * into v_invitation
  from invitations i
  where i.token_hash = sha256(convert_to(p_token, 'utf8'))
  limit 1;

  -- Un solo mensaje para todos los fallos: token inexistente, revocado,
  -- caducado, ya usado o de otra persona. La ruta no debe delatar qué
  -- invitaciones existen ni a quién fueron dirigidas.
  if v_invitation.id is null
     or v_invitation.archived_at is not null
     or v_invitation.accepted_at is not null
     or v_invitation.expires_at <= now()
     or lower(v_invitation.email) is distinct from lower(v_email) then
    raise exception 'La invitación no es válida' using errcode = 'check_violation';
  end if;

  -- Quien ya estuvo en la organización y fue archivado vuelve con el rol
  -- de la invitación, no con el que tenía antes.
  insert into memberships (organization_id, user_id, role)
  values (v_invitation.organization_id, auth.uid(), v_invitation.role)
  on conflict (organization_id, user_id) do update
    set role = excluded.role,
        archived_at = null;

  update invitations set accepted_at = now() where id = v_invitation.id;

  return v_invitation.organization_id;
end $$;

grant execute on function accept_invitation(text) to authenticated;

-- ── Guardia del último dueño ──────────────────────────────────────────────
-- Una organización sin dueño activo es irrecuperable desde la interfaz: nadie
-- podría volver a invitar ni a cambiar roles. La regla vive en la base.

create or replace function guard_last_owner()
returns trigger
language plpgsql as $$
begin
  if old.archived_at is null
     and new.archived_at is not null
     and old.role = 'owner'
     and not exists (
       select 1 from memberships m
       where m.organization_id = old.organization_id
         and m.role = 'owner'
         and m.archived_at is null
         and m.id <> old.id
     ) then
    raise exception 'La organización debe conservar al menos un dueño activo'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

create trigger guard_last_owner before update on memberships
  for each row execute function guard_last_owner();

-- ── Privilegios y RLS ─────────────────────────────────────────────────────
-- Las invitaciones son asunto del dueño: el ayudante no las ve ni las crea.
-- (Matriz de acceso §16.) Revocar es archivar, nunca borrar.

grant select, insert, update on invitations to authenticated;
revoke delete on invitations from authenticated, anon, service_role;
revoke insert, update on invitations from anon;
revoke insert, update on invitations from service_role;
grant select on invitations to service_role;

alter table invitations enable row level security;

create policy "invitations: leer solo el dueño"
  on invitations for select to authenticated
  using (is_owner(organization_id));

create policy "invitations: crear solo el dueño"
  on invitations for insert to authenticated
  with check (is_owner(organization_id));

create policy "invitations: editar solo el dueño"
  on invitations for update to authenticated
  using (is_owner(organization_id))
  with check (is_owner(organization_id));

-- Sin política DELETE: revocar archiva.
