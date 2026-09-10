> Cada tarea de prueba nombra los escenarios del delta spec que cubre (convención nº 12: ningún escenario sin prueba referenciada). Los escenarios viven en `specs/task-links-deliverables/spec.md`, `specs/tasks/spec.md`, `specs/orders/spec.md`, `specs/catalog-directory/spec.md` y `specs/assets/spec.md` de este cambio. Las decisiones citadas (D1–D8) son las de `design.md`.
>
> Los escenarios que los deltas de `tasks`, `orders` y `catalog-directory` arrastran sin cambio —los que ya estaban en la capacidad y se copian por exigencia del formato MODIFIED— conservan las pruebas que KAM-06, KAM-07 y KAM-15 les dieron; abajo solo se nombran los que este cambio añade o altera.
>
> **Orden:** el grupo 1 no depende de nada y absorbe la mitad de las pruebas unitarias. Los grupos 2 y 3 son la base de datos. Del 4 en adelante ya se puede probar contra los vínculos que KAM-15 escribe. El asistente (grupos 7 y 8) va al final porque necesita todo lo anterior.

## 0. Condición de arranque

- [x] 0.1 Verificar que KAM-15 y KAM-16 están fusionados: existen `tasks` con `closed_without_deliverables`, `task_links` con su trigger `validate_task_link()` y sus políticas, `services/tasks/task-service.ts` con `link()`, `actions/tasks.ts` y el detalle en `app/(app)/tasks/[id]/`. Si falta algo, detenerse.
- [x] 0.2 ~~Confirmar que **no hace falta ningún `alter table` sobre `tasks` ni sobre `task_links`**~~ **Corregido al implementar (4.2):** `task_links` nació sin `archived_at` y sin política `DELETE`, así que *quitar un vínculo* era imposible. La migración le añade `archived_at`, cambia su `unique` por un índice parcial sobre las vigentes y le pone `enforce_archive`, siguiendo el precedente que KAM-15 fijó para `membership_lines`. `tasks` sigue sin tocarse: la afirmación original valía: `closed_without_deliverables` ya existe y el `check` de `task_links` ya admite los cinco tipos. Si al implementar aparece la necesidad de alterarlas, detenerse y revisar el diseño antes de escribirlo.
- [x] 0.3 Re-listar `openspec/changes/`: KAM-17 a KAM-20 ya se archivaron y KAM-22 y KAM-23 siguen vivas. Confirmar que el requisito `Pantalla de detalle de ítem (V11)` del spec principal ya trae los escenarios de inventario (KAM-18) y de activo (KAM-19), y que el delta de este cambio los conserva. Si KAM-22 o KAM-23 reclamaran alguno de los requisitos que este cambio modifica, detenerse y coordinar.
- [x] 0.4 Confirmar que **KAM-19 está archivada y `asset_details` existe**, que `20260908170000_asset_recovery.sql` ya reemplazó `validate_task_link()` para validar la rama `asset`, y que las tres políticas de `asset_details` van bajo `is_owner()`. El activo entra en esta tarea (supuesto 2 revisado) con la reserva de rol del supuesto 9. **No** escribir ninguna migración que toque `validate_task_link()`.

## 1. Dominio de entregables y prellenado

- [x] 1.1 Crear `lib/tasks/deliverables.ts` con los seis tipos del esquema como dominio, cada uno declarando qué registro crea (tabla, `kind` o rol), qué formulario abre y qué rol hace falta para ofrecerlo (D6). El activo entra con `ownerOnly: true`; los otros cinco, sin reserva.
- [x] 1.2 Añadir `prefillFor(type, task)`: función pura que devuelve los valores iniciales del formulario de cada tipo a partir del título, la línea, el cuerpo y los adjuntos de la tarea (D6). Sin red, sin React.
- [x] 1.3 Añadir `needsClosingWizard(statusKind, deliverables)`: verdadero solo si el tipo del estado destino es `final` y queda al menos un entregable declarado sin cumplir (D7). Comparar por `kind`, nunca por nombre.
- [x] 1.4 Añadir el cálculo puro de la marca: «quedó al menos un entregable sin cumplir **y** no se creó ninguno», para que la interfaz y la RPC coincidan en qué significa (D3, supuesto 8).
- [x] 1.5 `lib/tasks/deliverables.test.ts`: cubre *Una tarea declara qué debe existir al terminarla* → «El ayudante no puede declarar un activo»; *El asistente ofrece un formulario prellenado por entregable* → «Dos entregables, dos formularios prellenados» en su parte pura; *Entrar en un estado final con entregables pendientes abre el asistente* → «Sin entregables se cierra directo», «La decisión se toma por el tipo del estado», «Retroceder no abre nada»; y *Cerrar sin entregables deja una marca discreta y localizable* → «Sin entregables declarados no hay marca», «Crear alguno evita la marca».

