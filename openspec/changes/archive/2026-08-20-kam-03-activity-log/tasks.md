# KAM-03 · Tareas — Bitácora desde el primer día

## 1. Migración de la bitácora

- [x] 1.1 Crear la migración `YYYYMMDDHHMMSS_activity_log.sql` con la tabla `activity_log` (columnas y check de `action` del esquema canónico §14) y sus cuatro índices, incluido el GIN sobre `changes`. (Spec: "Activity log table stores every audited event")
- [x] 1.2 En la misma migración, crear la función `log_activity()` `security definer` con: detección de acción (`created`/`updated`/`status_changed`/`archived`/`unarchived`), diff de solo campos cambiados ignorando `created_at`/`updated_at`, retorno sin evento cuando el diff queda vacío, y resolución de organización `coalesce(organization_id, id)` (design D2, D5). (Spec: "Every INSERT…", "Updates record only the fields that changed", "Action kind is derived…")
- [x] 1.3 Añadir a `log_activity()` la fusión de ediciones: buscar evento `updated` del mismo actor/tabla/registro dentro de 5 minutos y fusionar el diff conservando el `antes` original por clave; nunca fusionar `created`/`archived`/`unarchived`/`status_changed` (design D3). (Spec: "Successive edits by the same author are merged")
- [x] 1.4 En la misma migración: habilitar RLS en `activity_log`, política `SELECT` solo `is_owner(organization_id)`, sin políticas de escritura, y `revoke insert, update, delete … from authenticated, anon` (design D4). (Spec: "The activity log is immutable and owner-readable only")
- [x] 1.5 En la misma migración: crear el trigger `audit` (`after insert or update … for each row`) sobre `organizations` y `memberships`. (Spec: "Existing tables are audited…")

## 2. Pruebas pgTAP

- [x] 2.1 Escribir `supabase/tests/audit_trigger.test.sql` con la convención `pg_temp.login()`/`logout()` y organización propia, cubriendo: INSERT auditado → evento `created` con autor, organización y contenido (criterio 1 / escenario "Insert is logged…"); UPDATE de un campo → `changes` con solo ese campo y sus dos valores (criterio 2); UPDATE que solo toca `updated_at` → cero eventos (criterio 3).
- [x] 2.2 Ampliar `audit_trigger.test.sql`: archivado → acción `archived` y desarchivado → `unarchived`, no `updated` (criterio 4); dos ediciones del mismo usuario a 2 minutos → un solo evento con ambos cambios fusionados, y ediciones de usuarios distintos → eventos separados (criterio 5).
- [x] 2.3 Escribir `supabase/tests/activity_immutable.test.sql`: dueño no puede `UPDATE` ni `DELETE` sobre `activity_log` (criterio 6); `INSERT` directo de un autenticado rechazado; ayudante y no-miembro obtienen cero filas al leer (criterio 7).
- [x] 2.4 Ejecutar `supabase db reset` y `supabase test db`; verificar que todas las suites pgTAP (nuevas y existentes) pasan.

## 3. Procedimiento para tablas futuras

- [x] 3.1 Crear `supabase/README.md` documentando el procedimiento (fuera de `migrations/`: el CLI imprime `Skipping migration README.md...` en cada reset si el archivo vive ahí): toda tabla auditable adjunta el trigger `audit` en su propia migración de creación y su prueba pgTAP verifica al menos un evento (design D7). (Spec: escenario "The attachment procedure is documented")

## 4. Cierre

- [x] 4.1 Correr `npm run lint`, `npm run typecheck` y `npm run test:unit` para confirmar que nada del frente de aplicación se rompió (no debería haber cambios de código TS).
- [x] 4.2 Regenerar el grafo de conocimiento (`graphify .`) tras el cambio de esquema (convención nº 6).
- [x] 4.3 Verificar el checklist de "Definición de terminado" del backlog aplicable a KAM-03 y dejar el cambio listo para archivar con `openspec archive`.
