-- KAM-27 · Cambio `tenant-tools-registry` · Herramientas activas por organización.
--
-- Una **herramienta** es una utilidad opcional que el núcleo no trae (la
-- primera: la calculadora de costo de impresión 3D). Qué herramientas existen
-- y qué hacen lo decide el código (`tools/registry.ts`); la base solo guarda
-- **cuál** está activa para cada organización y **con qué parámetros**.
-- Spec `tenant-tools`; design D4.

-- ── La tabla ──────────────────────────────────────────────────────────────
-- Una fila por organización y herramienta. `slug` no es una clave foránea: el
-- registro vive en el código, y una fila cuyo slug ya no existe allí
-- simplemente se ignora (spec → *Herramienta retirada del registro*).
--
-- `config` guarda parámetros, nunca resultados (convención nº 4). Desactivar
-- es archivar: la fila se queda, con sus parámetros, para que reactivar los
-- devuelva intactos.
--
-- `id` es generable en el cliente como en el resto del esquema (convención
-- nº 9), aunque hoy activar una herramienta no ocurra sin conexión.

create table organization_tools (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  slug            text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  config          jsonb not null default '{}'::jsonb
                    check (jsonb_typeof(config) = 'object'),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  archived_at     timestamptz,
  unique (organization_id, slug)
);

-- Procedimiento de supabase/README.md: el trigger se adjunta en la misma
-- migración que crea la tabla. Activar, cambiar parámetros, desactivar y
-- reactivar quedan así en la bitácora sin una línea más.
create trigger audit after insert or update on organization_tools
  for each row execute function log_activity();

-- ── Privilegios y RLS ─────────────────────────────────────────────────────
-- **No es el patrón de configuración de siempre**, y es a propósito: los
-- parámetros de una herramienta pueden llevar tarifas y márgenes, que en Kamay
-- son solo del dueño (como `expenses`). Con lectura de miembro, el ayudante
-- los obtendría con una consulta directa aunque la pantalla se los oculte.

grant select, insert, update on organization_tools to authenticated;
revoke delete on organization_tools from authenticated, anon, service_role;
revoke insert, update on organization_tools from anon, service_role;
grant select on organization_tools to service_role;

alter table organization_tools enable row level security;

create policy "organization_tools: leer solo el dueño"
  on organization_tools for select to authenticated
  using (is_owner(organization_id));

create policy "organization_tools: crear solo el dueño"
  on organization_tools for insert to authenticated
  with check (is_owner(organization_id));

create policy "organization_tools: editar solo el dueño"
  on organization_tools for update to authenticated
  using (is_owner(organization_id))
  with check (is_owner(organization_id));

-- ── Qué está activo, y nada más ───────────────────────────────────────────
-- El menú del ayudante tiene que saber qué herramientas mostrar, pero no con
-- qué parámetros trabajan. Esta función salta la política de lectura
-- (`security definer`) y por eso lleva su propia compuerta: para quien no es
-- miembro de la organización devuelve cero filas, igual que haría la RLS.

create function active_tool_slugs(p_organization_id uuid)
returns setof text
language sql stable security definer set search_path = public as $$
  select t.slug
  from organization_tools t
  where t.organization_id = p_organization_id
    and t.archived_at is null
    and is_member(p_organization_id)
  order by t.slug;
$$;

revoke all on function active_tool_slugs(uuid) from public, anon;
grant execute on function active_tool_slugs(uuid) to authenticated;
