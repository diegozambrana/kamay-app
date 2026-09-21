## MODIFIED Requirements

### Requirement: El cuerpo se escribe en Markdown con ayuda de una barra de herramientas

El detalle SHALL mostrar el cuerpo de la tarea **rendido** por omisión, no en su forma de origen: abrir una tarea es leerla. Las casillas de verificación del cuerpo SHALL seguir siendo marcables directamente desde esa lectura, sin abrir nada.

El sistema SHALL ofrecer una acción explícita para editar el cuerpo. Solo esa acción SHALL abrir el editor; activar el cuerpo rendido SHALL NOT abrirlo, de modo que marcar una casilla siga costando un solo gesto. Cuando la tarea no tiene cuerpo, el sistema SHALL mostrar en su lugar una invitación a escribirlo que abre el editor.

El editor SHALL ofrecer una barra de herramientas que aplique al menos negrita, cursiva, encabezado, lista, lista de verificación y enlace sobre la selección o en la posición del cursor. La escritura directa de sintaxis Markdown SHALL seguir funcionando. El editor SHALL permitir alternar entre **Escribir** y **Vista previa** sobre el mismo contenido mientras está abierto. SHALL ofrecer *Guardar* y *Cancelar*: guardar SHALL escribir el cuerpo tal como se escribió, sin transformarlo, y volver a la lectura; cancelar SHALL volver a la lectura descartando lo escrito. Si hay cambios sin guardar, cancelar SHALL pedir confirmación antes de descartarlos.

Una tarea sin cuerpo SHALL ser válida. Una tarea archivada SHALL mostrar su cuerpo rendido y SHALL NOT ofrecer la acción de editar.

#### Scenario: Abrir una tarea muestra el cuerpo rendido

- **GIVEN** una tarea cuyo cuerpo es `Set de **6 tazas** de gres`
- **WHEN** se abre su detalle
- **THEN** se lee «Set de 6 tazas de gres» con «6 tazas» en negrita, y no se muestra ni el texto con asteriscos ni el editor

#### Scenario: Aplicar formato sin saber Markdown

- **WHEN** se abre el editor, se selecciona un texto del cuerpo y se activa el botón de negrita
- **THEN** el texto seleccionado queda en negrita y la vista previa lo muestra así

#### Scenario: Crear una lista de verificación desde la barra

- **WHEN** se abre el editor y se activa el botón de lista de verificación con el cursor en una línea vacía
- **THEN** la línea pasa a ser un elemento de lista de verificación sin marcar

#### Scenario: La sintaxis escrita a mano funciona igual

- **WHEN** se escribe `**taza**` en el editor y se abre la vista previa
- **THEN** la palabra aparece en negrita

#### Scenario: El cuerpo se guarda tal cual

- **WHEN** se guarda un cuerpo y se vuelve a abrir la tarea
- **THEN** el cuerpo rendido corresponde exactamente al texto que se escribió, y al volver a abrir el editor este muestra ese mismo texto

#### Scenario: Guardar vuelve a la lectura

- **WHEN** se edita el cuerpo y se pulsa *Guardar*
- **THEN** el cuerpo queda guardado, el editor se cierra y la tarjeta vuelve a mostrar el cuerpo rendido

#### Scenario: Cancelar descarta lo escrito

- **WHEN** se edita el cuerpo y se pulsa *Cancelar*, y se confirma el descarte
- **THEN** el editor se cierra, el cuerpo sigue siendo el guardado y nada se escribió

#### Scenario: Cancelar sin cambios no pregunta nada

- **WHEN** se abre el editor y se pulsa *Cancelar* sin escribir nada
- **THEN** el editor se cierra sin ninguna confirmación

#### Scenario: Activar el cuerpo no abre el editor

- **WHEN** se pulsa sobre el cuerpo rendido
- **THEN** el editor no se abre y la tarjeta sigue en lectura

#### Scenario: Marcar una casilla sigue costando un gesto

- **GIVEN** una tarea cuyo cuerpo tiene una lista de verificación
- **WHEN** se marca una casilla desde la lectura
- **THEN** queda marcada y persiste, sin haber abierto el editor

#### Scenario: Una tarea puede no tener cuerpo

