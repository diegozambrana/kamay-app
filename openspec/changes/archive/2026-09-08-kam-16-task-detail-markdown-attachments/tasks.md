> Cada tarea de prueba nombra los escenarios del delta spec que cubre (convención nº 12: ningún escenario sin prueba referenciada). Los escenarios viven en `specs/task-detail/spec.md` de este cambio. Las decisiones citadas (D1–D8) son las de `design.md`.
>
> **Orden:** los grupos 1 a 4 no dependen de KAM-15 y pueden hacerse en cuanto empiece el trabajo. Del grupo 5 en adelante hace falta la tabla `tasks` fusionada.

## 0. Condición de arranque y ausencia de migración

- [x] 0.1 Verificar que KAM-15 está fusionado: existen la tabla `tasks` con `body_markdown`, `services/tasks/task-service.ts` y `actions/tasks.ts`. Si no, detenerse: los grupos 1–4 se pueden adelantar, del 5 en adelante no.
- [x] 0.2 Confirmar que este cambio no escribe ningún archivo en `supabase/migrations/`. `attachments`, los cuatro buckets y las tres políticas de `storage.objects` están desde `20260826180000_attachments.sql`, y `entity_type` ya admite `'task'`. Si al implementar aparece la necesidad de una migración, detenerse y revisar el diseño antes de escribirla.
- [x] 0.3 Comprobar que el modelo real de `tasks` que dejó KAM-15 coincide con los campos de los que depende este cambio —`title`, `body_markdown`, `status_id`, `business_line_id`, `assignee_id`, `due_at`, `remind_at`, `archived_at`— y con la restricción `reminder_needs_due_date`. Si se desvía, actualizar `proposal.md` y `design.md` antes de seguir.

## 1. Saneado del Markdown

- [x] 1.1 Añadir `react-markdown`, `remark-gfm` y `rehype-sanitize` a `package.json`.
- [x] 1.2 Crear `lib/markdown/sanitize.ts` con el esquema de saneado partiendo de `defaultSchema` de `rehype-sanitize` y recortándolo (D1): sin `img` de origen remoto arbitrario, con `input[type=checkbox][checked]` y las clases de elemento de lista que `remark-gfm` necesita.
- [x] 1.3 Crear `lib/markdown/markdown-view.tsx` como **único** componente que rinde Markdown en la aplicación, con `remark-gfm` y `rehype-sanitize` cableados por dentro y sin opción de desactivarlos (D1).
- [x] 1.4 `lib/markdown/sanitize.test.tsx`: cubre *El Markdown rendido se sanea* → «Un script no se ejecuta», «El HTML escrito a mano no se rinde», «Un enlace con esquema peligroso no navega», «El formato legítimo sobrevive», «Un cuerpo antiguo también se sanea» (el mismo cuerpo peligroso rendido sin haber pasado nunca por un saneado al escribir).

## 2. Listas de verificación como reescritura de línea

- [x] 2.1 Crear `lib/markdown/checklist.ts` con `parseChecklistItems(body)` y `toggleChecklistItem(body, index, checked)` (D2): índice por orden de ocurrencia, preservando sangría, marcador y texto; devuelve el cuerpo intacto si el índice no existe.
- [x] 2.2 Saltar los bloques de código cercados en el recorrido, para que una casilla dentro de un bloque no desplace los índices (riesgo declarado en `design.md`).
- [x] 2.3 `lib/markdown/checklist.test.ts`: cubre *Las listas de verificación del cuerpo se marcan y persisten* → «El cuerpo refleja el marcado», «Solo cambia la línea alternada»; más los casos de sangría anidada, marcador `*`, casilla dentro de bloque cercado e índice inexistente.

## 3. Límites de adjuntos y añadidos genéricos al servicio

