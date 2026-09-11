> Cada tarea de prueba nombra los escenarios del delta spec que cubre (convención nº 12: ningún escenario sin prueba referenciada). Los escenarios viven en `specs/activity-screen/`, `specs/activity-retention/`, `specs/activity-log/` y `specs/org-configuration/` de este cambio. Las decisiones citadas (D1–D12) son las de `design.md`.
>
> **Orden:** los grupos 1 a 4 son independientes entre sí y pueden repartirse. El grupo 6 depende del 2 y del 3; el 8 depende del 3 y del 6.
>
> **Revisado el 2026-09-10**, tras fusionarse KAM-17 a KAM-21: 24 tablas auditadas, cinco historiales duplicados, CSV ya resuelto por KAM-20 y guardia de `/settings` bajada a cada sección. Los grupos 0 y 1 se completaron antes de la revisión y no cambian.
>
> **Escenarios heredados.** Los deltas `activity-log` y `org-configuration` son MODIFIED y arrastran escenarios que ya existían y no cambian —«Newest first, capped», «Restricted to one business line», «Owner cannot alter the log», «Assistant reads zero rows», «Direct insert by a user is rejected», «A status change reads as a sentence», «A system actor is named», «An unknown action degrades gracefully», «Assistant is redirected from settings» y «Settings is absent from the assistant menu»—. Sus pruebas siguen donde estaban (`activity_recent.test.sql`, `activity_immutable.test.sql`, `describe.test.ts`, `settings.spec.ts`) y esta tarea no las reescribe.
>
> **Recordatorios del proyecto:** `throws_ok` de pgTAP con sus cuatro argumentos; las pruebas pgTAP se ejecutan con `supabase test db`, nunca con `psql`; tras cualquier cambio de esquema, `graphify update .`; la suite e2e tarda del orden de 18 minutos, así que se corre entera al final y no por tarea.

## 0. Condición de arranque

- [x] 0.1 Verificar que KAM-03 sigue en pie tal como este cambio lo presupone: `activity_log` con sus cinco acciones, el trigger `log_activity()`, la política de lectura `is_owner` y las revocaciones a `authenticated` y `anon`. Si algo difiere, detenerse y revisar `design.md` antes de tocar nada.
- [x] 0.2 Confirmar que `ActivityService.recent()`, `lib/activity/describe.ts` y los cuatro bloques de historial existentes (`order-detail.tsx`, `item-detail.tsx`, `expense-detail.tsx`, `task-history.tsx`) están donde el diseño dice. Son la base que se extiende, no se reescribe.
- [x] 0.3 Comprobar en la base local que `origin` está vacío en todos los eventos y que ninguna parte del código envía `x-client-origin`. Es el supuesto que justifica el grupo 4.

## 1. Migración: índices, función de purga y bucket

- [x] 1.1 Crear `supabase/migrations/YYYYMMDDHHMMSS_activity_screen_retention.sql` (D3): índices `(organization_id, occurred_at desc, id desc)`, `(organization_id, actor_id, occurred_at desc)` y `(organization_id, action, occurred_at desc)`.
- [x] 1.2 En la misma migración, eliminar el índice redundante `(organization_id, occurred_at desc)`, que el primero cubre por prefijo (D3). No se edita ninguna migración existente.
- [x] 1.3 Añadir `purge_activity_detail(p_organization uuid, p_cutoff timestamptz) returns integer` con `security definer`, `set search_path = public`, sin ninguna sentencia `delete`, tocando solo `changes` y solo donde `occurred_at < p_cutoff and changes is not null` (D7). Devuelve el número de filas vaciadas.
- [x] 1.4 Revocar `execute` sobre esa función a `public`, `authenticated` y `anon` (D7).
- [x] 1.5 Crear el bucket privado `activity-exports` **sin ninguna política para `authenticated`**, de modo que solo el service role escriba y lea (D8). Documentar en el propio SQL por qué no reutiliza `attachments`.
- [x] 1.6 `supabase/tests/activity_retention.test.sql` (pgTAP): cubre *La purga resume, nunca borra* → «El número de eventos no cambia», «Todo salvo el detalle sobrevive»; *Solo se vacían los eventos vencidos de la organización tratada* → «Lo reciente conserva su detalle», «Otra organización no se toca»; *La retención solo la ejecuta el sistema* → «Un usuario no puede purgar» (con `throws_ok` de cuatro argumentos, como dueño y como ayudante); y de `activity-log` *The activity log is immutable and owner-readable only* → «Retention may only empty the payload», «No row ever disappears».
- [x] 1.7 `supabase/tests/activity_immutable.test.sql` — **no se edita**: la garantía nueva de `activity-log` *No row ever disappears* se cubre en `activity_retention.test.sql`, junto a la purga que es lo único capaz de violarla.
- [x] 1.8 Ejecutar `supabase db reset` y `supabase test db`, y regenerar el grafo con `graphify update .`.

