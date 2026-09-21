# task-detail Specification

## Purpose

Convierte la tarea en el lugar donde vive el trabajo y no solo su rótulo: un cuerpo en Markdown escribible sin saber Markdown, con listas de verificación que se marcan y se guardan, adjuntos que se arrastran, se comprimen y suben sin bloquear la edición, y el historial de lo que pasó ahí, leído de la bitácora y de ninguna otra fuente.

> Origen: `specs/PRD/kamay-backlog.md` — KAM-16; `specs/PRD/kamay-especificacion-producto-v6.md` — V18, Flujo B; `specs/PRD/kamay-mapa-navegacion-ui.md` §3 (V18), §4 (pantalla completa móvil), §6 (V17→V18, V20→V18, V21→V18); `specs/PRD/kamay-esquema-base-de-datos-supabase.md` §12–§13; `specs/PRD/ARCHITECTURE.md` (`features/tasks/editor/`, un solo historial, nada derivado se almacena).
>
> Presupone la capacidad de tareas de KAM-15: la tabla `tasks`, su tablero y su alta. Esta capacidad edita ese modelo, no lo define.

## Requirements

### Requirement: El detalle de tarea es una página con dirección propia

El sistema SHALL ofrecer el detalle de una tarea en `/tasks/[id]` y su edición en `/tasks/[id]/edit` como páginas con dirección propia, alcanzables en escritorio y en móvil. Ambas direcciones SHALL poder abrirse directamente y SHALL resolver la misma tarea que se alcanza desde el tablero. En móvil ambas páginas SHALL ocupar la pantalla completa, sin la barra de navegación inferior. Una tarea que la persona no alcanza —de otra organización, o de una línea que su rol no ve— SHALL NOT ser accesible por ninguna de las dos direcciones. Una tarea archivada SHALL abrirse en solo lectura: el detalle SHALL informar de su estado, mostrar sus datos sin poder cambiarlos y SHALL NOT ofrecer la acción *Editar*; `/tasks/[id]/edit` SHALL informar de su estado y SHALL NOT ofrecer el formulario.

#### Scenario: Se llega desde el tablero

- **WHEN** se activa una tarjeta del tablero de tareas
- **THEN** se abre `/tasks/[id]` con el detalle de esa tarea

#### Scenario: La dirección es compartible

- **WHEN** se abre `/tasks/[id]` escribiendo la dirección directamente
- **THEN** se rinde el detalle de esa misma tarea

#### Scenario: En móvil ocupa la pantalla completa

- **WHEN** se abre el detalle de una tarea, y luego su edición, en un viewport de 390 px
- **THEN** en ninguna de las dos se rinde la barra de navegación inferior, y el contenido no exige desplazamiento horizontal

#### Scenario: Una tarea de otra organización no se abre

- **WHEN** una persona de la organización A abre la dirección de una tarea de la organización B
- **THEN** el sistema no muestra la tarea, ni en el detalle ni en la edición

#### Scenario: El ayudante no edita lo que no ve

- **GIVEN** una tarea de una línea que un ayudante no tiene asignada
- **WHEN** ese ayudante abre `/tasks/[id]/edit` de esa tarea
- **THEN** el sistema no la muestra, igual que no muestra su detalle

#### Scenario: Una tarea archivada no se edita

- **WHEN** se abre el detalle de una tarea archivada
- **THEN** sus datos se muestran sin poder cambiarse, la pantalla informa de que está archivada y no se ofrece la acción *Editar*

#### Scenario: La edición de una tarea archivada lo explica

- **WHEN** se abre `/tasks/[id]/edit` de una tarea archivada
- **THEN** la pantalla explica que está archivada, no ofrece el formulario ni guardar, y conserva sus migas de pan

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

### Requirement: El Markdown rendido se sanea

El sistema SHALL rendir el cuerpo como Markdown y SHALL NOT interpretar el HTML escrito a mano dentro de él: ninguna etiqueta HTML del cuerpo SHALL llegar al documento rendido, ni como elemento ni como texto ejecutable. El sistema SHALL sanear además el resultado, tanto en la vista previa como en cualquier otra lectura del cuerpo, de modo que ningún enlace con esquema peligroso —`javascript:` entre otros— conserve su destino, y SHALL conservar el formato legítimo. Ningún contenido del cuerpo SHALL ejecutarse en el navegador de quien lo lee. Ambas defensas SHALL aplicarse también a los cuerpos guardados con anterioridad, sin depender de que se hayan saneado al escribirse.

