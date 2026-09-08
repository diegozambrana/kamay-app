# KAM-16 · Diseño

## Context

Ver `proposal.md` — Why. Lo que importa aquí es el estado del código en el que aterriza este cambio:

- **Nada de tareas existe todavía.** No hay `features/tasks/`, ni `services/tasks/`, ni `actions/tasks.ts`, ni migración `tasks`. Todo eso llega con KAM-15. Este diseño describe lo que KAM-16 **añade** sobre esa base, y `tasks.md` abre comprobando que la base está.
- **`attachments` ya está instalada y es genérica** (`20260826180000_attachments.sql`): `entity_type` admite `'task'` desde el primer día, el `check` de 5 MB por archivo vive en la tabla, `path_starts_with_organization` obliga a la ruta verificable, hay trigger de bitácora, RLS por `is_member()` y **ninguna política `DELETE`**.
- **Los cuatro buckets privados y las tres políticas de `storage.objects` ya existen** desde esa misma migración, y cubren `attachments` entre ellos. La política comprueba `is_member((storage.foldername(name))[1]::uuid)`: la primera carpeta de la ruta es el `organization_id`.
- **`AttachmentService` (`services/catalog/attachment-service.ts`) ya resuelve** ruta canónica (`storagePath()`), subida con retirada del objeto si la fila falla, archivado y firma en lote por bucket (`signedUrls()`, TTL de una hora). Lo que **no** hace: no expone `uploaded_by` —no está en su `COLUMNS`—, no cuenta adjuntos vigentes, y solo lista por lote de entidades (`listForEntities`).
- **`compressImage` (`lib/attachments/compress-image.ts`)** comprime en el navegador sin dependencia nueva: `createImageBitmap` + `canvas.toBlob`, lado mayor a 1600 px, calidad por escalones, tope de entrada de 20 MB, WebP con reserva JPEG. Acepta JPEG, PNG, WebP y AVIF.
- **`receipt-upload-store.ts` (KAM-09)** es el precedente de subida en segundo plano: store de Zustand con estado de interfaz —`pending` / `failed`— indexado por registro, un `uploader` inyectable para probarlo sin red, y `hasPendingUploads()` para el aviso de `beforeunload`. Es de **un archivo por egreso**; una tarea admite quince.
- **`OrderService.history()`, `ExpenseService.history()` e `ItemService.history()`** ya son el mismo método tres veces: `activity_log` filtrado por `table_name` y `record_id`, `occurred_at` descendente, `limit(50)`. El ayudante recibe vacío por RLS, no un error.
- **`isCaptureRoute()` en `components/layout/mobile-nav.tsx`** decide dónde la barra inferior no se rinde. Hoy conoce cuatro rutas; `/tasks/[id]` es la quinta.
- **`useIsMobile()`** decide en cliente lo que puede corregirse tras hidratar; `defaultLandingPath(userAgent)` decide en servidor lo que no.
- **La única prueba de `storage.objects` que existe** (`supabase/tests/attachments.test.sql`) comprueba que los buckets existen, que ninguno es público y que `item-photos` limita a 5 MB. **No prueba las políticas entre organizaciones.** El criterio 5 del backlog lo exige, y esa es la única deuda de base de datos que este cambio salda.

## Goals / Non-Goals

**Goals**

- No tocar el esquema. Ni una migración: la infraestructura de adjuntos ya está y el modelo de tareas es de KAM-15. La deuda que sí se salda es de **prueba**, no de esquema.
- Que el saneado sea una función pura de `lib/`, probable sin rendir nada, y que **toda** lectura del cuerpo pase por ella: una segunda ruta de renderizado sin sanear es exactamente el agujero que el criterio 3 quiere cerrar.
- Que el marcado de una casilla sea una reescritura de línea, verificable con una prueba unitaria sobre cadenas de texto, sin base de datos ni navegador.
- Reutilizar `AttachmentService` y `compressImage` en lugar de escribir una segunda ruta de adjuntos. Lo que falta se **añade** a esos módulos, para que el detalle de pedido y el de ítem hereden la mejora.
- Que la edición de la tarea nunca espere a una subida, ni una subida a otra.