- [x] 3.1 Crear `lib/attachments/limits.ts` con `MAX_ATTACHMENTS_PER_TASK = 15` y la derivada pura `remainingSlots(activeCount)` / `fitsBatch(activeCount, batchSize)` (D5). Reutilizar el `MAX_FILE_SIZE` que ya existe en `lib/catalog/photos.ts`, sin duplicarlo.
- [x] 3.2 Añadir `uploaded_by` a `COLUMNS` y al tipo `Attachment` en `services/catalog/attachment-service.ts` y `types/` (D6). La columna ya se escribe; empezar a leerla no cambia el esquema.
- [x] 3.3 Añadir `listForEntity(organizationId, entityType, entityId)` y `countActive(organizationId, entityType, entityId)` a `AttachmentService` (D6), ambos genéricos y contando solo `archived_at is null`.
- [x] 3.4 `lib/attachments/limits.test.ts`: cubre *Una tarea admite hasta quince adjuntos vigentes* → «Un lote que desborda el límite se rechaza» en su parte pura, y la aritmética de ranuras tras quitar un adjunto.

## 4. Aislamiento de Storage entre organizaciones

- [x] 4.1 Crear `supabase/tests/attachments_storage.test.sql` (pgTAP) con dos organizaciones sembradas y sus miembros, ejercitando las políticas de `storage.objects` que KAM-06b instaló y que hasta ahora nadie probaba. Usar `throws_ok` de cuatro argumentos y ejecutarlo con `supabase test db`, nunca con `psql`.
- [x] 4.2 Cubrir la lectura y la escritura ajenas. Cubre *Los adjuntos de una tarea solo son accesibles dentro de su organización* → «Otra organización no lista los adjuntos», «Conocer la ruta no basta», «Tampoco se puede escribir en la carpeta ajena», «Un miembro sí accede».
- [x] 4.3 Cubrir la ausencia de `DELETE` en `attachments` y en `storage.objects`. Cubre el mismo requisito → «Nadie borra un adjunto».
- [x] 4.4 Fijar que la tabla admite `entity_type = 'task'`. Queda en `attachments_storage.test.sql` y no en `attachments.test.sql`: el archivo nuevo ya siembra una tarea real con su línea y su juego de estados, y el antiguo tendría que sembrarlas solo para repetir la misma afirmación.

## 5. Lectura del detalle y su historial

- [x] 5.1 Añadir a `services/tasks/task-service.ts` la lectura del detalle: la tarea con su estado, su línea, su responsable y sus etiquetas, y `null` cuando no está al alcance de la organización.
- [x] 5.2 Añadir `TaskService.history(organizationId, id)` repitiendo el patrón de `OrderService.history()` —`activity_log`, `table_name = 'tasks'`, `record_id`, `occurred_at` descendente, `limit(50)`— sin ninguna tabla propia (D7).
- [x] 5.3 `services/tasks/task-service.test.ts`: cubre *El historial de la tarea sale de la bitácora* → «No existe una segunda tabla de historial» (la consulta apunta a `activity_log` y a ninguna otra).

## 6. Página del detalle

- [x] 6.1 Crear `app/(app)/tasks/[id]/page.tsx` como página delgada (D8): carga tarea, adjuntos vigentes con sus URLs firmadas e historial en el servidor, y los pasa a los componentes de cliente. Devuelve *no encontrado* cuando la tarea no está al alcance.
- [x] 6.2 Componer la pantalla en `features/tasks/detail/`: cabecera, cuerpo, adjuntos e historial, siguiendo la disposición de V18 y **sin** la sección *Vínculos* (KAM-21).
- [x] 6.3 Rendir la tarea archivada en solo lectura, con su aviso y sin ofrecer guardar, reutilizando el patrón ya establecido en el detalle de pedido y de ítem.
- [x] 6.4 Añadir `/^\/tasks\/[^/]+$/` a `CAPTURE_ROUTES` en `components/layout/mobile-nav.tsx` (D8) y a `PROTECTED_PREFIXES` en `lib/auth/routes.ts` si KAM-15 no lo hizo ya.
- [x] 6.5 Ampliar `components/layout/mobile-nav.test.tsx` y `lib/auth/routes.test.ts` con la ruta nueva. Cubre *El detalle de tarea es una página con dirección propia* → «En móvil ocupa la pantalla completa» en su parte pura.
- [x] 6.6 Apuntar la tarjeta del tablero a `/tasks/[id]` y retirar `features/tasks/board/task-sheet.tsx`, el panel provisional de KAM-15. No estaba en el plan porque la propuesta no revisó ese archivo, pero el escenario «Se llega desde el tablero» lo exige y el propio KAM-15 lo dejó anotado: «sustituir este panel es cambiar a dónde apunta la tarjeta». Con él salen sus props `tags` y `assignees` de `BoardView`, que ya no usa nadie.