## 2. `lib/activity/`: filtros, campos, diff y CSV

- [x] 2.1 Crear `lib/activity/filters.ts` (D10): tipo de filtro, lectura desde `searchParams` con Zod, serialización a la dirección y normalización del rango de fechas a la zona horaria de la organización. Puro.
- [x] 2.2 Crear `lib/activity/fields.ts` (D5): `tabla.columna` → rótulo en español y clase de valor (`text | money | date | boolean | enum | reference:<tabla>`), cubriendo **las 24 tablas** con trigger `audit` (`asset_details`, `attachments`, `business_lines`, `contacts`, `expense_categories`, `expense_items`, `expenses`, `inventory_movements`, `invitations`, `item_variants`, `items`, `membership_lines`, `memberships`, `order_items`, `orders`, `organizations`, `payments`, `sales_channels`, `statuses`, `tags`, `task_deliverables`, `task_links`, `tasks`, `units`). Campo desconocido → «Otro dato»; **nunca** el nombre de la columna humanizado.
- [x] 2.3 Crear `lib/activity/diff.ts` (D5): de un `changes` a las filas *campo · antes · después*, con el valor ausente como marca de vacío explícita y el detalle purgado (`changes` nulo) como ausencia declarada, no como tabla vacía.
- [x] 2.4 **No** escribir un serializador CSV: `toCsv()` de `lib/reports/csv.ts` ya resuelve RFC 4180, el BOM de Excel y las cifras sin formato (D6). Declarar solo `MAX_EXPORT_ROWS = 5000` y el nombre de archivo de la bitácora en `lib/activity/export.ts`, porque `csvFilename()` es de informes.
- [x] 2.5 Extender `lib/activity/describe.ts`: añadir a `SUBJECTS` las **siete** tablas auditadas que faltan —`tasks`, `tags`, `invitations`, `inventory_movements`, `membership_lines`, `task_links`, `task_deliverables`—, empezando por `tasks`, que hoy hace que un evento de tarea se lea como «un registro». Y `recordHref()` con `tasks` (`/tasks/<id>`) y `contacts` (`/contacts?id=<id>`). `asset_details` se queda **sin** enlace a propósito (D14).
- [x] 2.10 `lib/activity/grouping.ts` y su prueba: el agrupado por día, el rótulo del encabezado y la hora local, en el servidor y en la zona de la organización (design D10). Destapó que la medianoche salía como «24:00» con `hour12: false`.
- [x] 2.6 `lib/activity/filters.test.ts`: cubre *Los filtros se aplican en la consulta y viven en la dirección* → «El filtro se comparte por enlace», «Volver atrás recupera el filtro anterior», «Los filtros se combinan» en su parte pura (ida y vuelta a la dirección, valores inválidos descartados).
- [x] 2.7 `lib/activity/diff.test.ts`: cubre *La fila expandida muestra el antes y el después de los campos que cambiaron* → «Solo los campos que cambiaron», «Ningún nombre de columna llega a la pantalla», «Un detalle purgado se explica», «Una referencia se lee por su nombre»; y de `activity-log` *An event can be rendered as a natural-language sentence* → «The detail names its fields in the product's language», «A referenced record reads by its name», «An unknown field still renders», «An emptied payload states its absence».
- [x] 2.8 `lib/activity/export.test.ts`: cubre *El resultado filtrado se exporta* → el tope de filas y el nombre de archivo. «Un valor con separadores no rompe el archivo» ya está cubierto por `lib/reports/csv.test.ts` y no se reescribe; comprobar que ese caso está allí y referenciarlo.
- [x] 2.9 Ampliar `lib/activity/describe.test.ts` con las tablas y rutas nuevas, sin tocar los casos existentes.

