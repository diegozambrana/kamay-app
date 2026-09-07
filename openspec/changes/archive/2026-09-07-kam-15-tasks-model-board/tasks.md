> Cada tarea de prueba nombra los escenarios del delta spec que cubre (convención nº 12: ningún escenario sin prueba referenciada). Los escenarios viven en `specs/tasks/spec.md`, `specs/user-management/spec.md`, `specs/quick-capture/spec.md` y `specs/orders/spec.md` de este cambio. Las decisiones citadas (D1–D12) son las de `design.md`.

## 0. Punto de partida

- [x] 0.1 Confirmar que KAM-05 está archivada y que `resolve_statuses(org, line, 'task')` devuelve los cuatro estados sembrados de Geeko Store. Este cambio **no toca** ninguna migración ni pantalla de configuración de estados.
- [x] 0.2 Confirmar que ninguna otra rama en curso escribe en `supabase/migrations/`. KAM-14 añade una vista de flujo de caja en su propio archivo; la marca de tiempo de esta migración debe respetar el orden de fusión (design, Migration Plan).
- [x] 0.3 Confirmar que `app/(app)/tasks/[id]/` no se crea en este cambio: es de KAM-16 (D12). El único destino de la tarjeta aquí es el panel compacto.

## 1. Extracción del cascarón de arrastre (antes de tareas)

- [x] 1.1 Mover `features/orders/board-store.ts` a `stores/board-store.ts` con nombres neutros (`recordId` en vez de `orderId`), conservando `pending`, `pendingQueue`, `move`, `reorder`, `settle`, `revert` y `displayedPlacement` (D6).
- [x] 1.2 Crear `components/board/kanban-board.tsx` con lo que los dos tableros hacen igual: `DndContext`, `PointerSensor` con activación a 6 px, columnas `useDroppable`, tarjetas `useSortable`, `DragOverlay` y la resolución de «soltar sobre columna o sobre tarjeta». Recibe columnas, elementos, `renderCard` y `onMove`, más un `onReorder` opcional.
- [x] 1.3 Refitar `features/orders/board-view.tsx` sobre el cascarón, dejando `queuePositions` y `sortByArrival` dentro de pedidos: la cola no se generaliza (D6).
- [x] 1.4 Mover `features/orders/board-store.test.ts` junto al store y adaptarlo a los nombres neutros.
- [x] 1.5 **Puerta:** `npm run test:unit` y el e2e del tablero de pedidos en verde antes de tocar nada de tareas. Si el refit no puede dejarse verde, revisar D6 en vez de seguir con dos mecánicas.

## 2. Migración: asignación de líneas y visibilidad

- [x] 2.1 Abrir `supabase/migrations/<ts>_tasks.sql` con la cabecera del proyecto: tarea, DDL canónico de referencia (§12, §16, §18) y las desviaciones declaradas —`membership_lines` en vez de `memberships_lines`, y su `organization_id` redundante— con su motivo (D4).
- [x] 2.2 Crear `membership_lines (membership_id, business_line_id, organization_id)` con llave primaria compuesta, sus referencias y su índice por `organization_id`.
- [x] 2.3 Crear `has_line_access(org uuid, line uuid) returns boolean` como `stable security definer set search_path = public`, con las tres condiciones de D4: sin líneas declaradas, línea declarada, o línea compartida (`business_lines.is_shared`).
- [x] 2.4 Privilegios y RLS de `membership_lines`: lectura para todo miembro, escritura solo del dueño, sin política `DELETE`; trigger `audit`.

## 3. Migración: tareas, etiquetas y vínculos