**Non-Goals**

- No se define nada del modelo de tareas: `tasks`, sus estados, su tablero y su alta son de KAM-15. Si al implementar KAM-15 el modelo se desvía del esquema canónico, este diseño se revisa antes de aplicarse.
- No se generaliza el editor Markdown a otros dominios. La nota de pedido y la de egreso siguen siendo texto plano; convertirlas es una decisión de producto que nadie ha tomado.
- No se toca el modo sin conexión. Los adjuntos exigen conexión, como los de pedido, y el cuerpo se guarda con las mismas reglas que cualquier otra escritura directa.
- No se construye la sección *Vínculos* ni el cierre con entregables (KAM-21).

## Decisions

### D1 · El saneado vive en `lib/markdown/`, se aplica al rendir y es la única puerta

Un módulo `lib/markdown/sanitize.ts` exporta el esquema de saneado —el de `rehype-sanitize` por omisión, recortado— y `lib/markdown/markdown-view.tsx` es el **único** componente que rinde Markdown en la aplicación: `react-markdown` con `remark-gfm` y `rehype-sanitize` ya cableados, sin admitir que quien lo use desactive el saneado.

*Por qué:* el criterio 3 no se cumple con «se sanea en la vista previa»; se cumple si no existe manera de rendir el cuerpo sin sanear. Un componente único con el saneado dentro convierte el requisito en una propiedad estructural en vez de una disciplina que hay que recordar en cada llamada.

*El HTML crudo no se interpreta.* `react-markdown` descarta por omisión toda etiqueta escrita a mano en el cuerpo, y este cambio **no añade `rehype-raw`**: un `<script>`, un `<iframe>` o un `<img onerror=…>` no llegan al documento, ni como elemento ni como texto. Es una defensa anterior al saneado y más fuerte que él, porque no depende de que el esquema esté completo. Lo que el editor produce es Markdown, así que el cuerpo no pierde nada.

*El esquema de partida es `defaultSchema` recortado*, no una lista de permitidos escrita a mano: la lista de esquemas de URL peligrosos es larga y se descubre por incidentes. Sobre lo que sí produce la sintaxis Markdown se le **quita** el `src` de `img` —una imagen del cuerpo tendría que salir de los adjuntos, y hoy no hay forma de referenciarlos desde el Markdown, así que cualquier `src` apunta a un servidor de terceros que registraría quién mira la tarea— y se le **añade** lo que `remark-gfm` necesita para las listas de verificación: `input` con `type` y `checked`, y las clases que marcan el elemento de lista.

*Alternativa descartada:* sanear al guardar. Destruye lo que la persona escribió, hace irreversible un falso positivo, y deja sin proteger los cuerpos guardados antes de que el saneado existiera. Sanear al rendir cuesta un paso por lectura y protege todas.

*Alternativa descartada:* renderizar el Markdown en el servidor a HTML y guardarlo. Es una columna derivada —convención nº 4— y obliga a re-renderizar todo el histórico cada vez que cambia el esquema de saneado.

### D2 · Marcar una casilla es una reescritura de línea, con índice de ocurrencia

`lib/markdown/checklist.ts` expone `toggleChecklistItem(body, index, checked)`: recorre las líneas, cuenta las que casan con el patrón de casilla —`- [ ]`, `- [x]`, con sangría y con `*` o `-`—, y reescribe **solo** la línea número `index`, preservando su sangría, su marcador y su texto. Devuelve el cuerpo sin tocar si el índice no existe.

*Por qué:* el esquema no tiene tabla de ítems de lista de verificación y no se inventa ninguna (convención nº 11); el cuerpo es el dato. Aislar el alternado en una función pura sobre cadenas hace que los casos difíciles —sangría anidada, una casilla dentro de un bloque de código, texto que parece casilla— se prueben sin navegador ni base de datos.

