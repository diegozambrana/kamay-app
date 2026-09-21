## Why

KAM-29 convirtió la cabecera de la tarea en texto y llevó su edición a una pantalla aparte, pero se detuvo ahí a propósito: su alcance excluía «rediseñar el detalle más allá de convertir en texto los campos que se mudan». El resultado es una pantalla a medias. La cabecera se lee, y justo debajo la **descripción** sigue abriéndose en modo escritura —un `textarea` monoespaciado, la barra de formato y un botón *Guardar descripción* desplegados desde el primer instante— y los **adjuntos** siguen encabezados por un recuadro punteado de arrastre que ocupa sitio aunque nadie vaya a adjuntar nada.

Abrir una tarea para mirarla cuesta hoy pasar por encima de dos zonas de edición que nadie pidió. Y el cuerpo, que es lo que más se lee —el proceso, los pasos, las casillas—, se muestra como código fuente en vez de como texto: los asteriscos y los guiones a la vista, cuando la vista previa rendida existe y está a un clic.

## What Changes

- **La descripción se lee por omisión.** **BREAKING**: el editor deja de ser la vista inicial. El cuerpo SHALL rendirse siempre —con sus casillas marcables, que siguen funcionando de un toque— y un botón *Editar* junto al título de la tarjeta abre el editor, con su barra de formato y sus acciones *Guardar* y *Cancelar*. Al guardar o cancelar se vuelve a la lectura. Pulsar el cuerpo **no** abre el editor: es lo que mantiene las casillas marcables sin ambigüedad.
- **Una tarea sin descripción invita a escribirla.** En lugar de un `textarea` vacío con su marcador de posición, la tarjeta muestra una invitación pulsable que abre el editor.
- **Los adjuntos muestran solo su lista.** **BREAKING**: la zona de arrastre deja de estar siempre desplegada. Un botón *Añadir* junto al título de la tarjeta la revela —con su alternativa de elegir del equipo— y se repliega al terminar. Quitar sigue estando en cada fila, a un gesto.
- **Las imágenes se ven en un visor, no en otra pestaña.** Activar un adjunto que es imagen abre un diálogo con la imagen a tamaño completo, su nombre y las acciones de abrir el original y quitarlo, y permite pasar a la imagen siguiente y anterior sin cerrarlo. Un adjunto que no es imagen sigue abriéndose como hasta ahora.
- **Fuera de alcance:** el formulario de `/tasks/[id]/edit` y la cabecera, que KAM-29 acaba de dejar como quedan; mover la descripción o los adjuntos a ese formulario; el detalle de pedidos, egresos, ítems o contactos; cambiar qué se guarda, cómo se sanea el Markdown, los límites de adjuntos, la compresión o la cola de subida; reordenar adjuntos; comentarios.

## Capabilities

### New Capabilities

Ninguna. El cambio ajusta cómo se presenta lo que ya existe.

### Modified Capabilities

- `task-detail`: «El cuerpo se escribe en Markdown con ayuda de una barra de herramientas» pasa a abrirse en lectura, con el editor tras una acción explícita y con *Guardar* y *Cancelar*; «Los adjuntos se agregan arrastrando o eligiendo del equipo» deja la zona de arrastre tras una acción y añade el visor de imágenes.

## Impact

- **UI**: `features/tasks/editor/markdown-editor.tsx` (lectura por omisión, modo edición con *Guardar* y *Cancelar*, invitación cuando no hay cuerpo); `features/tasks/attachments/attachment-panel.tsx` (zona de arrastre tras *Añadir*, activación de imagen abre el visor); nuevo `features/tasks/attachments/image-viewer.tsx` sobre `components/ui/dialog.tsx`; `features/tasks/detail/task-detail.tsx` para colocar las acciones en las cabeceras de sus tarjetas.
- **Acciones y servicios**: sin cambios. No se toca qué se guarda ni cómo, ni `updateTaskBody`, ni `toggleTaskChecklistItem`, ni la cola de subida.
- **Esquema, RLS y permisos**: sin cambios. No hay migración.
- **Pruebas**: `markdown-editor.test.tsx` y `checklist-preview.test.tsx` se ajustan al nuevo punto de partida —varias abren hoy asumiendo el `textarea` visible—; nuevo `image-viewer.test.tsx`; `attachment-panel.test.tsx` gana la zona de arrastre plegada y la apertura del visor; e2e `task-detail.spec.ts` y `task-edit.spec.ts` ajustan los pasos que escriben el cuerpo o marcan casillas.
