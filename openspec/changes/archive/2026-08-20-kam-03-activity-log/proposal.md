# KAM-03 · Bitácora desde el primer día

## Why

Kamay exige que todo lo que muestre "qué pasó aquí" lea de un único historial (`activity_log`), y un historial no se reconstruye hacia atrás: si la bitácora no está activa antes de que entre la primera fila real de datos, ese primer mes se pierde para siempre. KAM-02 dejó `organizations` y `memberships` operativas; este cambio instala la auditoría genérica **ahora**, antes de que KAM-04 en adelante creen las tablas de negocio.

## What Changes

- Nueva tabla `activity_log` (identidad `bigint`, `organization_id`, `business_line_id`, `actor_id`/`actor_label`, `table_name`, `record_id`, `action`, `changes` jsonb, `origin`, `occurred_at`) con sus cuatro índices del esquema canónico (§14).
- Nueva función de trigger genérica `log_activity()` (`security definer`): detecta `created`, `updated`, `status_changed`, `archived` y `unarchivado` (`unarchived`); guarda **solo** los campos modificados con valor anterior y nuevo; ignora `created_at` y `updated_at`; si nada relevante cambió, no inserta evento.
- Fusión de ruido: dos ediciones `updated` del mismo actor sobre el mismo registro dentro de 5 minutos se consolidan en un solo evento; `created`, `archived`, `unarchived` y `status_changed` nunca se fusionan.
- RLS de la bitácora: `SELECT` solo para el dueño de la organización (`is_owner`); `INSERT`, `UPDATE` y `DELETE` revocados para `authenticated` y `anon` — ni el dueño puede alterarla; las inserciones solo ocurren vía el trigger.
- Aplicación del trigger `audit` a las tablas existentes `organizations` y `memberships`.
- Procedimiento documentado (en el propio cambio y en `openspec/specs/`) para que toda tabla futura auditable reciba el trigger en su migración de creación.

**Fuera de alcance** (copiado literal del backlog):
- La pantalla de bitácora (V23) y los filtros — llegan en KAM-22.
- La política de retención y su purga — llega en KAM-22.
- Registros técnicos de fallas del sistema; no forman parte de este módulo.

## Capabilities

### New Capabilities

- `activity-log`: registro inmutable de actividad — tabla `activity_log`, trigger genérico `log_activity()` con detección de acción y diff de campos, fusión de ediciones sucesivas, RLS de solo-lectura para el dueño y escritura revocada, y la obligación de aplicar el trigger a toda tabla auditable presente y futura.

### Modified Capabilities

_(ninguna — `tenant-isolation`, `user-auth` y `project-foundation` no cambian sus requisitos; la nueva tabla simplemente cumple las convenciones ya especificadas: RLS activa y sin política DELETE)_

## Impact

- **Base de datos:** una migración nueva `YYYYMMDDHHMMSS_activity_log.sql` (tabla, índices, función, triggers en `organizations` y `memberships`, RLS y revocaciones). No se edita ninguna migración existente.
- **Pruebas:** pgTAP `audit_trigger` y `activity_immutable` en `supabase/tests/`, cubriendo los siete criterios de aceptación de KAM-03.
- **Código de aplicación:** ninguno — no hay pantalla, servicio ni store en este cambio.
- **Grafo:** regenerar `graphify .` tras la migración (convención nº 6).
- **Dependencias:** requiere KAM-02 archivado (hecho); KAM-04+ dependerán del procedimiento documentado aquí para auditar sus tablas nuevas.
