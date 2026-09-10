# KAM-21 · Diseño

## Context

Ver `proposal.md` — Why. Lo que importa aquí es el estado real del código en el que aterriza este cambio, que difiere de lo que el backlog daba por supuesto:

- **`task_links` ya está construida y probada** (`20260907120000_tasks.sql`): el `check` de los cinco tipos, el `unique (task_id, entity_type, entity_id)`, los tres índices, el trigger `validate_task_link()` que comprueba la existencia del destino, el `audit` de bitácora, y las tres políticas «según la tarea» que resuelven la visibilidad con un `exists` contra `tasks`. **Esta tarea no la toca.** Su rama `asset` ya no rechaza: `20260908170000_asset_recovery.sql` (KAM-19) la reemplazó para validar contra `asset_details`.
- **`TaskService.link()` ya existe** y es genérica en el tipo (`TaskLinkType`), aunque hoy solo la llame *Crear tarea para este pedido*. Lo que falta no es la escritura: es leer, resolver y quitar.
- **`closed_at` lo mantiene la base**, no la aplicación: `maintain_task_closed_at()` lo fija al entrar en un estado de tipo `final` y lo borra al salir. La aplicación **no puede** cerrar una tarea de otra manera que moviéndola de estado, y eso decide la forma del asistente (D3).
- **`closed_without_deliverables` existe en `tasks` desde KAM-15**, declarada inerte con el comentario «la escribe KAM-21». No hace falta `alter table`.
- **El patrón del proyecto para escrituras multi-tabla atómicas es una RPC plpgsql `security invoker`**: `create_order`, `create_expense`, `create_direct_sale`, `accept_invitation`. Ninguna Server Action encadena inserciones en varias tablas por su cuenta.
- **Los seis destinos de entregable ya se saben crear**: `items` (producto e insumo) por `actions/catalog.ts`, `contacts` (proveedor) por `actions/contacts.ts`, `expenses` de tipo `purchase` y `expense` por `create_expense`, y `asset_details` por el alta de activo de KAM-19 (`services/assets/asset-service.ts`, `features/assets/declare-asset-dialog.tsx`). Ninguno hay que escribirlo de nuevo.
- **Los activos son solo de la persona dueña**: las tres políticas de `asset_details` van bajo `is_owner()`, y `asset_details.item_id` es su llave — el `entity_id` de un vínculo de tipo `asset` es el **id del ítem**, no un identificador aparte. La asimetría con `task_links`, que va «según la tarea», es lo que obliga a D9.
- **`normalizeForSearch` / `matchesSearch` (`lib/search/normalize.ts`)** ya son la regla única de búsqueda tolerante a acentos, y las tablas comparan contra `immutable_unaccent(lower(name))`. El buscador de vínculos no inventa una segunda regla.
- **`attachments` es genérica desde KAM-06b** y sus filas apuntan a un objeto de Storage por `bucket` + `storage_path`, con `unique (bucket, storage_path)`: **dos filas no pueden compartir un objeto**. Llevar las fotos de la tarea al producto exige copiar el objeto, no solo la fila (D6). `AttachmentService.upload()` ya establece el patrón de retirar el objeto si la fila falla.
- **Los cuatro archivados existen** —`archiveOrder`, `archiveItem`, `archiveContact`, `archiveExpense`— y los cuatro delegan la decisión de quién puede hacerlo al trigger `enforce_archive_rules()` de la base. El aviso es de interfaz y se suma delante, sin tocar esa decisión.
- **`ItemDetail`, `OrderDetail`, `ContactsScreen` y `ExpenseDetail` ya rinden bloques de historial** con el mismo componente y el mismo patrón de carga en servidor. El bloque *Tareas relacionadas* es el cuarto bloque de la misma familia.

## Goals / Non-Goals

**Goals**