## 3. Capa de servicios: búsqueda, rótulos y referencias

- [x] 3.1 Añadir `search(organizationId, filters, cursor)` a `services/activity/activity-service.ts` (D1, D2): filtros por fecha, línea, actor, tabla, acción y registro; orden `occurred_at desc, id desc`; cursor con el par `(occurred_at, id)`; techo de página propio del servicio; sin `count`.
- [x] 3.2 Añadir `forRecord(organizationId, tableName, recordId, limit)` para el historial contextual, leyendo la **misma** tabla con las mismas reglas (D1).
- [x] 3.3 Crear `services/activity/label-service.ts` (D4): agrupa `record_id` por `table_name`, una consulta por tabla, devuelve el rótulo humano de cada registro y `null` para las tablas que no tienen uno.
- [x] 3.4 Añadir a `LabelService` la resolución en lote de los valores de referencia del diff (estados, líneas, contactos, ítems, unidades, categorías), que `lib/activity/diff.ts` consume ya resueltos.
- [x] 3.5 Migrar `app/(app)/dashboard/page.tsx` a `LabelService`, retirando la resolución a mano de los códigos de pedido (D4). El panel debe seguir rindiendo exactamente igual.
- [x] 3.6 `services/activity/activity-service.test.ts`: ampliar para cubrir de `activity-log` *Recent activity is read through one bounded, owner-only query* → «Narrowed by actor, action and date range», «Narrowed to one record», «A cursor continues exactly where the page ended», «The cap cannot be lifted by paging»; y de `activity-screen` *La pantalla nunca carga la bitácora entera* → «La primera página está acotada», «El techo de página no se puede superar».
- [x] 3.7 `services/activity/label-service.test.ts`: una consulta por tabla distinta, tabla sin rótulo devuelve `null`, y ningún registro de otra organización se resuelve.

## 4. Origen del cambio

- [x] 4.1 Fijar la cabecera `x-client-origin` en `lib/supabase/server.ts` a partir del agente de usuario de la petición, con el mismo criterio que `defaultLandingPath()` (D12).
- [x] 4.2 Fijar la misma cabecera en `lib/supabase/client.ts` para las escrituras que salgan del navegador (D12).
- [x] 4.3 Prueba unitaria de la deducción de origen a partir del agente de usuario; cubre *Cada fila se lee como una frase y trae su contexto* → «Un evento sin origen no lo inventa» en su parte pura.

## 5. Retención: política, rutina y sección de V15

- [x] 5.1 Leer y escribir `settings.activity_retention_months` (D9): lectura con doce meses por defecto cuando la clave no existe, y validación Zod de entero positivo. Cubre *La retención es una política de la organización* → «Sin configurar, doce meses», «Un plazo inválido se rechaza».
- [x] 5.2 Añadir la acción de guardado en `actions/configuration.ts`, con la guardia de dueño de las demás secciones. Cubre → «La persona dueña cambia el plazo», «El ayudante no cambia la política».
- [x] 5.3 Crear `features/settings/retention-form.tsx` y `app/(app)/settings/retention/page.tsx` con su **propio** `getOwnerContext()` —desde KAM-17 el layout de `/settings` ya no guarda por sus secciones (D13)—, y añadir la entrada `ownerOnly: true` a `features/settings/settings-nav.tsx`. La sección explica en una frase qué ocurre al cumplirse el plazo. Cubre de `org-configuration` *The settings screen is a full page reserved to the owner* → «Owner opens settings», «The Retention section states what expiry does», «The Retention section guards itself».
- [x] 5.4 Crear `services/activity/retention-service.ts` con `run(organizationId)` (D7): plazo → eventos vencidos con detalle → CSV → subida a `activity-exports` → **relectura y verificación** → llamada a `purge_activity_detail`. Ningún vaciado antes de la verificación.
- [x] 5.5 Informar al terminar el número de eventos exportados, el número vaciados y la ubicación de la exportación. Cubre *La purga exporta y verifica antes de vaciar el detalle* → «La rutina informa lo que hizo».
- [x] 5.6 Documentar en `openspec/project.md` —o donde el proyecto recoja los trabajos programados— cómo se agenda la rutina en producción y por qué no se agenda aquí. Cubre *La retención solo la ejecuta el sistema* → «El procedimiento de activación está documentado».
- [x] 5.7 `tests/integration/activity-retention.test.ts` contra la base local: cubre *La purga exporta y verifica antes de vaciar el detalle* → «Primero exporta, después vacía»; *Si la exportación falla, no se vacía nada* → «Exportación fallida, bitácora intacta», «Exportación no verificable, bitácora intacta»; *Solo se vacían los eventos vencidos* → «Cada organización se rige por su propio plazo»; *Un evento purgado se sigue leyendo* → «Sigue en la lista y se lee», «El detalle ausente se declara»; y *La retención solo la ejecuta el sistema* → «Nada se purga sin ejecutarla».

