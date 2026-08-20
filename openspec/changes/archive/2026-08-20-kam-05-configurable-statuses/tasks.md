# KAM-05 · Tareas

> Prerrequisito: KAM-04 (líneas de negocio) fusionada — la migración de estados referencia `business_lines` y la semilla asume las cuatro líneas de Geeko Store.

## 1. Base de datos

- [x] 1.1 Migración `YYYYMMDDHHMMSS_statuses.sql`: tabla `statuses` con checks (`flow`, `kind`, `queue_only_when_waiting`), unicidad `nulls not distinct`, índice parcial por `(organization_id, flow, business_line_id) where archived_at is null`
- [x] 1.2 Función `resolve_statuses(org, line, p_flow)` según el esquema canónico (juego propio completo o el de la organización; excluye archivados; ordena por `position`)
- [x] 1.3 Constraint trigger diferido de integridad: todo juego activo conserva al menos un `initial` y un `final`; `raise exception` con mensaje y código propios
- [x] 1.4 Función `archive_status(status_id, move_to_status_id)`: reasigna registros dependientes y archiva en una transacción; exige destino cuando hay registros
- [x] 1.5 RLS de `statuses` (miembros leen, solo dueño escribe, sin política `DELETE`) + trigger `audit` de `activity_log`, en la misma migración
- [x] 1.6 Semilla de Geeko Store en la migración: 4 estados de tarea (organización), 7 de pedido Sublimación (En cola con `is_queue`), 4 de Alfarería, 7 provisionales de 3D
- [x] 1.7 `supabase db reset` sin error y regenerar el grafo (`graphify .`)

## 2. Pruebas pgTAP (`supabase/tests/status_integrity.test.sql`)

- [x] 2.1 Escenarios de tabla: nombre duplicado en el mismo juego rechazado; mismo nombre en juegos distintos aceptado; `is_queue` con `kind` ≠ `waiting` rechazado y con `waiting` aceptado
- [x] 2.2 Escenarios de resolución: línea sin juego propio → juego de organización; línea con juego propio → solo el suyo; archivados excluidos
- [x] 2.3 Escenarios de integridad: dejar un juego sin `final` falla; dejarlo sin `initial` falla; el juego queda como estaba
- [x] 2.4 Escenarios de archivado: `archive_status` con tabla ficticia dependiente reasigna sin huérfanos; archivar en uso sin destino se rechaza
- [x] 2.5 Escenarios de RLS y auditoría: ayudante no puede escribir; otra organización no ve filas; crear/renombrar/archivar dejan evento en `activity_log` con campos cambiados (renombrar conserva la referencia de registros antiguos)
- [x] 2.6 Escenario de semilla: tras reset, los cuatro juegos existen y `resolve_statuses` devuelve Sublimación para pedidos de esa línea y el juego de organización para tareas

## 3. Servicio y acciones

- [x] 3.1 `services/status/` (`StatusServices`): lectura vía `.rpc('resolve_statuses')`, lectura administrativa por alcance (incluye archivados), crear, actualizar, reordenar, `archive_status`, restaurar por defecto, volver al juego de organización
- [x] 3.2 Constante compartida en `lib/` con los juegos por defecto (fuente única para migración y restaurar) + prueba unitaria que la valida contra los `kind` y nombres esperados
- [x] 3.3 `actions/status/`: Server Actions con verificación de sesión, organización y rol dueño, Zod compartido, `revalidatePath`; traducción de errores del trigger a mensajes en español
- [x] 3.4 Pruebas unitarias de servicio y validaciones de formulario (escenario "comparación por `kind`": ninguna condición del código usa nombres — verificado además con búsqueda en revisión)

## 4. Pantalla V22 (`features/settings/statuses/` + `app/(app)/settings/statuses/`)

- [x] 4.1 Ruta delgada solo dueño: ayudante redirigido y sin entrada de menú
- [x] 4.2 Selector de flujo (Pedidos/Tareas) y de alcance (organización o línea); lista con nombre, color, `kind` y marca "columna en cola"; aviso "Los cambios no afectan la historia de pedidos y tareas anteriores"
- [x] 4.3 Edición en el sitio y alta de estados con validación Zod (al menos un `initial` y un `final` antes de enviar)
- [x] 4.4 Reordenar por arrastre con dnd-kit y persistencia de `position` (optimista + revalidación)
- [x] 4.5 Archivar con diálogo de reasignación; restaurar valores por defecto; *usar el juego de la organización* con confirmación
- [x] 4.6 Pruebas unitarias de los componentes con lógica (validación del juego, diálogo de reasignación)

## 5. E2E y cierre

- [x] 5.1 `tests/e2e/status-config.spec.ts`: como dueño, crear juego propio para Alfarería, editarlo, reordenar, y verificar que Sublimación, 3D y el juego de la organización quedan intactos; como ayudante, la ruta redirige
- [x] 5.2 CI completa en verde (`lint → typecheck → test:unit → test:integration → build → test:e2e`)
- [x] 5.3 Actualizar el grafo y dejar el cambio listo para archivar (`openspec archive`)
