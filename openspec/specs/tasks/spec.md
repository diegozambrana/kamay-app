# tasks Specification

## Purpose

Da al taller un sitio dentro del sistema para su propio trabajo pendiente —lo que se piensa, no lo que se le debe a un cliente—: un modelo de tarea con línea obligatoria, estado resuelto por configuración y etiquetas, y un tablero donde el trabajo avanza y retrocede sin ceremonia. Su regla fundacional es la separación: el tablero de pedidos gestiona compromisos con clientes, el de tareas gestiona el trabajo propio, y ningún movimiento de uno mueve el otro.

> Origen: `specs/PRD/kamay-backlog.md` — KAM-15; `specs/PRD/kamay-esquema-base-de-datos-supabase.md` §12, §16, §18; `specs/PRD/kamay-especificacion-producto-v6.md` §6.3 y V17; `specs/PRD/kamay-mapa-navegacion-ui.md` §4.1, §5, §11; `specs/PRD/ARCHITECTURE.md` (convención 5: los estados se comparan por `kind`; convención 10: pedidos y tareas no se sincronizan).

## Requirements

### Requirement: Modelo de tarea con título y línea obligatorios

El sistema SHALL almacenar las tareas en la tabla `tasks` según el esquema canónico, con `organization_id`, `business_line_id`, `status_id` y `title` obligatorios, y los campos opcionales `assignee_id`, `due_at`, `remind_at`, `body_markdown`, `closed_at`, `closed_without_deliverables` y `archived_at`. Una tarea con título y línea SHALL guardarse sin ningún otro dato. Una tarea sin línea SHALL ser rechazada por la base de datos. La restricción `reminder_needs_due_date` SHALL exigir que `remind_at` sea nulo mientras `due_at` lo sea.

#### Scenario: Título y línea bastan

- **WHEN** se guarda una tarea con solo título y línea de negocio
- **THEN** la tarea queda creada, con su estado inicial asignado y sin responsable, fecha ni etiquetas

#### Scenario: Tarea sin línea

- **WHEN** se intenta guardar una tarea sin `business_line_id`
- **THEN** la base de datos rechaza la operación

#### Scenario: Tarea sin título

- **WHEN** se intenta guardar una tarea con el título vacío
- **THEN** la operación se rechaza con un mensaje comprensible y nada se crea

#### Scenario: Recordatorio sin fecha límite

- **WHEN** se intenta guardar una tarea con `remind_at` y sin `due_at`
- **THEN** la base de datos rechaza la operación por la restricción `reminder_needs_due_date`

### Requirement: El estado inicial lo asigna la base resolviendo el juego de la línea

Al crear una tarea sin estado explícito, el sistema SHALL asignarle el estado de tipo `initial` del juego que resuelve para su línea de negocio en el flujo `task`, aplicando la resolución ya definida por la configuración de estados: el juego propio de la línea si existe, y el de la organización si no. La asignación SHALL ocurrir en la base de datos, de modo que toda vía de alta obtenga el mismo estado inicial. Ninguna consulta del sistema SHALL identificar el estado inicial por su nombre.

#### Scenario: Alta sin estado explícito

- **WHEN** se crea una tarea de una línea sin juego propio de tareas
- **THEN** queda en el estado de tipo `initial` del juego de la organización

#### Scenario: Línea con juego propio de tareas

- **WHEN** se crea una tarea de una línea que tiene su propio juego de estados de tarea
- **THEN** queda en el estado de tipo `initial` de ese juego, y el de la organización se ignora

#### Scenario: Estado explícito respetado

- **WHEN** se crea una tarea indicando un estado del juego que le corresponde
- **THEN** la tarea queda en ese estado, sin que la asignación automática lo reemplace

#### Scenario: El nombre del estado no decide nada

- **WHEN** la organización renombra su estado inicial de tareas
- **THEN** las tareas nuevas siguen naciendo en ese mismo estado, identificado por su tipo

### Requirement: El cierre se deriva de la posición en el tablero

El sistema SHALL registrar en `closed_at` el instante en que una tarea entra en un estado de tipo `final`, y SHALL borrarlo cuando la tarea deja de estar en un estado de ese tipo. El valor SHALL mantenerlo la base de datos al cambiar el estado, no la aplicación, de modo que ninguna vía de cambio de estado pueda dejarlo sin actualizar. `closed_at` SHALL NOT ser editable como un campo más de la tarea.

