## Purpose

Responde a una sola pregunta —«¿qué hago hoy?»— con las tareas de quien mira agrupadas por urgencia y no por estado, y con las acciones que esa pregunta pide de vuelta: hecha, más tarde, ábrela. Es la pantalla de tareas del celular y el complemento del tablero en el escritorio.

> Origen: `specs/PRD/kamay-backlog.md` — KAM-17; `specs/PRD/kamay-especificacion-producto-v6.md` V20; `specs/PRD/kamay-mapa-navegacion-ui.md` §2 (las dos vistas que ignoran el selector de línea), §4.2, §5, §11 y la matriz de permisos; `specs/PRD/ARCHITECTURE.md` (convención 5: los estados se comparan por `kind`).

## ADDED Requirements

### Requirement: Cuatro grupos por fecha, con contador y en orden fijo

La pantalla de pendientes SHALL agrupar las tareas abiertas de quien mira en exactamente cuatro grupos —*Vencidas*, *Hoy*, *Próximos 7 días* y *Sin fecha*—, en ese orden y cada uno con el número de tareas que contiene. Lo vencido SHALL aparecer primero. La agrupación SHALL calcularse contra el día de hoy en la zona horaria de la organización. Un grupo vacío SHALL declararse como tal o retirarse, pero SHALL NOT mostrar un contador engañoso.

#### Scenario: Los cuatro grupos y su orden

- **WHEN** se abre la pantalla con tareas de las cuatro clases
- **THEN** aparecen los cuatro grupos en el orden Vencidas, Hoy, Próximos 7 días, Sin fecha, cada uno con su contador

#### Scenario: Lo vencido primero

- **WHEN** hay tareas vencidas y tareas de hoy
- **THEN** las vencidas se muestran antes que las de hoy

#### Scenario: El día es el de la organización

- **WHEN** la organización está en una zona horaria distinta de la del navegador y una tarea vence hoy allí
- **THEN** esa tarea aparece en el grupo Hoy, no en Vencidas ni en Próximos 7 días

#### Scenario: Una tarea sin fecha

- **WHEN** existe una tarea abierta sin fecha límite
- **THEN** aparece en el grupo Sin fecha y en ningún otro

#### Scenario: Grupo sin tareas

- **WHEN** no hay ninguna tarea vencida
- **THEN** el grupo Vencidas no muestra un contador con contenido falso

### Requirement: La pantalla de pendientes ignora deliberadamente el selector de línea

La pantalla de pendientes SHALL mostrar las tareas de todas las líneas de negocio a las que la persona tenga acceso, con independencia de la línea seleccionada en el resto de la aplicación. Cambiar el selector de línea SHALL NOT alterar su contenido. Cada tarea SHALL mostrar a qué línea pertenece, ya que no hay un selector que lo diga.

#### Scenario: El selector no filtra aquí

- **WHEN** se selecciona una línea concreta y se abre la pantalla de pendientes
- **THEN** siguen apareciendo las tareas de todas las líneas accesibles

#### Scenario: Cada tarea dice su línea

- **WHEN** se ven tareas de dos líneas distintas
- **THEN** cada fila indica a qué línea pertenece

### Requirement: Cada quien ve sus pendientes según su rol

La pantalla de pendientes SHALL mostrar al dueño todas las tareas abiertas de la organización, y al ayudante únicamente las de su línea o las asignadas a él. Este alcance SHALL ser el mismo que rige el tablero de tareas: la pantalla SHALL NOT ampliar ni recortar lo que el rol ya puede ver. Las tareas cerradas y archivadas SHALL NOT aparecer.

#### Scenario: El ayudante ve lo suyo

- **WHEN** un ayudante abre la pantalla de pendientes en una organización con tareas de varias líneas
- **THEN** ve solo las de su línea y las asignadas a él

#### Scenario: El dueño lo ve todo

- **WHEN** el dueño abre la pantalla
- **THEN** ve las tareas abiertas de todas las líneas

#### Scenario: Lo cerrado no vuelve

- **WHEN** existen tareas cerradas y archivadas con fecha pasada
- **THEN** no aparecen en ningún grupo

### Requirement: Marcar hecha deja la tarea tachada en su sitio

Marcar una tarea como hecha desde la pantalla de pendientes SHALL moverla al estado de tipo `final` del juego que corresponde a su línea, resolviéndolo por tipo declarado y nunca por nombre, de modo que el cierre lo derive el mismo mecanismo del tablero. La tarea SHALL permanecer visible y tachada en su grupo durante la sesión de la pantalla, en lugar de desaparecer al instante, y SHALL poder deshacerse el cambio.