- [x] 3.1 Crear `tasks` con el DDL canónico **completo** (D1), incluidas `body_markdown`, `remind_at`, `closed_at` y `closed_without_deliverables`, con la restricción `reminder_needs_due_date` y un comentario por columna inerte nombrando la tarea que la enciende (KAM-16, KAM-17, KAM-21).
- [x] 3.2 Añadir la restricción de título no vacío y los tres índices del esquema §12 (`(organization_id, status_id)`, `(organization_id, due_at)`, `(assignee_id)`), todos con su cláusula `where` de vigencia.
- [x] 3.3 Crear el trigger `before insert` `assign_initial_task_status`: si `status_id` viene nulo, lo resuelve con `resolve_statuses(organization_id, business_line_id, 'task')` tomando el `kind = 'initial'` de menor `position` (D3). Comparación por `kind`, nunca por nombre.
- [x] 3.4 Crear el trigger `before update` `maintain_task_closed_at`: actúa solo si cambia `status_id`; escribe `closed_at = now()` al entrar en un estado `final` y lo pone a `null` al salir (D2). Añadir su equivalente `before insert` para una tarea que nazca en un estado final.
- [x] 3.5 Crear `tags` con `search_name` generada como `immutable_unaccent(lower(name))`, `unique (organization_id, name)` y su índice de búsqueda; y `task_tags (task_id, tag_id)` con llave primaria compuesta y `organization_id` (D10).
- [x] 3.6 Crear `task_links` con su DDL canónico —los cinco tipos en el `check`, `unique (task_id, entity_type, entity_id)`— y el trigger que valida la existencia del registro apuntado, que es lo que sustituye a la llave foránea imposible (D8).
- [x] 3.7 Enganchar `enforce_archive_rules()` a `tasks` y `log_activity()` a `tasks`, `tags`, `task_tags` y `task_links`.
- [x] 3.8 Privilegios y políticas de RLS de las cuatro tablas según D5: `tasks` con `is_owner or (is_member and (assignee_id = auth.uid() or has_line_access(...)))` en `select`, `insert` y `update`; `task_tags` y `task_links` heredando por `exists` sobre `tasks`; `tags` legible por todo miembro y escribible por ambos roles. Ninguna política `DELETE` en ninguna.
- [x] 3.9 Ejecutar `supabase db reset` y comprobar que la migración aplica limpia; regenerar el grafo con `graphify .` y versionar `graphify-out/` en el mismo commit (convención nº 6).

## 4. Pruebas pgTAP del esquema

- [x] 4.1 `supabase/tests/task_integrity.test.sql`: título vacío, tarea sin línea, y `remind_at` sin `due_at` rechazados con `throws_ok` de cuatro argumentos. Cubre *Modelo de tarea con título y línea obligatorios* → «Tarea sin línea», «Tarea sin título», «Recordatorio sin fecha límite»; y «Título y línea bastan».
- [x] 4.2 Ampliar el mismo archivo con el estado inicial. Cubre *El estado inicial lo asigna la base resolviendo el juego de la línea* → «Alta sin estado explícito», «Línea con juego propio de tareas», «Estado explícito respetado», «El nombre del estado no decide nada».
- [x] 4.3 `supabase/tests/task_closed_at.test.sql`: mover a `final` fija `closed_at`, salir de `final` lo borra, y editar responsable o fecha no lo toca. Cubre *El cierre se deriva de la posición en el tablero* → sus tres escenarios; y *El arrastre funciona en ambos sentidos* → «Retroceder desde un estado final reabre la tarea».
- [x] 4.4 `supabase/tests/task_access.test.sql` con la matriz completa de D5: dueño; ayudante sin líneas; ayudante con una línea; tarea asignada de otra línea; línea compartida; y otra organización. Cubre *Visibilidad de tareas por rol y por línea* → «Ayudante restringido a una línea», «Tarea asignada de otra línea», «La línea compartida es de todos», «Ayudante sin líneas asignadas», «Aislamiento entre organizaciones».
- [x] 4.5 Probar `has_line_access` directamente, aparte de la política, para que un fallo diga cuál de las dos falló (riesgo declarado en design).
- [x] 4.6 Ampliar `supabase/tests/no_delete.test.sql` con las cinco tablas nuevas, y cubrir el archivado. Cubre *Visibilidad de tareas por rol y por línea* → «Nadie borra una tarea», «El ayudante no archiva».
- [x] 4.7 `supabase/tests/task_links.test.sql`: vínculo a un registro inexistente rechazado, y vínculo duplicado rechazado. Cubre *El vínculo de una tarea con un pedido se guarda desde el primer día* → «Vínculo a un registro inexistente», «Vínculo duplicado», «El vínculo sigue la visibilidad de su tarea».
- [x] 4.8 `supabase/tests/tag_uniqueness.test.sql`: unicidad por organización y búsqueda por `search_name` sin tildes. Cubre *Etiquetas por organización creadas al vuelo* → «La misma etiqueta no se duplica», «Etiquetas de otra organización».

