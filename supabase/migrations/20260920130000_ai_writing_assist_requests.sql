-- KAM-30 · Cambio `task-body-writing-assist` · Límite de uso de la asistencia
-- de redacción por IA.
--
-- Un registro por solicitud a un modelo de lenguaje, para poder contar cuántas
-- hizo cada organización en el mes en curso y rechazar las que se pasan del
-- límite (proposal.md, design.md → "Límite de uso: tabla de solicitudes +
-- vista, no un contador"). Un contador en `organizations` sería exactamente el
-- dato derivado que la convención nº 4 prohíbe.
--
-- No lleva el trigger `audit`: no es una tabla cuyo historial le importe a la
-- persona que usa el taller (supabase/README.md → "Qué se audita y qué no"),
-- es telemetría interna, igual que `activity_log` no se audita a sí misma. Por
-- la misma razón no se archiva: es un registro de uso que se conserva tal
-- cual, sin la maquinaria de `archived_at`.

create table ai_writing_assist_requests (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  requested_by    uuid not null references auth.users(id),
  requested_at    timestamptz not null default now()
);

create index on ai_writing_assist_requests (organization_id, requested_at);

grant select, insert on ai_writing_assist_requests to authenticated;

revoke update, delete on ai_writing_assist_requests from authenticated, anon, service_role;
revoke insert on ai_writing_assist_requests from anon, service_role;
grant select on ai_writing_assist_requests to service_role;

alter table ai_writing_assist_requests enable row level security;

create policy "ai_writing_assist_requests: leer si es miembro"
  on ai_writing_assist_requests for select to authenticated
  using (is_member(organization_id));

create policy "ai_writing_assist_requests: crear si es miembro"
  on ai_writing_assist_requests for insert to authenticated
  with check (is_member(organization_id) and requested_by = auth.uid());

-- Sin política UPDATE ni DELETE: una solicitud contada no se corrige ni se
-- retira, igual que un evento de `activity_log`.

-- ── Cuánto se usó, por organización y por mes ──────────────────────────────
-- Vista y no columna (convención nº 4): el conteo se deriva de las filas, no
-- se guarda en ningún lado. `security_invoker = true` para que respete la
-- misma RLS de lectura que la tabla.

create view ai_writing_assist_usage_by_period
  with (security_invoker = true) as
  select
    organization_id,
    date_trunc('month', requested_at) as period_start,
    count(*)::int as request_count
  from ai_writing_assist_requests
  group by organization_id, date_trunc('month', requested_at);

grant select on ai_writing_assist_usage_by_period to authenticated;