## 2. Migración de `task_deliverables`

- [x] 2.1 Crear `supabase/migrations/<timestamp>_task_deliverables.sql` con la tabla del DDL canónico (§12) más `organization_id`, documentando esa desviación con el mismo motivo que KAM-15 dio para `task_tags` (D1).
- [x] 2.2 Añadir sus índices, sus `grant`/`revoke` sin `DELETE` para `authenticated`, `anon` y `service_role`, y su trigger `audit` con `log_activity()`.
- [x] 2.3 Activar RLS con las tres políticas «según la tarea», copiando el `exists` contra `tasks` que ya usan `task_links` y `task_tags` (D1).
- [x] 2.4 Reemplazar `maintain_task_closed_at()` con `create or replace` —sin editar la migración de KAM-15— para que bajar de un estado `final` ponga `closed_without_deliverables` en `false` (D3).
- [x] 2.5 Escribir `close_task_with_deliverables(p_task_id uuid, p_deliverables jsonb, p_status_id uuid)` como RPC plpgsql `security invoker` (D3): crea cada registro marcado con el identificador que le llega —reutilizando `create_expense` para los dos tipos de egreso e inserciones directas para `items`, `contacts` y `asset_details`, esta última solo si quien llama es dueño, lo que RLS ya impone—, escribe `fulfilled_type`/`fulfilled_id`/`fulfilled_at`, escribe la fila de `task_links` de cada creado, **inserta las filas de `attachments` que le llegan ya copiadas** (D6), mueve el estado y fija la marca. Comprobar dentro de la transacción que el entregable siga sin cumplir antes de crear. La RPC **no** habla con Storage: la copia ocurre antes, en la acción.
- [x] 2.6 Regenerar el grafo con `graphify .` tras la migración (convención nº 6).

- [x] 2.7 Añadir `AttachmentService.copyToEntity(organizationId, attachment, entityType, entityId)` (D6): copia el objeto de Storage a la ruta canónica del destino con la operación `copy`, devuelve la fila a insertar, y deja al llamador retirar el objeto si algo falla después —el mismo patrón que `upload()` ya usa—. Genérico, no específico de tareas.
- [x] 2.8 `services/catalog/attachment-service.test.ts`: cubrir que `copyToEntity` compone la ruta del destino y **no** reutiliza la de origen, que es lo que `unique (bucket, storage_path)` rechazaría.

## 3. Pruebas pgTAP de la migración

- [x] 3.1 Crear `supabase/tests/task_deliverables.test.sql` con dos organizaciones sembradas y sus miembros. Usar `throws_ok` de cuatro argumentos y ejecutarlo con `supabase test db`, nunca con `psql`.
- [x] 3.2 Cubrir el aislamiento y el rol. Cubre *Los entregables solo son accesibles dentro de su organización y nadie los borra* → «Otra organización no lee los entregables», «Otra organización no declara entregables ajenos», «El ayudante sigue la visibilidad de la tarea», «Nadie borra un entregable».
- [x] 3.3 Cubrir la unicidad por tipo. Cubre *Una tarea declara qué debe existir al terminarla* → «No se declara dos veces el mismo tipo».
- [x] 3.4 Cubrir la RPC de cierre con los cinco tipos construibles y con un fallo a medias. Cubre *El asistente ofrece tres salidas y ninguna se penaliza* → «Crear seleccionados cierra la tarea», «Un fallo no deja la tarea a medias»; y *El registro creado queda enlazado desde la tarea y visible en la bitácora* → «El producto creado aparece en los vínculos», «La creación queda en la bitácora».
- [x] 3.5 Cubrir la marca y su retirada al reabrir. Cubre *Cerrar sin entregables deja una marca discreta y localizable* → «La marca aparece al cerrar sin crear nada», «Reabrir retira la marca».
- [x] 3.6 Añadir a `supabase/tests/task_links.test.sql` —el archivo que KAM-15 dejó y KAM-19 amplió— la escritura de los cinco tipos de vínculo. Cubre *Un buscador único resuelve los tipos vinculables* → «No se ofrecen registros de otra organización» y *Los vínculos se quitan sin tocar el registro apuntado* → «No hay vínculos duplicados», ambos contra RLS y contra el `unique`, no contra la interfaz.
- [x] 3.7 Cubrir en el mismo archivo que un ayudante obtiene cero filas de `asset_details` aunque el vínculo de tipo `asset` exista y él pueda leer su fila (D9). Es la defensa de base que respalda el filtro del servicio.