## 6. V23 · la pantalla

- [x] 6.1 Crear `app/(app)/activity/layout.tsx` con la guardia de dueño del patrón de `app/(app)/expenses/layout.tsx` —`getOwnerContext()` y redirección a `defaultLandingPath()`—, **no** el de `settings/layout.tsx`, que dejó de exigir dueño en KAM-17 (D13). Cubre *La bitácora es una página completa reservada a la persona dueña* → «La persona dueña abre la bitácora», «El ayudante es redirigido».
- [x] 6.2 Añadir la entrada *Bitácora* bajo «Más» en la navegación, solo para el dueño. Cubre → «La bitácora no aparece en el menú del ayudante».
- [x] 6.3 Crear `app/(app)/activity/page.tsx` (D10): lee y valida `searchParams`, consulta `ActivityService.search()`, resuelve rótulos, autores y referencias, y rinde. Componente de servidor.
- [x] 6.4 Crear `features/activity/activity-header.tsx`: aviso de inmutabilidad y plazo de retención leído de la configuración. Cubre *La cabecera declara que la bitácora no se edita* → «El aviso refleja la política guardada», «La inmutabilidad se declara».
- [x] 6.5 Crear `features/activity/activity-list.tsx`: agrupación por día con encabezado y conteo, orden inverso, desempate estable. Cubre *Los eventos se listan del más reciente al más antiguo, agrupados por día* → «Orden inverso por día», «El conteo del día es el de sus eventos», «El orden no baila entre recargas», en `lib/activity/grouping.test.ts` (el agrupado es puro y vive en el servidor: en el navegador cada evento caería en el día de quien mira).
- [x] 6.6 Crear `features/activity/activity-row.tsx`: hora, autor e iniciales, frase de `describeEvent()`, línea con su color, origen cuando conste, rótulo del registro. Cubre *Cada fila se lee como una frase y trae su contexto* → «Un cambio de estado se lee como frase», «Un evento sin origen no lo inventa», «El autor no humano se nombra por su etiqueta».
- [x] 6.7 Añadir la expansión de la fila con la tabla *campo · antes · después*, alimentada por `lib/activity/diff.ts`. Cubre *La fila expandida muestra el antes y el después* → «Una referencia se lee por su nombre» (los demás escenarios del requisito se cubren en 2.7).
- [x] 6.8 Crear `features/activity/activity-filters.tsx`: barra de filtros de cliente que empuja a la dirección, con fecha, línea, usuario, tipo de registro, tipo de acción y búsqueda.
- [x] 6.9 Resolver la búsqueda por identificador humano a `record_id` antes de consultar, aceptando también el identificador interno pegado. Cubre *La búsqueda encuentra los eventos de un registro por su identificador* → «Buscar por el número del pedido», «Buscar por identificador interno», «Una búsqueda sin correspondencia».
- [x] 6.10 Añadir *Cargar más* como navegación con el cursor en la dirección (D2, D10). Cubre *La pantalla nunca carga la bitácora entera* → «Cargar más continúa donde quedó».
- [x] 6.11 Rendir los dos estados vacíos distinguidos. Cubre *El vacío inicial y el resultado sin coincidencias se distinguen* → «Sin eventos todavía», «Ningún evento coincide» (e2e 10.5).
- [x] 6.12 Enlazar cada evento a su registro con `recordHref()`, sin enlace cuando no hay destino y sin retirarlo por estar archivado. Cubre *Desde el evento se llega al registro afectado* → «El evento de un pedido lleva a su pedido», «Un evento sin destino se rinde sin enlace», «Lo archivado sigue siendo alcanzable», en `lib/activity/describe.test.ts` sobre `recordHref()`.

