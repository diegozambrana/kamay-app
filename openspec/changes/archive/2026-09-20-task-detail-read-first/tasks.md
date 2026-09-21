## 1. La descripción se lee por omisión

- [x] 1.1 `features/tasks/editor/markdown-editor.tsx` (design D1): estado `editing`; en lectura rinde `ChecklistPreview` sobre el cuerpo **guardado**, sin barra ni `textarea`; al entrar en edición copia el cuerpo guardado a `draft`. Se retira el guardado por `onBlur`: el único guardado es el botón.
- [x] 1.2 `markdown-editor.tsx`: la tarjeta rinde su propia cabecera con el título *Descripción* y, a su derecha, la acción *Editar* —oculta en una tarea archivada— (design D3). En edición la cabecera ofrece *Guardar* y *Cancelar*.
- [x] 1.3 `markdown-editor.tsx`: una tarea sin cuerpo muestra en lectura una invitación pulsable que abre el editor, en vez de un `textarea` vacío.
- [x] 1.4 `markdown-editor.tsx` (design D2): *Cancelar* con cambios usa `useDiscardConfirm` de `features/orders/discard-guard.tsx`; sin cambios cierra sin preguntar. Guardar cierra el editor y vuelve a la lectura.
- [x] 1.5 `features/tasks/editor/markdown-editor.test.tsx`: el cuerpo se abre rendido y sin editor («Abrir una tarea muestra el cuerpo rendido»); activar el cuerpo no abre nada («Activar el cuerpo no abre el editor»); *Editar* abre la barra y el `textarea`, y las pruebas vigentes de formato y de sintaxis a mano pasan tras abrirlo («Aplicar formato sin saber Markdown», «Crear una lista de verificación desde la barra», «La sintaxis escrita a mano funciona igual»); guardar escribe el mismo texto y cierra («El cuerpo se guarda tal cual», «Guardar vuelve a la lectura»); cancelar con cambios pregunta y descarta («Cancelar descarta lo escrito») y sin cambios no pregunta («Cancelar sin cambios no pregunta nada»); una tarea sin cuerpo muestra la invitación («Una tarea puede no tener cuerpo»); una archivada se lee y no ofrece editar («Una tarea archivada se lee y no se edita»).
- [x] 1.6 `features/tasks/editor/checklist-preview.test.tsx`: las casillas se marcan desde la lectura, sin abrir el editor («Marcar una casilla sigue costando un gesto»); las pruebas vigentes de índice, desmarcado, rechazo del servidor y bloque de código siguen en verde.

## 2. Los adjuntos muestran solo su lista

- [x] 2.1 `features/tasks/attachments/attachment-panel.tsx`: la zona de arrastre pasa a estar plegada; la tarjeta rinde su cabecera con el título *Adjuntos* y la acción *Añadir*, que la despliega y la repliega (design D3). *Quitar* se queda en cada fila. En una tarea archivada no se ofrece ni añadir ni quitar.
- [x] 2.2 `features/tasks/attachments/attachment-panel.test.tsx`: al abrir no se rinde la zona de arrastre («La zona de arrastre no está desplegada»); *Añadir* la revela y adjuntar sigue funcionando («Arrastrar una imagen la adjunta», «Elegir del equipo hace lo mismo»); quitar sigue en la fila («Quitar sigue a un gesto en la fila»); un PDF sigue apareciendo con nombre, peso y autor y sin miniatura («Un archivo que no es imagen se adjunta sin miniatura»); sin conexión se avisa («Sin conexión se avisa y se sigue trabajando»); una archivada conserva la lista sin acciones («Una tarea archivada conserva sus adjuntos»).

## 3. El visor de imágenes

- [x] 3.1 `features/tasks/attachments/image-viewer.tsx` (design D4): `Dialog` que recibe **todas** las imágenes y el índice activo; muestra la imagen a tamaño completo con su nombre, ofrece abrir el original y quitar, y pasa a la siguiente y la anterior con botones y con las flechas del teclado. Quitar pasa a la siguiente y cierra si era la última.
- [x] 3.2 `attachment-panel.tsx` (design D5): activar una fila cuyo adjunto es imagen abre el visor en ella; un adjunto que no es imagen sigue abriéndose como archivo. La decisión usa el mismo `esImagen` que ya decide la miniatura.
- [x] 3.3 `features/tasks/attachments/image-viewer.test.tsx`: se abre con la imagen y su nombre («Una imagen se ve dentro de la pantalla»); pasa de una a otra sin cerrarse, con botón y con flecha («El visor pasa de una imagen a otra»); quitar la última lo cierra; `Esc` cierra sin cambiar nada.
- [x] 3.4 `attachment-panel.test.tsx`: activar una imagen abre el visor y activar un PDF no («Un archivo que no es imagen no abre el visor»).

## 4. La composición del detalle

- [x] 4.1 `features/tasks/detail/task-detail.tsx`: las tarjetas de *Descripción* y *Adjuntos* dejan de declararse aquí; cada componente rinde la suya con su cabecera y su acción (design D3).
- [x] 4.2 `features/tasks/detail/task-detail.test.tsx` pasa sin tocarse: sus testigos siguen demostrando que la descripción, los adjuntos, los vínculos, los entregables y el historial siguen en el detalle. *Las cabeceras ya no se afirman aquí* —pasaron a ser responsabilidad de cada componente y se verifican en `markdown-editor.test.tsx` y `attachment-panel.test.tsx`—.

## 5. e2e

- [x] 5.1 `tests/e2e/task-detail.spec.ts`: los casos que escriben el cuerpo abren primero el editor; el que marca casillas lo hace **desde la lectura**, sin pasar por *Vista previa* («Marcar una casilla sigue costando un gesto»). Se añade que al abrir la tarea el cuerpo se lee rendido («Abrir una tarea muestra el cuerpo rendido»).
- [x] 5.2 `tests/e2e/task-detail.spec.ts`: activar una imagen adjunta abre el visor dentro de la pantalla y `Esc` lo cierra («Una imagen se ve dentro de la pantalla»).
- [x] 5.3 `tests/e2e/task-edit.spec.ts`: el caso «marcar una casilla del cuerpo no exige entrar a editar» se ajusta al nuevo punto de partida —el cuerpo se escribe abriendo el editor y se marca desde la lectura—.
- [x] 5.4 Revisado: ninguna otra e2e toca la descripción ni los adjuntos **de una tarea**. Los hallazgos de `file-dropzone` y `getByLabel("Descripción")` en `archive-restore.spec.ts` y `tools.spec.ts` son de otras pantallas (ítem del catálogo y línea de pedido).

## 6. Cierre

- [x] 6.1 `specs/PRD/kamay-backlog-sprint-01.md`: anotar el cambio en la bitácora, con la decisión de que el cuerpo no se abre al pulsarlo —para que marcar una casilla siga costando un gesto— y la de que el visor recibe todas las imágenes.
- [x] 6.2 `lint` y `typecheck` limpios; `test:unit` 293 archivos / 2881 pruebas; e2e `task-detail` y `task-edit` en serie, 19 de 19. En `test:integration` fallan 0 de 125 salvo `reports.test.ts › no depende del periodo`, que **agota los 5 s y falla igual con este cambio guardado aparte**: la base local engordó con las copias de Geeko de las e2e de hoy. Verificación visual hecha en escritorio y en 390 px, con cuerpo y sin él, y del visor. `graphify update .` al terminar.
