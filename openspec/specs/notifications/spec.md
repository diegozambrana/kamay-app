# notifications Specification

## Purpose

Hace que lo urgente aparezca solo, sin que el sistema se convierta en una fuente de ruido que alguien termine silenciando para siempre: avisos generados con reglas de agrupación e idempotencia, apagables uno a uno por cada persona, visibles en una bandeja dentro de la aplicación y enviados por correo solo cuando importan fuera de ella.

> Origen: `specs/PRD/kamay-backlog.md` — KAM-17; `specs/PRD/kamay-esquema-base-de-datos-supabase.md` §15, §16; `specs/PRD/kamay-especificacion-producto-v6.md` §6.3, V15, V21 y «Notificaciones sin fatiga»; `specs/PRD/kamay-mapa-navegacion-ui.md` §4.2, §5, §11; `specs/PRD/ARCHITECTURE.md` (§Enrutado: los trabajos programados son manejadores de ruta; convención 2: el service role solo en trabajos programados y generación de notificaciones).

## Requirements

### Requirement: Modelo de notificación con tipo cerrado

El sistema SHALL almacenar los avisos en la tabla `notifications` según el esquema canónico, con `organization_id`, `user_id`, `type` y `title` obligatorios, y `body`, `entity_type`, `entity_id` y `read_at` opcionales. El campo `type` SHALL admitir exactamente los valores `due_summary`, `task_assigned`, `task_review`, `task_overdue`, `task_stalled` y `stock_below_min`, y la base de datos SHALL rechazar cualquier otro. Una notificación SHALL NOT poder borrarse: la única transición sobre una notificación existente es marcarla leída.

#### Scenario: Tipo fuera del catálogo

- **WHEN** se intenta insertar una notificación con un `type` que no está entre los seis
- **THEN** la base de datos rechaza la operación

#### Scenario: No hay borrado

- **WHEN** se intenta borrar una notificación
- **THEN** la operación se rechaza, y la única forma de retirarla de lo pendiente es marcarla leída

#### Scenario: Aislamiento entre organizaciones

- **WHEN** una persona de otra organización consulta las notificaciones
- **THEN** obtiene cero filas, aunque conozca el identificador exacto

#### Scenario: Las notificaciones son de quien las recibe

- **WHEN** una persona consulta las notificaciones de su propia organización
- **THEN** obtiene únicamente las dirigidas a ella, y ninguna de sus compañeros

### Requirement: Preferencias de notificación por persona, con cada tipo apagable

El sistema SHALL almacenar las preferencias de notificación por organización y usuario, con un interruptor independiente para cada uno de los seis tipos, la hora del resumen diario y la elección de recibir además correo. Cada persona SHALL poder leer y escribir únicamente sus propias preferencias, incluido el ayudante. Una persona sin preferencias guardadas SHALL recibir el comportamiento por omisión —todos los tipos activos y el resumen a la hora predeterminada— sin que haga falta crear la fila por adelantado.

#### Scenario: El ayudante configura las suyas

- **WHEN** un ayudante abre la sección de notificaciones y apaga un tipo
- **THEN** el cambio queda guardado sobre sus propias preferencias

#### Scenario: Nadie toca las de otro

- **WHEN** una persona intenta leer o escribir las preferencias de otra
- **THEN** la operación no devuelve ni modifica nada

#### Scenario: Sin fila guardada

- **WHEN** una persona que nunca abrió la sección recibe la generación de avisos
- **THEN** se le aplica el comportamiento por omisión, con todos los tipos activos

#### Scenario: Las demás secciones de configuración siguen siendo del dueño

- **WHEN** un ayudante intenta abrir cualquier otra sección de configuración
- **THEN** no accede a ella, y solo la de notificaciones queda a su alcance

### Requirement: Un tipo apagado no se genera ni se envía

Cuando una persona tenga apagado un tipo de aviso, el sistema SHALL NOT crear una notificación de ese tipo para ella ni enviarle correo por ese motivo. El apagado SHALL ser independiente por tipo: apagar uno SHALL NOT afectar a la generación ni al envío de los demás, ni para esa persona ni para nadie más.