*El índice es de ocurrencia, no de línea:* `react-markdown` entrega el elemento `input`, no el número de línea del original. Contar casillas en el mismo orden en que se rinden es lo que hace que el índice del clic y el índice de la reescritura sean el mismo, y una prueba lo fija: rendir un cuerpo y alternar la enésima casilla deja marcada esa y solo esa.

*Riesgo conocido, y por qué se acepta:* una casilla escrita dentro de un bloque de código cercado se cuenta como casilla en el texto pero no se rinde como tal, y los índices se desalinean. Se resuelve saltando los bloques cercados en el recorrido, que es un caso de la misma función pura y por tanto una prueba más, no un mecanismo nuevo.

*Alternativa descartada:* guardar el estado en `task_checklist_items`. Es una segunda fuente de verdad para lo que ya está en el cuerpo: editar el Markdown a mano la dejaría mintiendo.

### D3 · El cuerpo y los campos se guardan por separado, cada uno con su acción

`actions/tasks.ts` gana acciones acotadas —`updateTaskField`, `updateTaskBody`, `toggleTaskChecklistItem`— en lugar de un `updateTask` que reciba la tarea entera. Cada una valida con Zod solo lo suyo y revalida la ruta del detalle.

*Por qué:* el requisito es que cambiar el responsable no obligue a guardar el cuerpo, y que el cuerpo se guarde mientras un adjunto sube. Una acción que reciba el objeto completo convierte cada guardado parcial en una lectura-modificación-escritura que puede pisar lo que otra persona acaba de cambiar.

*El alternado de casilla es su propia acción, no un `updateTaskBody`:* la reescritura se hace **en el servidor**, sobre el cuerpo recién leído, no sobre la copia que el navegador tenía cargada. Es la diferencia entre marcar el paso 3 y borrar sin querer el párrafo que la otra persona añadió hace diez segundos.

*Alternativa descartada:* guardado automático del cuerpo con temporizador. Multiplica las escrituras y llena la bitácora de entradas por cada pausa al teclear. El cuerpo se guarda al salir del campo y con un botón explícito; la bitácora del proyecto es una lista que alguien lee, no un registro de pulsaciones.

### D4 · La subida de adjuntos es un store por tarea con cola de varios archivos

`features/tasks/attachments/upload-store.ts` sigue el patrón de `receipt-upload-store` —estado de interfaz, `uploader` inyectable, `pending` / `failed`— pero indexado por **adjunto**, no por registro: `Record<attachmentId, TaskAttachmentUpload>`, cada uno con su nombre, su estado y su error. `hasPendingUploads()` se conserva para el aviso de `beforeunload`.

*Por qué:* un egreso tiene un comprobante; una tarea admite quince y se arrastran de tres en tres. Indexar por registro haría que la segunda imagen pisara el estado de la primera.

*La compresión ocurre en el navegador antes de enviar*, reutilizando `compressImage`; los archivos que no son imagen se envían tal cual y se rechazan por tamaño antes de viajar. Es lo que hace que la foto de 10 MB del criterio 4 quepa en un límite de 5 MB sin subir 10 MB por la red del taller.

*Las subidas se encolan con concurrencia acotada* —dos a la vez—: tres imágenes de 5 MB en paralelo por una conexión de celular no llegan antes, y sí compiten con el guardado del cuerpo, que es lo que el requisito promete que sigue funcionando.

*Alternativa descartada:* subir desde el servidor con el archivo pasando por la Server Action sin comprimir. Es lo que hace `attachReceipt` hoy y funciona porque el comprobante ya viene comprimido; hacerlo sin comprimir con quince archivos convierte la acción en un cuello de botella y desperdicia el `MAX_FILE_SIZE` del bucket como única defensa.

### D5 · El límite de quince se comprueba en el servidor contando adjuntos vigentes