#### Scenario: Un script no se ejecuta

- **WHEN** el cuerpo contiene `<script>alert(1)</script>` y se abre la vista previa
- **THEN** no se ejecuta nada y la etiqueta no aparece en el documento rendido

#### Scenario: El HTML escrito a mano no se rinde

- **WHEN** el cuerpo contiene una imagen con `onerror` y un `<iframe>`, y se abre la vista previa
- **THEN** no se rinde ninguno de los dos elementos, sus atributos no llegan al documento y no se ejecuta nada

#### Scenario: Un enlace con esquema peligroso no navega

- **WHEN** el cuerpo contiene un enlace con destino `javascript:`
- **THEN** el enlace rendido no conserva ese destino

#### Scenario: El formato legítimo sobrevive

- **WHEN** el cuerpo contiene negritas, encabezados, listas y un enlace `https://`
- **THEN** todos se rinden con su formato y el enlace conserva su destino

#### Scenario: Un cuerpo antiguo también se sanea

- **WHEN** se abre una tarea cuyo cuerpo peligroso ya estaba guardado
- **THEN** la lectura lo rinde saneado igual que uno recién escrito

### Requirement: Las listas de verificación del cuerpo se marcan y persisten

El sistema SHALL rendir cada elemento `- [ ]` o `- [x]` del cuerpo como una casilla marcable en la vista previa. Marcar o desmarcar una casilla SHALL reescribir esa línea del cuerpo y guardar el resultado. El estado de una casilla SHALL vivir únicamente en el cuerpo de la tarea y SHALL NOT almacenarse en ninguna otra tabla, columna ni store. Alternar una casilla SHALL modificar solo su línea, dejando intacto el resto del cuerpo. En una tarea archivada las casillas SHALL rendirse sin poder marcarse.

#### Scenario: Marcar una casilla la deja marcada

- **WHEN** se marca la casilla de un elemento de lista de verificación y se recarga la tarea
- **THEN** la casilla sigue marcada

#### Scenario: El cuerpo refleja el marcado

- **WHEN** se marca la primera casilla de una lista de verificación
- **THEN** el cuerpo pasa a contener `- [x]` en esa línea

#### Scenario: Desmarcar también persiste

- **WHEN** se desmarca una casilla ya marcada y se recarga la tarea
- **THEN** la casilla aparece sin marcar

#### Scenario: Solo cambia la línea alternada

- **WHEN** se marca la tercera casilla de una lista de cinco pasos con texto alrededor
- **THEN** las demás líneas y el texto que las rodea quedan idénticos

#### Scenario: No hay segunda fuente del marcado

- **WHEN** se marca una casilla
- **THEN** el único registro del cambio es el cuerpo de la tarea y la entrada correspondiente de la bitácora

#### Scenario: Una tarea archivada no se marca

- **WHEN** se abre una tarea archivada con lista de verificación
- **THEN** las casillas se muestran con su estado y no responden a la interacción

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
### Requirement: Las imágenes se comprimen y todo adjunto sube en segundo plano

El sistema SHALL comprimir en el navegador las imágenes adjuntadas hasta que pesen 5 MB o menos antes de subirlas. Un archivo que no es imagen SHALL subirse sin transformar y SHALL rechazarse con mensaje claro si pasa de 5 MB. La subida SHALL ocurrir en segundo plano: mientras un adjunto viaja, el título, el cuerpo, el estado y los demás campos de la tarea SHALL seguir editables y guardables. Cada adjunto en vuelo SHALL mostrarse como tal. Si una subida falla, el sistema SHALL avisar cuál falló y SHALL permitir reintentarla, sin afectar a las demás ni al resto de la tarea.

#### Scenario: Una foto de 10 MB se adjunta igual

- **WHEN** se arrastra una imagen de 10 MB a la tarea
- **THEN** se comprime hasta caber en el límite y queda adjunta

#### Scenario: La tarea sigue editable mientras sube

- **WHEN** hay un adjunto subiendo y se edita el cuerpo de la tarea
- **THEN** el cuerpo se guarda sin esperar a que la subida termine

#### Scenario: Lo que está subiendo se ve

- **WHEN** un adjunto está en vuelo
- **THEN** aparece en la lista señalado como subiendo

#### Scenario: Un archivo grande que no es imagen se rechaza

- **WHEN** se intenta adjuntar un PDF de 12 MB
- **THEN** el sistema lo rechaza con un mensaje que indica el límite y no lo sube

