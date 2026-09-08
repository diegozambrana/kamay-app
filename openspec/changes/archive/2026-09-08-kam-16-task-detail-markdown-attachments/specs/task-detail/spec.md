## Purpose

Convierte la tarea en el lugar donde vive el trabajo y no solo su rótulo: un cuerpo en Markdown escribible sin saber Markdown, con listas de verificación que se marcan y se guardan, adjuntos que se arrastran, se comprimen y suben sin bloquear la edición, y el historial de lo que pasó ahí, leído de la bitácora y de ninguna otra fuente.

> Origen: `specs/PRD/kamay-backlog.md` — KAM-16; `specs/PRD/kamay-especificacion-producto-v6.md` — V18, Flujo B; `specs/PRD/kamay-mapa-navegacion-ui.md` §3 (V18), §4 (pantalla completa móvil), §6 (V17→V18, V20→V18, V21→V18); `specs/PRD/kamay-esquema-base-de-datos-supabase.md` §12–§13; `specs/PRD/ARCHITECTURE.md` (`features/tasks/editor/`, un solo historial, nada derivado se almacena).
>
> Presupone la capacidad de tareas de KAM-15: la tabla `tasks`, su tablero y su alta. Esta capacidad edita ese modelo, no lo define.

## ADDED Requirements

### Requirement: El detalle de tarea es una página con dirección propia

El sistema SHALL ofrecer el detalle de una tarea en `/tasks/[id]` como página con dirección propia, alcanzable en escritorio y en móvil. La dirección SHALL poder abrirse directamente y SHALL resolver la misma tarea que se alcanza desde el tablero. En móvil la página SHALL ocupar la pantalla completa, sin la barra de navegación inferior. Una tarea de otra organización SHALL NOT ser accesible por dirección directa. Una tarea archivada SHALL abrirse en solo lectura, informando de su estado y sin ofrecer guardar.

#### Scenario: Se llega desde el tablero

- **WHEN** se activa una tarjeta del tablero de tareas
- **THEN** se abre `/tasks/[id]` con el detalle de esa tarea

#### Scenario: La dirección es compartible

- **WHEN** se abre `/tasks/[id]` escribiendo la dirección directamente
- **THEN** se rinde el detalle de esa misma tarea

#### Scenario: En móvil ocupa la pantalla completa

- **WHEN** se abre el detalle de una tarea en un viewport de 390 px
- **THEN** la barra de navegación inferior no se rinde y el contenido no exige desplazamiento horizontal

#### Scenario: Una tarea de otra organización no se abre

- **WHEN** una persona de la organización A abre la dirección de una tarea de la organización B
- **THEN** el sistema no muestra la tarea

#### Scenario: Una tarea archivada no se edita

- **WHEN** se abre el detalle de una tarea archivada
- **THEN** sus campos se muestran sin poder editarse y la pantalla informa de que está archivada

### Requirement: Los campos de la tarea se editan y se guardan uno a uno

El sistema SHALL permitir editar desde el detalle el título, el estado, la línea de negocio, el responsable, la fecha límite, el recordatorio y las etiquetas de la tarea. Cada campo SHALL guardarse por sí solo al confirmarlo, sin exigir una acción de guardado global ni bloquear la edición de los demás. Un título vacío SHALL NOT guardarse. Un recordatorio SHALL NOT poder fijarse en una tarea sin fecha límite. El cambio de estado SHALL compararse por el tipo declarado del estado y nunca por su nombre. Todo cambio guardado SHALL quedar registrado en la bitácora.

#### Scenario: Cambiar el responsable no exige guardar nada más

- **WHEN** se elige otro responsable en el detalle
- **THEN** el cambio queda guardado sin ninguna otra acción y el resto de campos sigue editable

#### Scenario: El título no puede quedar vacío

- **WHEN** se borra el título y se confirma el campo
- **THEN** el sistema impide el guardado y conserva el título anterior

#### Scenario: Un recordatorio necesita fecha límite

- **WHEN** se intenta fijar un recordatorio en una tarea sin fecha límite
- **THEN** el sistema lo impide y explica que primero hace falta una fecha límite

#### Scenario: Cada cambio deja rastro

- **WHEN** se cambia la fecha límite de una tarea
- **THEN** la bitácora registra el cambio con su autor y su hora

### Requirement: El cuerpo se escribe en Markdown con ayuda de una barra de herramientas

El sistema SHALL ofrecer para el cuerpo de la tarea un editor de Markdown con una barra de herramientas que aplique al menos negrita, cursiva, encabezado, lista, lista de verificación y enlace sobre la selección o en la posición del cursor. La escritura directa de sintaxis Markdown SHALL seguir funcionando. El editor SHALL ofrecer las vistas **Escribir** y **Vista previa** sobre el mismo contenido. El cuerpo SHALL guardarse tal como se escribió, sin transformarlo. Una tarea sin cuerpo SHALL ser válida.

#### Scenario: Aplicar formato sin saber Markdown

- **WHEN** se selecciona un texto del cuerpo y se activa el botón de negrita
- **THEN** el texto seleccionado queda en negrita y la vista previa lo muestra así

#### Scenario: Crear una lista de verificación desde la barra

- **WHEN** se activa el botón de lista de verificación con el cursor en una línea vacía
- **THEN** la línea pasa a ser un elemento de lista de verificación sin marcar

#### Scenario: La sintaxis escrita a mano funciona igual

- **WHEN** se escribe `**taza**` en el cuerpo y se abre la vista previa
- **THEN** la palabra aparece en negrita

#### Scenario: El cuerpo se guarda tal cual

- **WHEN** se guarda un cuerpo y se vuelve a abrir la tarea
- **THEN** el editor muestra exactamente el mismo texto que se escribió

#### Scenario: Una tarea puede no tener cuerpo

- **WHEN** se abre una tarea cuyo cuerpo está vacío
- **THEN** el editor se rinde vacío y la tarea es válida

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

El sistema SHALL ofrecer en el detalle una zona que acepte archivos arrastrados y SHALL ofrecer además la alternativa de elegirlos del equipo. Los adjuntos SHALL guardarse asociados a la tarea con `entity_type = 'task'` en el bucket privado de adjuntos. Cada adjunto SHALL mostrarse con su nombre, su peso y quién lo subió; los que son imagen SHALL mostrar además una miniatura. Ningún adjunto SHALL mostrarse por URL pública: cada lectura SHALL firmarse. Agregar un adjunto SHALL requerir conexión; sin ella el sistema SHALL informarlo y SHALL NOT impedir editar ni guardar el resto de la tarea.

#### Scenario: Arrastrar una imagen la adjunta

- **WHEN** se arrastra una imagen sobre la zona de adjuntos
- **THEN** queda adjunta a la tarea y aparece en la lista con su miniatura

#### Scenario: Elegir del equipo hace lo mismo

- **WHEN** se elige un archivo del equipo desde la alternativa ofrecida
- **THEN** queda adjunto a la tarea igual que si se hubiera arrastrado

#### Scenario: Un archivo que no es imagen se adjunta sin miniatura

- **WHEN** se adjunta un PDF a la tarea
- **THEN** aparece en la lista con su nombre, su peso y quién lo subió, sin miniatura

#### Scenario: Sin conexión se avisa y se sigue trabajando

- **WHEN** se intenta adjuntar un archivo sin conexión
- **THEN** el sistema informa de que hace falta conexión y el cuerpo y los campos de la tarea siguen editables y guardables

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
