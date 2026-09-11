# KAM-22 · Bitácora: pantalla, filtros y retención

## Why

Kamay lleva registrando desde el primer día. KAM-03 instaló `activity_log` con su trigger genérico antes de que existiera una sola fila de negocio, y desde entonces cada alta, cada edición, cada cambio de estado y cada archivado de pedidos, egresos, cobros, ítems, contactos, tareas y configuración ha ido a parar allí. Hoy hay meses de historia acumulada y **ninguna manera de leerla**: una tarjeta de cinco eventos en el panel, y bloques de historial dentro de cuatro pantallas de detalle, cada uno con su propia redacción.

El objetivo del backlog es concreto: responder *«qué cambió, quién y cuándo»* en menos de dos minutos, sin salir del sistema. Eso exige una pantalla con filtros que se acoten en la consulta y no en la cabeza de quien mira, filas que se abran para mostrar el antes y el después, y una salida —exportar— para lo que no se resuelve mirando.

Y exige cerrar el otro extremo: la bitácora es el grupo de datos de mayor volumen del sistema (§9 de la especificación funcional) y crece sin que nadie la borre nunca, porque no hay política `DELETE` en ninguna tabla. La retención a 12 meses es lo que evita que dentro de tres años la pantalla que este cambio construye sea inservible —y la exportación previa es lo que hace que resumir el detalle no sea perder información—.

> **Posición en la secuencia.** El backlog sitúa a KAM-22 en la fase 4 con **una sola dependencia: KAM-03**, que está implementada y archivada (`20260820120000_activity_log.sql`, `openspec/specs/activity-log/spec.md`). Cuando esta propuesta se escribió, KAM-17 a KAM-21 estaban pendientes y se declaró que KAM-22 no dependía de ellas; **desde entonces las cinco se fusionaron** (hasta `4afaf32`), y eso amplía el trabajo sin cambiar el objetivo: hay más tablas auditadas que redactar, una pantalla más con historial duplicado y una exportación a CSV que ya no hay que inventar. Lo que sí presupone es lo ya construido: `ActivityService.recent()`, `lib/activity/describe.ts`, y los bloques de historial de V4, V11, V12 y V18. Ver los supuestos registrados al final.

> **Buena parte de la lectura ya está escrita.** `describeEvent()` redacta la frase en lenguaje natural y `recordHref()` resuelve adónde lleva un evento; ambas nacieron en KAM-14 declarando en su propio comentario que «KAM-22 la hereda para V23 en vez de escribir una segunda redacción que acabaría diciendo otra cosa». Este cambio **las extiende, no las duplica**: la frase se enriquece con el detalle que hoy le falta, y el `recordHref` cubre las tablas que faltan. Lo mismo con `ActivityService`: la lectura acotada de la organización existe; lo nuevo es filtrarla y paginarla.

## What Changes

### V23 · Bitácora de actividad (nueva pantalla en `/activity`)

- **Página completa, solo dueño**, con la misma guardia que `/settings`: el ayudante que entra por dirección directa termina en su aterrizaje habitual, y la entrada no aparece en su menú. La seguridad real sigue siendo la RLS de `activity_log` —`is_owner`—, que le devolvería cero filas aunque llegara.
- **Aviso visible en la cabecera**: que la bitácora no puede editarse ni borrarse, y cuál es la política de retención vigente, leída de la configuración y no escrita a mano en la plantilla.
- **Lista cronológica invertida agrupada por día**, con encabezado de día (*Hoy*, *Ayer*, día de la semana) y su conteo de eventos, tal como el diseño de V23.
- **Cada fila**: hora, autor con sus iniciales, la frase en lenguaje natural, la línea de negocio con su color, el origen —móvil o escritorio— y el rótulo del registro afectado.
- **Fila expandible** con la tabla *campo · antes · después*, **solo con los campos que cambiaron**, con nombres de campo en español y valores legibles: un estado se lee por su nombre, no por su `uuid`; un importe con su moneda; una fecha en la zona horaria de la organización. Ningún nombre de columna llega a la pantalla.
- **Filtros**: rango de fechas, línea de negocio, usuario, tipo de registro, tipo de acción y búsqueda por identificador del registro. Todos **se aplican en la consulta**, no sobre el resultado ya cargado, y **viven en la dirección** para que un filtro se pueda compartir y para que volver atrás no lo pierda.
- **Paginación por cursor** (*Cargar más*): la pantalla nunca pide el total ni carga la bitácora entera. Con 100.000 eventos, la primera página y cada filtro responden por índice.
- **Acciones sobre el evento**: abrir el registro afectado cuando tiene pantalla propia, y **desarchivar** cuando el evento es de archivado y el registro sigue archivado. El desarchivado se delega a la acción que cada dominio ya tiene y **queda registrado a su vez** como un evento nuevo.
- **Exportar el resultado filtrado** a CSV, **generado en el servidor** reconsultando con los mismos filtros y con un tope de filas explícito. El archivo lleva la frase redactada y el detalle del cambio, no el `jsonb` crudo.
- **Estados vacío y sin resultados distinguidos**: «todavía no hay movimientos» no es lo mismo que «ningún evento coincide con estos filtros», y el segundo ofrece quitarlos.