#### Scenario: Apagado, no generado

- **WHEN** una persona tiene apagado el aviso de tarea asignada y se le asigna una tarea
- **THEN** no se crea ninguna notificación de ese tipo para ella, y no recibe correo

#### Scenario: Los demás tipos no se ven afectados

- **WHEN** una persona apaga el aviso de tarea asignada y después una tarea suya vence
- **THEN** sigue recibiendo el aviso de vencida con normalidad

#### Scenario: El apagado es de quien lo hace

- **WHEN** una persona apaga un tipo y a otra de la misma organización le ocurre ese mismo hecho
- **THEN** la segunda sí recibe su aviso

### Requirement: El resumen diario es un solo aviso por persona

El trabajo programado SHALL generar como máximo **una** notificación de tipo `due_summary` por persona y día, con el conteo de sus tareas que vencen, cualquiera que sea el número de tareas implicadas. El sistema SHALL NOT generar una notificación por tarea vencida dentro del resumen. La agrupación SHALL ocurrir al generar el aviso, no al mostrarlo: la bandeja SHALL NOT tener que agrupar nada para respetar esta regla.

#### Scenario: Cinco tareas, un aviso

- **WHEN** una persona tiene cinco tareas que vencen hoy y llega la hora de su resumen
- **THEN** recibe exactamente una notificación de resumen, que menciona las cinco

#### Scenario: Sin nada que vencer, sin aviso

- **WHEN** llega la hora del resumen de una persona sin ninguna tarea que venza
- **THEN** no se le crea ninguna notificación de resumen

#### Scenario: El resumen no se desglosa en la bandeja

- **WHEN** se abre la bandeja tras un resumen de cinco tareas
- **THEN** aparece una sola entrada, no cinco

### Requirement: El resumen llega a la hora que cada persona eligió, en la hora local de su organización

El sistema SHALL enviar el resumen diario a la hora configurada por cada persona, interpretada en la zona horaria de su organización y no en la del servidor ni en la del navegador. Personas de la misma organización con horas distintas SHALL recibir cada una la suya.

#### Scenario: Dos horas distintas en la misma organización

- **WHEN** una persona eligió las 07:00 y otra las 18:00 en la misma organización
- **THEN** cada una recibe su resumen a su hora local, no a una hora común

#### Scenario: La zona horaria manda

- **WHEN** la organización está en una zona horaria distinta de la del servidor y alguien eligió las 08:00
- **THEN** el resumen se envía a las 08:00 locales de la organización

### Requirement: Ningún hecho genera dos avisos

Cada notificación generada SHALL tener una llave de idempotencia derivada del destinatario, el tipo y el hecho concreto que la origina. Reejecutar el trabajo programado sobre los mismos datos SHALL NOT producir notificaciones duplicadas. Una tarea que sigue vencida durante varios días SHALL NOT generar un aviso de vencida nuevo cada pasada.

#### Scenario: Reejecución sin duplicados

- **WHEN** el trabajo programado se ejecuta dos veces sobre los mismos datos
- **THEN** el número de notificaciones no cambia tras la segunda ejecución

#### Scenario: Vencida una vez, no cada día

- **WHEN** una tarea lleva tres días vencida y el trabajo corre cada día
- **THEN** existe un solo aviso de vencida por esa tarea, no tres

### Requirement: Sin fecha límite no hay aviso de vencimiento

Una tarea sin `due_at` SHALL NOT generar nunca aviso de vencimiento próximo, de vencida, ni entrada en el resumen diario. Un recordatorio SHALL NOT existir sin fecha límite, tal como impone el modelo de tarea.

#### Scenario: Tarea sin fecha, sin avisos

- **WHEN** existe una tarea sin fecha límite y corre el trabajo programado
- **THEN** no se genera para ella ningún aviso de vencimiento, ni entra en ningún resumen

#### Scenario: Se le pone fecha

- **WHEN** a esa tarea se le asigna una fecha límite ya pasada
- **THEN** pasa a generar su aviso de vencida como cualquier otra

