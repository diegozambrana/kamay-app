# Diseño · KAM-22

## Context

Ver `proposal.md` — *Why*. Lo que importa aquí es el estado del que se parte:

- **`activity_log` está lleno y no se toca.** La tabla, el `check` de acciones, `log_activity()` y la fusión de ruido son de KAM-03 (`20260820120000_activity_log.sql`) y de la corrección de `occurred_at` del sincronizado sin conexión (`20260903210000_offline_sync.sql`). Este cambio **lee** esa tabla y le añade índices; no altera su forma ni su trigger.
- **Cuatro índices existen**: `(organization_id, occurred_at desc)`, `(table_name, record_id, occurred_at desc)`, `(organization_id, business_line_id, occurred_at desc)` y un GIN sobre `changes`. Ninguno sirve para filtrar por autor ni por acción, y ninguno incluye `id` como desempate, que es lo que una paginación por cursor necesita.
- **`changes` guarda valores crudos**: `{"status_id": {"antes": "<uuid>", "despues": "<uuid>"}}`. Nada en la base traduce eso a «Estado: En diseño → En cola». La traducción es trabajo de la capa de lectura.
- **`origin` está siempre vacío.** El trigger la llena desde la cabecera `x-client-origin`; ningún cliente de Supabase del proyecto la envía.
- **La redacción ya existe a medias.** `lib/activity/describe.ts` tiene `describeEvent()` y `recordHref()` con diecisiete tablas en su diccionario de sujetos y tres en el de rutas. `ActivityService.recent()` lee con tope de 50.
- **El historial contextual está quintuplicado**: `order-detail.tsx`, `item-detail.tsx`, `expense-detail.tsx`, `task-history.tsx` y `asset-detail-panel.tsx` tienen cada uno su propio `ACTION_LABELS` y su propia disposición. Ninguno de los cinco usa `describeEvent()`.
- **El proyecto ya exporta a CSV, pero no tiene ningún trabajo programado ni `pg_cron`.** KAM-20 dejó `lib/reports/csv.ts` —RFC 4180, BOM UTF-8, cifras sin formato de moneda— y `app/(app)/reports/export/route.ts`, un Route Handler que reconsulta con los parámetros de la dirección y se guarda con `getOwnerContext()`. Los cuatro buckets de Storage (`attachments`, `receipts`, `item-photos`, `org-logos`) los creó KAM-06b con políticas que dan lectura a **cualquier miembro** de la organización dueña de la carpeta.
- **`/settings` ya no exige ser dueño en su layout.** KAM-17 bajó la guardia a cada sección para que las preferencias de notificación —que son de la persona— fueran alcanzables por el ayudante. El patrón vivo de «todo este árbol es del dueño» es hoy `app/(app)/expenses/layout.tsx`.
- **La base tiene 24 tablas con trigger `audit`**, no las dieciséis que `SUBJECTS` conoce: faltan `tasks`, `tags`, `invitations`, `inventory_movements`, `membership_lines`, `task_links` y `task_deliverables`. Que `tasks` no esté significa que hoy un evento de tarea se lee como «un registro».

## Goals / Non-Goals

**Goals**

- Una sola ruta de lectura de la bitácora para el panel, la pantalla V23 y los cuatro historiales contextuales, con las mismas reglas de acceso y la misma redacción.
- Que el criterio de los 2 segundos con 100.000 eventos sea consecuencia del plan de consulta —índice y cursor— y no de una caché ni de un recorte.
- Que la garantía «la retención no borra nada y no vacía sin haber exportado» viva donde una prueba pgTAP pueda comprobarla, no solo en el código de aplicación.
- Que el diccionario de campos no envejezca en silencio: cuando alguien añada una columna auditable, algo debe fallar.

**Non-Goals**

- Reescribir `log_activity()`, la fusión de ruido o el `check` de acciones.
- Una capa de caché o de materialización de la bitácora. `changes` se traduce al leer.
- Un componente de historial universal que absorba las decisiones de disposición de las cuatro pantallas que lo adoptan (supuesto 8 de la propuesta).
- La descarga de las exportaciones de retención por parte de la persona dueña: la exportación existe y se verifica; ofrecerla en la interfaz pertenece a la exportación completa de KAM-23.

## Decisions

### D1 · La lectura filtrada es PostgREST desde `ActivityService`, no una función `security definer`

`ActivityService.search(organizationId, filters, cursor)` construye la consulta con el cliente del usuario: RLS decide, y el servicio filtra además por `organization_id` explícitamente (convención nº 2).