### Historial contextual unificado (V4, V11, V12, V13, V18)

- **Un solo componente de historial** para las cinco pantallas, en lugar de las cinco redacciones que hoy conviven: `order-detail.tsx`, `item-detail.tsx`, `expense-detail.tsx`, `task-history.tsx` y `asset-detail-panel.tsx` tienen cada uno su propio `ACTION_LABELS` y su propia disposición. Pasan a compartir la del componente, que redacta con `describeEvent()` como la bitácora general.
- **V12 · Activos entra en la unificación.** No estaba en el backlog de KAM-22 porque cuando esto se escribió no existía; llegó con KAM-19 trayendo el quinto `ACTION_LABELS`. Dejar fuera la única pantalla nueva sería fabricar la divergencia que este cambio existe para eliminar.
- **V13 · Contactos estrena historial**: el panel de detalle del contacto no tiene ninguno hoy, y el backlog lo pide.
- **Cada bloque enlaza a `/activity` filtrada por ese registro**, sustituyendo los avisos de «llega con la pantalla de bitácora» que KAM-14 y KAM-16 dejaron declarados a la espera de esta tarea.
- **Los eventos que el bloque muestra son exactamente los que la bitácora general devuelve filtrada por ese registro**: no hay dos consultas con dos reglas.

### Retención y purga

- **Política de retención configurable** en `organizations.settings`, con 12 meses por defecto, editable desde una **sección nueva de V15**. La pantalla explica en una frase qué ocurre al cumplirse el plazo: el detalle del cambio se vacía, el evento se conserva.
- **Rutina de purga** que, para una organización y un plazo, **primero genera la exportación de los eventos afectados y verifica que quedó escrita**, y solo entonces vacía `changes`. Si la exportación falla, **no se vacía nada**.
- **Ninguna fila se borra jamás**: la purga resume, no elimina. Quién hizo qué y cuándo sobrevive a la retención; lo que se suelta es el detalle campo a campo.
- **El agendado mensual queda documentado y sin activar.** La rutina es invocable y está probada; encender `pg_cron` en producción pertenece a KAM-23 · puesta en producción, junto con las copias de seguridad y el resto de trabajos programados. Se declara así en lugar de dejar un `cron.schedule` que en local no corre y en producción nadie vigila.

### Capa de lectura

- **`ActivityService.search()`**: filtros, orden por `(occurred_at, id)` descendente y paginación por cursor, con tope de página. Convive con `recent()`, que el panel sigue usando.
- **Resolución de rótulos y autores en lote**: hoy el panel resuelve a mano el `#142` de los pedidos dentro de `page.tsx` y deja al resto de las tablas sin rótulo. Eso pasa a ser una pieza reutilizable que resuelve los rótulos de todas las tablas con pantalla propia en una consulta por tabla, no una por evento.
- **`lib/activity/` crece** con el diccionario de nombres de campo en español, el formato de valores y la construcción del diff legible, para las **24 tablas** que hoy llevan el trigger `audit`. Siete de ellas —`tasks` incluida— no están ni en el diccionario de sujetos de `describe.ts`, así que un evento de tarea se lee hoy como «un registro». Todo función pura, probado sin base de datos.
- **La serialización a CSV no se escribe: se reutiliza.** KAM-20 dejó `lib/reports/csv.ts` con el escapado RFC 4180 y el BOM que Excel necesita, y `app/(app)/reports/export/route.ts` como patrón de exportación guardada por dueño. La bitácora los usa en vez de duplicarlos.
- **`x-client-origin` empieza a enviarse.** La columna `origin` existe desde KAM-03 y el trigger la lee de esa cabecera, pero **ninguna parte de la aplicación la envía**: hoy es null en todos los eventos. La fila de V23 la muestra, así que este cambio la llena.