### Requirement: Los avisos de tarea cubren asignación, revisión, vencimiento y estancamiento

El sistema SHALL generar `task_assigned` cuando una tarea pase a estar asignada a una persona distinta de quien hace el cambio; `task_review` cuando una tarea entre en un estado del tipo declarado que corresponde a revisión; `task_overdue` cuando una tarea abierta con fecha límite pase a estar vencida; y `task_stalled` cuando una tarea lleve demasiado tiempo sin moverse en un estado de tipo `in_progress`. La identificación del estado SHALL hacerse por su tipo declarado y nunca por su nombre. Una tarea cerrada o archivada SHALL NOT generar ningún aviso.

#### Scenario: Asignar avisa a quien recibe

- **WHEN** alguien asigna una tarea a otra persona
- **THEN** esa persona recibe un aviso de tarea asignada

#### Scenario: Asignarse a uno mismo no avisa

- **WHEN** alguien se asigna a sí mismo una tarea
- **THEN** no se genera ningún aviso

#### Scenario: El nombre del estado no decide nada

- **WHEN** la organización renombra su estado de revisión
- **THEN** las tareas que entran en él siguen generando el aviso de revisión

#### Scenario: Estancada en curso

- **WHEN** una tarea lleva más del umbral sin moverse en un estado de tipo `in_progress`
- **THEN** se genera un aviso de tarea estancada

#### Scenario: Una tarea cerrada calla

- **WHEN** una tarea vencida se cierra y después corre el trabajo programado
- **THEN** no se genera ningún aviso nuevo sobre ella

### Requirement: La bitácora nunca genera notificaciones

Ningún evento de `activity_log` SHALL originar una notificación, en ningún caso y para ningún rol. La bitácora es un registro de hechos, no un canal de avisos.

#### Scenario: Actividad intensa, bandeja tranquila

- **WHEN** se registran decenas de eventos de bitácora de cualquier tipo
- **THEN** no se crea ninguna notificación a raíz de ellos

### Requirement: El tipo de insumo bajo mínimo se declara sin generador

El tipo `stock_below_min` SHALL existir en el catálogo de tipos y en las preferencias desde este cambio, y la bandeja SHALL saber rendirlo, pero el sistema SHALL NOT generar avisos de ese tipo mientras el inventario no exista. La ausencia de generador SHALL NOT producir errores ni entradas vacías en ninguna pantalla.

#### Scenario: Preferencia presente, aviso ausente

- **WHEN** se abre la sección de preferencias
- **THEN** el interruptor de insumo bajo mínimo aparece y se puede apagar, aunque todavía no llegue ningún aviso de ese tipo

#### Scenario: Nada se rompe por su ausencia

- **WHEN** se abre la bandeja de una organización sin ningún aviso de inventario
- **THEN** la bandeja se rinde con normalidad, sin hueco ni error

### Requirement: Bandeja de notificaciones agrupada por tipo

El sistema SHALL ofrecer una bandeja de notificaciones, abierta desde la campana de la barra superior, con las notificaciones de quien la abre en orden cronológico inverso y agrupadas por tipo, destacando las no leídas. La bandeja SHALL permitir marcar una notificación como leída y marcarlas todas, y SHALL ofrecer acceso a las preferencias. La campana SHALL mostrar el número de notificaciones no leídas y SHALL NOT mostrar contador cuando sean cero. La bandeja SHALL estar disponible para los dos roles.

#### Scenario: Contador real

- **WHEN** una persona con tres notificaciones sin leer abre cualquier pantalla
- **THEN** la campana muestra tres

#### Scenario: Sin nada sin leer

- **WHEN** una persona no tiene notificaciones sin leer
- **THEN** la campana no muestra ningún número

#### Scenario: Marcar leída

- **WHEN** se marca una notificación como leída
- **THEN** deja de estar destacada y el contador de la campana baja en uno

#### Scenario: Bandeja vacía

- **WHEN** una persona sin ninguna notificación abre la bandeja
- **THEN** ve un mensaje de lista sin contenido, no un error ni una lista en blanco

