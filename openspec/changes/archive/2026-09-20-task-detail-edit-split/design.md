## Context

Ver `proposal.md` — *Why*. Lo que importa aquí es el estado del código, que contradice tres supuestos con los que se escribió la tarea del backlog:

- **Las etiquetas no se editan en el detalle.** El requisito vigente de `task-detail` las declara, pero `features/tasks/detail/task-fields.tsx` no las muestra ni las edita, y `updateTaskField` no tiene el caso. Hoy una etiqueta solo se pone en el alta. El cambio no las muda: las estrena en las dos pantallas.
- **`updateTaskFields` existe y nadie la llama.** Se escribió en KAM-15 para la edición desde la tarjeta del tablero, que nunca se implementó; el único rastro es un `vi.fn()` en `features/tasks/board/tasks-screen.test.tsx`. Es el guardado multi-campo que este cambio necesita, y le faltan la línea, el recordatorio, la comprobación de tarea archivada, las dos reglas del recordatorio y el `revalidatePath` del detalle. El alcance del backlog dice «no tocar las acciones de servidor»: no se puede cumplir, y la propuesta lo corrige.
- **Cambiar la línea deja un estado huérfano.** `assign_initial_task_status` es `before insert`, no `before update`. El detalle lo disimula porque `app/(app)/tasks/[id]/page.tsx` añade el estado actual al selector con `listAllForFlow` cuando no está en el juego resuelto; el tablero de la línea nueva no tiene esa columna y la tarea desaparece de él.

Dos restricciones más del código que condicionan el diseño:

- **`task_tags` no lleva auditoría.** Lo dice la migración `20260907120000_tasks.sql`: es una tabla de unión con llave compuesta. Un cambio de etiquetas no deja ni dejará rastro en `activity_log`.
- **Ninguna operación de tareas está en la cola sin conexión.** `features/sync/operations.ts` registra pedidos, venta directa e inventario; el alta de tarea llama a `createTask` directo.

## Goals / Non-Goals

**Goals:**

- Que la cabecera de la tarea se lea en una pantalla y se cambie en otra, sin que lo que se hace mientras se trabaja pague el precio.
- Que una edición de varios campos sea **una** escritura y **un** registro de bitácora con exactamente los campos tocados.
- Que la separación en dos pantallas no cree una segunda fuente de verdad ni una ventana para pisar el trabajo de otra persona.
- Cerrar el defecto de línea/estado, que este cambio destapa al mudar la línea al formulario.

**Non-Goals:**

- Un formulario que sepa guardar sin conexión (D7).
- Implementar la edición desde la tarjeta del tablero, que el requisito «Formulario de alta con responsable, fecha límite y etiquetas» de `tasks` declara y nadie escribió. Sigue sin escribirse; `updateTaskFields` queda lista para cuando se aborde.
- Unificar el encabezado de tareas con el de pedidos más allá de las migas.

## Decisions

### D1 · El cuerpo en Markdown se queda entero en el detalle

La tabla del backlog lo partía: rendido y marcable en el detalle, escribible en la edición. Se descarta.

**Por qué.** El caso «abro la tarea y anoto dos líneas» es trabajo, no descripción, y la propia línea que ordena el cambio —el detalle conserva lo que se hace mientras se trabaja— lo deja de este lado. Partirlo cuesta además dividir `markdown-editor.tsx` en un visor con casillas y un editor controlado, y abre el riesgo de D2 en su forma más grave.

**Alternativas.** (a) Mudarlo entero a la edición: encarece el uso más frecuente y mete el cuerpo en el formulario. (b) Punto medio, un «Editar descripción» que abre el editor en el propio detalle: es casi lo que ya hay, y no aporta sobre dejarlo como está.

**Consecuencia para KAM-30.** El botón *Mejorar la descripción* vive en el detalle, junto al texto. Es coherente con proponer y aceptar en el mismo sitio.

### D2 · El formulario envía solo los campos tocados

`updateTaskFields` ya trata `undefined` como «no tocar». El formulario arma su carga desde los campos sucios y nada más.

**Por qué.** El comentario de KAM-16 que introdujo el guardado campo por campo avisaba de esto: un `updateTask` con la tarea entera es una lectura-modificación-escritura capaz de pisar lo que otra persona acaba de cambiar. Dos pantallas reabren esa ventana —alguien deja la edición abierta diez minutos mientras otro marca casillas en el detalle—. Enviar solo lo sucio la cierra para todo lo que el formulario no toca, y junto con D1 el cuerpo queda fuera de su alcance por completo.

Además es lo que hace verificable «esos tres campos y solo esos» sin depender de que el trigger de auditoría compare valores: si el `update` no menciona un campo, no hay nada que registrar.

### D3 · `updateTaskFields` es el guardado de la cabecera; `updateTaskField` queda para el estado