## 7. Acciones sobre el evento: desarchivar y exportar

- [x] 7.1 Crear `actions/activity.ts` con el desarchivado que despacha por `table_name` a la acción de dominio existente (D del supuesto 6 de la propuesta), sin ningún `update archived_at = null` genérico.
- [x] 7.2 Ofrecer la acción solo cuando el evento es de archivado, el registro sigue archivado y su tabla tiene desarchivado. Cubre *Un evento de archivado permite desarchivar* → «Ya desarchivado, sin acción».
- [x] 7.3 Crear `app/(app)/activity/export/route.ts` (D6), calcado de `app/(app)/reports/export/route.ts`: `getOwnerContext()`, lee los filtros de los parámetros de la dirección, **reconsulta** hasta el tope, redacta cada fila y responde con `toCsv()` de `lib/reports/csv.ts` y su `Content-Disposition`. Responde el aviso **antes** de producir nada cuando el resultado supera el tope.
- [x] 7.4 Conectar el botón de exportar en la pantalla: un enlace a esa ruta con los filtros vigentes, como hace la pantalla de reportes. Sin `Blob` ni descarga armada en el cliente.
- [x] 7.5 Pruebas unitarias de `actions/activity.ts` y de la ruta de exportación: despacho por tabla, negativa cuando la tabla no admite desarchivado, y el aviso de tope. Cubre *El resultado filtrado se exporta* → «Se exporta lo filtrado, no lo cargado», «El archivo es legible», «Un resultado por encima del techo se avisa».

## 8. Historial contextual unificado

- [x] 8.1 Crear `components/activity/record-history.tsx` (D11): recibe eventos ya resueltos y redactados, no consulta nada, y ofrece el paso a `/activity` filtrada por ese registro. Lo comparten **cinco** rebanadas.
- [x] 8.2 Migrar `features/orders/order-detail.tsx` al componente compartido, retirando su `ACTION_LABELS`.
- [x] 8.3 Migrar `features/catalog/item-detail.tsx`, conservando su condición de rol para mostrar el bloque.
- [x] 8.4 Migrar `features/expenses/expense-detail.tsx`.
- [x] 8.5 Migrar `features/tasks/detail/task-history.tsx`, retirando el aviso `activity-link-pending`.
- [x] 8.6 Añadir el bloque al panel de detalle de `features/contacts/contacts-screen.tsx`, leyendo con `ActivityService.forRecord()`. Cubre *Toda pantalla de detalle con historial lo lee de la bitácora y lleva a ella* → «El contacto estrena historial», «Del historial a la bitácora filtrada».
- [x] 8.6b Migrar `features/assets/asset-detail-panel.tsx` al bloque compartido, retirando el quinto `ACTION_LABELS`. Cubre el mismo requisito → «El activo se suma a la redacción común».
- [x] 8.7 Pasar `logHref` a `features/dashboard/recent-activity.tsx` y retirar el aviso de pantalla pendiente. Cubre → «Ya no queda ningún aviso de pantalla pendiente», y de `dashboard` *El panel es un punto de partida* → «Del movimiento a la bitácora».
- [x] 8.8 `components/activity/record-history.test.tsx`: cubre *El historial de un registro coincide con la bitácora filtrada por ese registro* → «El ayudante ve el bloque vacío, no un error», y la redacción compartida.
- [x] 8.10 Retirar los cinco `history()` de dominio que quedaron sin uso —`OrderService`, `ItemService`, `ExpenseService`, `TaskService`, `AssetService`— y sus pruebas. **No era limpieza opcional:** `OrderService.history()` ordenaba sin desempate por `id`, así que con eventos del mismo instante su orden podía diferir del de la bitácora general, y el requisito exige «el mismo orden». La garantía de la convención nº 7 se afirma ahora una vez, en `ActivityService.forRecord`.
- [x] 8.9 Ajustar las pruebas existentes de las seis pantallas tocadas —las cinco migradas más el panel— para que sigan pasando con la redacción nueva, sin relajar lo que ya comprobaban. `asset-detail-panel.test.tsx` es la que más cambia.