## 4. Lectura y escritura de vínculos en el servicio

- [x] 4.1 Añadir `TaskService.links(organizationId, taskId, isOwner)` que lee `task_links` y resuelve los destinos **agrupados por tipo** —una consulta por tipo presente, nunca una por vínculo— devolviendo nombre o número, estado actual y `archived_at` (D2). No almacenar ninguna copia. Omitir por completo los vínculos de tipo `asset` cuando `isOwner` es falso (D9), sin dejar hueco ni rótulo.
- [x] 4.2 Añadir `TaskService.unlink(organizationId, taskId, entityType, entityId)`, que retira solo la fila de `task_links`.
- [x] 4.3 Añadir `TaskService.searchLinkTargets(organizationId, term, isOwner)`: consulta los cinco tipos, excluye archivados y mezcla los resultados identificando el tipo de cada uno, reutilizando `normalizeForSearch` sin escribir una segunda regla de búsqueda (D2). Saltarse la consulta de activos cuando `isOwner` es falso (D9). El `entity_id` de un activo es el `item_id` de `asset_details`.
- [x] 4.4 Añadir `TaskService.relatedTasks(organizationId, entityType, entityId)`: una sola consulta de `task_links` unida a `tasks`, dejando el filtrado por rol y por línea a RLS (D4).
- [x] 4.5 `services/tasks/task-service.test.ts`: cubre *El vínculo refleja el estado actual del registro, nunca una copia* → «El estado del pedido cambia después de vincularlo», «El nombre del registro cambia después de vincularlo» (la consulta resuelve contra la tabla destino y no lee ninguna columna copiada), «El ayudante no ve el vínculo a un activo»; y *Los registros vinculados muestran sus tareas relacionadas* → «El ayudante solo ve lo que le corresponde» en su parte de consulta.

## 5. Vínculos en el detalle de tarea (V18)

- [x] 5.1 Añadir a `actions/tasks.ts` las acciones `linkTask` y `unlinkTask`, cada una con su Zod, revalidando la ruta del detalle y rechazando la tarea archivada.
- [x] 5.2 Crear `features/tasks/links/link-search.tsx`: el buscador único con debounce, resultados por tipo, exclusión en memoria de lo ya vinculado, y escritura al elegir sin paso de guardado (D2).
- [x] 5.3 Crear `features/tasks/links/task-links.tsx`: la lista de vínculos con el estado actual de cada destino, la señal de archivado y la acción de quitar.
- [x] 5.4 Encender la sección *Vínculos* en `features/tasks/detail/task-detail.tsx`, la ranura que KAM-16 dejó sin pintar (D8), cargando los vínculos en servidor con el resto del detalle y en solo lectura si la tarea está archivada.
- [x] 5.5 `features/tasks/links/link-search.test.tsx`: cubre *Un buscador único resuelve los tipos vinculables* → «Un término encuentra registros de varios tipos», «La búsqueda ignora acentos y mayúsculas», «Un destino ya vinculado no se ofrece dos veces», «Los registros archivados no se ofrecen», «Elegir vincula sin más pasos», «La persona dueña encuentra activos», «El ayudante no encuentra activos»; y el delta de `assets` → «El vínculo a un activo se crea desde la tarea» en su parte de interfaz.
- [x] 5.6 `features/tasks/links/task-links.test.tsx`: cubre *El vínculo refleja el estado actual del registro, nunca una copia* → «Un destino archivado sigue visible»; y *Los vínculos se quitan sin tocar el registro apuntado* → «Quitar el vínculo no toca el pedido», «Se puede volver a vincular».

## 6. Bloques *Tareas relacionadas* y aviso al archivar