#### Scenario: Cerrar una tarea

- **WHEN** una tarea se mueve a un estado de tipo `final`
- **THEN** su `closed_at` queda con el instante del movimiento

#### Scenario: Reabrir una tarea

- **WHEN** una tarea que estaba en un estado `final` se mueve a uno que no lo es
- **THEN** su `closed_at` vuelve a quedar nulo

#### Scenario: Editar la tarea no la cierra

- **WHEN** se cambia el responsable o la fecha límite de una tarea abierta
- **THEN** su `closed_at` sigue nulo y su estado no cambia

### Requirement: Etiquetas por organización creadas al vuelo

El sistema SHALL ofrecer etiquetas propias de la organización, almacenadas en `tags` con nombre único dentro de la organización, y relacionadas con las tareas mediante `task_tags`. El selector de etiquetas de una tarea SHALL buscar entre las existentes tolerando diferencias de acentuación y de mayúsculas, y SHALL ofrecer crear la etiqueta cuando no exista, sin obligar a darla de alta previamente en ninguna pantalla de configuración. Una tarea SHALL poder llevar varias etiquetas y ninguna.

#### Scenario: Etiqueta nueva desde la tarea

- **WHEN** se escribe una etiqueta que no existe y se elige crearla
- **THEN** la etiqueta queda creada en la organización y aplicada a la tarea

#### Scenario: Búsqueda tolerante a tildes

- **WHEN** se escribe "hornada" en el selector y existe la etiqueta "Hornada-07"
- **THEN** la etiqueta existente aparece como sugerencia antes de ofrecer crear una nueva

#### Scenario: La misma etiqueta no se duplica

- **WHEN** se intenta crear una etiqueta con un nombre que ya existe en la organización
- **THEN** se aplica la existente y no se crea una segunda

#### Scenario: Etiquetas de otra organización

- **WHEN** se buscan etiquetas desde una organización
- **THEN** solo aparecen las de esa organización

### Requirement: Visibilidad de tareas por rol y por línea

El sistema SHALL permitir a la persona dueña ver, crear y editar todas las tareas de su organización. Un ayudante SHALL ver únicamente las tareas de las líneas que tiene asignadas, las de la línea compartida y las que le están asignadas como responsable, cualquiera sea su línea. Un ayudante sin ninguna línea asignada SHALL ver las tareas de todas las líneas. El recorte SHALL aplicarse en la base de datos, de modo que una consulta directa devuelva el mismo resultado que la pantalla. Ningún usuario autenticado SHALL poder ejecutar `DELETE` sobre `tasks`, `tags`, `task_tags` ni `task_links`, y archivar una tarea SHALL ser acción exclusiva de la persona dueña.

#### Scenario: Ayudante restringido a una línea

- **WHEN** un ayudante con la línea Alfarería asignada consulta las tareas
- **THEN** obtiene las de Alfarería y no las de Sublimación ni las de 3D

#### Scenario: Tarea asignada de otra línea

- **WHEN** un ayudante restringido a Alfarería es el responsable de una tarea de Sublimación
- **THEN** esa tarea le resulta visible

#### Scenario: La línea compartida es de todos

- **WHEN** un ayudante restringido a Alfarería consulta las tareas
- **THEN** las de la línea compartida aparecen junto a las de Alfarería

#### Scenario: Ayudante sin líneas asignadas

- **WHEN** un ayudante sin ninguna línea asignada consulta las tareas
- **THEN** ve las tareas de todas las líneas de su organización

#### Scenario: Aislamiento entre organizaciones

- **WHEN** un miembro de la organización A consulta `tasks`, `tags`, `task_tags` o `task_links`
- **THEN** obtiene cero filas de la organización B, sea cual sea su rol

#### Scenario: Nadie borra una tarea

- **WHEN** un usuario autenticado intenta ejecutar `DELETE` sobre cualquiera de las tablas de tareas
- **THEN** la operación no elimina ninguna fila

#### Scenario: El ayudante no archiva

- **WHEN** un ayudante intenta archivar una tarea
- **THEN** la operación se rechaza y la tarea sigue vigente

### Requirement: Las columnas del tablero salen del juego de estados de la línea