**Fuera de alcance** (copiado del backlog):
- Reversión de cambios individuales; recuperar es desarchivar.
- Registros técnicos de fallas del sistema.
- Notificaciones derivadas de la bitácora.

Derivado de lo anterior, tampoco entran: el agendado real del trabajo mensual con `pg_cron` (KAM-23); la exportación completa de todos los datos del sistema (KAM-23); los reportes y sus exportaciones, ya construidos por KAM-20 y que aquí solo se reutilizan; V20 · Mis pendientes, que es una lista de trabajo y no una pantalla de detalle con historial; la búsqueda por texto libre dentro de `changes`, descartada por el criterio de los 2 segundos; y cualquier cambio a la tabla `activity_log`, a su trigger o a sus reglas de fusión, que son de KAM-03 y no se tocan.

Tampoco entra **la deuda de `org-configuration` que KAM-17 dejó**: su spec principal sigue afirmando que el ayudante es redirigido de todo `/settings`, cuando la guardia bajó a cada sección para dejarle las preferencias de notificación. KAM-22 corrige la lista de secciones —porque añade una— y deja esa frase intacta, señalada para quien la deba arreglar.

## Capabilities

### New Capabilities

- `activity-screen`: la pantalla V23 —lista agrupada por día, filas expandibles con antes y después legibles, filtros en la consulta y en la dirección, paginación por cursor, apertura y desarchivado desde el evento, exportación del resultado filtrado— y el historial contextual unificado de V4, V11, V13 y V18, con la garantía de que dice lo mismo que la bitácora general filtrada por ese registro.
- `activity-retention`: la política de retención configurable y la rutina de purga que exporta y verifica antes de vaciar el detalle, sin borrar ninguna fila.

### Modified Capabilities

- `activity-log`: tres requisitos cambian. **(1)** La lectura acotada de la organización deja de ser solo «los N más recientes» y pasa a admitir filtros y paginación por cursor, manteniendo el techo por página y las reglas de acceso. **(2)** La inmutabilidad se matiza: `changes` puede vaciarse por la rutina de retención, que no es una escritura de usuario; ninguna fila se elimina y ningún otro campo se altera, y `authenticated` sigue sin poder escribir nada. **(3)** La redacción en lenguaje natural se extiende del titular al detalle: un evento debe poder rendirse también como un diff legible campo a campo, sin nombres de columna ni identificadores.
- `org-configuration`: V15 gana la sección Retención. El requisito de pantalla pasa a enumerar las secciones que existen de verdad —el spec principal se había quedado en las seis de KAM-04, sin Estados ni Notificaciones— y **su escenario deja de contarlas**: ese número ya se rompió dos veces, y lo que importa es que Retención esté, no cuántas hay. Se añade además que la sección se guarda a sí misma, porque desde KAM-17 el layout de `/settings` ya no lo hace por ella.

## Impact

**Código afectado**

