## Why

Abrir una tarea hoy es entrar a un formulario: título, estado, línea, responsable, fecha límite y recordatorio se rinden como controles vivos que guardan solos al confirmarlos. Eso convierte la lectura en un campo minado —un `Select` tocado sin querer cambia el responsable de una tarea ajena, y no hay ningún gesto que diga «ahora voy a cambiar esto»— y deja las tareas como la única pantalla de detalle del sistema que no se parece a las demás: pedidos, egresos e ítems ya leen en el detalle y cambian en `/[id]/edit`, con su Guardar, su confirmación antes de descartar y sus migas de pan.

La decisión que trajo el campo por campo (KAM-16, design D3) tenía una razón concreta y sigue siendo cierta: *«una tarea se toca muchas veces al día por un solo dato, y un botón Guardar al pie obligaría a bajar hasta él para cambiar un responsable»*. Por eso este cambio no mueve todo al formulario: mueve **los datos que describen la tarea** y deja en el detalle **lo que se hace mientras se trabaja** —marcar casillas, escribir el cuerpo, adjuntar, vincular, declarar entregables y cambiar de estado—, que es justo lo que D3 protegía.

## What Changes

- **El detalle deja de editar los datos de cabecera.** **BREAKING**: reemplaza el requisito vigente «Los campos de la tarea se editan y se guardan uno a uno». Título, línea, responsable, fecha límite, recordatorio y etiquetas pasan a mostrarse como texto, con una acción *Editar* hacia `/tasks/[id]/edit`. Las etiquetas hoy no se muestran ni se editan en el detalle pese a que el requisito las declara: pasan a mostrarse, y a editarse en el formulario.
- **El estado se queda en el detalle** y sigue siendo un control vivo: es lo que se hace mientras se trabaja, es la puerta al asistente de cierre (V19), y arrastrar en el tablero ya lo cambia sin abrir nada. No entra al formulario.
- **El cuerpo en Markdown se queda entero en el detalle** —se lee, se marca y se escribe ahí, con su guardado propio—, resolviendo la pregunta abierta del backlog. Partirlo encarecería «abro la tarea y anoto dos líneas», que es el uso de trabajo por excelencia, y pondría el cuerpo viejo del formulario a pisar las casillas que otra persona acaba de marcar.
- **Ruta nueva `/tasks/[id]/edit`** con su `page.tsx`, `loading.tsx` y `error.tsx`, a imagen de `app/(app)/orders/[id]/edit/`: migas `Tareas › <título> › Editar`, valores actuales cargados, un solo Guardar que espera la confirmación y aterriza en el detalle, confirmación antes de descartar, y una tarea archivada que explica su estado sin ofrecer formulario.
- **Un único formulario para alta y edición.** `features/tasks/task-form.tsx` gana modo edición y migra a react-hook-form, que es lo que da `isDirty` para la guardia de descarte y `dirtyFields` para enviar solo lo tocado. El alta no cambia por fuera: mismos campos, mismo destino, mismas pruebas.
- **Una edición es una sola escritura.** El formulario llama a `updateTaskFields` —que existe desde KAM-15 y hoy no tiene ni un solo llamador— con los campos tocados y nada más, de modo que cambiar tres campos deje un registro de bitácora con esos tres y solo esos.
- **Cambiar la línea reubica el estado.** Al cambiar la línea de negocio, el estado pasa al primero de su mismo `kind` en el juego de la línea nueva. Hoy no pasa nada: el trigger que resuelve el estado es solo de inserción, así que la tarea se queda con un estado de la línea vieja y desaparece del tablero de su línea nueva. Es un defecto vivo que este cambio no puede ignorar, porque la línea es uno de los campos que se mudan al formulario.
- **La vista de origen se conserva.** Entrar al detalle, editar y guardar devuelve al tablero, la lista, el calendario o *Mis pendientes* con sus filtros, con un `from` propio de tareas.
- **Fuera de alcance:** el detalle de pedidos, egresos, ítems o contactos; mover al formulario lo que se queda en el detalle (casillas, cuerpo, adjuntos, vínculos, entregables, estado); la edición desde la tarjeta del tablero sin abrir la tarea —que el requisito de `tasks` declara y nadie implementó, y que sigue sin implementarse aquí—; la edición masiva; meter las tareas en la cola de captura sin conexión (ninguna operación de tareas está hoy en la cola, y empezar por la edición antes que por el alta sería incoherente); cambios de esquema, de RLS o de permisos.