#### Scenario: Tachada, no desaparecida

- **WHEN** se marca hecha una tarea del grupo Hoy
- **THEN** queda tachada en su sitio y el contador del grupo se ajusta

#### Scenario: El cierre pasa por el estado

- **WHEN** se marca hecha una tarea
- **THEN** queda en el estado de tipo `final` de su juego y su cierre queda registrado por la vía habitual

#### Scenario: Deshacer

- **WHEN** se deshace el marcado
- **THEN** la tarea vuelve al estado en que estaba y deja de aparecer tachada

#### Scenario: El nombre del estado final no decide nada

- **WHEN** la organización renombra su estado final de tareas
- **THEN** marcar hecha sigue llevando la tarea a ese mismo estado

### Requirement: Posponer a mañana en un solo gesto

La pantalla SHALL permitir posponer una tarea a mañana con un solo gesto: deslizar la fila en un teléfono, y un control equivalente alcanzable por teclado y por puntero donde no se deslice. Posponer SHALL fijar la fecha límite de la tarea al día siguiente calculado en la zona horaria de la organización, SHALL reubicar la tarea en el grupo que le corresponda y SHALL poder deshacerse. Posponer SHALL NOT introducir ningún campo nuevo en la tarea.

#### Scenario: Un solo gesto

- **WHEN** se desliza una fila del grupo Vencidas
- **THEN** la tarea queda con fecha límite de mañana y pasa al grupo Próximos 7 días

#### Scenario: Sin deslizar

- **WHEN** se opera la pantalla con el teclado
- **THEN** existe un control de posponer alcanzable y activable sin gestos

#### Scenario: Mañana es el de la organización

- **WHEN** se pospone una tarea a las 23:50 hora local de la organización
- **THEN** la nueva fecha límite es el día siguiente a ese día local, no dos días después

#### Scenario: Deshacer el aplazamiento

- **WHEN** se deshace un aplazamiento
- **THEN** la tarea recupera su fecha límite anterior

### Requirement: Reprogramar y abrir el detalle desde la fila

Cada fila SHALL ofrecer reprogramar a una fecha elegida y abrir el detalle de la tarea. Abrir el detalle SHALL llevar a la pantalla de detalle de esa tarea concreta. Reprogramar SHALL actualizar la fecha límite y reubicar la tarea en su grupo sin abandonar la pantalla.

#### Scenario: Reprogramar a una fecha

- **WHEN** se reprograma una tarea vencida a dentro de tres días
- **THEN** la tarea pasa al grupo Próximos 7 días sin salir de la pantalla

#### Scenario: Abrir el detalle

- **WHEN** se activa una fila
- **THEN** se abre el detalle de esa tarea

### Requirement: Filtrar dentro de los pendientes

La pantalla SHALL permitir filtrar lo que muestra sin romper la agrupación por fecha: los grupos y sus contadores SHALL reflejar el resultado filtrado. Un filtro que no deje ninguna tarea SHALL declararlo con un mensaje comprensible.

#### Scenario: Los contadores siguen al filtro

- **WHEN** se aplica un filtro
- **THEN** los cuatro grupos siguen presentes y sus contadores cuentan solo lo filtrado

#### Scenario: Filtro sin resultados

- **WHEN** un filtro no deja ninguna tarea
- **THEN** se muestra un mensaje de lista sin contenido, no una pantalla en blanco

### Requirement: Es la pantalla de tareas del teléfono

La pantalla de pendientes SHALL ser el destino de la ranura de tareas de la barra inferior en el teléfono, y SHALL ser utilizable en un viewport de 390 px sin desplazamiento horizontal. En el escritorio SHALL alcanzarse desde la navegación y SHALL convivir con el tablero: ninguna de las dos SHALL reemplazar a la otra.

#### Scenario: Desde la barra inferior

- **WHEN** se activa la ranura de tareas de la barra inferior en un teléfono
- **THEN** se abre la pantalla de pendientes, no el tablero

#### Scenario: Cabe en 390 px

- **WHEN** se abre la pantalla en un viewport de 390 px
- **THEN** las filas se apilan en una columna y nada obliga a desplazarse horizontalmente

#### Scenario: El tablero sigue existiendo

- **WHEN** se navega al tablero de tareas desde el escritorio
- **THEN** sigue funcionando como hasta ahora, con sus columnas por estado
