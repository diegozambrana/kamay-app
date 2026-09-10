## MODIFIED Requirements

### Requirement: El arrastre funciona en ambos sentidos y sin efectos secundarios

El tablero SHALL permitir mover una tarea de cualquier columna a cualquier otra, hacia adelante y hacia atrás, mediante arrastre. Retroceder SHALL NOT pedir confirmación, mostrar advertencias ni producir ningún efecto distinto del propio cambio de estado. Soltar una tarea en una columna cuyo estado sea de tipo `final` SHALL abrir el asistente de cierre **solo si** esa tarea tiene entregables declarados sin cumplir; en cualquier otro caso el movimiento SHALL cerrarla sin pedir nada. El movimiento SHALL reflejarse de inmediato en la tarjeta y SHALL devolverla a su columna anterior con un mensaje si el servidor lo rechaza, o si quien abrió el asistente lo cancela. Todo cambio de estado SHALL quedar registrado en la bitácora.

#### Scenario: Volver a una columna anterior

- **WHEN** se arrastra una tarea de *En revisión* de vuelta a *Por hacer*
- **THEN** la tarea cambia de estado sin advertencia ni confirmación, y ningún otro registro se modifica

#### Scenario: Retroceder desde un estado final reabre la tarea

- **WHEN** se arrastra una tarea desde un estado de tipo `final` a uno anterior
- **THEN** la tarea vuelve a estar abierta y su fecha de cierre desaparece

#### Scenario: Soltar en la columna final sin entregables cierra sin preguntar

- **WHEN** se arrastra a una columna de tipo `final` una tarea sin entregables declarados
- **THEN** la tarea se cierra sin abrir ningún diálogo ni pedir confirmación

#### Scenario: Soltar en la columna final con entregables abre el asistente

- **WHEN** se arrastra a una columna de tipo `final` una tarea con un entregable declarado sin cumplir
- **THEN** se abre el asistente de cierre antes de dar el movimiento por hecho

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

La tarjeta del tablero SHALL mostrar el título de la tarea, su responsable cuando lo tenga, su fecha límite con una señal visual de proximidad o vencimiento, y sus etiquetas. La tarjeta SHALL señalar además, con íconos discretos, que la tarea tiene adjuntos, que tiene vínculos y que tiene entregables declarados, sin repetir su número cuando no aporte. Cuando el selector de línea está en «Todas», cada tarjeta SHALL mostrar además el color de su línea de negocio. Una tarea sin fecha límite SHALL NOT mostrar ninguna señal de retraso. Una tarea cerrada sin entregables SHALL llevar su marca de forma sobria, sin tratarla como un error.

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

#### Scenario: Íconos de vínculos y entregables

- **WHEN** una tarea tiene un vínculo y un entregable declarado
- **THEN** su tarjeta muestra el ícono de vínculos y el de entregables

#### Scenario: Una tarea sin vínculos ni entregables no muestra sus íconos

- **WHEN** una tarea no tiene vínculos ni entregables declarados
- **THEN** su tarjeta no muestra ninguno de los dos íconos

#### Scenario: La marca de cerrada sin entregables es sobria

- **WHEN** una tarea quedó cerrada sin entregables
- **THEN** su tarjeta lo señala de forma discreta, sin apariencia de alerta ni de error

### Requirement: Vistas lista y calendario y filtros del tablero

El sistema SHALL ofrecer, sobre el mismo conjunto de tareas, una vista de lista y una vista de calendario ordenada por fecha límite, además del tablero. SHALL permitir filtrar por responsable, por etiqueta, por estado y por vínculo, SHALL ofrecer un filtro que muestre solo las tareas cerradas sin entregables, y SHALL ofrecer un filtro «Ver archivados» que, desactivado, oculta las tareas archivadas. El filtro por vínculo SHALL permitir al menos acotar a las tareas que tienen algún vínculo y a las que referencian un registro concreto. La vista elegida y los filtros aplicados SHALL vivir en la dirección, de modo que cambiar de vista los conserve y el tablero sea enlazable.

#### Scenario: Los filtros sobreviven al cambio de vista

- **WHEN** se filtra por una etiqueta en el tablero y se cambia a la vista de lista
- **THEN** el filtro sigue aplicado

#### Scenario: Vista de calendario

- **WHEN** se cambia a la vista de calendario
- **THEN** las tareas aparecen ubicadas por su fecha límite y las que no tienen fecha se muestran aparte

#### Scenario: Filtro por responsable

- **WHEN** se filtra por un responsable
- **THEN** solo aparecen las tareas asignadas a esa persona, en las tres vistas

#### Scenario: Filtro por vínculo

- **WHEN** se filtra por las tareas vinculadas a un pedido concreto
- **THEN** solo aparecen las tareas que lo referencian, en las tres vistas

#### Scenario: Filtro de cerradas sin entregables

- **WHEN** se activa el filtro de tareas cerradas sin entregables
- **THEN** solo aparecen las tareas con esa marca

#### Scenario: Tarea archivada oculta por defecto

- **WHEN** se abre el tablero sin activar «Ver archivados»
- **THEN** las tareas con `archived_at` no aparecen en ninguna de las tres vistas

#### Scenario: Un tablero enlazable

- **WHEN** se comparte la dirección de un tablero filtrado
- **THEN** al abrirla se rinde la misma vista con los mismos filtros

### Requirement: El vínculo de una tarea con un pedido se guarda desde el primer día

El sistema SHALL almacenar los vínculos de una tarea en `task_links` según el esquema canónico, con la referencia formada por `entity_type` y `entity_id`, y SHALL rechazar un vínculo que apunte a un registro inexistente. Un mismo destino SHALL NOT poder vincularse dos veces a la misma tarea. La acción *Crear tarea para este pedido* SHALL seguir escribiendo su vínculo al guardar la tarea; las demás vías de escritura y los demás tipos vinculables se definen en la capacidad de vínculos y entregables.

#### Scenario: Vínculo a un registro inexistente

- **WHEN** se intenta guardar un vínculo cuyo `entity_id` no corresponde a ningún registro de su tipo
- **THEN** la base de datos rechaza la operación

#### Scenario: Vínculo duplicado

- **WHEN** se intenta vincular dos veces el mismo pedido a la misma tarea
- **THEN** la segunda operación se rechaza y solo queda un vínculo

#### Scenario: El vínculo sigue la visibilidad de su tarea

- **WHEN** un ayudante consulta `task_links`
- **THEN** solo obtiene los vínculos de las tareas que puede ver