- Una sola migración, con una sola tabla nueva. Todo lo demás ya está en el esquema.
- Que «el vínculo refleja el estado actual» sea cierto por construcción y no por disciplina: si la única manera de rendir un vínculo es resolverlo contra su tabla al leer, no hay forma de que alguien guarde una copia sin querer.
- Que el cierre con entregables sea **una sola operación de base de datos**. La alternativa —crear el ítem, luego el egreso, luego marcar los entregables, luego mover el estado, cada uno con su ida y vuelta— es exactamente donde un corte de red del taller deja una tarea cerrada sin lo que debía crear.
- Que el prellenado sea una función pura por tipo de entregable, probable sin base de datos ni navegador, como lo fue `lib/tasks/prefill.ts` en el sentido inverso.
- Que añadir el sexto tipo (el activo, KAM-19) sea añadir una entrada a una tabla de datos, no abrir el asistente y repartir un `if` por cinco archivos.
- Reutilizar las acciones de creación que ya existen en vez de escribir una segunda vía de alta de ítem, de contacto o de egreso.

**Non-Goals**

- No se construye nada del modelo de activos. Ni `asset_details`, ni la barra de recuperación, ni la pantalla V12, ni la rama `asset` del trigger: todo eso es de KAM-19 y ya está. Esta tarea solo suma un bloque a su panel y usa el activo como destino de vínculo y de entregable.
- No se generaliza el bloque *Tareas relacionadas* al detalle de egreso. El backlog pide V4, V11, V12 y V13; el egreso es destino de vínculo y de aviso, no de bloque.
- No se toca el modo sin conexión. Vincular, declarar y cerrar con entregables exigen conexión, como los adjuntos de tarea y los de pedido.
- No se toca la bitácora. Las creaciones ya las registran los triggers `log_activity()` de `items`, `contacts` y `expenses`; el enlace a V23 sigue inerte hasta KAM-22.
- No se resuelve la edición concurrente. Dos personas cerrando la misma tarea a la vez es el mismo caso que dos personas moviéndola de columna, y se comporta igual.

## Decisions

### D1 · Una sola tabla nueva, `task_deliverables`, con el patrón de `task_links`

La migración crea `task_deliverables` con su DDL canónico (§12) más `organization_id`, la misma desviación consciente que KAM-15 documentó para `task_tags` y `membership_lines`: la convención nº 2 lo exige en toda tabla, y sin él `log_activity()` —que lo lee de la propia fila— registraría el evento bajo una organización inexistente. Sus políticas RLS copian el `exists` contra `tasks` de `task_links`, sus privilegios revocan `DELETE` a todos, y lleva su trigger `audit`.

*Por qué copiar y no factorizar:* las políticas de `task_links` son cuatro líneas de `exists` y ya están escritas dos veces en la misma migración (`task_tags`, `task_links`). Una función compartida ahorraría ocho líneas y añadiría un salto de indirección justo donde una prueba de aislamiento tiene que poder leerse de un vistazo.

*`fulfilled_type` no lleva `check`:* el canon lo deja como `text` libre frente a los seis valores acotados de `deliverable_type`. Se respeta —lo que se guarda ahí es el tipo del registro creado, no el del entregable, y en la práctica coinciden— y la validación de dominio vive en la RPC de cierre, que es la única vía que lo escribe.

*Sin `alter table` en `tasks`:* `closed_without_deliverables` ya existe. Esta tarea es la primera que la escribe, y lo hace únicamente desde la RPC de cierre (D3).

### D2 · Los vínculos se resuelven al leer, con una consulta por tipo y ninguna copia

`TaskService` gana `links(organizationId, taskId)`, que lee `task_links` y después resuelve los destinos **agrupados por tipo**: una consulta a `orders`, una a `contacts`, una a `items`, una a `expenses` —nunca una por vínculo—, cada una devolviendo lo que el vínculo muestra: nombre o número, estado actual, y `archived_at`. El resultado es un `TaskLinkView` que **no se almacena en ninguna parte**.

*Por qué:* el criterio 1 del backlog —«la tarea muestra el estado **actual** del pedido, no una copia del momento del vínculo»— es, en el vocabulario del proyecto, la convención nº 4 aplicada a una relación. Guardar el nombre en `task_links` para «ahorrar una consulta» es almacenar un derivado, y el escenario que lo delata es trivial: renombrar el ítem.

*El agrupado por tipo es lo que evita el N+1*: una tarea con seis vínculos hace cuatro consultas como máximo, no seis. Para el bloque inverso —*Tareas relacionadas*— la consulta es una sola: `task_links` filtrada por `entity_type` y `entity_id`, con `tasks` unida, y RLS haciendo el resto del trabajo (D4).