*Alternativa descartada:* una función `search_activity()` con `security definer`. Habría que reescribir dentro de ella la regla `is_owner` que la política de RLS ya expresa, y toda divergencia futura entre las dos sería un agujero silencioso. La única razón para un `security definer` es hacer algo que el usuario no puede hacer; aquí el usuario **sí** puede leer su bitácora.

### D2 · Paginación por cursor `(occurred_at, id)`, nunca por desplazamiento

El orden es `occurred_at desc, id desc`; `id` es identidad creciente, así que el orden es total y estable. El cursor lleva ese par y la página siguiente pide `occurred_at < t OR (occurred_at = t AND id < i)`.

*Alternativa descartada:* `range()` por desplazamiento. Sobre 100.000 filas la página 200 obliga al motor a recorrer y descartar 10.000 filas, y un evento insertado entre dos páginas desplaza el corte y hace que una fila se repita o se pierda —exactamente lo que el escenario «Cargar más continúa donde quedó» prohíbe—.

Consecuencia: **la pantalla no pide el total**. Un `count` exacto sobre la bitácora filtrada es un recorrido completo, y es la mitad del presupuesto de los 2 segundos gastada en un número que nadie necesita.

### D3 · Tres índices nuevos, y uno viejo que se retira

Migración nueva:

- `(organization_id, occurred_at desc, id desc)` — la lista base y el cursor.
- `(organization_id, actor_id, occurred_at desc)` — el filtro por usuario.
- `(organization_id, action, occurred_at desc)` — el filtro por tipo de acción.

Y se **elimina** `(organization_id, occurred_at desc)`, que el primero cubre por prefijo. Se retira un índice, no se edita una migración: la convención nº 6 prohíbe tocar un archivo ya aplicado, no prohíbe corregir el esquema con uno nuevo. La bitácora recibe una escritura por cada operación del sistema; mantener un índice redundante en la tabla más escrita del proyecto se paga en cada alta.

`action` tiene cinco valores y por sí sola no justificaría un índice; con `organization_id` delante y `occurred_at` detrás sí, porque el filtro habitual —«enséñame los archivados»— es el más selectivo de la pantalla y el que peor se comporta sin él.

El filtro por línea y la búsqueda por registro usan los índices que ya existen.

### D4 · Los rótulos de registro se resuelven en lote, una consulta por tabla

`LabelService.resolve(events)` agrupa los `record_id` por `table_name` y lanza una consulta por tabla distinta —como mucho ocho por página— pidiendo el identificador y la columna que nombra al registro (`orders.order_number`, `items.name`, `contacts.name`, `tasks.title`, …). Una tabla sin columna que la nombre no aporta rótulo y su evento se cuenta sin él.

*Alternativa descartada:* una vista que una todas las tablas con su rótulo. Sería una vista de más de veinte ramas con `security_invoker` que habría que ampliar en cada tarea futura que añada una tabla auditable, y su plan sobre 100.000 eventos no es predecible. Lo que hoy hace `app/(app)/dashboard/page.tsx` a mano solo para pedidos pasa a esta pieza, y el panel la adopta.

### D5 · El diccionario de campos vive en `lib/`, y una prueba de integración lo obliga a estar completo

`lib/activity/fields.ts` mapea `tabla.columna` → rótulo en español y **clase de valor** (texto, importe, fecha, booleano, referencia a otra tabla), para las **24 tablas** que hoy llevan el trigger `audit`. `lib/activity/diff.ts` toma un `changes` y produce las filas *campo · antes · después*; las referencias se resuelven con el mismo mecanismo en lote de D4.

El trabajo es mayor de lo que parecía al diseñarlo: entre KAM-17 y KAM-21 la bitácora pasó a auditar `tasks`, `tags`, `invitations`, `inventory_movements`, `membership_lines`, `task_links` y `task_deliverables`, y ninguna de las siete está siquiera en el diccionario de sujetos de `describe.ts`. La consecuencia visible hoy es que **un evento de tarea se lee como «un registro»**.

El riesgo real es que el diccionario envejezca: alguien añade una columna en KAM-17 y V23 empieza a mostrar «Otro dato» sin que nadie se entere. Por eso la completitud se prueba **contra la base**: una prueba de integración lee las columnas reales de las tablas que llevan el trigger `audit` y falla si alguna auditable no tiene rótulo. Una prueba unitaria contra una lista escrita a mano solo comprobaría que la lista coincide consigo misma.

