## ADDED Requirements

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

## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Los campos de la tarea se editan y se guardan uno a uno

**Reason**: El detalle deja de ser un formulario. Título, línea, responsable, fecha límite, recordatorio y etiquetas pasan a mostrarse como texto y a cambiarse en `/tasks/[id]/edit` con un solo Guardar, para que abrir una tarea sea leerla y cambiarla sea un acto deliberado, como ya ocurre con pedidos, egresos e ítems. El guardado campo por campo dejaba la lectura expuesta a cambios accidentales y no daba ningún gesto que separase leer de modificar.

**Migration**: Reemplazado por dos requisitos. «El detalle presenta los datos de la tarea y los cambia en una pantalla aparte» conserva en el detalle lo que se hace mientras se trabaja —el cambio de estado con su comparación por tipo y su asistente de cierre, el cuerpo, las casillas, los adjuntos, los vínculos, los entregables y el historial—. «La edición de la tarea reúne sus datos en un formulario con un solo Guardar» recoge los escenarios de validación que siguen vigentes —el título no puede quedar vacío, un recordatorio necesita fecha límite— y la exigencia de que todo cambio guardado quede registrado en la bitácora.