#### Scenario: Una subida fallida se reintenta

- **WHEN** la subida de un adjunto falla
- **THEN** el sistema indica cuál falló y ofrece reintentarla, y los demás adjuntos quedan intactos

#### Scenario: Varias imágenes a la vez

- **WHEN** se arrastran tres imágenes juntas
- **THEN** las tres se encolan y suben, cada una con su propio indicador

### Requirement: Una tarea admite hasta quince adjuntos vigentes

El sistema SHALL limitar a 15 los adjuntos vigentes de una tarea. Al intentar superar ese límite SHALL impedirlo con un mensaje que indique el límite, sin subir nada y sin afectar a los adjuntos ya presentes. El límite SHALL comprobarse también en el servidor, no solo antes de enviar. Quitar un adjunto SHALL archivarlo, nunca borrarlo, y SHALL liberar una ranura. Un adjunto archivado SHALL dejar de aparecer en la lista y SHALL conservarse en la historia de la tarea.

#### Scenario: El decimosexto no entra

- **WHEN** una tarea tiene 15 adjuntos vigentes y se intenta agregar otro
- **THEN** el sistema lo impide con un mensaje que indica el límite y los 15 existentes quedan intactos

#### Scenario: Un lote que desborda el límite se rechaza

- **WHEN** una tarea tiene 13 adjuntos vigentes y se arrastran cinco archivos a la vez
- **THEN** el sistema avisa de que se supera el límite y no deja la tarea con más de 15 adjuntos vigentes

#### Scenario: Quitar libera ranura

- **WHEN** se quita un adjunto de una tarea que tenía 15 y se agrega otro
- **THEN** el nuevo adjunto se acepta

#### Scenario: Quitar archiva, no borra

- **WHEN** se quita un adjunto de la tarea
- **THEN** deja de aparecer en la lista, la fila sigue existiendo archivada y el objeto sigue en el bucket

#### Scenario: El límite no depende del navegador

- **WHEN** se intenta registrar un decimosexto adjunto sin pasar por la pantalla
- **THEN** el servidor lo rechaza igualmente

### Requirement: Los adjuntos de una tarea solo son accesibles dentro de su organización

El sistema SHALL restringir la lectura de los adjuntos de una tarea a los miembros autenticados de la organización dueña de la tarea. La restricción SHALL sostenerse tanto en las filas de adjuntos como en los objetos almacenados, sin depender de que la pantalla oculte el enlace. Una persona de otra organización SHALL NOT poder listar, leer, subir ni modificar el objeto de un adjunto ajeno, ni siquiera conociendo su ruta. Ninguna persona SHALL poder eliminar un adjunto ni su objeto.

#### Scenario: Otra organización no lista los adjuntos

- **WHEN** una persona de la organización B consulta los adjuntos de una tarea de la organización A
- **THEN** obtiene cero filas

#### Scenario: Conocer la ruta no basta

- **WHEN** una persona de la organización B intenta leer el objeto almacenado de un adjunto de la organización A usando su ruta exacta
- **THEN** el almacenamiento se lo niega

#### Scenario: Tampoco se puede escribir en la carpeta ajena

- **WHEN** una persona de la organización B intenta subir un objeto a la carpeta de la organización A
- **THEN** el almacenamiento se lo niega

#### Scenario: Un miembro sí accede

- **WHEN** un miembro de la organización A abre un adjunto de una tarea de su organización
- **THEN** el adjunto se muestra mediante una lectura firmada

#### Scenario: Nadie borra un adjunto

- **WHEN** cualquier persona autenticada intenta eliminar la fila de un adjunto o su objeto
- **THEN** la operación es rechazada

### Requirement: El historial de la tarea sale de la bitácora

El sistema SHALL mostrar en el detalle un bloque de historial con lo ocurrido en esa tarea, leído de la bitácora del sistema filtrada por esa tarea, del cambio más reciente al más antiguo, con autor y momento de cada uno. El sistema SHALL NOT mantener ninguna otra tabla, columna o store de historial de tareas. Para quien no puede leer la bitácora, el bloque SHALL rendirse vacío con su mensaje de lista sin contenido, nunca como un error. El bloque SHALL ofrecer el paso a la bitácora completa filtrada por esa tarea cuando esa pantalla exista.

#### Scenario: Los cambios aparecen en el historial

- **WHEN** se cambia el estado y luego el responsable de una tarea y se mira su historial
- **THEN** ambos cambios aparecen, el más reciente primero, con su autor y su momento