`updateTaskFields` crece hasta cubrir título, línea, responsable, fecha límite, recordatorio y etiquetas, y se le trasplantan las reglas que hoy solo vive `updateTaskField`: tarea archivada, recordatorio sin fecha límite, y quitar la fecha límite borra el recordatorio. Gana `revalidatePath("/tasks/[id]")`. `updateTaskField` se reduce al caso `statusId`.

**Por qué no una acción nueva.** La que existe tiene la forma correcta y su esquema Zod ya está escrito; duplicarla dejaría dos caminos para la misma escritura.

**Por qué no borrar `updateTaskField`.** El estado sigue cambiándose desde el detalle de a uno, y su unión discriminada ya resuelve ese caso. Se estrecha, no se elimina.

**Pendiente deliberado.** `updateTaskField` con `statusId` no emite `emitTaskEvents`, y el tablero sí lo hace con `moveTaskToStatus`. Es una incoherencia anterior a este cambio y no se toca aquí: unificarlas obligaría a decidir si el detalle debe avisar también, que es una pregunta de producto.

### D4 · Cambiar la línea remapea el estado por tipo, en el servidor

Al llegar una línea nueva, la acción resuelve el juego de estados de esa línea para el flujo `task` y mueve la tarea al primer estado del mismo tipo que el suyo, con `targetStatusFor` de `lib/orders/kind-board.ts` —la misma función que el tablero con «Todas» usa para decidir a qué estado cae un pedido soltado en una columna de tipo—. Si no hay ninguno de ese tipo, la acción devuelve error y no escribe nada.

**Por qué en el servidor.** El juego de la línea destino no está cargado en el formulario, y cargarlo para las líneas activas solo para pintar un selector pondría a decidir en el cliente algo que la base ya sabe resolver. El cliente manda la línea; el servidor decide el estado.

**Por qué rechazar y no caer al inicial.** Mandar al estado inicial una tarea que estaba cancelada o terminada la resucita en silencio. Un error que se puede leer es preferible; y es lo que el tablero con «Todas» ya hace cuando una columna no tiene destino en la línea del pedido.

**Por qué `targetStatusFor` y no una función nueva.** Es exactamente la misma pregunta con los mismos datos. Si el nombre `lib/orders/` molesta para un uso de tareas, moverla a un sitio compartido es un renombrado mecánico; no se hace aquí para no mezclar un movimiento de archivos con un cambio de comportamiento.

### D5 · `lib/tasks/list-href.ts`, con *Mis pendientes* como origen reservado

Se copia la forma de `lib/orders/list-href.ts` —`sanitizeFrom`, `tasksListHref`, `withFrom`— con dos diferencias:

- **Nueve llaves de filtro** en vez de cuatro: `view`, `q`, `assignee`, `tag`, `status`, `archived`, `link`, `nodeliv`, `closed`. Las declara `app/(app)/tasks/page.tsx`.
- **Dos pantallas de origen.** *Mis pendientes* no tiene ningún parámetro en la dirección: su búsqueda es estado del cliente. Así que no necesita llevar consulta, solo marcarse. `from=my-tasks` es un **token reservado**: si `from` es exactamente esa cadena, el origen es `/my-tasks` y el primer tramo de las migas dice «Mis pendientes»; cualquier otro valor se lee como consulta de `/tasks`. No hay ambigüedad porque `my-tasks` no es una llave de filtro válida y el saneado descarta lo que no reconoce.

La defensa de `sanitizeFrom` se hereda tal cual: `from` nunca se usa como URL, se lee como consulta, se descarta entero si trae `/` o `:`, y solo sobreviven las llaves conocidas. Un origen ajeno se ignora por construcción.

Hay que propagar `from` desde los cuatro sitios que hoy enlazan al detalle sin él: `board-view.tsx`, `list-view.tsx`, `calendar-view.tsx` y `my-tasks/pending-row.tsx`. `task-detail.tsx` tiene además un `router.push("/tasks")` fijo en `onClosed` tras el asistente de cierre, que pasa a respetar el origen.

### D6 · Un solo `task-form.tsx` con `mode: "create" | "edit"`, migrado a react-hook-form

**Por qué react-hook-form.** `useDiscardConfirm` pide `isDirty`, y D2 pide `dirtyFields`. Las dos las da la librería que el proyecto ya usa en `order-form.tsx` y que la constitución declara en el stack. Calcularlas a mano contra los valores iniciales es código que hay que escribir y probar para obtener lo mismo.

**El alta no cambia por fuera.** Mismos campos, mismo destino, misma validación. Sus pruebas vigentes son el contrato: deben pasar sin tocarse.

**Diferencias entre modos.** El recordatorio solo aparece en edición —el alta no lo tiene hoy y no lo gana—. El bloque de vínculo prellenado (`keepLink`) es solo del alta: en una tarea existente los vínculos viven en el detalle. El destino tras guardar es `/tasks` en el alta y `/tasks/[id]` en la edición, ambos con el origen conservado.