- **WHEN** se abre una tarea cuyo cuerpo está vacío
- **THEN** la tarjeta muestra una invitación a escribir la descripción, la tarea es válida, y activar esa invitación abre el editor

#### Scenario: Una tarea archivada se lee y no se edita

- **WHEN** se abre el detalle de una tarea archivada con cuerpo
- **THEN** el cuerpo se muestra rendido y no se ofrece la acción de editarlo

### Requirement: Los adjuntos se agregan arrastrando o eligiendo del equipo

El detalle SHALL mostrar por omisión **solo la lista** de adjuntos de la tarea. El sistema SHALL ofrecer una acción explícita para añadir, que revela una zona que acepta archivos arrastrados y la alternativa de elegirlos del equipo; esa zona SHALL poder replegarse. Quitar un adjunto SHALL seguir disponible en su fila, sin entrar en ningún modo de edición.

Los adjuntos SHALL guardarse asociados a la tarea con `entity_type = 'task'` en el bucket privado de adjuntos. Cada adjunto SHALL mostrarse con su nombre, su peso y quién lo subió; los que son imagen SHALL mostrar además una miniatura. Ningún adjunto SHALL mostrarse por URL pública: cada lectura SHALL firmarse. Agregar un adjunto SHALL requerir conexión; sin ella el sistema SHALL informarlo y SHALL NOT impedir editar ni guardar el resto de la tarea. Una tarea archivada SHALL conservar su lista y SHALL NOT ofrecer añadir ni quitar.

Activar un adjunto que es imagen SHALL abrirlo en un visor dentro de la propia pantalla, que muestra la imagen a tamaño completo con su nombre y ofrece abrir el original y —salvo en una tarea archivada— quitarlo. Cuando la tarea tiene varias imágenes, el visor SHALL permitir pasar a la siguiente y a la anterior sin cerrarse. Cerrar el visor SHALL devolver al detalle sin cambiar nada. Un adjunto que no es imagen SHALL seguir abriéndose como archivo.

#### Scenario: La zona de arrastre no está desplegada

- **WHEN** se abre el detalle de una tarea
- **THEN** se ve la lista de sus adjuntos y no la zona de arrastre, hasta que se active la acción de añadir

#### Scenario: Arrastrar una imagen la adjunta

- **WHEN** se activa la acción de añadir y se arrastra una imagen sobre la zona
- **THEN** queda adjunta a la tarea y aparece en la lista con su miniatura

#### Scenario: Elegir del equipo hace lo mismo

- **WHEN** se elige un archivo del equipo desde la alternativa ofrecida
- **THEN** queda adjunto a la tarea igual que si se hubiera arrastrado

#### Scenario: Un archivo que no es imagen se adjunta sin miniatura

- **WHEN** se adjunta un PDF a la tarea
- **THEN** aparece en la lista con su nombre, su peso y quién lo subió, sin miniatura

#### Scenario: Una imagen se ve dentro de la pantalla

- **WHEN** se activa un adjunto que es imagen
- **THEN** se abre un visor con la imagen a tamaño completo y su nombre, sin salir del detalle ni abrir otra pestaña

#### Scenario: El visor pasa de una imagen a otra

- **GIVEN** una tarea con tres imágenes adjuntas
- **WHEN** se abre el visor en la primera y se pide la siguiente
- **THEN** el visor muestra la segunda imagen sin cerrarse

#### Scenario: Un archivo que no es imagen no abre el visor

- **WHEN** se activa un PDF adjunto
- **THEN** se abre como archivo y el visor no aparece

#### Scenario: Quitar sigue a un gesto en la fila

- **WHEN** se quita un adjunto desde su fila
- **THEN** deja de figurar entre los vigentes sin haber entrado en ningún modo de edición

#### Scenario: Sin conexión se avisa y se sigue trabajando

- **WHEN** se intenta adjuntar un archivo sin conexión
- **THEN** el sistema informa de que hace falta conexión y el cuerpo y los campos de la tarea siguen editables y guardables

#### Scenario: Una tarea archivada conserva sus adjuntos

- **WHEN** se abre el detalle de una tarea archivada con adjuntos
- **THEN** se ve su lista, no se ofrece añadir ni quitar, y sus imágenes siguen abriéndose en el visor