*Alternativa descartada:* una vista `task_link_details` que haga el `union all` de los cinco tipos en la base. Sería elegante y sería una vista más que mantener con `security_invoker` y con una rama muerta para `asset`; y cada tipo nuevo obligaría a una migración en vez de a un caso más en un servicio. Se anota como posible limpieza si el número de tipos crece.

*El buscador de vínculos consulta los cuatro tipos en paralelo y mezcla*, ordenando por tipo y luego por coincidencia, y excluye en memoria lo ya vinculado a esa tarea. Excluir en la base obligaría a cruzar `task_links` en cuatro consultas distintas para ahorrar un filtro sobre, como mucho, unas decenas de filas.

### D3 · El cierre con entregables es una RPC, y el asistente es su interfaz

`close_task_with_deliverables(p_task_id uuid, p_deliverables jsonb, p_status_id uuid)` —plpgsql, `security invoker`, siguiendo a `create_order` y `create_expense`— hace en una transacción: crear cada registro marcado, escribir su `fulfilled_type` / `fulfilled_id` / `fulfilled_at` en `task_deliverables`, escribir su fila en `task_links`, mover la tarea al estado destino —lo que dispara `maintain_task_closed_at()` y cierra— y fijar `closed_without_deliverables` según haya quedado algo declarado sin cumplir.

*La copia de adjuntos ocurre **antes** de la RPC, no dentro:* plpgsql no habla con Storage. La acción genera los identificadores de los registros a crear —la convención nº 9 ya admite UUID generados fuera de la base—, copia los objetos a la ruta de cada destino, y pasa a la RPC tanto los identificadores como las filas de `attachments` a insertar. Si la RPC falla, la acción retira los objetos copiados, que es el mismo patrón de `AttachmentService.upload()`. Lo que la transacción garantiza sigue siendo lo que el requisito pide: **ningún registro a medias**. Un objeto huérfano en Storage tras un fallo es recuperable y no miente a nadie; media tarea cerrada, no.

*Por qué una RPC y no cuatro Server Actions encadenadas:* el requisito dice «o se crean los marcados y se cierra, o no se crea ninguno y la tarea sigue abierta». Eso es una transacción, y el proyecto ya decidió tres veces que las transacciones multi-tabla viven en una función de la base. Encadenar desde la acción deja como resultado más probable del fallo una tarea cerrada con la mitad de sus entregables, que es justo el estado que el criterio 4 del backlog quiere impedir.

*`security invoker` y no `definer`:* la RPC no necesita saltarse nada. Corre como la persona, así que RLS decide qué puede crear y en qué tarea, y una llamada contra una tarea ajena no crea nada porque el `update` no encuentra fila. Un `definer` aquí sería un agujero con la forma exacta de este parámetro.

*`closed_without_deliverables` se calcula dentro de la RPC*, no lo manda el cliente: es la diferencia entre una marca que significa algo y una casilla que el navegador puede mentir. Y se calcula como «quedó al menos un entregable declarado sin cumplir **y** no se creó ninguno en esta operación», que es la lectura del supuesto 8 de la propuesta.

*Reabrir baja la marca desde el mismo sitio que borra `closed_at`:* se añade al trigger `maintain_task_closed_at()` —en una migración nueva, nunca editando la de KAM-15— la línea que pone `closed_without_deliverables` en `false` cuando el estado deja de ser `final`. Que lo lleve el trigger es lo que hace que «reabrir retira la marca» sea cierto por cualquier vía de reapertura, incluidas las que aún no existen.

*Cancelar no llama a nada.* El asistente se abre **antes** de que el movimiento se dé por hecho: en el tablero, sobre el movimiento optimista que KAM-15 ya sabe revertir; en el detalle, antes de enviar el cambio de estado. *Cancelar* revierte lo optimista y no envía nada, que es lo que hace que la tercera salida sea distinta de la segunda (supuesto 6).

*Alternativa descartada:* cerrar primero y crear después, con la creación como «tarea pendiente». Convierte un fallo en una tarea cerrada que promete registros que no existen, y obliga a inventar un mecanismo de reintento que nadie pidió.

### D4 · El bloque *Tareas relacionadas* es un solo componente y una sola consulta, y RLS filtra