El tablero de tareas SHALL rendir como columnas exactamente el juego de estados que la configuración resuelve para la línea activa en el flujo `task`, en el orden declarado por esa configuración. El sistema SHALL NOT contener ninguna lista fija de estados de tarea ni ninguna rama por línea. Al cambiar la línea activa, las columnas SHALL recalcularse con el juego que corresponda.

#### Scenario: Columnas de una línea sin juego propio

- **WHEN** se abre el tablero con una línea que no tiene juego propio de tareas
- **THEN** las columnas son las del juego de la organización, en su orden

#### Scenario: Columnas de una línea con juego propio

- **WHEN** se abre el tablero con una línea que tiene su propio juego de tareas
- **THEN** las columnas son las de ese juego y no las de la organización

#### Scenario: Un estado nuevo aparece como columna

- **WHEN** la persona dueña añade un estado al juego de tareas y vuelve al tablero
- **THEN** aparece una columna nueva en la posición declarada, sin ningún cambio en el código

### Requirement: El arrastre funciona en ambos sentidos y sin efectos secundarios

El tablero SHALL permitir mover una tarea de cualquier columna a cualquier otra, hacia adelante y hacia atrás, mediante arrastre. Retroceder SHALL NOT pedir confirmación, mostrar advertencias ni producir ningún efecto distinto del propio cambio de estado. El movimiento SHALL reflejarse de inmediato en la tarjeta y SHALL devolverla a su columna anterior con un mensaje si el servidor lo rechaza. Todo cambio de estado SHALL quedar registrado en la bitácora.

#### Scenario: Volver a una columna anterior

- **WHEN** se arrastra una tarea de *En revisión* de vuelta a *Por hacer*
- **THEN** la tarea cambia de estado sin advertencia ni confirmación, y ningún otro registro se modifica

#### Scenario: Retroceder desde un estado final reabre la tarea

- **WHEN** se arrastra una tarea desde un estado de tipo `final` a uno anterior
- **THEN** la tarea vuelve a estar abierta y su fecha de cierre desaparece

#### Scenario: El movimiento se ve antes que la respuesta

- **WHEN** se suelta una tarea en otra columna
- **THEN** la tarjeta aparece en la columna destino sin esperar la confirmación del servidor

#### Scenario: Movimiento rechazado

- **WHEN** el servidor rechaza un cambio de estado
- **THEN** la tarjeta vuelve a su columna anterior y se muestra el motivo

#### Scenario: El historial recoge el ir y venir

- **WHEN** una tarea avanza y luego retrocede de columna
- **THEN** la bitácora registra los dos cambios en orden

### Requirement: Tarjeta de tarea

La tarjeta del tablero SHALL mostrar el título de la tarea, su responsable cuando lo tenga, su fecha límite con una señal visual de proximidad o vencimiento, y sus etiquetas. Cuando el selector de línea está en «Todas», cada tarjeta SHALL mostrar además el color de su línea de negocio. Una tarea sin fecha límite SHALL NOT mostrar ninguna señal de retraso.

#### Scenario: Color de línea con el filtro en Todas

- **WHEN** se abre el tablero con el selector de línea en «Todas»
- **THEN** cada tarjeta muestra el color de la línea a la que pertenece

#### Scenario: Fecha límite vencida

- **WHEN** una tarea abierta tiene su fecha límite en el pasado
- **THEN** la tarjeta la señala como vencida

#### Scenario: Tarea sin fecha

- **WHEN** una tarea no tiene fecha límite
- **THEN** la tarjeta no muestra ninguna señal de vencimiento

#### Scenario: Responsable visible

- **WHEN** una tarea tiene responsable asignado
- **THEN** la tarjeta lo identifica

### Requirement: Vistas lista y calendario y filtros del tablero

El sistema SHALL ofrecer, sobre el mismo conjunto de tareas, una vista de lista y una vista de calendario ordenada por fecha límite, además del tablero. SHALL permitir filtrar por responsable, por etiqueta y por estado, y SHALL ofrecer un filtro «Ver archivados» que, desactivado, oculta las tareas archivadas. La vista elegida y los filtros aplicados SHALL vivir en la dirección, de modo que cambiar de vista los conserve y el tablero sea enlazable.

#### Scenario: Los filtros sobreviven al cambio de vista