## 9. Coincidencia y rendimiento

- [x] 9.1 `tests/integration/activity-history-parity.test.ts`: cubre *El historial de un registro coincide con la bitácora filtrada por ese registro* → «Los eventos coinciden uno a uno», «La redacción es la misma», contra la base real y como usuario autenticado.
- [x] 9.2 `tests/integration/activity-performance.test.ts`: sembrar cien mil eventos en una organización de prueba y comprobar que la lista filtrada responde en menos de dos segundos. Cubre *La pantalla nunca carga la bitácora entera* → «Respuesta bajo dos segundos con cien mil eventos».
- [x] 9.3 En la misma prueba, comprobar con el plan de consulta que la lista base y cada filtro usan índice y que la paginación no recorre lo ya leído (D2, D3). Cubre el mismo escenario en su segunda mitad.
- [x] 9.4 `tests/integration/activity-fields-coverage.test.ts` (D5): leer de la base las columnas de **las 24 tablas** que llevan el trigger `audit` y fallar si alguna auditable no tiene rótulo en `lib/activity/fields.ts`. Es la prueba que evita que el diccionario vuelva a quedarse atrás como le pasó a `SUBJECTS` entre KAM-17 y KAM-21.
- [x] 9.5 Comprobar en integración que el ayudante obtiene cero filas por cada camino nuevo —`search`, `forRecord` y `recent`—; la exportación se guarda con `getOwnerContext()` y su negativa se cubre en `app/(app)/activity/export/route.test.ts`. Vive en `activity-history-parity.test.ts`, que ya monta las dos sesiones. Cubre de `activity-log` *Recent activity is read through one bounded, owner-only query* → «Assistant still reads nothing», «Another organization's events never appear».

## 10. e2e

- [x] 10.1 `tests/e2e/activity.spec.ts`: filtrar por línea y por acción, comprobar que la dirección lleva el filtro y que volver atrás lo recupera. Cubre *Los filtros se aplican en la consulta y viven en la dirección* → «El filtro se aplica en la consulta».
- [x] 10.2 Expandir una fila y verificar que muestra el antes y el después de un solo campo, con su nombre en español.
- [x] 10.3 Desarchivar desde un evento de archivado y comprobar que el registro vuelve y que aparece un evento nuevo de desarchivado. Cubre *Un evento de archivado permite desarchivar* → «Desarchivar desde el evento», «El desarchivado se registra».
- [x] 10.5 Distinguir en e2e el vacío inicial del resultado sin coincidencias, con su salida para quitar los filtros. Cubre *El vacío inicial y el resultado sin coincidencias se distinguen* → «Ningún evento coincide».
- [x] 10.4 Comprobar como ayudante que `/activity` redirige y que la entrada no está en el menú, ampliando `tests/e2e/assistant-permissions.spec.ts` en vez de duplicar su montaje.

## 11. Cierre

- [x] 11.1 `npm run lint` y `npm run typecheck` limpios.
- [x] 11.2 `npm run test:unit` con la cobertura mínima de 90 % sostenida en `lib/` y `services/`.
- [x] 11.3 `supabase db reset`, `supabase test db` y `npm run test:integration` en verde.
- [x] 11.4 `npm run test:e2e` completa una vez, al final. **Resultado:** la suite completa en local es intermitente por carga (`retries: 0` en local, 2 en CI; siete trabajadores contra un servidor de desarrollo que compila rutas al vuelo). Cada fallo de la corrida final se volvió a ejecutar aislado: todos pasan salvo `task-board.spec.ts:107`, que **ya fallaba en `HEAD`** con los cambios de KAM-22 guardados. Dos fallos eran de este cambio y se arreglaron: `task-detail.spec.ts` y `order-payments.spec.ts` buscaban los rótulos viejos del historial («Editada», «Registrado»).
- [x] 11.5 `graphify update .` y `npm run build`.
- [x] 11.6 `openspec validate kam-22-activity-screen-retention --strict` y repaso de que ningún escenario de los cuatro deltas quedó sin prueba referenciada.
