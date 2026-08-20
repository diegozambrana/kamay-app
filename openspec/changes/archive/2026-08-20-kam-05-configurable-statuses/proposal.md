# KAM-05 · Estados configurables por línea

## Why

Cada línea de negocio de Kamay trabaja distinto —Sublimación tiene seis estados definidos, Alfarería tres marginales, 3D un juego provisional— y forzar un flujo único rompería la herramienta desde el primer pedido. La solución del PRD es un juego de estados configurable por organización y personalizable por línea, con el `kind` declarado (`initial | in_progress | waiting | final | cancelled`) como único contrato estable: alertas, indicadores y reportes comparan por `kind`, nunca por nombre (convención nº 5). Este cambio instala esa base **antes** de que KAM-07 (tablero de pedidos) y KAM-15 (tareas) la consuman.

## What Changes

- Nueva tabla `statuses` según el esquema canónico (§ Estados): `flow` (`order`/`task`), `kind` con check, `color`, `position`, `is_queue`, alcance por organización (`business_line_id is null`) o por línea, unicidad `nulls not distinct` por `(organization_id, business_line_id, flow, name)`, y la restricción `queue_only_when_waiting` (`is_queue` solo si `kind = 'waiting'`).
- Nueva función `resolve_statuses(org, line, p_flow)`: si la línea tiene juego propio se devuelve ese completo; si no, el de la organización. La resolución vive solo en esta función; ningún servicio la reimplementa.
- Trigger de integridad sobre `statuses` (`after insert or update or delete`): todo juego activo debe conservar al menos un estado `initial` y un `final`; si queda inválido, la operación falla con excepción comprensible.
- RLS de `statuses` con el patrón del proyecto (miembros leen, escritura según rol, **sin política `DELETE`** — se archiva con `archived_at`) y trigger `audit` de `activity_log` aplicado en la misma migración.
- Servicio `StatusService` (acceso a Supabase solo desde `services/`) y Server Actions para crear, renombrar, recolorear, reordenar, archivar con reasignación y restaurar valores por defecto.
- Pantalla **V22 · Configuración de estados** (solo dueño, bajo Configuración): selector de flujo (Pedidos/Tareas) y de alcance (organización o línea), lista ordenable por arrastre, edición en el sitio, marca "columna en cola", archivar pidiendo a dónde mover lo que quedaba, restaurar valores por defecto, *usar el juego de la organización*, y el aviso "Los cambios no afectan la historia de pedidos y tareas anteriores".
- Semilla de Geeko Store: los cuatro estados de tarea (juego de organización); los seis de pedido de Sublimación (+ Cancelado, con "En cola" como única columna `is_queue`); los tres de Alfarería (+ Cancelado); el juego provisional de 3D (Registrado · En cola · Imprimiendo · Post-proceso · Listo para entrega · Entregado · Cancelado).

**Fuera de alcance** (copiado literal del backlog):
- Reglas automáticas de transición, transiciones condicionales o permisos por estado.
- Usar los estados en un tablero real; eso llega en KAM-07 y KAM-15.

## Capabilities

### New Capabilities

- `configurable-statuses`: juegos de estados por organización y por línea — tabla `statuses` con `kind` declarado e `is_queue`, resolución vía `resolve_statuses()`, integridad del juego (al menos un `initial` y un `final`), archivado con reasignación sin huérfanos, pantalla V22 de administración solo para el dueño, semilla de Geeko Store, y la regla de que ningún código compara estados por nombre.

### Modified Capabilities

_(ninguna — `activity-log` ya obliga a auditar toda tabla nueva y `tenant-isolation` ya exige RLS sin `DELETE`; `statuses` simplemente cumple ambos requisitos existentes)_

## Impact

- **Base de datos:** una migración nueva `YYYYMMDDHHMMSS_statuses.sql` (tabla, índice parcial, función `resolve_statuses`, trigger de integridad, trigger `audit`, RLS, semilla). No se edita ninguna migración existente.
- **Código de aplicación:** `services/status-service.ts`, Server Actions en `actions/`, pantalla V22 en `features/settings/` con ruta delgada en `app/`.
- **Pruebas:** unitarias (`resolve_statuses` desde el servicio, validaciones del formulario), pgTAP `status_integrity` en `supabase/tests/`, e2e `status-config.spec.ts` (personalizar Alfarería sin afectar a las otras líneas).
- **Grafo:** regenerar `graphify .` tras la migración (convención nº 6).
- **Dependencias:** **requiere KAM-04 (líneas de negocio) implementada primero** — hoy no existe la tabla `business_lines` ni la pantalla de Configuración (V15) de la que cuelga V22, ni la semilla de Geeko Store con sus cuatro líneas. Este cambio no puede aplicarse antes de que KAM-04 esté fusionada.