Un campo desconocido en tiempo de ejecución se rinde como «Otro dato» con sus valores. **No se humaniza el nombre de la columna**: convertir `body_markdown` en «Body markdown» es enseñar la columna con otra tipografía, y el requisito dice que no aparezca.

### D6 · La exportación del resultado filtrado es un Route Handler que reutiliza el CSV de reportes

`app/(app)/activity/export/route.ts`, calcado del que KAM-20 dejó en `app/(app)/reports/export/route.ts`: se guarda con `getOwnerContext()`, lee los filtros de los parámetros de la dirección, **reconsulta** en vez de serializar lo que quedó pintado, y devuelve el archivo con su `Content-Disposition`. La serialización es `toCsv()` de `lib/reports/csv.ts`, que ya resuelve el escapado RFC 4180, el BOM que evita que Excel abra «Sublimación» como «SublimaciÃ³n», y las cifras sin formato de moneda para que la columna se pueda sumar.

Su `CsvContext` —título, periodo, línea, leyenda— encaja sin tocarlo: el título es «Bitácora de actividad», el periodo es el rango filtrado o «Todo», y la línea es la filtrada o «Todas». Solo hace falta un nombre de archivo propio, porque `csvFilename()` es de informes.

*Alternativa descartada:* una Server Action que devuelva el texto y un `Blob` en el cliente. Era la decisión original de este diseño, y se cambia porque su único argumento —que un Route Handler sería un segundo camino de autenticación fuera de `actions/`— dejó de ser cierto: ese camino existe, está probado y es el que el proyecto ya usa para exportar. Mantener la Server Action obligaría además a escribir un segundo serializador CSV al lado del que ya funciona.

**Se reutiliza `lib/reports/csv.ts` donde está, sin moverlo** a un `lib/export/` compartido. El módulo es genérico pese a su carpeta, y moverlo arrastraría el código y las pruebas de un cambio recién fusionado por una ganancia de nomenclatura. Queda anotado como deuda menor.

El tope de 5.000 filas se mantiene y vive en `lib/activity/`: el Route Handler comprueba antes de producir nada y responde el aviso en lugar de un archivo recortado en silencio.

### D7 · La retención se parte en dos: la orquestación en Node, el vaciado en una función de la base

**Por qué partirla.** Postgres no puede escribir en Storage sin `pg_net` y sin guardar una clave dentro de la base; Node sí. Pero si el vaciado fuera solo código de aplicación, «`authenticated` no puede vaciar un evento» sería una promesa del código, no una regla del esquema, y ninguna prueba pgTAP podría comprobarla.

- **`purge_activity_detail(p_organization uuid, p_cutoff timestamptz) returns integer`** — `security definer`, con `execute` revocado a `public`, `authenticated` y `anon`. Pone `changes` a null donde la organización coincide, `occurred_at < p_cutoff` y `changes is not null`. No tiene ninguna sentencia `delete` ni toca ninguna otra columna. Devuelve cuántas filas vació. Esto es lo que prueba pgTAP: privilegios, que solo alcanza lo vencido, que no cruza organizaciones y que el conteo de filas no baja.
- **`RetentionService.run(organizationId)`** — con el cliente de service role: lee el plazo de la organización, lee los eventos vencidos con detalle, arma el CSV, lo sube, **lo vuelve a descargar y comprueba que lo escrito es lo que se quiso escribir**, y solo entonces llama a la función. Cualquier fallo antes de esa llamada deja la bitácora intacta porque nunca llegó a invocarla.

La verificación es una relectura, no un `if (!error)`. «Se subió sin error» y «está ahí y es legible» no son la misma afirmación, y el criterio de aceptación pide la segunda.

### D8 · Las exportaciones van a un bucket propio que ningún usuario puede leer

Bucket nuevo `activity-exports`, privado, **sin política para `authenticated`**: solo el service role escribe y lee. Ruta `{organization_id}/{fecha}-bitacora-hasta-{corte}.csv`.

*Alternativa descartada:* reutilizar el bucket `attachments`. Sus políticas dan lectura a `is_member(...)`, es decir **a cualquier miembro de la organización, ayudantes incluidos**. Un volcado de la bitácora en ese bucket entregaría al ayudante, en un solo archivo, exactamente lo que la RLS de `activity_log` le niega fila por fila. La comodidad de no crear un bucket no compensa abrir esa puerta.

### D9 · El plazo de retención vive en `organizations.settings`

