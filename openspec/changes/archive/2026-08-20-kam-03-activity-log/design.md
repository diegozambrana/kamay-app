# KAM-03 · Diseño — Bitácora desde el primer día

## Context

Hoy existen solo `organizations` y `memberships` (migración `20260820100000_tenants.sql`), con RLS activa, `is_member()`/`is_owner()` y sin políticas `DELETE`. El esquema canónico define `activity_log`, la función `log_activity()` y sus políticas en `specs/PRD/kamay-esquema-base-de-datos-supabase.md` §14 y §16. Las pruebas pgTAP existentes (`supabase/tests/rls_isolation.test.sql`) ya establecen la convención de simular usuarios con `pg_temp.login()`/`logout()` sobre `request.jwt.claims`. Motivación: ver `proposal.md` — Why. Requisitos: ver el delta spec `activity-log`.

## Goals / Non-Goals

**Goals:**
- Una sola migración nueva que deje la auditoría completa y activa sobre las tablas existentes.
- Que el trigger sea genérico de verdad: aplicable sin cambios a cualquier tabla futura con `organization_id`, `status_id` o `archived_at` opcionales.
- Inmutabilidad garantizada por privilegios de base de datos, no por código de aplicación.

**Non-Goals:**
- Ninguna superficie de aplicación (pantalla, servicio, action, store) — V23 llega en KAM-22.
- Retención/purga y exportación (pg_cron) — KAM-22.
- Auditar tablas que aún no existen; solo se documenta el procedimiento.

## Decisions

### D1 · Una migración única `..._activity_log.sql`

El orden canónico del PRD ubica la bitácora en "012", pero este proyecto crea tablas incrementalmente por tarea. Se crea una migración nueva con timestamp (convención nº 6) que contiene: tabla + índices + función + triggers + RLS + revocaciones. Alternativa descartada: separar RLS a una migración posterior "al final y de una sola vez" (§18 del PRD) — para `activity_log` la seguridad **es** el requisito central de la tarea y no puede quedar pendiente; la revisión global de RLS igual ocurrirá en KAM-23.

### D2 · Resolución de `organization_id` dentro del trigger

El esquema canónico toma `v_new->>'organization_id'`, pero `organizations` no tiene esa columna: su identidad es `id`. El trigger resuelve `v_org := coalesce((v_new->>'organization_id')::uuid, (v_new->>'id')::uuid)`. Esto mantiene el trigger genérico para toda tabla futura (todas llevan `organization_id` por convención nº 2) y cubre a `organizations` sin caso especial por nombre de tabla.

### D3 · Fusión de ruido dentro del propio trigger

Antes de insertar un evento `updated`, la función busca el evento más reciente del mismo `actor_id`, `table_name` y `record_id` con acción `updated` y `occurred_at > now() - interval '5 minutes'`; si existe, hace `changes = changes || v_changes` sobre ese evento (los diffs nuevos pisan la clave repetida, conservando el `antes` más antiguo por clave solo si la clave no existía). `created`, `archived`, `unarchived` y `status_changed` nunca se fusionan ni sirven de destino de fusión. Alternativa descartada: fusionar en la lectura (vista) — dejaría el ruido almacenado y la pantalla de KAM-22 tendría que repetir la lógica.

Detalle del merge por clave: si la clave ya existe en el evento previo se conserva su `antes` original y se toma el `despues` nuevo; si no existe, se copia el par completo. Así el evento fusionado representa el diff neto de la ventana.

### D4 · `security definer` + revocación de privilegios

`log_activity()` es `security definer` (dueño `postgres`) con `set search_path = public`: puede insertar y fusionar aunque `authenticated`/`anon` tengan `INSERT/UPDATE/DELETE` revocados sobre `activity_log`. La política de `SELECT` usa `is_owner(organization_id)`. No existe ninguna política de escritura — la inmutabilidad no depende de RLS sino de `revoke`, que es más difícil de deshacer por accidente.