## 7. Campos con guardado propio

- [x] 7.1 Añadir `updateTaskField` a `actions/tasks.ts` (D3): una acción acotada con Zod por campo —título, estado, línea, responsable, fecha límite, recordatorio, etiquetas—, que revalida la ruta del detalle y rechaza la tarea archivada.
- [x] 7.2 Validar en el servidor que el título no queda vacío y que un recordatorio exige fecha límite, sin depender de la restricción de la base de datos para el mensaje.
- [x] 7.3 Construir los campos editables en `features/tasks/detail/` de modo que cada uno confirme y guarde por su cuenta, sin acción de guardado global.
- [x] 7.4 `features/tasks/detail/task-fields.test.tsx`: cubre *Los campos de la tarea se editan y se guardan uno a uno* → «El título no puede quedar vacío», «Un recordatorio necesita fecha límite»; y *El detalle de tarea es una página con dirección propia* → «Una tarea archivada no se edita», que se verifica repartido entre los cuatro componentes que congelan sus controles: aquí los campos, en 8.5 el editor, en 9.4 las casillas y en 10.8 los adjuntos.

## 8. Editor de Markdown

- [x] 8.1 Crear `features/tasks/editor/` con las pestañas *Escribir* y *Vista previa* sobre el mismo contenido; la vista previa usa `MarkdownView` (D1).
- [x] 8.2 Construir la barra de herramientas mínima —negrita, cursiva, encabezado, lista, lista de verificación, enlace— aplicando sobre la selección o en la posición del cursor. Extraer la transformación de texto a funciones puras en `lib/markdown/toolbar.ts`.
- [x] 8.3 Añadir `updateTaskBody` a `actions/tasks.ts`: guarda el cuerpo tal cual, sin transformarlo (D3).
- [x] 8.4 `lib/markdown/toolbar.test.ts`: cubre *El cuerpo se escribe en Markdown con ayuda de una barra de herramientas* → «Aplicar formato sin saber Markdown», «Crear una lista de verificación desde la barra».
- [x] 8.5 `features/tasks/editor/markdown-editor.test.tsx`: cubre el mismo requisito → «La sintaxis escrita a mano funciona igual», «El cuerpo se guarda tal cual», «Una tarea puede no tener cuerpo».

## 9. Casillas marcables en la vista previa

- [x] 9.1 Rendir los `input[type=checkbox]` de `remark-gfm` como casillas marcables en la vista previa del detalle, con el índice de ocurrencia como identidad (D2).
- [x] 9.2 Añadir `toggleTaskChecklistItem` a `actions/tasks.ts`: lee el cuerpo **en el servidor**, aplica `toggleChecklistItem` y guarda (D3), para que marcar un paso no pise una edición ajena del resto del cuerpo.
- [x] 9.3 Rendir las casillas sin interacción cuando la tarea está archivada.
- [x] 9.4 `features/tasks/editor/checklist-preview.test.tsx`: cubre *Las listas de verificación del cuerpo se marcan y persisten* → «No hay segunda fuente del marcado» (el único efecto es la escritura del cuerpo), «Una tarea archivada no se marca», y que el índice del clic y el de la reescritura coinciden al rendir.

## 10. Adjuntos: subida en segundo plano