- `app/(app)/activity/page.tsx` y su `layout.tsx` — página nueva y guardia de dueño, con el patrón de `app/(app)/expenses/layout.tsx` (el de `settings/layout.tsx` dejó de servir: KAM-17 bajó allí la guardia a cada sección). Lee los filtros de `searchParams`.
- `app/(app)/activity/export/route.ts` — exportación del resultado filtrado, calcada de `app/(app)/reports/export/route.ts`.
- `features/activity/` — rebanada nueva: la lista agrupada por día, la fila expandible, la barra de filtros, el diálogo de desarchivado y el botón de exportar.
- `components/activity/record-history.tsx` (o `features/activity/record-history.tsx`) — el bloque de historial contextual compartido por las cuatro pantallas de detalle.
- `features/orders/order-detail.tsx`, `features/catalog/item-detail.tsx`, `features/expenses/expense-detail.tsx`, `features/tasks/detail/task-history.tsx` — pasan a usar el bloque compartido y pierden su `ACTION_LABELS` propio.
- `features/assets/asset-detail-panel.tsx` — pasa al bloque compartido y pierde el quinto `ACTION_LABELS`.
- `features/contacts/contacts-screen.tsx` — el panel de detalle estrena su bloque de historial.
- `features/dashboard/recent-activity.tsx` — recibe por fin su `logHref`; el aviso de «la bitácora completa llega con la pantalla de actividad» se retira.
- `features/settings/retention-form.tsx` y `features/settings/settings-nav.tsx` — sección nueva de V15.
- `app/(app)/settings/retention/page.tsx` — ruta de la sección.
- `services/activity/activity-service.ts` — `search()` con filtros y cursor, `forRecord()` para el historial contextual, y `countExportable()`/lectura para la exportación. Ninguna consulta a Supabase sale de aquí (convención nº 1).
- `services/activity/label-service.ts` — resolución en lote de rótulos de registro y nombres de autor.
- `services/activity/retention-service.ts` — la rutina de exportación y vaciado, con el cliente de service role.
- `actions/activity.ts` — acción de desarchivado genérico, que delega en la acción del dominio. La exportación no vive aquí sino en su Route Handler, como la de reportes.
- `actions/configuration.ts` — guardado de la política de retención.
- `lib/activity/describe.ts` — se extiende: más tablas en `SUBJECTS` y en `recordHref`.
- `lib/activity/fields.ts`, `lib/activity/diff.ts`, `lib/activity/filters.ts` — nombres de campo en español para las 24 tablas auditadas, construcción del diff legible y lectura de filtros desde la dirección. Puras, cubiertas al 90 %.
- `lib/reports/csv.ts` — **se lee y no se modifica**: `toCsv()` sirve tal cual y la bitácora solo aporta su propio nombre de archivo.
- `lib/supabase/server.ts` y `lib/supabase/client.ts` — cabecera `x-client-origin`.
- `components/layout/` — la entrada *Bitácora* bajo «Más», solo para el dueño.

**Base de datos**

- **Una migración nueva.** No crea ni altera ninguna tabla de negocio: añade los índices que los filtros de V23 necesitan sobre `activity_log` —hoy hay cuatro, ninguno cubre el filtro por actor ni por acción—, la función de purga con `security definer`, y el bucket o prefijo de Storage donde aterrizan las exportaciones, con su política. `activity_log`, su `check` de acciones y el trigger `log_activity()` **no se modifican**.
- **No se activa `pg_cron`** en esta migración (decisión registrada arriba).

**Dependencias nuevas:** ninguna. El CSV ya está serializado a mano en `lib/reports/csv.ts` desde KAM-20 y se reutiliza.

**Pruebas**

- **Unitarias**: la construcción del diff legible, el diccionario de campos, el formato de valores, la lectura y escritura de filtros en la dirección, y el tope de la exportación. La serialización CSV ya tiene las suyas en `lib/reports/csv.test.ts` y no se reescriben.
- **Integración (pgTAP)**: que el historial de un registro coincide exactamente con la bitácora general filtrada por ese registro; que la rutina de retención exporta antes de vaciar y **no vacía nada si la exportación falla**; que la purga no elimina ninguna fila; que el ayudante sigue leyendo cero filas por cualquiera de los caminos nuevos; y el plan de consulta de la pantalla filtrada sobre un volumen grande.
- **e2e** (`activity.spec.ts`): filtrar, expandir una fila, desarchivar desde el evento y comprobar que el desarchivado queda registrado.

**Rendimiento:** el criterio 7 —100.000 eventos, respuesta bajo 2 segundos, sin cargar todo— es un requisito verificable, no una aspiración. La prueba de integración siembra ese volumen y comprueba que la consulta de la pantalla usa índice y que la paginación es por cursor y no por desplazamiento.

## Supuestos registrados

1. **El agendado mensual no se enciende aquí. — DECISIÓN DEL USUARIO.** La rutina de retención se construye completa, invocable y probada, y la política vive en V15; activar `pg_cron` en producción pertenece a KAM-23, donde ya se agrupan las copias de seguridad, el monitoreo y el despliegue. El criterio de aceptación 6 del backlog —«primero se genera y verifica la exportación, y solo entonces se vacía el detalle»— se cumple y se prueba sobre la rutina; lo que queda pendiente es *cuándo* la dispara el reloj, no *qué* hace.

