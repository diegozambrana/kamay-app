# KAM-05 · Diseño

## Context

Motivación en `proposal.md`; requisitos verificables en `specs/configurable-statuses/spec.md`. Estado actual del repositorio: existen `organizations`, `memberships` (KAM-02) y `activity_log` con su procedimiento de auditoría (KAM-03). **`business_lines` aún no existe** — KAM-05 depende de KAM-04 y no puede aplicarse antes. El esquema canónico de `statuses`, `resolve_statuses()` y la semilla están definidos en `specs/PRD/kamay-esquema-base-de-datos-supabase.md` (§ Estados y § Semilla); la pantalla V22 en la especificación de producto §V22. Restricciones de la constitución que gobiernan este cambio: comparación por `kind` (nº 5), RLS sin `DELETE` (nº 2–3), migraciones solo nuevas con pgTAP (nº 6), auditoría universal (nº 7), acceso a Supabase solo desde `services/` (nº 1).

## Goals / Non-Goals

**Goals:**

- Instalar el modelo de estados completo (tabla, resolución, integridad, semilla) de una sola vez, para que KAM-07 y KAM-15 lo consuman sin tocar el esquema.
- Dejar la administración (V22) usable por el dueño de punta a punta: crear juego propio, editar, reordenar, archivar con reasignación, restaurar, volver al juego de la organización.
- Que la reasignación al archivar sea genérica aunque hoy no exista ninguna tabla que referencie estados (`orders` y `tasks` llegan después).

**Non-Goals:**

- Transiciones automáticas, condicionales o permisos por estado (fuera de alcance del backlog).
- Tableros que consuman los estados (KAM-07, KAM-15).
- La numeración de posición en cola por antigüedad — `is_queue` se almacena y se administra aquí; el comportamiento de orden lo implementa el tablero de KAM-07.

## Decisions

1. **Una sola migración `statuses`** con tabla, índice parcial, `resolve_statuses()`, trigger de integridad, trigger `audit`, RLS y semilla. Alternativa considerada: separar semilla en migración propia; se descarta porque el patrón del proyecto (KAM-02/03) es una migración por cambio y la semilla de líneas ya vivirá en la migración de KAM-04, a la que esta añade solo estados.

2. **Trigger de integridad como constraint trigger `AFTER … DEFERRABLE INITIALLY DEFERRED` por sentencia**, verificando el juego completo afectado (org + línea + flujo) al final de la transacción. Razón: "restaurar valores por defecto" y "usar el juego de la organización" archivan y crean estados en varias sentencias; validar por fila haría imposible cualquier reordenamiento del juego. Alternativa (validar por fila con `AFTER` simple): rechazada porque bloquearía operaciones legítimas intermedias.

3. **La reasignación al archivar vive en una función SQL `archive_status(status_id, move_to_status_id)`** ejecutada dentro de una transacción: actualiza los registros dependientes y archiva el estado. Hoy no hay tablas dependientes; la función consulta dinámicamente las tablas que referencien `statuses` cuando existan (KAM-07/15 la extienden). Razón: mantener la garantía "ningún huérfano" en la base de datos, no repartida por servicios. El servicio solo la invoca y traduce errores a mensajes de formulario.

4. **`resolve_statuses()` es la única vía de lectura de juegos vigentes.** `StatusServices` la llama vía `.rpc()`; la pantalla V22, en cambio, lee la tabla directa (necesita ver también el juego de la organización cuando edita una línea, y los archivados). Esto respeta que la resolución no se reimplemente en TypeScript.

5. **"Restaurar valores por defecto" reutiliza la definición de la semilla** exportada como constante en `lib/` (fuente única compartida entre la migración y la acción de restaurar). El restaurar archiva los estados actuales del alcance (con reasignación si hay registros) y crea el juego por defecto. Alternativa (borrar y recrear): prohibida — no existe `DELETE`.

6. **Reordenamiento por arrastre con dnd-kit** (ya previsto por ARCHITECTURE.md para tableros) y persistencia de `position` en una sola Server Action que recibe la lista ordenada de ids. Optimista en el cliente (Zustand local de la pantalla), con revalidación al confirmar.

7. **Rutas y capas** según la constitución: `app/(app)/settings/statuses/page.tsx` delgada → `actions/status/` (verifica rol dueño antes de mutar) → `services/status/` (`StatusServices`, cliente inyectado) → `features/settings/statuses/` (pantalla, hooks, store). Zod compartido entre formulario y acción.

## Risks / Trade-offs

- [El trigger de integridad diferido puede dejar mensajes de Postgres crípticos al usuario] → la función del trigger lanza `raise exception` con mensaje propio y código estable; las acciones lo traducen a texto de formulario en español.
- [`archive_status` genérica sin tablas dependientes aún es difícil de probar "de verdad"] → la prueba pgTAP `status_integrity` crea una tabla ficticia con FK a `statuses` en el esquema de prueba para verificar la reasignación; KAM-07/15 añadirán pruebas sobre tablas reales.
- [La semilla duplicada entre SQL y constante TypeScript puede divergir] → una prueba unitaria compara la constante con lo sembrado (fixture generado desde la migración) o, como mínimo, la prueba e2e de "restaurar valores por defecto" verifica nombres y `kind` esperados.
- [KAM-04 no está implementada] → este cambio queda propuesto pero no aplicable; la migración de estados debe fecharse posterior a la de `business_lines` y la semilla asume las cuatro líneas de Geeko Store ya creadas.

## Migration Plan

1. Fusionar KAM-04 (prerrequisito).
2. Migración nueva `YYYYMMDDHHMMSS_statuses.sql` + prueba pgTAP `status_integrity.test.sql`; `supabase db reset` local.
3. Código de aplicación (servicio → acciones → pantalla) con sus pruebas unitarias y e2e.
4. Regenerar el grafo (`graphify .`).
5. Rollback: como siempre, ninguna migración se revierte editándola; un error se corrige con una migración nueva.

## Open Questions

- ¿El juego provisional de 3D debe poder marcarse visualmente como "provisional" en V22? El PRD no lo pide; se asume que no y que el método de los 10 encargos es disciplina de uso, no del sistema.