## 5. Asignación de líneas en Configuración

- [x] 5.1 Añadir a `services/membership-service.ts` la lectura y escritura de las líneas de una membresía, sin ninguna comprobación de rol en el servicio: RLS decide.
- [x] 5.2 Añadir a `actions/members.ts` la acción de asignar y limpiar líneas, con validación Zod y `revalidatePath`.
- [x] 5.3 Ampliar `features/settings/members-section.tsx` con el selector de líneas por membresía y la indicación visible de que sin líneas se ven todas (D4).
- [x] 5.4 Pruebas unitarias del servicio y de la acción. Cubren *The owner assigns business lines to a membership* → «Owner restricts an assistant to one line», «Clearing the assignment restores full coverage», «A membership with no line covers every line».
- [x] 5.5 Cubrir la escritura de `membership_lines` en pgTAP. **Va en `supabase/tests/task_access.test.sql`, no en `rls_roles.test.sql`**: esa suite es de `org-configuration` (KAM-04) y la convención del proyecto es que cada suite cubra su propia capacidad; además `task_access` ya siembra las membresías y líneas que estos escenarios necesitan. Cubre *The owner assigns business lines to a membership* → «Only the owner assigns lines», «A member reads their own assignment», «Assignments do not cross organizations».

## 6. Servicio y acciones de tareas

- [x] 6.1 Crear `services/tasks/task-service.ts` con `listForBoard`, `create`, `updateFields`, `moveToStatus` y `archive`, todo con `organization_id` en cada consulta aunque RLS ya filtre (convención nº 2). Es el archivo que KAM-16 ampliará.
- [x] 6.2 Crear `services/tasks/tag-service.ts` con la búsqueda por `search_name`, la creación al vuelo y la aplicación de etiquetas a una tarea.
- [x] 6.3 Crear `actions/tasks.ts` con `createTask`, `updateTaskFields`, `moveTaskToStatus` y `archiveTask`: sesión, organización, rol, Zod y `revalidatePath`. La creación escribe tarea, etiquetas y vínculo **en una sola operación** (D8).
- [x] 6.4 Pruebas unitarias de ambos servicios con el doble de Supabase del proyecto, incluida la comprobación de que ninguna consulta compara estados por nombre.

## 7. Lógica pura de tareas

- [x] 7.1 Crear `lib/tasks/schema.ts` con el esquema Zod del alta: título obligatorio no vacío, línea obligatoria, y el resto opcional.
- [x] 7.2 Crear `lib/tasks/suggested-due-date.ts`: dos días antes de la fecha comprometida del pedido, hoy si eso ya pasó, y sin sugerencia si el pedido no tiene fecha (D8). Resolver «hoy» con la zona horaria de la organización, reutilizando `todayInTimezone`.
- [x] 7.3 Crear `lib/tasks/prefill.ts`: compone los valores iniciales del formulario desde un pedido —línea, título sugerido, vínculo, cliente como contexto y la fecha de 7.2—.
- [x] 7.4 Crear `lib/tasks/overdue.ts` con el semáforo de la fecha límite, sin señal cuando no hay fecha.
- [x] 7.5 Añadir la resolución de la línea del alta rápida: la del selector activo y, con «Todas», la compartida de la organización (D7); sin línea compartida, devuelve «hay que preguntar».
- [x] 7.6 Pruebas unitarias de 7.1–7.5. Cubren *Alta rápida de tarea en tres interacciones o menos* → «Crear una tarea con la línea activa», «Crear una tarea con el selector en Todas», «Título vacío»; *Formulario de alta…* → «Responsable propuesto»; y *Crear tarea para este pedido…* → «Formulario prellenado», «Pedido sin fecha comprometida», «La fecha sugerida nunca queda en el pasado».