#### Scenario: Adjuntar también queda registrado

- **WHEN** se adjunta un archivo a la tarea
- **THEN** el historial recoge que se adjuntó

#### Scenario: No existe una segunda tabla de historial

- **WHEN** se inspecciona de dónde sale el bloque de historial
- **THEN** su única fuente es la bitácora del sistema

#### Scenario: El ayudante ve el bloque vacío, no un error

- **WHEN** un ayudante abre el detalle de una tarea con cambios registrados
- **THEN** el bloque de historial se rinde con su mensaje de lista sin contenido y el resto de la pantalla funciona con normalidad

#### Scenario: Una tarea recién creada tiene su primera entrada

- **WHEN** se abre el detalle de una tarea recién creada
- **THEN** el historial muestra su creación
### Requirement: El detalle presenta los datos de la tarea y los cambia en una pantalla aparte

El detalle de la tarea SHALL mostrar su título, su línea de negocio, su responsable, su fecha límite, su recordatorio y sus etiquetas como texto, y SHALL NOT ofrecer controles para cambiarlos. SHALL ofrecer una acción *Editar* que lleva a `/tasks/[id]/edit`. Un dato sin valor —sin responsable, sin fecha límite, sin recordatorio, sin etiquetas— SHALL presentarse como ausente y no como un hueco en blanco.

Lo que se hace **mientras se trabaja** SHALL seguir ocurriendo en el detalle, sin pasar por la edición:

- El **estado** SHALL cambiarse desde el detalle, comparado por su tipo declarado y nunca por su nombre. Llevarlo a un estado de tipo `final` con entregables sin cumplir SHALL abrir el asistente de cierre, como hasta ahora.
- El **cuerpo en Markdown** SHALL escribirse, rendirse y marcarse en el detalle, con su propio guardado y sin exigir entrar a la edición.
- Los **adjuntos**, los **vínculos**, los **entregables** y el **historial** SHALL permanecer en el detalle, con su comportamiento actual.

Ningún dato de la tarea SHALL calcularse ni guardarse dos veces por existir dos pantallas: el detalle y la edición SHALL leer la misma fuente.

#### Scenario: La cabecera se lee, no se edita

- **WHEN** se abre el detalle de una tarea
- **THEN** su título, su línea, su responsable, su fecha límite, su recordatorio y sus etiquetas se muestran como texto, sin campos ni selectores que los cambien

#### Scenario: Editar lleva al formulario

- **WHEN** se activa la acción *Editar* en el detalle de una tarea
- **THEN** se abre `/tasks/[id]/edit` con el formulario de esa tarea

#### Scenario: Las etiquetas se ven en el detalle

- **GIVEN** una tarea con las etiquetas «Hornada-07» y «Urgente»
- **WHEN** se abre su detalle
- **THEN** ambas etiquetas se muestran

#### Scenario: Un dato ausente se dice

- **GIVEN** una tarea sin responsable y sin fecha límite
- **WHEN** se abre su detalle
- **THEN** ambos datos se presentan como ausentes, y no como espacios vacíos

#### Scenario: El estado se cambia sin salir del detalle

- **WHEN** se elige otro estado en el detalle de una tarea
- **THEN** el cambio queda guardado ahí mismo, sin abrir la edición, y la bitácora lo registra

#### Scenario: Cerrar con entregables pendientes sigue abriendo el asistente

- **GIVEN** una tarea con un entregable sin cumplir
- **WHEN** desde el detalle se la lleva a un estado de tipo `final`
- **THEN** se abre el asistente de cierre, como antes de existir la pantalla de edición

#### Scenario: Marcar una casilla no exige editar

- **GIVEN** una tarea cuyo cuerpo tiene una lista de verificación
- **WHEN** se marca una casilla desde el detalle
- **THEN** queda marcada y persiste, sin pasar por `/tasks/[id]/edit`

#### Scenario: El cuerpo se escribe en el detalle

- **WHEN** se escribe en la descripción desde el detalle y se guarda
- **THEN** el cuerpo queda guardado sin abrir la pantalla de edición

#### Scenario: Adjuntos, vínculos y entregables siguen en el detalle

- **WHEN** se adjunta un archivo, se declara un entregable o se vincula un pedido
- **THEN** las tres cosas ocurren en el detalle, y la pantalla de edición no las ofrece

### Requirement: La edición de la tarea reúne sus datos en un formulario con un solo Guardar

