-- KAM-02 · Tenant model: organizations, memberships, membership helpers and RLS.
-- Canonical DDL: specs/PRD/kamay-esquema-base-de-datos-supabase.md §5, §16.

-- Organizations (tenants)
create table organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  logo_path     text,
  currency      text not null default 'BOB',
  timezone      text not null default 'America/La_Paz',
  settings      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  archived_at   timestamptz
);

-- Membership: which user belongs to which organization, and with which role
create table memberships (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  user_id         uuid not null references auth.users(id),
  role            text not null check (role in ('owner','assistant')),
  display_name    text,
  created_at      timestamptz not null default now(),
  archived_at     timestamptz,
  unique (organization_id, user_id)
);

create index on memberships (user_id) where archived_at is null;

-- Privilegios explícitos: las imágenes recientes de Supabase ya no otorgan
-- privilegios por defecto a `authenticated`. Quien restringe es RLS:
-- DELETE queda concedido a nivel de tabla pero sin política, afecta cero filas.
grant select, insert, update, delete on organizations, memberships to authenticated;
grant all on organizations, memberships to service_role;

-- Security helper functions: the basis of every RLS policy in the system.
create or replace function is_member(org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.organization_id = org
      and m.user_id = auth.uid()
      and m.archived_at is null
  );
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
  );
$$;

-- RLS. Writes on tenant tables are owner-only (access matrix §16);
-- there is deliberately no DELETE policy anywhere: records are archived, never deleted.
alter table organizations enable row level security;

create policy "organizations: leer si es miembro"
  on organizations for select to authenticated
  using (is_member(id));

-- New organizations are created by seed/admin (service role); is_owner(id) is
-- always false for a row that does not exist yet, so this blocks all client inserts.
create policy "organizations: crear solo el dueño"
  on organizations for insert to authenticated
  with check (is_owner(id));

create policy "organizations: editar solo el dueño"
  on organizations for update to authenticated
  using (is_owner(id))
  with check (is_owner(id));

alter table memberships enable row level security;

create policy "memberships: leer si es miembro"
  on memberships for select to authenticated
  using (is_member(organization_id));

create policy "memberships: crear solo el dueño"
  on memberships for insert to authenticated
  with check (is_owner(organization_id));

create policy "memberships: editar solo el dueño"
  on memberships for update to authenticated
  using (is_owner(organization_id))
  with check (is_owner(organization_id));

-- Sin política DELETE: nada se elimina en Kamay.