2. **La exportación del resultado filtrado se genera en el servidor y tiene tope. — DECISIÓN DEL USUARIO.** Exportar solo lo que la página tiene cargado produciría un archivo que no es «el resultado filtrado» y engañaría a quien lo abra; exportar sin tope invitaría a un tiempo de espera agotado sobre 100.000 eventos. El tope se declara en `lib/` junto al resto de constantes y la pantalla avisa cuando el resultado lo supera, en lugar de recortar en silencio. **La forma cambió al revisar:** se hace con un Route Handler y `toCsv()` de KAM-20, no con una Server Action y un serializador propio (design D6).

3. **La búsqueda es por identificador del registro, no por texto libre. — DECISIÓN DEL USUARIO.** Escribir «142» encuentra los eventos del pedido #142; pegar un `uuid` también funciona. Se resuelve el identificador humano a `record_id` y se consulta por el índice `(table_name, record_id, occurred_at desc)` que ya existe. Buscar dentro de `changes` con el índice GIN queda fuera: su coste depende del contenido del `jsonb` y pondría el criterio de los 2 segundos a merced del dato.

4. **La retención se guarda en `organizations.settings`, no en una columna nueva.** El esquema canónico ya declara ese `jsonb` como el sitio de «preferencias, retención, reparto» (§ tabla `organizations`). No se inventa un concepto nuevo (convención nº 11) ni se altera una tabla existente para algo que su propio esquema ya previó.

5. **Vaciar `changes` no rompe la inmutabilidad de la bitácora; la matiza.** La regla de KAM-03 —`insert`, `update` y `delete` revocados para `authenticated` y `anon`— sigue intacta: ninguna persona puede alterar un evento. La purga corre con privilegio de sistema, solo puede poner `changes` a null en eventos más viejos que el plazo, y no puede tocar ningún otro campo ni eliminar ninguna fila. El delta de `activity-log` lo escribe como requisito, no como excepción tácita.

6. **El desarchivado desde el evento delega en la acción de cada dominio.** `actions/orders.ts`, `actions/catalog.ts`, `actions/contacts.ts`, `actions/expenses.ts` y `actions/configuration.ts` ya tienen su desarchivado, con sus validaciones y su `revalidatePath`. La bitácora despacha según `table_name` en lugar de escribir un `update archived_at = null` genérico que se saltaría esas validaciones. Un evento cuya tabla no tenga acción de desarchivado no ofrece el botón.

7. **El origen se deduce del agente de usuario en el servidor.** La cabecera `x-client-origin` la fija el cliente de Supabase del servidor a partir del agente de usuario —el mismo criterio que `defaultLandingPath()` ya usa para decidir el aterrizaje—, no una preferencia del navegador que cualquiera pueda falsear a mano. Los eventos anteriores a este cambio quedan sin origen y la fila lo omite en lugar de inventarlo.

8. **El bloque de historial compartido no se convierte en el componente de todo.** Rinde una lista de eventos redactados, con su expansión opcional, y nada más. Las cuatro pantallas que lo adoptan conservan su propia decisión de dónde ponerlo y de si el ayudante lo ve —V11 lo esconde por rol, V4 lo esconde cuando llega vacío—; unificar eso también sería cambiar el comportamiento de cuatro pantallas que ya están especificadas y probadas.

9. **KAM-22 se planificó sobre un repositorio que ya no existe. — REVISADO EL 2026-09-10.** Entre la propuesta y su implementación se fusionaron KAM-17 a KAM-21. Lo que eso cambió, y que está recogido arriba y en `design.md`: 24 tablas auditadas en vez de dieciséis, cinco historiales duplicados en vez de cuatro, exportación a CSV ya resuelta, y la guardia de `/settings` bajada a cada sección. Lo que **no** cambió: el objetivo, las capacidades declaradas y las tres decisiones del usuario sobre retención, exportación y búsqueda.

10. **Los eventos de `asset_details` sí llevan enlace. — CORREGIDO AL IMPLEMENTAR.** Se supuso que el `record_id` del evento era el de una fila de detalle propia y que traducirlo al ítem exigiría una consulta. No es así: KAM-19 declaró `asset_details.id` como columna generada `as (item_id) stored` para que el trigger genérico pudiera auditar una tabla cuya clave primaria es `item_id`, de modo que el `record_id` **es** el del ítem y `/assets?selected=<record_id>` funciona (design D14). Lo que sigue sin enlace es lo que de verdad no tiene pantalla propia: una línea de pedido, un movimiento de dinero.