`/tasks/[id]/edit` SHALL ofrecer un formulario con el título, la línea de negocio, el responsable, la fecha límite, el recordatorio y las etiquetas de la tarea, cargado con sus valores actuales. El estado, el cuerpo, los adjuntos, los vínculos y los entregables SHALL NOT formar parte de este formulario. El alta de tarea SHALL conservar sus campos, su destino y su comportamiento actuales.

Un título vacío SHALL NOT guardarse, y el mensaje SHALL señalar el campo. Un recordatorio SHALL NOT poder fijarse en una tarea sin fecha límite. Quitar la fecha límite SHALL quitar también el recordatorio.

Al pulsar Guardar con conexión, el sistema SHALL escribir los campos cambiados en una única operación, SHALL esperar a que el envío se confirme —indicando que está guardando— y SHALL llevar a `/tasks/[id]`, que SHALL mostrar los valores nuevos. Si el envío falla, el formulario SHALL quedarse abierto con el error y con los datos escritos. La bitácora SHALL registrar exactamente los campos cambiados, con su valor anterior y el nuevo, y ningún campo más.

Si el formulario tiene cambios sin guardar y se intenta salir —cancelar, seguir una miga de pan, o abandonar la página—, el sistema SHALL pedir confirmación antes de descartar. Si no tiene cambios, SHALL salir sin preguntar. Tras un guardado exitoso, la salida SHALL NOT pedir confirmación.

#### Scenario: El formulario llega con los valores actuales

- **GIVEN** una tarea titulada «Cortar tazas», de la línea Alfarería, con responsable, fecha límite y una etiqueta
- **WHEN** se abre `/tasks/[id]/edit`
- **THEN** el formulario muestra esos mismos valores, y no muestra el estado ni el cuerpo de la tarea

#### Scenario: Guardar lleva al detalle con los valores nuevos

- **WHEN** se cambia el título y se pulsa Guardar con conexión
- **THEN** el formulario indica que está guardando y, al confirmarse el envío, navega a `/tasks/[id]`, que muestra el título nuevo

#### Scenario: Tres campos, un solo registro de bitácora

- **WHEN** se cambian de una vez el título, el responsable y la fecha límite, y se guarda
- **THEN** la bitácora registra esos tres campos, cada uno con su valor anterior y el nuevo, y ningún otro campo de la tarea

#### Scenario: Un campo que no se tocó no se registra

- **GIVEN** una tarea cuya descripción y cuyas etiquetas no se tocan en el formulario
- **WHEN** se cambia solo la fecha límite y se guarda
- **THEN** la bitácora registra la fecha límite y nada más

#### Scenario: El título no puede quedar vacío

- **WHEN** se borra el título y se intenta guardar
- **THEN** el guardado se impide con un mensaje que señala el campo, y la tarea conserva su título

#### Scenario: Un recordatorio necesita fecha límite

- **WHEN** se fija un recordatorio en una tarea sin fecha límite y se intenta guardar
- **THEN** el guardado se impide y el mensaje explica que primero hace falta una fecha límite

#### Scenario: Quitar la fecha límite quita el recordatorio

- **GIVEN** una tarea con fecha límite y recordatorio
- **WHEN** se borra la fecha límite y se guarda
- **THEN** la tarea queda sin fecha límite y sin recordatorio

#### Scenario: Salir con cambios pide confirmación

- **WHEN** se cambia el responsable y se pulsa Cancelar, o la miga de pan de la tarea
- **THEN** se pide confirmación; al rechazarla sigue en el formulario con el cambio intacto, y al aceptarla sale sin guardar

#### Scenario: Salir sin cambios no pregunta nada

- **WHEN** se abre el formulario y se sale sin tocar ningún campo
- **THEN** la salida ocurre sin ninguna confirmación

#### Scenario: Salir tras guardar no pregunta nada

- **WHEN** se guarda con éxito
- **THEN** la navegación al detalle ocurre sin confirmación de descarte

#### Scenario: Un fallo deja el formulario abierto

- **WHEN** el envío de la edición falla
- **THEN** el formulario sigue abierto con el error y con los datos escritos, y la tarea conserva sus valores anteriores

#### Scenario: El alta no cambia

- **WHEN** se abre el alta de tarea y se guarda con título, línea, responsable, fecha límite y etiquetas
- **THEN** la tarea queda creada con todo ello y el alta se comporta como antes de existir la pantalla de edición