- [x] 10.1 Crear `features/tasks/attachments/upload-store.ts` siguiendo el patrón de `receipt-upload-store` pero indexado por adjunto (D4): `pending` / `failed` con nombre y error, `uploader` inyectable, concurrencia acotada a dos, y `hasPendingUploads()` para el aviso de `beforeunload`.
- [x] 10.2 Comprimir las imágenes con `compressImage` antes de enviar; enviar sin transformar lo que no es imagen y rechazarlo antes de viajar si pasa de 5 MB (D4).
- [x] 10.3 Añadir `attachToTask` y `detachFromTask` a `actions/tasks.ts`, sobre `AttachmentService` con `entity_type = 'task'` y bucket `attachments`. Retirar archiva, nunca borra.
- [x] 10.4 Comprobar el límite de 15 en la acción, contando adjuntos vigentes antes de subir (D5); comprobar el lote completo en la pantalla antes de comprimir nada.
- [x] 10.5 Construir `features/tasks/attachments/` con la zona de arrastre, la alternativa *elegir del equipo*, miniatura para imágenes, ficha con nombre, peso y autor para el resto, indicador de subida y reintento del fallido.
- [x] 10.6 Informar de que hace falta conexión cuando no la hay, sin bloquear la edición ni el guardado del resto de la tarea.
- [x] 10.7 `features/tasks/attachments/upload-store.test.ts`: cubre *Las imágenes se comprimen y todo adjunto sube en segundo plano* → «Una foto de 10 MB se adjunta igual», «Lo que está subiendo se ve», «Un archivo grande que no es imagen se rechaza», «Una subida fallida se reintenta», «Varias imágenes a la vez».
- [x] 10.8 `features/tasks/attachments/attachment-panel.test.tsx`: cubre *Los adjuntos se agregan arrastrando o eligiendo del equipo* → «Un archivo que no es imagen se adjunta sin miniatura», «Sin conexión se avisa y se sigue trabajando»; y *Una tarea admite hasta quince adjuntos vigentes* → «El decimosexto no entra», «Un lote que desborda el límite se rechaza».
- [x] 10.9 `actions/tasks.test.ts`: cubre el mismo requisito de límite → «El límite no depende del navegador» (la acción rechaza el decimosexto sin pasar por la pantalla).

## 11. Bloque de historial

- [x] 11.1 Rendir el bloque de historial al pie del detalle con el componente ya usado en el detalle de pedido, de egreso y de ítem (D7), y su mensaje de lista sin contenido cuando llega vacío.
- [x] 11.2 Declarar el enlace a la bitácora filtrada por esta tarea como inerte hasta KAM-22, con su leyenda, siguiendo el precedente de `quick-capture`.
- [x] 11.3 `features/tasks/detail/task-history.test.tsx`: cubre *El historial de la tarea sale de la bitácora* → «El ayudante ve el bloque vacío, no un error».

## 12. Pruebas de integración

- [x] 12.1 Visibilidad de los adjuntos de tarea entre organizaciones sobre la tabla `attachments` con `entity_type = 'task'`, complementando el grupo 4, que cubre `storage.objects`. Queda en `attachments_storage.test.sql`, junto a la comprobación de Storage con la que comparte siembra. Cubre *Los adjuntos de una tarea solo son accesibles dentro de su organización* → «Otra organización no lista los adjuntos» también en la capa de filas.
- [x] 12.2 Comprobar en pgTAP que una tarea de otra organización devuelve cero filas al leerla por identificador. Cubre *El detalle de tarea es una página con dirección propia* → «Una tarea de otra organización no se abre».
- [x] 12.3 Comprobar en pgTAP que actualizar un campo de la tarea y adjuntar un archivo dejan su entrada en `activity_log`. Cubre *Los campos de la tarea se editan y se guardan uno a uno* → «Cada cambio deja rastro»; y *El historial de la tarea sale de la bitácora* → «Adjuntar también queda registrado».

## 13. Pruebas e2e