La constante vive en `lib/attachments/limits.ts` junto al resto de constantes de adjuntos. `AttachmentService` gana `countActive(organizationId, entityType, entityId)`, y la acción de adjuntar cuenta antes de subir y rechaza si el resultado desborda. La pantalla cuenta también, para avisar antes de comprimir nada.

*Por qué:* el criterio 6 dice «se impide agregar más allá del límite», y una comprobación solo en el navegador no impide nada —basta con llamar a la acción—. El precedente del proyecto es el de pedidos, que fija su límite en el código y no en una preferencia de la organización (supuesto 1 de la propuesta).

*Un lote se rechaza entero, no a medias:* arrastrar cinco archivos sobre una tarea que tiene trece no debe dejarla con quince y dos errores. La pantalla comprueba el lote completo contra la ranura disponible antes de encolar nada; el servidor vuelve a comprobar por adjunto, como red de seguridad ante dos personas adjuntando a la vez.

*«Vigentes» significa `archived_at is null`:* quitar libera ranura, y la fila archivada sigue existiendo para la historia. Es la misma semántica que el resto del sistema.

### D6 · `AttachmentService` gana lo que le falta, en vez de un servicio paralelo de adjuntos de tarea

Tres añadidos, todos genéricos: `uploaded_by` entra en `COLUMNS` y en el tipo `Attachment`; `listForEntity(organizationId, entityType, entityId)` como caso de uno; `countActive(...)` para D5. Ninguno es específico de tareas.

*Por qué:* el servicio ya es genérico por diseño —su `entity_type` cubre las cinco entidades desde KAM-06b— y su ubicación en `services/catalog/` es un accidente de qué tarea lo necesitó primero, no una pertenencia. Escribir un `TaskAttachmentService` duplicaría la ruta canónica y la firma en lote, que es justo donde un error se vuelve un agujero de aislamiento.

*Lo que se muestra como «quién lo subió» sale de `uploaded_by`*, resuelto contra los miembros de la organización como ya hace el resto de pantallas. Hoy la columna se escribe y no se lee; empezar a leerla no cambia el esquema.

*No se mueve el archivo de sitio en este cambio.* Mover `attachment-service.ts` a `services/attachments/` tocaría el catálogo, los pedidos y los egresos por una razón estética, y ensuciaría el diff de una tarea que ya toca bastante. Queda anotado como limpieza aparte.

### D7 · El historial reutiliza el mismo método que pedidos, egresos e ítems

`TaskService.history(organizationId, id)` —añadido al servicio que crea KAM-15— repite el patrón existente: `activity_log`, `table_name = 'tasks'`, `record_id`, `occurred_at` descendente, `limit(50)`. El bloque se rinde con el mismo componente de historial que ya usan los otros detalles.

*Por qué:* el criterio 7 exige que no exista una segunda tabla de historial, y la manera de garantizarlo es no escribir nada nuevo. El ayudante recibe cero filas por RLS y ve el mensaje de lista sin contenido, que es el comportamiento ya establecido, no un caso especial.

*El enlace a la bitácora filtrada se declara y queda inerte hasta KAM-22*, del mismo modo en que `quick-capture` dejó sus dos destinos: la pantalla V23 aún no existe.

### D8 · La página se rinde en el servidor y la interactividad es un cliente acotado

`app/(app)/tasks/[id]/page.tsx` es delgada: carga tarea, adjuntos con sus URLs firmadas e historial, y los pasa a los componentes de cliente. El editor, la zona de arrastre y los campos editables son de cliente; la vista previa y el bloque de historial se rinden en servidor cuando no hay nada que alternar.

*Por qué:* es la convención nº 1 del proyecto, y aquí paga doble: firmar las URLs en el servidor evita que el navegador pida quince firmas tras hidratar, y rendir el historial en servidor evita una cascada sobre `activity_log` que para el ayudante devuelve vacío igualmente.

