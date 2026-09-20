## MODIFIED Requirements

### Requirement: Modelo de notificación con tipo cerrado

El sistema SHALL almacenar los avisos en la tabla `notifications` según el esquema canónico, con `organization_id`, `user_id`, `type` y `title` obligatorios, y `body`, `entity_type`, `entity_id` y `read_at` opcionales. El campo `type` SHALL admitir exactamente los valores `due_summary`, `task_assigned`, `task_review`, `task_overdue`, `task_stalled`, `stock_below_min` y `order_request_received`, y la base de datos SHALL rechazar cualquier otro. Una notificación SHALL NOT poder borrarse: la única transición sobre una notificación existente es marcarla leída.

#### Scenario: Tipo fuera del catálogo

- **WHEN** se intenta insertar una notificación con un `type` que no está entre los siete
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

El sistema SHALL almacenar las preferencias de notificación por organización y usuario, con un interruptor independiente para cada uno de los siete tipos, la hora del resumen diario y la elección de recibir además correo. Cada persona SHALL poder leer y escribir únicamente sus propias preferencias, incluido el ayudante. Una persona sin preferencias guardadas SHALL recibir el comportamiento por omisión —todos los tipos activos y el resumen a la hora predeterminada— sin que haga falta crear la fila por adelantado.

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

## ADDED Requirements

### Requirement: El envío público genera el aviso de solicitud recibida, solo a los dueños

Cuando una solicitud de `order-requests` se marca como recibida, el sistema SHALL generar una notificación `order_request_received` para cada persona con rol de dueño en la organización que tenga ese tipo activo. El sistema SHALL NOT generarla para el rol de ayudante. La llave de idempotencia SHALL derivarse del identificador de la solicitud, de modo que reintentar el envío SHALL NOT producir un segundo aviso. Un fallo al generar el aviso SHALL NOT deshacer que la solicitud quedó marcada como recibida.

#### Scenario: El dueño se entera sin abrir la bandeja

- **WHEN** una solicitud se marca como recibida y su organización tiene un dueño con el tipo activo
- **THEN** ese dueño recibe una notificación `order_request_received`

#### Scenario: El ayudante no la recibe

- **WHEN** una solicitud se marca como recibida
- **THEN** ningún ayudante de la organización recibe esa notificación

#### Scenario: Apagado, no generado

- **WHEN** el dueño tiene apagado el tipo `order_request_received` y llega una solicitud
- **THEN** no se le crea ninguna notificación de ese tipo

#### Scenario: Un solo aviso por solicitud

- **WHEN** el envío que marca la solicitud como recibida se procesa más de una vez para la misma solicitud
- **THEN** existe como máximo una notificación `order_request_received` por dueño para esa solicitud

#### Scenario: Un fallo al avisar no deshace la recepción

- **WHEN** la generación del aviso falla después de que la solicitud ya quedó marcada como recibida
- **THEN** la solicitud sigue recibida, y el fallo no la revierte