`TaskService.relatedTasks(organizationId, entityType, entityId)` devuelve las tareas que referencian un registro, y `features/tasks/links/related-tasks.tsx` las rinde. Los tres detalles —pedido, ítem, contacto— cargan en servidor y pasan el resultado, como ya hacen con su historial.

*Por qué una sola consulta:* la visibilidad por rol y por línea la resuelve la política de `tasks` («ayudante ve su línea o lo asignado»), y `task_links` hereda de ella con su `exists`. Filtrar en la aplicación duplicaría esa lógica en TypeScript, que es exactamente donde se desincroniza con la política y se convierte en una fuga. El escenario del ayudante se prueba en pgTAP contra la política, no contra el componente.

*El mismo servicio sirve al aviso de archivado (D5):* lo que el aviso enumera es esa misma lista. Un método, dos usos.

### D5 · El aviso al archivar es interfaz delante de la acción, no una regla de la base

Los cuatro archivados pasan a abrir una confirmación que, si el registro tiene tareas que lo referencian, las enumera. Confirmada, llama a la acción de archivado que ya existe, sin cambiarla. Si no hay tareas, la confirmación es la que ya había.

*Por qué no un trigger que bloquee:* el criterio 7 pide avisar, no impedir, y nada queda roto porque en Kamay nada se borra —el vínculo sobrevive al archivado y sigue resolviendo al mismo registro (supuesto 3)—. Un trigger que rechace el archivado dejaría al usuario sin salida cuando la tarea que estorba se cerró hace meses, y obligaría a inventar un «archivar de todos modos» que atravesara la base.

*Un solo componente para los cuatro:* `features/tasks/links/archive-warning.tsx` recibe el tipo, el identificador y la acción a ejecutar. Cuatro diálogos casi iguales es cómo tres de ellos se quedan atrás cuando el cuarto cambia.

*El aviso no decide nada sobre permisos.* Quién puede archivar lo sigue decidiendo `enforce_archive_rules()`; el diálogo solo informa antes.

### D6 · El prellenado es una función pura por tipo, y los adjuntos se copian por fila

`lib/tasks/deliverables.ts` declara los seis tipos, marca cuáles son construibles hoy, y expone `prefillFor(type, task)`: una función pura que devuelve los valores iniciales del formulario de ese tipo a partir del título, la línea, el cuerpo y los adjuntos de la tarea. Nada de red, nada de React.

*Por qué puro y por tipo:* la prueba unitaria que pide el backlog —«prellenado de cada tipo de entregable»— es entonces una tabla de entradas y salidas, sin base de datos ni navegador. Es el mismo movimiento que `lib/tasks/prefill.ts` hizo de pedido a tarea; aquí el sentido es el inverso y la forma es la misma.

*El mapa de tipo a destino vive en un solo dato*, no repartido en condicionales: cada tipo declara qué crea (`items` con `kind`, `contacts` con rol, `expenses` con `kind`, `asset_details` sobre un ítem de tipo activo), qué formulario abre y qué rol hace falta para ofrecerlo. El activo es el único con `ownerOnly: true`, y eso es un dato del mapa, no una rama en la interfaz.

*Los adjuntos se copian de verdad, objeto incluido* (supuesto 7 de la propuesta, revisado): `AttachmentService` gana `copyToEntity()`, que copia el objeto de Storage a la ruta canónica del destino —`{organization_id}/{entity_type}/{entity_id}/{uuid}.ext`— y devuelve la fila a insertar. Compartir el objeto entre dos filas **no es posible**: `attachments` lleva `unique (bucket, storage_path)`, y esa restricción existe para que ningún objeto quede con dos dueños o con ninguno.

*Lo que la copia compra, además de ser la única opción:* cada registro queda con sus propios archivos. Retocar la foto del producto no cambia la de la tarea, y archivar el adjunto de una no deja a la otra apuntando a un objeto que nadie reclama.

*El gasto está acotado:* solo se copian los adjuntos que queden marcados en el asistente, que es un caso del «todo valor prellenado SHALL ser modificable antes de crear» que el requisito ya exige.

*Alternativa descartada:* no llevar los adjuntos y dejar que la persona los vuelva a subir. Es exactamente el trabajo manual que el criterio 3 quiere eliminar —«formularios prellenados con título, línea, **adjuntos** y notas»— y en el flujo de alfarería son las fotos de las tazas, que es lo único que hace vendible la ficha del producto.