`settings.activity_retention_months`, entero positivo, con doce por defecto **al leer** cuando la clave no existe. El esquema canónico ya declara ese `jsonb` como el sitio de «preferencias, retención, reparto», así que no hay columna nueva ni concepto nuevo (convenciones nº 6 y nº 11). El defecto se resuelve al leer y no con una migración que rellene la clave en todas las filas: así una organización creada mañana también lo tiene sin que nadie la actualice.

La sección nueva de V15 guarda por la acción de configuración existente, con la misma guardia de dueño.

### D10 · Los filtros son la dirección; la pantalla es un componente de servidor

`app/(app)/activity/page.tsx` lee `searchParams`, valida con Zod (`lib/activity/filters.ts`, puro y probado) y consulta. La barra de filtros es un componente de cliente que empuja al router. De ahí salen gratis los tres escenarios del requisito: el enlace se comparte, volver atrás recupera el filtro anterior, y el filtro se aplica en la consulta porque el servidor solo conoce la consulta.

El cursor viaja también en la dirección (`after`), de modo que *Cargar más* es navegación y no estado de cliente que se pierda al recargar.

### D11 · El historial contextual es un componente compartido en `components/`, no en `features/`

`components/activity/record-history.tsx`. Lo importan cinco rebanadas distintas —pedidos, catálogo, contactos, tareas y activos—, y una importación cruzada entre rebanadas rompería la separación por dominio; `components/` es precisamente la capa de presentación compartida donde ARCHITECTURE.md pone los «widgets de dominio». Recibe eventos ya resueltos y redactados: no consulta nada, igual que `RecentActivity`.

V12 · Activos no estaba en el backlog de KAM-22 porque cuando se escribió la propuesta no existía. Existe, y trajo el quinto `ACTION_LABELS` con su propia redacción. Entra en la unificación: dejar fuera la única pantalla nueva sería fabricar la divergencia que este cambio existe para eliminar.

Cada pantalla conserva su decisión de dónde ponerlo y de si aparece —V11 lo esconde por rol, V4 y V12 cuando llega vacío—: unificar también eso cambiaría el comportamiento de cinco pantallas ya especificadas y probadas.

### D12 · El origen se fija en el servidor a partir del agente de usuario

`lib/supabase/server.ts` añade la cabecera `x-client-origin` con `mobile` o `desktop` según el agente de usuario de la petición, con el mismo criterio que `defaultLandingPath()` ya usa para decidir el aterrizaje; `lib/supabase/client.ts` hace lo propio para las escrituras que salgan del navegador. El trigger la lee sin cambiar una línea.

Los eventos anteriores a este cambio quedan sin origen para siempre. La fila lo omite en vez de suponerlo: inventar «escritorio» para un evento del que no se sabe nada sería escribir historia falsa en la única pantalla cuyo trabajo es no hacerlo.

### D13 · La guardia de dueño se copia de egresos, no de configuración

`/activity` es un árbol entero reservado al dueño, así que su guardia va en `app/(app)/activity/layout.tsx` con `getOwnerContext()` y redirección a `defaultLandingPath()` — el patrón de `app/(app)/expenses/layout.tsx`.

**No** el de `app/(app)/settings/layout.tsx`, que era la referencia obvia hasta KAM-17 y dejó de serlo: allí la guardia bajó a cada sección para que las preferencias de notificación fueran alcanzables por el ayudante. De ahí se sigue que la sección de Retención de V15 **tiene que resolver su propio `getOwnerContext()`**, como hacen General, Líneas, Canales, Categorías, Unidades, Estados y Usuarios; heredarla del layout ya no protege nada.

### D14 · Los eventos de `asset_details` sí enlazan a su activo

El detalle de un activo se abre en `/assets?selected=<item_id>`, y el `record_id` que la bitácora guarda para un evento de `asset_details` **es** ese `item_id`: KAM-19 declaró `id` como columna generada, `generated always as (item_id) stored`, precisamente para que el trigger genérico —que lee `new.id`— pudiera auditar una tabla cuya clave primaria es `item_id`. El enlace es directo y `recordHref()` lo resuelve sin consultar nada.

> **Esta decisión decía lo contrario y estaba equivocada.** Se escribió suponiendo que `record_id` era el de una fila de detalle propia, y que traducirlo al ítem exigiría una consulta que una función pura no puede hacer. Al implementarla se comprobó contra la base: la columna generada existe desde `20260908160000_assets.sql`. Lo que sí se queda sin enlace es lo que de verdad no tiene pantalla propia —una línea de pedido, un movimiento de dinero—, tal como el requisito contempla.