- [x] 6.1 Crear `features/tasks/links/related-tasks.tsx` como componente único de los cuatro bloques, con su mensaje de lista sin contenido (D4).
- [x] 6.2 Sumar el bloque a `features/orders/order-detail.tsx`, cargando las tareas en servidor junto al historial que esa pantalla ya carga.
- [x] 6.3 Sumar el bloque a `features/catalog/item-detail.tsx`, retirando de su prueba la afirmación de KAM-06 de que el detalle de ítem no muestra tareas relacionadas.
- [x] 6.4 Sumar el bloque a `features/contacts/contacts-screen.tsx`, en el panel derecho, actualizándose al cambiar de contacto sin abandonar la página.
- [x] 6.5 Sumar el bloque al panel de detalle de activo en `features/assets/asset-detail-panel.tsx`. La pantalla ya es solo del dueño, así que aquí no hace falta filtro de rol adicional.
- [x] 6.6 Crear `features/tasks/links/archive-warning.tsx`, un solo diálogo que enumera las tareas que referencian el registro y, confirmado, llama a la acción de archivado que ya existe sin cambiarla (D5).
- [x] 6.7 Pasar por ese diálogo los archivados que existen en la interfaz: **ítem, contacto y egreso**. **Corregido al implementar:** el pedido no tiene flujo de archivado en pantalla —`archiveOrder` existe como acción pero nada la llama; los pedidos se cancelan— así que no hay nada que interceptar ahí. No tocar `enforce_archive_rules()`: quién puede archivar lo sigue decidiendo la base. Archivar el ítem de un activo pasa por el mismo aviso, porque un activo **es** un ítem.
- [x] 6.8 `features/tasks/links/related-tasks.test.tsx`: cubre *Los registros vinculados muestran sus tareas relacionadas* → «El pedido muestra sus tareas», «Desde la tarea relacionada se llega a la tarea», «Sin tareas relacionadas el bloque queda vacío».
- [x] 6.9 Ampliar `features/orders/order-detail.test.tsx`, `features/catalog/item-detail.test.tsx`, `features/contacts/contacts-screen.test.tsx` y `features/assets/asset-detail-panel.test.tsx`. Cubren el delta de `orders` → «Bloque de tareas relacionadas», «Pedido sin tareas relacionadas»; el delta de `catalog-directory` → «Tareas relacionadas en el detalle», «Ítem sin tareas relacionadas», «Tareas relacionadas en el panel», «El bloque sigue al contacto elegido»; el delta de `assets` → «Tareas relacionadas del activo», «Activo sin tareas relacionadas»; y *Los registros vinculados muestran sus tareas relacionadas* → «El panel del activo muestra sus tareas».
- [x] 6.10 `features/tasks/links/archive-warning.test.tsx`: cubre *Archivar un registro referenciado avisa y no rompe nada* → «El aviso enumera las tareas», «El archivado sigue adelante», «Sin referencias no hay aviso». El escenario «Ningún vínculo queda roto» se verifica en 3.6 contra la base.

## 7. Declaración de entregables en V18

- [x] 7.1 Añadir a `services/tasks/task-service.ts` la lectura de los entregables de una tarea y las escrituras de declarar y retirar, rechazando retirar uno ya cumplido.
- [x] 7.2 Añadir a `actions/tasks.ts` las acciones `declareDeliverable` y `withdrawDeliverable`, con su Zod sobre el dominio de tipos construibles de `lib/tasks/deliverables.ts`.
- [x] 7.3 Crear `features/tasks/deliverables/deliverables-section.tsx`: el selector que ofrece solo los tipos construibles, la lista de declarados con su estado de cumplimiento, y la retirada.
- [x] 7.4 Encender la sección *Entregables esperados* en `features/tasks/detail/task-detail.tsx` (D8), cargando en servidor y en solo lectura si la tarea está archivada.
- [x] 7.5 `features/tasks/deliverables/deliverables-section.test.tsx`: cubre *Una tarea declara qué debe existir al terminarla* → «Declarar dos entregables», «Retirar un entregable no cumplido», «Una tarea puede no declarar ninguno».

## 8. Asistente de cierre (V19)