## Capabilities

### New Capabilities

Ninguna. El cambio reparte responsabilidades entre capacidades existentes.

### Modified Capabilities

- `task-detail`: se **elimina** «Los campos de la tarea se editan y se guardan uno a uno» y se reemplaza por dos requisitos —«El detalle presenta los datos de la tarea y los cambia en una pantalla aparte» y «La edición de la tarea reúne sus datos en un formulario con un solo Guardar»—; se ajusta «El detalle de tarea es una página con dirección propia» para que la regla de tarea archivada y la de pantalla completa en móvil cubran también la edición.
- `tasks`: se agrega «Cambiar la línea de una tarea reubica su estado en el juego de la línea nueva», que cierra el hueco que deja «El estado inicial lo asigna la base resolviendo el juego de la línea» —válido solo al crear.
- `navigation-breadcrumbs`: se agrega la fila de la edición de tarea a la tabla de rutas del requisito «Migas de pan en pantallas de alta, edición y detalle», y se agrega «La miga de la lista de tareas conserva la vista de origen», hermano del que ya existe para pedidos, con la particularidad de que el origen puede ser el tablero de tareas o *Mis pendientes*.

## Impact

- **Rutas**: nueva `app/(app)/tasks/[id]/edit/{page,loading,error}.tsx`; `app/(app)/tasks/[id]/page.tsx` pasa a leer `from` y las etiquetas de la tarea.
- **UI**: `features/tasks/task-form.tsx` (modo edición + react-hook-form); `features/tasks/detail/task-fields.tsx` (de controles a texto, conservando el selector de estado y el asistente de cierre); `features/tasks/detail/task-detail.tsx`; los orígenes que enlazan al detalle pasan a propagar `from` —`features/tasks/board/board-view.tsx`, `list-view.tsx`, `calendar-view.tsx`, `features/tasks/my-tasks/pending-row.tsx`.
- **Lógica pura**: nuevo `lib/tasks/list-href.ts` (saneado de `from` con las llaves de filtro de tareas y el origen *Mis pendientes*), al estilo de `lib/orders/list-href.ts`; reutiliza `targetStatusFor` de `lib/orders/kind-board.ts` para el remapeo por `kind`.
- **Acciones**: `updateTaskFields` se completa —línea, recordatorio, comprobación de tarea archivada, recordatorio sin fecha límite, quitar la fecha borra el recordatorio, remapeo de estado al cambiar de línea, `revalidatePath` del detalle— y pasa a tener llamador. `updateTaskField` queda reducido al estado. Sin cambios de esquema, de RLS ni de roles.
- **Navegación**: `components/layout/mobile-nav.tsx` oculta la barra inferior con `/^\/tasks\/[^/]+$/`, que no casa con `/tasks/[id]/edit`; hay que añadir el patrón. `specs/PRD/kamay-mapa-navegacion-ui.md` pasa V18 a dos pantallas.
- **Pruebas**: unitarias del formulario en modo edición, del detalle sin controles, de las migas de ambas pantallas y del saneado de `from`; integración de la edición de tres campos con un solo registro de bitácora y del remapeo de estado al cambiar de línea; pgTAP no cambia (no hay migración); e2e de editar y volver al origen, salir con cambios sin guardar, tarea archivada, casilla desde el detalle y acceso denegado al ayudante.