*`/tasks/[id]` se suma a `CAPTURE_ROUTES`:* en móvil el detalle ocupa la pantalla completa, como manda §4 del mapa. Es una línea en `mobile-nav.tsx` y la razón de que ese arreglo sea barato es que KAM-13 lo dejó como lista de patrones.

## Risks / Trade-offs

- **KAM-15 no existe todavía y este diseño se apoya en él.** → `tasks.md` abre con una verificación explícita: si `tasks` no está, el trabajo no empieza. Los tres módulos que no dependen de tareas —`lib/markdown/`, `lib/attachments/limits.ts`, los añadidos a `AttachmentService`— se escriben y se prueban primero, así que un retraso de KAM-15 no bloquea todo el cambio.
- **KAM-15 podría desviarse del esquema canónico de `tasks`.** → El diseño solo depende de `body_markdown`, `title`, `status_id`, `assignee_id`, `due_at`, `remind_at` y `archived_at`, que son del esquema de `specs/PRD/`, no de una invención. Si la desviación ocurre, la propuesta se actualiza antes de aplicarse.
- **Tres dependencias nuevas en el bundle de cliente** (`react-markdown`, `remark-gfm`, `rehype-sanitize`). → El editor y la vista previa se cargan solo en `/tasks/[id]`; la vista previa se rinde en servidor cuando no hay que alternar nada. Ninguna otra pantalla las arrastra.
- **El saneado podría quedar por detrás de una técnica nueva.** → Se parte de `defaultSchema` de `rehype-sanitize` y se recorta, en vez de escribir la lista de permitidos a mano: actualizar la dependencia trae las correcciones. Las pruebas fijan los casos del criterio 3 —`script`, `onerror`, `javascript:`— para que una actualización que los rompa se note. Y el saneado no es la única defensa: el HTML crudo ni siquiera se interpreta, así que una brecha del esquema tendría que abrirse camino a través de la sintaxis Markdown.
- **El índice de casilla se desalinea con casillas dentro de bloques de código.** → El recorrido salta los bloques cercados y una prueba fija ese caso. Es la razón de que el alternado sea una función pura y no lógica repartida por el componente.
- **Dos personas editando el cuerpo a la vez se pisan.** → Fuera de alcance por decisión del backlog (edición colaborativa). Se acota lo que se puede: alternar una casilla reescribe sobre el cuerpo leído en el servidor (D3), así que marcar un paso nunca borra un párrafo ajeno. Un guardado de cuerpo completo sí gana el último; es el mismo comportamiento que el resto de formularios del sistema.
- **Las URLs firmadas caducan a la hora.** → Es el TTL ya vigente en todo el sistema. Una tarea abierta toda la tarde mostrará miniaturas rotas; se recarga la página. Cambiar el TTL afectaría a catálogo, pedidos y egresos y no es de este cambio.

## Migration Plan

**Base de datos:** ninguna migración. La única deuda que se salda es de prueba: `supabase/tests/attachments_storage.test.sql` cubre por primera vez las políticas de `storage.objects` entre organizaciones —lectura, escritura y ausencia de `DELETE`— sobre unas políticas que llevan vigentes desde KAM-06b.

**Despliegue:** una rama, un pull request, la secuencia de CI habitual. No hay estado que migrar ni datos que rellenar: ninguna tarea existe hasta que KAM-15 las cree.

**Reversión:** revertir el pull request. Los cuerpos en Markdown guardados quedan como texto en `body_markdown`, legibles sin la pantalla; los adjuntos con `entity_type = 'task'` quedan en una tabla y unos buckets que ya existían y que otras pantallas siguen usando. Nada queda huérfano.

**Orden dentro del cambio:** primero `lib/` —saneado, casillas, límites—, que no depende de nada; después los añadidos genéricos a `AttachmentService` y su prueba de Storage; y solo entonces la pantalla, que es lo único que exige que KAM-15 esté fusionado.