*Alternativa descartada:* relajar el `unique` para permitir filas compartidas. Toca una restricción canónica que protege a todo el sistema por conveniencia de una pantalla.

### D7 · El asistente se abre desde una decisión pura, compartida por el tablero y el detalle

`lib/tasks/deliverables.ts` expone también `needsClosingWizard(statusKind, deliverables)`: verdadero cuando el tipo del estado destino es `final` y queda al menos un entregable declarado sin cumplir. El tablero la consulta al soltar; el detalle, al cambiar el estado.

*Por qué una función y no la condición escrita dos veces:* son dos entradas al mismo diálogo y el mapa de navegación no admite una tercera. Escribir la condición en cada sitio es cómo el tablero acaba abriendo el asistente y el detalle cerrando en silencio.

*Se compara por `kind`, no por nombre* (convención nº 5): el estado final de una organización se llama *Entregado* y el de otra *Vendido*, y hay juegos donde *Terminado* es de tipo `in_progress`. El escenario que lo fija está en el delta spec.

*El diálogo se rinde en cliente y monta los formularios de cada tipo bajo demanda.* Los cinco formularios completos montados a la vez en un diálogo de móvil es peso que casi nunca se usa: lo normal es un entregable, dos como mucho.

### D8 · Las dos secciones que KAM-16 dejó sin pintar se encienden aquí

`features/tasks/detail/task-detail.tsx` suma *Vínculos* y *Entregables esperados*. Es lo que KAM-16 anotó al dejar la ranura vacía en vez de pintarla inerte.

*Ambas son de cliente y acotadas*, como los campos y el editor: el buscador de vínculos escribe al elegir, el selector de entregables escribe al declarar, y ninguno bloquea al otro ni al guardado del cuerpo. La carga inicial de vínculos y entregables se hace en servidor con el resto del detalle, para no encadenar dos consultas más tras hidratar.

*Una tarea archivada las muestra en solo lectura*, con el mismo patrón que el resto del detalle ya establece.

### D9 · El filtro de rol de los activos vive en el servicio, no en los componentes

`TaskService.links()` recibe el rol de quien mira y **omite** los vínculos de tipo `asset` cuando no es la persona dueña; `searchLinkTargets()` no consulta activos en ese caso; y el dominio de entregables marca *Nuevo activo* como `ownerOnly`, de modo que ni el selector lo ofrece ni la acción lo acepta.

*Por qué omitir y no rotular como inaccesible* (supuesto 9): KAM-19 ya tomó esta decisión en V11 —«el detalle no contiene sección de datos de activo, ni vacía ni rotulada»—. Una entrada rotulada le diría al ayudante cuántos activos hay y cuáles tocan su trabajo, que es exactamente lo que `is_owner()` reserva. La coherencia importa más que la transparencia aquí, porque la alternativa filtra el dato que la política protege.

*Por qué en el servicio y no en el componente:* el bloque de vínculos se rinde en el detalle de tarea, y mañana podría rendirse en una tarjeta o en una exportación. Un filtro por componente es un filtro que la cuarta vía olvidará. En el servicio hay un solo sitio donde puede faltar, y una prueba lo fija.

*Lo que RLS ya hace por su cuenta:* aunque el filtro faltara, `asset_details` devolvería cero filas al ayudante y el vínculo quedaría sin resolver. El filtro no es la defensa —RLS lo es—; el filtro es lo que evita rendir un hueco que delata.

## Risks / Trade-offs