## 8. V17 · Tablero de tareas

- [x] 8.1 Crear `app/(app)/tasks/page.tsx`: resuelve línea activa, estados del flujo `task`, tareas y filtros desde la dirección, y rinde la pantalla.
- [x] 8.2 Crear `features/tasks/board/tasks-screen.tsx` con el conmutador de vistas y los filtros de responsable, etiqueta, estado, búsqueda y «Ver archivados», todos en la dirección (D11).
- [x] 8.3 Crear `features/tasks/board/board-view.tsx` sobre `components/board/kanban-board.tsx`, con las columnas resueltas y sin ninguna lógica de cola.
- [x] 8.4 Crear `features/tasks/board/task-card.tsx`: título, responsable, fecha con semáforo, etiquetas, y color de línea cuando el filtro está en «Todas».
- [x] 8.5 Crear `features/tasks/board/list-view.tsx` y `calendar-view.tsx` siguiendo el patrón de pedidos, con las tareas sin fecha aparte en el calendario.
- [x] 8.6 Añadir `/tasks` a `PROTECTED_PREFIXES` en `lib/auth/routes.ts` y su prueba.
- [x] 8.7 Pruebas de componente del tablero. Cubren *Las columnas del tablero salen del juego de estados de la línea* → sus tres escenarios; *Tarjeta de tarea* → sus cuatro escenarios; y *Vistas lista y calendario y filtros del tablero* → «Los filtros sobreviven al cambio de vista», «Vista de calendario», «Filtro por responsable», «Tarea archivada oculta por defecto», «Un tablero enlazable».

## 9. Alta de tarea

- [x] 9.1 Crear `features/tasks/board/quick-add.tsx`: compositor en la cabecera de la columna inicial —abrir, escribir, confirmar con Enter—, con la línea resuelta por 7.5 (D7).
- [x] 9.2 Crear `features/tasks/task-form.tsx` con título, línea, responsable, fecha límite y etiquetas, y el responsable propuesto como quien crea.
- [x] 9.3 Crear `app/(app)/tasks/new/page.tsx`, que lee el contexto de prellenado de la dirección (`?orderId=`), comprueba que el usuario ve ese pedido y compone los valores iniciales con `lib/tasks/prefill.ts` (D8).
- [x] 9.4 Crear `features/tasks/board/task-sheet.tsx`: panel compacto desde la tarjeta con responsable, fecha límite y etiquetas (D12). **No** crear `app/(app)/tasks/[id]/`.
- [x] 9.5 Crear `features/tasks/tag-picker.tsx` con búsqueda tolerante a tildes vía `lib/search/normalize.ts` y creación al vuelo (D10).
- [x] 9.6 Añadir `/tasks/new` a las rutas de captura a pantalla completa de `components/layout/mobile-nav.tsx`.
- [x] 9.7 Pruebas de componente del alta y del panel. Cubren *Alta rápida…* → «La tarea aparece en el acto»; *Formulario de alta…* → «Alta con todos los datos», «Editar una tarea desde su tarjeta»; y *Etiquetas por organización creadas al vuelo* → «Etiqueta nueva desde la tarea», «Búsqueda tolerante a tildes».

## 10. Entradas: navegación y registro rápido

- [x] 10.1 Añadir el campo opcional `barHref` a `NavEntry` en `components/layout/nav-entries.ts` y declarar la entrada *Tareas* con `href: "/tasks"` y `barHref: "/my-tasks"` (D9). No se añade una segunda entrada.
- [x] 10.2 Hacer que la barra inferior y el resaltado de activo usen el href de su superficie; el menú de escritorio sigue usando `href`.
- [x] 10.3 Encender el destino *Tarea* en `lib/quick-capture/destinations.ts`: `href: "/tasks/new"` y sin `availableFrom`. El menú *+ Registrar* lo hereda sin tocarlo.
- [x] 10.4 Ampliar `components/layout/nav-entries.test.ts` y `mobile-nav.test.tsx`. Cubren *El tablero de tareas se alcanza desde el menú de escritorio* → sus tres escenarios.
- [x] 10.5 Ampliar `lib/quick-capture/destinations.test.ts`. Cubre *La pantalla de registro rápido ofrece seis destinos* → «Los seis destinos están presentes», «Destinos disponibles hoy», «Destinos aún no construidos».