- **WHEN** se filtra por una etiqueta en el tablero y se cambia a la vista de lista
- **THEN** el filtro sigue aplicado

#### Scenario: Vista de calendario

- **WHEN** se cambia a la vista de calendario
- **THEN** las tareas aparecen ubicadas por su fecha límite y las que no tienen fecha se muestran aparte

#### Scenario: Filtro por responsable

- **WHEN** se filtra por un responsable
- **THEN** solo aparecen las tareas asignadas a esa persona, en las tres vistas

#### Scenario: Tarea archivada oculta por defecto

- **WHEN** se abre el tablero sin activar «Ver archivados»
- **THEN** las tareas con `archived_at` no aparecen en ninguna de las tres vistas

#### Scenario: Un tablero enlazable

- **WHEN** se comparte la dirección de un tablero filtrado
- **THEN** al abrirla se rinde la misma vista con los mismos filtros

### Requirement: Alta rápida de tarea en tres interacciones o menos

El sistema SHALL ofrecer en el tablero un alta rápida que requiera **tres interacciones o menos** para crear una tarea: abrirla, escribir el título y confirmar. La línea SHALL tomarse del selector de línea activo y, cuando ese selector está en «Todas», SHALL usarse la línea compartida de la organización. El estado inicial SHALL asignarlo la base de datos. La tarea recién creada SHALL aparecer en la columna inicial sin recargar la pantalla, con su línea visible y modificable.

#### Scenario: Crear una tarea con la línea activa

- **WHEN** se abre el alta rápida con una línea seleccionada, se escribe el título y se confirma
- **THEN** la tarea queda creada en esa línea y en el estado inicial, en tres interacciones

#### Scenario: Crear una tarea con el selector en Todas

- **WHEN** se crea una tarea por el alta rápida mientras el selector de línea está en «Todas»
- **THEN** la tarea queda en la línea compartida de la organización, visible en su tarjeta

#### Scenario: La tarea aparece en el acto

- **WHEN** se confirma el alta rápida
- **THEN** la tarjeta aparece en la columna inicial sin recargar la pantalla

#### Scenario: Título vacío

- **WHEN** se confirma el alta rápida sin escribir título
- **THEN** no se crea nada y el campo señala que falta el título

### Requirement: Formulario de alta con responsable, fecha límite y etiquetas

El sistema SHALL ofrecer un formulario de alta de tarea con título, línea, responsable, fecha límite y etiquetas, alcanzable desde el tablero y desde el destino *Tarea* del registro rápido. El responsable SHALL proponerse por omisión como la persona que crea la tarea, y SHALL poder cambiarse o dejarse vacío. El sistema SHALL ofrecer además, desde la tarjeta del tablero, la edición de responsable, fecha límite y etiquetas de una tarea existente.

#### Scenario: Alta con todos los datos

- **WHEN** se guarda el formulario con título, línea, responsable, fecha límite y dos etiquetas
- **THEN** la tarea queda creada con todo ello y aparece en el tablero

#### Scenario: Responsable propuesto

- **WHEN** se abre el formulario de alta
- **THEN** el responsable propuesto es quien está creando la tarea, y puede cambiarse o vaciarse

#### Scenario: Editar una tarea desde su tarjeta

- **WHEN** se abre la edición desde la tarjeta y se cambian responsable, fecha límite y etiquetas
- **THEN** los cambios quedan guardados y la tarjeta los refleja

#### Scenario: Entrada desde el registro rápido

- **WHEN** se activa el destino *Tarea* del registro rápido
- **THEN** se abre el formulario de alta de tarea

### Requirement: Crear tarea para este pedido con formulario prellenado

El sistema SHALL ofrecer en el detalle de un pedido la acción *Crear tarea para este pedido*, que abre el formulario de alta prellenado con la línea del pedido, un vínculo al pedido, el cliente como contexto y una fecha límite sugerida **anterior** a la fecha comprometida del pedido. Todos los valores prellenados SHALL ser modificables antes de guardar, incluido el vínculo. Cuando el pedido no tenga fecha comprometida, el formulario SHALL llegar sin fecha sugerida. Al guardar, el vínculo al pedido SHALL quedar registrado junto con la tarea.

#### Scenario: Formulario prellenado

- **WHEN** se activa *Crear tarea para este pedido* en un pedido de Sublimación con fecha comprometida
- **THEN** el formulario llega con la línea Sublimación, el vínculo a ese pedido, el cliente como contexto y una fecha límite anterior a la de entrega