### D7 · Sin cola sin conexión: la edición guarda directo

`await` a la acción, con el botón en estado «Guardando…», y navegación al detalle cuando responde. El requisito «espera la confirmación del envío» se cumple así, sin `capture()` ni plazos.

**Por qué.** Meter la edición de tarea en la cola antes que el alta dejaría un dominio a medias: se podría editar sin red una tarea que sin red no se puede crear. La cola de tareas —alta, edición y estado juntos— es un cambio propio, con su clave de operación, su `describe` y su bandeja.

El «mismo tratamiento de plazo que `order-form`» que pedía el backlog no aplica: ese plazo (`EDIT_FLUSH_DEADLINE_MS`) es un parámetro de `capture()`, que aquí no se usa.

### D8 · El estado se queda como el único control vivo de la cabecera

Rodeado de datos en texto, un `Select` suelto se lee como un descuido. Se presenta como **acción** y no como campo: el estado se muestra como su etiqueta de color junto a los demás datos, y cambiarlo es un gesto explícito desde esa misma etiqueta. La lógica no cambia —`opensClosingWizard` decide igual, y `?close=` sigue siendo la puerta del asistente desde el tablero y desde el detalle—.

`app/(app)/tasks/[id]/page.tsx` conserva el arreglo que añade el estado actual al juego cuando está archivado o fuera de la línea; con D4 deja de poder llegar un estado de otra línea, pero un estado archivado sigue siendo posible.

### D9 · Migas y pantalla completa

`MainContainer` ya recibe `breadcrumbs`; la edición declara los tres tramos y el del medio enlaza al detalle con el origen. `components/layout/mobile-nav.tsx` oculta la barra inferior con `/^\/tasks\/[^/]+$/`, que **no** casa con `/tasks/[id]/edit`: hay que añadir el patrón de la edición, igual que existe para el alta.

### D10 · La bitácora no registra las etiquetas, y el requisito no pretende que lo haga

`task_tags` no tiene trigger `audit`, así que un cambio de etiquetas no aparece en el historial. El escenario «tres campos, un solo registro de bitácora» se verifica con tres campos de la fila `tasks` —título, responsable y fecha límite—, no con etiquetas. Escribir una prueba que espere una etiqueta en `activity_log` sería escribir una prueba imposible.

## Risks / Trade-offs

- **Una edición abierta pisa lo que otro cambió en el detalle** → D2: solo viajan los campos sucios. Con D1 el cuerpo ni siquiera está en el formulario, que es donde el daño sería peor.
- **Cambiar la línea puede sacar la tarea del alcance de quien la edita.** Un ayudante con acceso a Sublimación que mueva una tarea a Alfarería deja de verla, y el detalle al que aterriza tras guardar responde como inexistente. → Se acepta: es la consecuencia correcta de RLS y la misma que tendría cualquier otra vía. La mitigación es que el selector ofrezca solo líneas que la persona alcanza, que es lo que `BusinessLineService.listActive` ya devuelve bajo RLS.
- **`updateTaskFields` no tenía llamador, así que sus reglas nunca se ejercitaron.** Su camino de etiquetas, su emisión de aviso al reasignar y su manejo de errores están sin probar en la práctica. → Entran con pruebas propias, no como código heredado que se asume bueno.
- **El detalle pierde inmediatez para quien cambiaba un responsable de un toque.** Es el costo deliberado del cambio, y la razón de que el estado, las casillas y el cuerpo se queden donde están: lo que se toca muchas veces al día no pasó al formulario.
- **Reutilizar `targetStatusFor` desde `lib/orders/`** deja una dependencia de tareas hacia un módulo nombrado por pedidos → Se acepta como deuda de nombre, no de diseño; moverla a un sitio común es mecánico y se hará cuando toque a un tercer dominio.
- **Nueve llaves de filtro en `from`** hacen la dirección larga en el tablero filtrado → Se acepta: solo sobreviven las que tienen valor, y el saneado descarta el resto.

## Migration Plan

No hay migración de base de datos: ni esquema, ni RLS, ni roles, ni `supabase/tests/`. El despliegue es de código y la vuelta atrás es revertir el commit.

Dos cosas conviene hacer en el mismo cambio para no dejar el árbol incoherente:

1. `specs/PRD/kamay-mapa-navegacion-ui.md`: V18 pasa a ser dos pantallas, con la transición V18 → V18-edit y la vuelta.
2. Regenerar el grafo de conocimiento (`graphify update .`), como pide el gancho posterior al commit.

Las direcciones existentes no cambian: `/tasks/[id]` sigue sirviendo el detalle, y todo enlace compartido sigue funcionando. `/tasks/[id]/edit` es una dirección nueva y nadie la tiene guardada.