**Corrección hallada al implementar:** las imágenes recientes de Supabase ya no otorgan privilegios DML por defecto a `anon`/`authenticated`/`service_role` en `public` (el default ACL del esquema concede solo `Dxtm`). El privilegio de lectura hay que concederlo explícitamente, como ya hace la migración de KAM-02: `grant select on activity_log to authenticated, service_role`. El `revoke` de escritura se conserva de todos modos — declara la intención y protege ante un `grant` futuro demasiado amplio. A `service_role` se le concede solo lectura, no `all`: la purga de retención de KAM-22 pedirá su propio privilegio cuando llegue.

### D5 · Diff con `jsonb_each` e ignorados fijos

El diff se calcula con `jsonb_each(v_new)` filtrando `is distinct from` y excluyendo `array['updated_at','created_at']`, exactamente como el canónico. Si el diff queda vacío (`v_changes is null`), el trigger retorna sin insertar — esto cubre el criterio 3 (tocar solo `updated_at` no genera evento).

### D6 · `origin` desde cabecera, tolerante a ausencia

`origin` se toma de `current_setting('request.headers', true)::json->>'x-client-origin'` y queda `null` cuando la cabecera no existe (pgTAP, seeds). Ningún criterio depende de él en esta tarea.

### D7 · Procedimiento documentado para tablas futuras

El procedimiento vive en `supabase/README.md` (nuevo; fuera de `migrations/`, donde el CLI advierte `Skipping migration README.md...` en cada reset): toda tabla auditable adjunta `create trigger audit after insert or update on <tabla> for each row execute function log_activity();` **en su propia migración de creación**, y su prueba pgTAP incluye al menos un assert de que el insert genera evento. Alternativa descartada: un helper `apply_audit(regclass)` — una línea de SQL no justifica indirección.

### D8 · Pruebas pgTAP en dos archivos

- `audit_trigger.test.sql`: criterios 1–5 (created con autor/organización/contenido, diff de un solo campo, no-evento con `updated_at`, `archived` vs `updated`, fusión a 2 minutos y no-fusión entre actores). Para la fusión se manipula `occurred_at` del evento previo vía `postgres` (permitido: el revoke aplica a roles de aplicación) o se hacen dos updates consecutivos reales dentro de la ventana.
- `activity_immutable.test.sql`: criterios 6–7 (dueño no puede `UPDATE`/`DELETE`, insert directo rechazado, ayudante lee cero filas, no-miembro lee cero filas).

Ambos siguen la convención existente `pg_temp.login()`/`logout()` y crean su propia organización.

## Risks / Trade-offs

- [El diff `jsonb` compara la fila completa serializada] → columnas jsonb grandes (`settings`) generan diffs voluminosos; aceptable ahora, la retención de KAM-22 vacía `changes` antiguos.
- [La fusión hace un `UPDATE` sobre `activity_log` desde el trigger] → es la única vía de mutación y vive en función `security definer`; la prueba de inmutabilidad verifica que ningún rol de aplicación puede hacerlo directamente.
- [`security definer` con búsqueda de eventos por actor/tabla/registro en cada UPDATE] → costo de una consulta indexada extra por escritura; el índice `(table_name, record_id, occurred_at desc)` la cubre.
- [Tablas futuras podrían olvidar el trigger] → el procedimiento documentado exige el trigger en la migración de creación y su prueba pgTAP; KAM-23 añade la verificación global.
- [`memberships.record_id`: la fila auditada de `organizations` usa `id` como organización] → cubierto por D2; la prueba de `organizations` asegura que el evento queda con la organización correcta.

## Migration Plan

1. Nueva migración `YYYYMMDDHHMMSS_activity_log.sql` (tabla, índices, función, triggers, RLS, revocaciones).
2. `supabase db reset` local; correr `supabase test db`.
3. Regenerar el grafo (`graphify .`) tras el cambio de esquema.
4. Rollback: nueva migración inversa si hiciera falta (nunca editar la existente); antes de datos reales, el costo es nulo.