- **El activo se reserva a la persona dueña, y el vínculo no.** → Resuelto por D9 omitiendo los vínculos de tipo `asset` para quien no es dueño. El riesgo residual es que una vía futura de lectura de vínculos se olvide del filtro; por eso el filtro vive en el servicio, en el mismo método que resuelve los destinos, y no en cada componente que los rinde. La prueba pgTAP fija además que un ayudante obtiene cero filas de `asset_details` aunque el vínculo exista.
- **El vínculo polimórfico no tiene llave foránea.** → Riesgo asumido por el esquema canónico y ya mitigado por KAM-15 con `validate_task_link()` y por la convención nº 3 —nada se borra, así que un vínculo nunca apunta al vacío—. Esta tarea añade la prueba de que un destino archivado sigue resolviendo.
- **Copiar el objeto duplica bytes en Storage.** → Es el precio de que `attachments` no admita filas compartidas, y está acotado a los adjuntos que la persona deje marcados. El riesgo operativo es el objeto huérfano cuando la RPC falla después de copiar; se retira en el mismo `catch`, como ya hace `AttachmentService.upload()`, y si aun así quedara, es el mismo objeto sin fila vigente que el sistema ya puede tener hoy —nada borra objetos de Storage— y que queda anotado para la limpieza de KAM-23.
- **La RPC de cierre concentra cinco creaciones distintas en una función de base de datos.** → Es la única forma de que el «todo o nada» sea cierto, pero hace de `close_task_with_deliverables` la función más larga del esquema. Se acota delegando: cada creación reutiliza la vía que ya existe (`create_expense` para los dos tipos de egreso; inserciones directas para `items` y `contacts`, que no tienen RPC porque no la necesitaban). Su prueba pgTAP cubre los cinco tipos y el fallo a medias.
- **Dos personas cerrando la misma tarea a la vez podrían crear dos veces el mismo entregable.** → El `unique (task_id, deliverable_type)` no lo impide, porque ambas escribirían la misma fila con `fulfilled_id` distinto. La RPC lo cierra comprobando dentro de la transacción que el entregable siga sin cumplir antes de crear; la segunda llamada no crea nada y devuelve la tarea ya cerrada. Es el mismo desenlace que hoy tiene mover dos veces la misma tarjeta.
- **El buscador único hace cuatro consultas por pulsación.** → Se debounce como el resto de buscadores del proyecto y cada consulta lleva su `limit`. En una organización de taller —cientos de registros, no millones— es barato; si dejara de serlo, la salida es la vista `union all` que D2 descarta hoy, y estaría contenida en un método.
- **El bloque *Tareas relacionadas* aparece en tres pantallas que ya cargan bastante.** → Es una consulta más, en servidor, junto a la del historial que esas mismas pantallas ya hacen. Para el ayudante devuelve menos filas por RLS, no más trabajo.
- **KAM-17 y KAM-18 no están, y el backlog los ponía antes.** → Ninguna parte de este diseño los nombra (supuesto 1). El único punto de contacto es que el egreso de compra que cree el asistente generará movimientos de inventario cuando KAM-18 instale su trigger sobre las líneas de compra, sin que este código cambie.

## Migration Plan

**Base de datos:** una migración nueva, `YYYYMMDDHHMMSS_task_deliverables.sql`, con:

1. `task_deliverables` con su DDL canónico más `organization_id`, sus índices, sus privilegios sin `DELETE`, su RLS «según la tarea» y su trigger `audit`.
2. El reemplazo de `maintain_task_closed_at()` —`create or replace`, nunca editando la migración de KAM-15— para bajar `closed_without_deliverables` al salir de un estado `final`.
3. `close_task_with_deliverables(...)` como RPC `security invoker`.

Su prueba pgTAP acompaña la migración en el mismo pull request, con `throws_ok` de cuatro argumentos y ejecutada con `supabase test db`. `graphify .` se regenera después, como manda la convención nº 6.

**Datos existentes:** ninguno que migrar. Ninguna tarea tiene entregables porque la tabla no existía, y `closed_without_deliverables` vale `false` en todas por su `default`, que es el valor correcto para una tarea cerrada antes de que hubiera entregables que declarar.

**Despliegue:** una rama, un pull request, la secuencia de CI habitual.

**Reversión:** revertir el pull request y, si la migración ya corrió, dejar `task_deliverables` en su sitio: es una tabla nueva que nadie más lee, y las filas escritas son historia legítima. Los vínculos creados por el asistente quedan en `task_links`, que existía antes y seguirá después. Lo único que habría que deshacer a mano es el `create or replace` del trigger, y hacerlo solo cambia que la marca deje de bajarse al reabrir.

**Orden dentro del cambio:** primero `lib/tasks/deliverables.ts` —dominio, prellenado y la decisión de abrir el asistente—, que no depende de nada y absorbe la mitad de las pruebas unitarias; después la migración y su pgTAP; después la lectura de vínculos y el bloque *Tareas relacionadas*, que ya se puede probar contra los vínculos que KAM-15 escribe; y por último el asistente, que es lo único que necesita todo lo anterior.