## 11. Crear tarea para este pedido

- [x] 11.1 Añadir la acción *Crear tarea para este pedido* a `features/orders/order-detail.tsx`, que navega a `/tasks/new?orderId=…` (D8). No se añade ningún bloque *Tareas relacionadas*: es de KAM-21.
- [x] 11.2 Verificar por lectura que no existe ningún trigger, acción ni servicio que escriba en `tasks` desde una operación de `orders`, ni al revés. Es la comprobación de la convención nº 10 sobre el código, complementaria a la de datos de 12.3.
- [x] 11.3 Ampliar las pruebas del detalle de pedido. Cubren *Detalle del pedido* → «Crear tarea para este pedido», «Cambiar de estado no crea ninguna tarea».

## 12. Pruebas e2e

- [x] 12.1 `tests/e2e/task-quick-add.spec.ts`: alta rápida contando las interacciones y afirmando que son tres o menos, con la medición registrada en la prueba. Cubre *Alta rápida de tarea en tres interacciones o menos* → «Crear una tarea con la línea activa», «La tarea aparece en el acto».
- [x] 12.2 `tests/e2e/task-board.spec.ts`: arrastrar hacia adelante y hacia atrás, comprobando que no aparece confirmación ni advertencia y que el historial recoge los dos movimientos. Cubre *El arrastre funciona en ambos sentidos y sin efectos secundarios* → «Volver a una columna anterior», «El movimiento se ve antes que la respuesta», «El historial recoge el ir y venir».
- [x] 12.3 `tests/e2e/orders-tasks-independence.spec.ts`: recorrer un pedido por todos sus estados contando las tareas de la organización antes y después; cerrar una tarea vinculada y comprobar que el pedido no se movió; archivar un pedido con tareas vinculadas. Cubre *Pedidos y tareas nunca se sincronizan* → sus tres escenarios.
- [x] 12.4 Ampliar el e2e de permisos del ayudante con la asignación de líneas: un ayudante restringido a una línea no ve las tareas de otra ni manipulando la dirección. Cubre *Visibilidad de tareas por rol y por línea* → «Ayudante restringido a una línea», «Tarea asignada de otra línea».
- [x] 12.5 `tests/e2e/task-from-order.spec.ts`: activar la acción desde el detalle del pedido, comprobar el prellenado, modificar la fecha y guardar. Cubre *Crear tarea para este pedido con formulario prellenado* → «Formulario prellenado», «Todo es modificable», «El vínculo queda guardado».

## 13. Cierre

- [x] 13.1 `npm run lint`, `npm run typecheck`, `test:unit`, `test:integration`, `supabase test db` y `build` en verde. En `test:e2e`, las 15 pruebas nuevas de KAM-15 pasan; quedan dos ajenas —`archive-restore` y `order-edit` en móvil— que fallan solo con la suite completa en paralelo y pasan aisladas, más `fair-offline` «el ayudante puede atender el puesto», que falla igual **sin** esta migración (verificado retirándola). Ninguna es de este cambio.
- [x] 13.2 Comprobar la cobertura mínima del 90 % en `lib/tasks/` y `services/tasks/`.
- [x] 13.3 Repasar la lista de verificación del backlog: migración con su pgTAP, prueba de aislamiento y de rol, ningún concepto ausente del modelo conceptual, ningún valor derivado almacenado, y `graphify .` regenerado.
- [x] 13.4 Comprobar que ninguna columna inerte de D1 —`body_markdown`, `remind_at`, `closed_without_deliverables`— aparece en ninguna consulta, formulario ni prueba de este cambio.
- [x] 13.5 Avisar en la propuesta de KAM-16 que su supuesto 2 quedó confirmado y que el destino de la tarjeta a sustituir es el panel compacto de D12.