- [x] 13.1 Crear `tests/e2e/task-detail.spec.ts`: abrir una tarea desde el tablero y comprobar que se llega a `/tasks/[id]`; volver a abrir esa misma dirección directamente. Cubre *El detalle de tarea es una página con dirección propia* → «Se llega desde el tablero», «La dirección es compartible».
- [x] 13.2 Añadir el recorrido de edición del cuerpo: escribir, aplicar negrita desde la barra, ver la vista previa y recargar. Cubre *El cuerpo se escribe en Markdown con ayuda de una barra de herramientas* → «Aplicar formato sin saber Markdown» de extremo a extremo.
- [x] 13.3 Añadir el marcado de casillas: crear una lista de cinco pasos, marcar el tercero, recargar y comprobar que sigue marcado y que los otros cuatro no cambiaron. Cubre *Las listas de verificación del cuerpo se marcan y persisten* → «Marcar una casilla la deja marcada», «Desmarcar también persiste».
- [x] 13.4 Añadir el adjuntado de una imagen y comprobar que el cuerpo se puede seguir editando y guardando mientras sube. Cubre *Los adjuntos se agregan arrastrando o eligiendo del equipo* → «Arrastrar una imagen la adjunta», «Elegir del equipo hace lo mismo»; y *Las imágenes se comprimen y todo adjunto sube en segundo plano* → «La tarea sigue editable mientras sube».
- [x] 13.5 Añadir quitar un adjunto y volver a adjuntar. Cubre *Una tarea admite hasta quince adjuntos vigentes* → «Quitar libera ranura», «Quitar archiva, no borra».
- [x] 13.6 Añadir el guardado por campo: cambiar el responsable sin tocar nada más y recargar. Cubre *Los campos de la tarea se editan y se guardan uno a uno* → «Cambiar el responsable no exige guardar nada más».
- [x] 13.7 Añadir el detalle en viewport de 390 px: la barra inferior no se rinde y no hay desplazamiento horizontal. Cubre *El detalle de tarea es una página con dirección propia* → «En móvil ocupa la pantalla completa».
- [x] 13.8 **Sin recorrido e2e, y queda dicho por qué**: no existe forma de archivar una tarea desde la interfaz. KAM-15 dejó la acción `archiveTask` y el filtro *Ver archivados*, pero ningún control que la invoque —hoy `archiveTask` no tiene un solo llamador—, así que no hay manera de llegar a una tarea archivada. El escenario *Una tarea archivada no se edita* sí está cubierto en el nivel unitario sobre los cuatro componentes que lo implementan (`task-fields`, `markdown-editor`, `checklist-preview`, `attachment-panel`). Falta el camino, no el comportamiento.
- [x] 13.9 Añadir el historial: crear una tarea, cambiar su estado y su responsable, y comprobar el orden y la primera entrada. Cubre *El historial de la tarea sale de la bitácora* → «Los cambios aparecen en el historial», «Una tarea recién creada tiene su primera entrada».

## 14. Cierre

- [x] 14.1 Comprobar que ningún otro punto de la aplicación rinde Markdown sin pasar por `MarkdownView` (D1).
- [x] 14.2 Cobertura: `lib/markdown/` 98,71 % de sentencias y 100 % de líneas; `services/tasks/` 95,86 % y 97,02 %; `lib/attachments/limits.ts`, `lib/markdown/toolbar.ts` y `lib/markdown/markdown-view.tsx` al 100 %. **`lib/attachments/` agregado queda en 65 %**, arrastrado por `compress-image.ts` (59 %), que es de KAM-09, no se toca en este cambio y tiene sin cubrir el códec de navegador —`createImageBitmap` y `canvas`—, que jsdom no puede ejercitar. Deuda preexistente, no introducida aquí.
- [x] 14.3 `lint` y `typecheck` limpios; `test:unit` 1251/1251; `test:integration` 12/12 y `supabase test db` 659/659 (tras `supabase db reset`: las corridas de e2e ensucian la base local y tumban `seed_geeko`); `build` correcto. **La suite e2e completa no queda verde, y no por este cambio**: falla un conjunto distinto en cada corrida —`fair-offline`, `order-edit`, `archive-restore`, `task-board`— y cada una pasa en aislamiento. Medido contra HEAD sin ninguno de estos cambios, `fair-offline` falla 5 pruebas y el arrastre del tablero falla 2 de 3 corridas; con este cambio, 1 de 3. `tests/e2e/task-detail.spec.ts` pasa de forma consistente: 7/7 en escritorio, 1/1 en móvil.
- [x] 14.4 Regenerar el grafo con `graphify update .` si el gancho no lo hizo.
- [x] 14.5 Actualizar `openspec/specs/` con `openspec sync` o archivar el cambio, según corresponda al cierre de la tarea.