#### Scenario: Agrupada por tipo

- **WHEN** la bandeja contiene avisos de tres tipos distintos
- **THEN** aparecen agrupados por tipo, no mezclados en una sola tira cronológica

### Requirement: Cada aviso lleva a su registro

Activar una notificación SHALL abrir el registro al que se refiere —la tarea para los avisos de tarea, el ítem para los de inventario—, y SHALL NOT llevar a una pantalla genérica. Un aviso de resumen diario SHALL llevar a la pantalla de pendientes. Un aviso cuyo registro ya no esté disponible SHALL declararlo en lugar de abrir una pantalla rota.

#### Scenario: Del aviso a la tarea

- **WHEN** se activa un aviso de tarea asignada
- **THEN** se abre el detalle de esa tarea concreta

#### Scenario: Del resumen a los pendientes

- **WHEN** se activa el aviso de resumen diario
- **THEN** se abre la pantalla de pendientes

#### Scenario: Registro ya no disponible

- **WHEN** se activa un aviso cuya tarea fue archivada
- **THEN** se declara que ya no está disponible, sin abrir una pantalla vacía

### Requirement: Correo transaccional para lo vencido y lo asignado

El sistema SHALL enviar correo para el resumen diario, los avisos de tarea vencida y los de tarea asignada, y SHALL NOT enviarlo para los demás tipos. El envío SHALL respetar tanto el interruptor del tipo como la preferencia de correo: apagar el correo SHALL dejar el aviso dentro de la aplicación intacto. Un fallo del envío de correo SHALL NOT impedir que la notificación exista en la bandeja.

#### Scenario: Correo apagado, aviso presente

- **WHEN** una persona apaga el correo y se le asigna una tarea
- **THEN** no recibe correo, pero el aviso aparece en su bandeja

#### Scenario: Los demás tipos no viajan por correo

- **WHEN** se genera un aviso de tarea estancada
- **THEN** no se envía ningún correo por ese motivo

#### Scenario: El correo falla, el aviso queda

- **WHEN** el envío de correo falla
- **THEN** la notificación sigue existiendo en la bandeja y el fallo queda registrado

### Requirement: El enlace del correo abre exactamente esa tarea, con o sin sesión

El enlace de un correo de aviso de tarea SHALL apuntar al detalle de esa tarea concreta. Quien lo abra con sesión activa SHALL llegar directamente a ella. Quien lo abra sin sesión SHALL pasar por el inicio de sesión y, tras entrar, SHALL aterrizar en esa misma tarea y no en la pantalla de aterrizaje habitual. El destino transportado a través del inicio de sesión SHALL ser siempre una ruta interna de la aplicación.

#### Scenario: Con sesión, directo

- **WHEN** alguien con sesión activa abre el enlace de un correo de tarea asignada
- **THEN** llega al detalle de esa tarea

#### Scenario: Sin sesión, entra y llega

- **WHEN** alguien sin sesión abre ese mismo enlace y se identifica
- **THEN** aterriza en esa tarea, no en el panel ni en el registro rápido

#### Scenario: No se admite un destino externo

- **WHEN** el destino transportado al inicio de sesión apunta fuera de la aplicación
- **THEN** se descarta y se usa el aterrizaje habitual

### Requirement: La generación privilegiada se limita al trabajo programado y a la creación de avisos

El acceso con privilegios que se salta el aislamiento por organización SHALL usarse únicamente en el trabajo programado y en la creación de notificaciones, y SHALL NOT usarse en ninguna acción disparada por una persona. El disparo del trabajo programado SHALL exigir una credencial propia: una petición sin ella SHALL rechazarse sin ejecutar nada.

#### Scenario: Disparo sin credencial

- **WHEN** se invoca el trabajo programado sin la credencial correcta
- **THEN** se rechaza la petición y no se genera ninguna notificación

#### Scenario: Cada aviso a su organización

- **WHEN** el trabajo programado corre sobre varias organizaciones
- **THEN** cada notificación queda con el `organization_id` de la organización de su destinatario, y ninguna cruza de una a otra