Lo que `asset_details` **no** ofrece es desarchivar desde su evento, por otra razón: la tabla no tiene `archived_at`, así que nunca produce un evento de archivado.

## Risks / Trade-offs

- **La traducción de `changes` puede quedarse corta y mostrar «Otro dato» en producción** → la prueba de integración de D5 falla en CI en cuanto una tabla auditada estrena columna, que es cuando hay que arreglarlo y no cuando alguien lo ve en pantalla.
- **La resolución de rótulos y referencias añade consultas por página** → son una por tabla distinta y una por tabla referenciada, sobre páginas de como mucho 50 eventos, todas por clave primaria. Se mide en la prueba de rendimiento junto con la consulta principal; si algún día pesa, el remedio es reducir el tamaño de página, no materializar.
- **Retirar el índice `(organization_id, occurred_at desc)`** → el índice nuevo lo cubre por prefijo, y la prueba de plan de consulta sobre 100.000 eventos comprueba que la lista base lo sigue usando.
- **Un evento cuyo registro ya no se puede desarchivar por una validación de dominio** → la acción genérica delega en la del dominio y muestra su mensaje; la bitácora no se salta ninguna regla para conseguir que el botón funcione.
- **La rutina de retención no está agendada** → decisión explícita (supuesto 1). Mientras no se agende, la bitácora crece con todo su detalle: es el estado de hoy, no una regresión. El riesgo se materializa solo si KAM-23 se olvida de encenderla, y por eso el procedimiento queda escrito en la documentación del proyecto y hay un escenario que lo exige.
- **La exportación de retención no es descargable desde la interfaz** → queda en un bucket que solo el sistema lee. Si hiciera falta recuperarla antes de KAM-23, se baja con la clave de servicio. Abrirla a la persona dueña exigiría una política de Storage por rol que hoy ningún bucket tiene, y ese trabajo pertenece a la exportación completa.
- **`lib/reports/csv.ts` pasa a tener dos consumidores y sigue viviendo en `lib/reports/`** → el nombre de la carpeta miente un poco. Se acepta antes que mover un módulo que KAM-20 acaba de fusionar; el día que aparezca un tercer consumidor, el movimiento a `lib/export/` se justifica solo.
- **El tope de 5.000 filas de la exportación puede quedarse corto** → la pantalla lo dice antes de exportar y el filtro por fechas parte el trabajo. Es preferible a un archivo silenciosamente incompleto o a una acción que agota su tiempo.

### D15 · Los cinco `history()` de dominio se retiran

`OrderService.history()`, `ItemService.history()`, `ExpenseService.history()`, `TaskService.history()` y `AssetService.history()` hacían cada uno su propia consulta a `activity_log`. Las cinco páginas pasan a `loadRecordHistory()` y los métodos se van con sus pruebas.

No es limpieza cosmética. `OrderService.history()` ordenaba **solo** por `occurred_at`, sin desempate por `id`: con dos eventos del mismo instante —cosa habitual, la semilla tiene cincuenta— su orden podía diferir del de la bitácora general, y el requisito pide «los mismos eventos, con la misma redacción y el mismo orden». Mantener las cinco consultas habría sido mantener cinco maneras de estar en desacuerdo.

Esta decisión no estaba en el diseño porque al escribirlo no se sabía que existieran: se descubrieron al migrar la primera pantalla.

## Migration Plan

1. **Migración** `YYYYMMDDHHMMSS_activity_screen_retention.sql`: los tres índices nuevos, la retirada del índice redundante, `purge_activity_detail()` con sus revocaciones, y el bucket `activity-exports` sin política para `authenticated`. Con su prueba pgTAP en el mismo cambio (convención nº 6).
2. **Sin datos que migrar.** Ningún evento existente cambia. `settings.activity_retention_months` no se escribe en ninguna fila: el defecto de doce meses se resuelve al leer.
3. **Despliegue en un orden cualquiera.** La migración no rompe nada de lo que hay: los índices son aditivos, la función nueva no se invoca sola y el bucket nace vacío.
4. **Reversión.** Basta con no rendir `/activity`: la migración se puede dejar puesta sin efecto alguno, porque nada del sistema anterior depende de ella. La única pieza con efecto propio es `purge_activity_detail()`, y solo corre si alguien la llama con la clave de servicio.
5. **Verificación posterior** en local con `supabase db reset` y la semilla de Geeko: abrir `/activity`, filtrar por línea y por acción, expandir una fila, exportar, y ejecutar la retención con un plazo de cero meses sobre una organización de prueba para ver el ciclo completo de exportar, verificar y vaciar.
