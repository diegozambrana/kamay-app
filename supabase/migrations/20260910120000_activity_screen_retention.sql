-- KAM-22 · Bitácora: índices de la pantalla, purga de retención y bucket de
-- exportaciones. No toca `activity_log`, su `check` ni `log_activity()`: los
-- creó KAM-03 y esta tarea solo los lee.
-- Decisiones: openspec/changes/kam-22-activity-screen-retention/design.md D3, D7, D8.

-- ── Índices para los filtros de V23 (D3) ──────────────────────────────────
-- Los cuatro de KAM-03 no cubren ni el filtro por autor ni el de acción, y
-- ninguno incluye `id`, que es lo que la paginación por cursor necesita para
-- desempatar dos eventos del mismo instante.

create index activity_log_org_occurred_id_idx
  on activity_log (organization_id, occurred_at desc, id desc);

create index activity_log_org_actor_occurred_idx
  on activity_log (organization_id, actor_id, occurred_at desc);

-- `action` tiene cinco valores y por sí sola no justificaría un índice; con la
-- organización delante y el orden detrás sí, porque «enséñame los archivados»
-- es el filtro más selectivo de la pantalla y el que peor se comporta sin él.
create index activity_log_org_action_occurred_idx
  on activity_log (organization_id, action, occurred_at desc);

-- El índice de KAM-03 queda cubierto por prefijo por el primero de arriba.
-- Se retira, no se edita su migración: la bitácora recibe una escritura por
-- cada operación del sistema y un índice redundante se paga en cada alta.
drop index activity_log_organization_id_occurred_at_idx;

-- ── Purga de retención (D7) ───────────────────────────────────────────────
-- La única excepción a la inmutabilidad de la bitácora, y está acotada aquí:
-- pone `changes` a null y nada más. Sin `delete`, sin tocar ninguna otra
-- columna. Quién hizo qué, a qué registro y cuándo es permanente.
--
-- Vive en la base y no solo en la aplicación porque «`authenticated` no puede
-- vaciar un evento» tiene que ser una regla del esquema, comprobable por
-- pgTAP, y no una promesa del código que la llama.
--
-- La exportación previa no está aquí: Postgres no escribe en Storage sin
-- `pg_net` y sin guardar una clave dentro de la base. La orquestación
-- —exportar, verificar y solo entonces llamar a esta función— vive en
-- services/activity/retention-service.ts.

create or replace function purge_activity_detail(
  p_organization uuid,
  p_cutoff       timestamptz
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  update activity_log
     set changes = null
   where organization_id = p_organization
     and occurred_at < p_cutoff
     and changes is not null;

  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Postgres concede `execute` a `public` por defecto en toda función nueva.
-- Retirarlo es lo que hace que ni el dueño pueda purgar su propia bitácora.
revoke execute on function purge_activity_detail(uuid, timestamptz)
  from public, authenticated, anon;

grant execute on function purge_activity_detail(uuid, timestamptz)
  to service_role;

-- ── Bucket de exportaciones de retención (D8) ─────────────────────────────
-- Privado y **sin política para `authenticated`**: solo el service role
-- escribe y lee.
--
-- No reutiliza `attachments` a propósito. Las políticas de KAM-06b dan lectura
-- a `is_member(...)` —cualquier miembro de la organización, ayudantes
-- incluidos—, y un volcado de la bitácora en ese bucket entregaría en un solo
-- archivo exactamente lo que la RLS de `activity_log` le niega fila por fila.
-- Las tres políticas de `storage.objects` enumeran los cuatro buckets de
-- KAM-06b por su nombre, así que este queda fuera sin escribir nada más.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('activity-exports', 'activity-exports', false, 104857600, array['text/csv'])
on conflict (id) do nothing;