#### Scenario: Todo es modificable

- **WHEN** se cambia la línea, la fecha y se quita el vínculo antes de guardar
- **THEN** la tarea se guarda con lo que quedó en el formulario, no con lo prellenado

#### Scenario: Pedido sin fecha comprometida

- **WHEN** el pedido no tiene fecha comprometida
- **THEN** el formulario llega sin fecha límite sugerida y la tarea puede guardarse igual

#### Scenario: La fecha sugerida nunca queda en el pasado

- **WHEN** la fecha comprometida del pedido es hoy o ya pasó
- **THEN** la fecha sugerida no es anterior al día de hoy

#### Scenario: El vínculo queda guardado

- **WHEN** se guarda una tarea creada desde un pedido sin quitar el vínculo
- **THEN** el vínculo al pedido queda registrado junto con la tarea

### Requirement: Pedidos y tareas nunca se sincronizan

El sistema SHALL NOT crear, mover, cerrar ni archivar ninguna tarea como consecuencia de un cambio en un pedido, y SHALL NOT modificar ningún pedido como consecuencia de un cambio en una tarea. La única vía por la que un pedido origina una tarea SHALL ser la acción explícita de una persona. Esta garantía SHALL sostenerse también cuando la tarea está vinculada al pedido.

#### Scenario: Cambiar el estado de un pedido no crea tareas

- **WHEN** un pedido recorre todos los estados de su flujo
- **THEN** el número de tareas de la organización es exactamente el mismo antes y después

#### Scenario: Cerrar una tarea no mueve su pedido

- **WHEN** se mueve a un estado final una tarea vinculada a un pedido
- **THEN** el pedido conserva el estado que tenía

#### Scenario: Archivar un pedido no toca sus tareas

- **WHEN** se archiva un pedido que tiene tareas vinculadas
- **THEN** las tareas siguen vigentes y en su estado

### Requirement: El vínculo de una tarea con un pedido se guarda desde el primer día

El sistema SHALL almacenar los vínculos de una tarea en `task_links` según el esquema canónico, con la referencia formada por `entity_type` y `entity_id`, y SHALL rechazar un vínculo que apunte a un registro inexistente. Un mismo destino SHALL NOT poder vincularse dos veces a la misma tarea. En esta capacidad la única vía de escritura SHALL ser la acción *Crear tarea para este pedido*, y el único tipo escrito SHALL ser el pedido; la interfaz de vínculos y los demás tipos vinculables se definen en otra capacidad.

#### Scenario: Vínculo a un registro inexistente

- **WHEN** se intenta guardar un vínculo cuyo `entity_id` no corresponde a ningún registro de su tipo
- **THEN** la base de datos rechaza la operación

#### Scenario: Vínculo duplicado

- **WHEN** se intenta vincular dos veces el mismo pedido a la misma tarea
- **THEN** la segunda operación se rechaza y solo queda un vínculo

#### Scenario: El vínculo sigue la visibilidad de su tarea

- **WHEN** un ayudante consulta `task_links`
- **THEN** solo obtiene los vínculos de las tareas que puede ver

### Requirement: El tablero de tareas se alcanza desde el menú de escritorio

El sistema SHALL ofrecer en el menú de escritorio una entrada *Tareas* que abre el tablero de tareas, y SHALL conservar en la ranura *Tareas* de la barra inferior del celular su destino actual, *Mis pendientes*. Las dos superficies SHALL salir de la misma declaración de entradas de navegación, sin que ninguna sección aparezca dos veces. El tablero SHALL seguir siendo alcanzable en el celular por su dirección, sin ocupar ninguna ranura de menú.

#### Scenario: Entrada de escritorio

- **WHEN** una persona con sesión abre el menú en escritorio y activa *Tareas*
- **THEN** se abre el tablero de tareas

#### Scenario: La ranura móvil no cambia de destino

- **WHEN** se activa la ranura *Tareas* de la barra inferior en un celular
- **THEN** se abre *Mis pendientes*, no el tablero

#### Scenario: La sección no se duplica en el celular

- **WHEN** se abre el panel «Más» en un celular
- **THEN** *Tareas* no aparece allí, porque ya ocupa una ranura de la barra