- [x] 8.1 Añadir a `actions/tasks.ts` la acción de cierre con entregables, que llama a `close_task_with_deliverables` y devuelve el motivo al fallar sin dejar nada a medias (D3).
- [x] 8.2 Crear `features/tasks/deliverables/closing-dialog.tsx`: un formulario por entregable pendiente, montado bajo demanda, con su casilla de inclusión y su prellenado desde `prefillFor` (D6, D7).
- [x] 8.3 Implementar las tres salidas: *Crear seleccionados y cerrar*, *Cerrar sin crear nada* y *Cancelar*. *Cancelar* revierte el movimiento optimista y no envía nada (supuesto 6).
- [x] 8.4 Conectar la entrada desde el tablero: al soltar en una columna de tipo `final`, consultar `needsClosingWizard` antes de dar el movimiento por hecho, reutilizando la reversión optimista que KAM-15 ya tiene.
- [x] 8.5 Conectar la entrada desde el detalle: al cambiar el estado a uno de tipo `final`, la misma consulta antes de enviar.
- [x] 8.6 `features/tasks/deliverables/closing-dialog.test.tsx`: cubre *El asistente ofrece un formulario prellenado por entregable* → «Dos entregables, dos formularios prellenados», «Lo prellenado se puede cambiar», «Se elige cuál incluir»; y *El asistente ofrece tres salidas y ninguna se penaliza* → «Cerrar sin crear nada no pide nada», «Cancelar devuelve la tarea a su estado anterior».
- [x] 8.7 Ampliar `features/tasks/board/tasks-screen.test.tsx`. Cubre el delta de `tasks` → «Soltar en la columna final sin entregables cierra sin preguntar», «Soltar en la columna final con entregables abre el asistente»; y *Entrar en un estado final con entregables pendientes abre el asistente* → «Soltar en la columna final abre el asistente».
- [x] 8.8 Ampliar `features/tasks/detail/task-fields.test.tsx` con la segunda entrada al asistente. Cubre *Entrar en un estado final con entregables pendientes abre el asistente* → «Cambiar el estado desde el detalle abre el asistente».

## 9. Tarjeta, filtros y marca en el tablero

- [x] 9.1 Añadir a `TaskService.listForBoard` los recuentos de vínculos y de entregables por tarea, y `closed_without_deliverables`, sin almacenar nada derivado.
- [x] 9.2 Añadir los íconos de vínculos y entregables a `features/tasks/board/task-card.tsx`, junto al de adjuntos, y la marca sobria de cerrada sin entregables.
- [x] 9.3 Añadir a `features/tasks/board/tasks-screen.tsx` el filtro por vínculo —con algún vínculo, y por registro concreto— y el filtro de cerradas sin entregables, ambos viviendo en la dirección como los que ya existen.
- [x] 9.4 `features/tasks/board/task-card.test.tsx`: cubre el delta de `tasks` → «Íconos de vínculos y entregables», «Una tarea sin vínculos ni entregables no muestra sus íconos», «La marca de cerrada sin entregables es sobria».
- [x] 9.5 Ampliar `features/tasks/board/tasks-screen.test.tsx` con los dos filtros. Cubre el delta de `tasks` → «Filtro por vínculo», «Filtro de cerradas sin entregables»; y *Cerrar sin entregables deja una marca discreta y localizable* → «El filtro la encuentra».

## 10. Integración y e2e

- [x] 10.1 `tests/integration/` — creación de los cinco tipos de entregable desde el asistente contra la base real, verificando que cada uno deja su registro, su `fulfilled_*`, su vínculo y su entrada de bitácora. Cubre *El registro creado queda enlazado desde la tarea y visible en la bitácora* → «La tarea aparece en el registro creado», «No hay un historial de entregables aparte», «Un entregable cumplido no se vuelve a ofrecer».
- [x] 10.2 Añadir al mismo nivel la verificación de que los adjuntos de la tarea llegan al registro creado como filas nuevas apuntando al mismo objeto de Storage (D6, supuesto 7).
- [x] 10.3 `tests/e2e/task-deliverables.spec.ts` con las tres salidas del diálogo: crear seleccionados y cerrar, cerrar sin crear nada, y cancelar. Cubre *El asistente ofrece tres salidas y ninguna se penaliza* de extremo a extremo.
- [x] 10.4 Añadir al mismo `spec` el recorrido bidireccional: vincular un pedido desde la tarea, comprobar que el pedido lista la tarea, archivar el pedido con su aviso y comprobar que el vínculo sigue resolviendo. Cubre *Archivar un registro referenciado avisa y no rompe nada* → «Ningún vínculo queda roto» desde la interfaz.

## 11. Cierre

- [x] 11.1 Ejecutar la secuencia completa de CI: `lint → typecheck → test:unit → supabase start → test:integration → build → test:e2e`.
- [x] 11.2 Comprobar la cobertura mínima del 90 % en `lib/tasks/deliverables.ts` y en los añadidos a `services/tasks/task-service.ts`.
- [x] 11.3 Repasar la lista de verificación del backlog: migración con su pgTAP, prueba de aislamiento entre organizaciones y de rol, ningún concepto nuevo fuera del modelo conceptual, ningún derivado almacenado, y `graphify .` regenerado.
