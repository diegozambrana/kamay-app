# offline-capture Specification

## Purpose

Garantiza que registrar nunca dependa de la red: la aplicación se abre y se usa sin conexión, todo registro nuevo se guarda localmente antes de intentar enviarse, y al reconectar llega completo, en orden, una sola vez y con la hora real del hecho. Solo se garantiza la **captura**; leer datos históricos sigue exigiendo conexión.

> Origen: `specs/PRD/kamay-backlog.md` — KAM-11; `specs/PRD/kamay-especificacion-producto-v6.md` — § Rendimiento («sin conexión obligatorio»), § Bitácora («fecha y hora del hecho real, no de la sincronización»), V6; `specs/PRD/kamay-mapa-navegacion-ui.md` §8 y §12 (indicador persistente, no bloqueante); `specs/PRD/ARCHITECTURE.md` § Modo sin conexión y convención 9 (uuid en el cliente, `occurred_at` del cliente).

## Requirements

### Requirement: La aplicación es instalable y su cascarón se abre sin conexión

El sistema SHALL publicar un manifiesto de aplicación web con nombre, iconos de al menos 192 y 512 píxeles, modo de presentación autónomo y dirección de arranque, de modo que el navegador ofrezca instalarla en la pantalla de inicio. Un service worker SHALL servir el cascarón de la aplicación y sus recursos estáticos sin red, de modo que abrir la aplicación sin conexión muestre la interfaz de Kamay y no la página de error del navegador. El service worker SHALL NOT reenviar ni reintentar ninguna operación de escritura: el reenvío ocurre en un único lugar, la cola de registros pendientes.

#### Scenario: Abrir la aplicación sin conexión

- **WHEN** la aplicación ya se abrió al menos una vez y el dispositivo se queda sin red
- **THEN** al abrirla de nuevo se muestra la interfaz de Kamay, no la página de error del navegador

#### Scenario: El navegador ofrece instalarla

- **WHEN** un navegador compatible visita la aplicación servida por HTTPS
- **THEN** el manifiesto y el service worker cumplen los requisitos de instalación y el navegador ofrece añadirla a la pantalla de inicio

#### Scenario: El service worker no duplica el reenvío

- **WHEN** una escritura falla por falta de red
- **THEN** la única entidad que la reintenta es la cola de registros pendientes, y no existe ningún mecanismo de reenvío en segundo plano que pueda enviarla por su cuenta

### Requirement: Todo registro cubierto se guarda localmente antes de intentar enviarse

Las operaciones de registro declaradas como cubiertas por la captura sin conexión SHALL escribirse primero en una cola local durable y solo después intentar su envío. La interfaz SHALL confirmar el registro en cuanto queda en la cola, sin esperar respuesta del servidor y sin mostrar error alguno por falta de red, y SHALL permitir continuar navegando con normalidad. Con red disponible, el envío SHALL resolverse dentro del mismo gesto siempre que el servidor responda a tiempo, de modo que la experiencia con conexión no cambie respecto de la escritura directa.

#### Scenario: Registrar sin red

- **GIVEN** un dispositivo sin conexión
- **WHEN** la persona registra un pedido válido
- **THEN** el registro queda guardado localmente, la interfaz lo confirma sin ningún error y la navegación continúa con normalidad

#### Scenario: Registrar con red no cambia la experiencia

- **GIVEN** un dispositivo con conexión y un servidor que responde con normalidad
- **WHEN** la persona registra un pedido válido
- **THEN** el registro llega al servidor dentro del mismo gesto y la interfaz se comporta igual que antes de existir la cola

#### Scenario: La red se cae a mitad del envío

- **WHEN** el envío de un registro empieza con red y falla antes de recibir respuesta
- **THEN** el registro permanece en la cola y se reintenta, sin que la persona tenga que volver a escribirlo

#### Scenario: Un registro rechazado por su contenido no llega a la cola

- **WHEN** la persona intenta guardar un registro que no cumple los mínimos obligatorios del formulario
- **THEN** el formulario lo rechaza en el dispositivo y no se encola nada

### Requirement: La cola sobrevive al cierre de la aplicación

La cola SHALL persistir en el almacenamiento del navegador, de modo que cerrar la pestaña, recargar la página o cerrar la aplicación instalada no pierda ninguna entrada pendiente. Al volver a abrir la aplicación, las entradas pendientes SHALL seguir en la cola y SHALL reanudarse su envío en cuanto haya conexión.

#### Scenario: Cerrar y reabrir con registros pendientes

- **GIVEN** dos registros pendientes en la cola y el dispositivo sin red
- **WHEN** la persona cierra la aplicación y la vuelve a abrir
- **THEN** los dos registros siguen pendientes, el indicador muestra dos, y al recuperar la conexión se envían

#### Scenario: Recargar la página no vacía la cola

- **WHEN** la persona recarga la página con registros pendientes
- **THEN** la cola conserva las mismas entradas, sin duplicarlas ni perderlas

### Requirement: El envío es secuencial y nunca envía un hijo antes que su padre

La cola SHALL enviar sus entradas de una en una y en el mismo orden en que se encolaron. Una entrada que dependa de otra SHALL NOT enviarse antes que aquella de la que depende, y SHALL NOT enviarse en absoluto si esa dependencia terminó en fallo definitivo: SHALL quedar retenida y visible junto a la que la bloquea. Un fallo transitorio en una entrada SHALL NOT hacer que la siguiente la adelante.

#### Scenario: Padre antes que hijo al reconectar

- **GIVEN** un registro padre y un registro que depende de él, ambos pendientes
- **WHEN** se recupera la conexión
- **THEN** el padre se envía primero y el hijo después, nunca al revés

#### Scenario: El hijo de un registro muerto no se envía

- **GIVEN** un registro padre que terminó en fallo definitivo y un registro que depende de él
- **WHEN** la cola continúa su vaciado
- **THEN** el dependiente no se envía, queda retenido y se muestra junto al registro que lo bloquea

#### Scenario: Un fallo transitorio no reordena la cola

- **WHEN** la primera entrada de la cola falla por un error de red
- **THEN** la segunda no se adelanta: el orden de encolado se conserva en el siguiente intento

### Requirement: Reenviar un registro nunca crea un segundo

Todo registro nuevo SHALL nacer con un identificador `uuid` generado en el dispositivo y SHALL conservarlo en todos sus reintentos. El servidor SHALL tratar la llegada de un registro cuyo identificador ya existe como una repetición y SHALL NOT crear una segunda fila. Un reenvío tras una respuesta perdida SHALL dejar exactamente un registro en la base de datos. El identificador SHALL seguir perteneciendo a la organización que lo creó: un registro cuyo identificador ya existe en otra organización SHALL ser rechazado con un error, nunca adoptado en silencio.

#### Scenario: Dos reintentos, un solo registro

- **GIVEN** un registro cuyo envío se reintenta dos veces por un fallo de red
- **WHEN** la cola termina de vaciarse
- **THEN** existe exactamente un registro en la base de datos

#### Scenario: La respuesta se pierde después de escribir

- **GIVEN** un envío que llegó al servidor y se guardó, pero cuya respuesta no llegó al dispositivo
- **WHEN** la cola lo reintenta
- **THEN** el servidor no crea un segundo registro y la entrada se da por completada

#### Scenario: Identificador de otra organización

- **WHEN** se reenvía un registro cuyo identificador ya existe en una organización distinta
- **THEN** la operación es rechazada con un error y no se modifica ni se adopta el registro ajeno

### Requirement: Los reintentos esperan cada vez más y se disparan al reconectar

Un envío que falle por causas transitorias SHALL reintentarse con una espera creciente entre intentos, con un tope máximo, para no castigar la batería ni la red del dispositivo. El vaciado SHALL dispararse al recuperar la conexión, al arrancar la aplicación y de forma periódica mientras haya entradas pendientes. La aplicación SHALL NOT bloquear la interfaz durante los reintentos.

#### Scenario: La espera crece entre intentos

- **WHEN** un envío falla varias veces seguidas por error de red
- **THEN** la espera antes del siguiente intento crece con cada fallo hasta alcanzar un tope, y no se reintenta de forma inmediata y continua

#### Scenario: Reconectar dispara el vaciado

- **GIVEN** entradas pendientes y el dispositivo sin red
- **WHEN** el dispositivo recupera la conexión
- **THEN** el vaciado comienza sin que la persona tenga que hacer nada

#### Scenario: Los reintentos no bloquean la interfaz

- **WHEN** la cola está reintentando envíos
- **THEN** la persona puede seguir navegando y registrando con normalidad

### Requirement: Un fallo definitivo se muestra, nunca se pierde en silencio

El sistema SHALL distinguir el fallo transitorio —falta de red, servidor inalcanzable, tiempo agotado— del fallo definitivo —rechazo por contenido, por permisos o por sesión terminada—. Un fallo transitorio SHALL reintentarse; un fallo definitivo SHALL NOT reintentarse y SHALL mostrarse a la persona en una bandeja de registros no sincronizados, con la explicación en lenguaje humano y las opciones de **reintentar** o **descartar**. Descartar SHALL pedir confirmación. Ningún registro SHALL desaparecer de la cola sin haberse enviado o sin que la persona lo haya descartado explícitamente.

#### Scenario: Rechazo por permisos

- **WHEN** un envío es rechazado porque la persona no tiene permiso para esa operación
- **THEN** la entrada no se reintenta, aparece en la bandeja con una explicación comprensible, y ofrece reintentar o descartar

#### Scenario: Descartar pide confirmación

- **WHEN** la persona elige descartar un registro que falló de forma definitiva
- **THEN** el sistema pide confirmación antes de quitarlo de la cola

#### Scenario: Reintentar desde la bandeja

- **WHEN** la persona corrige la causa del fallo —por ejemplo, vuelve a iniciar sesión— y pulsa reintentar
- **THEN** la entrada vuelve a la cola y se envía con su contenido y su identificador originales

#### Scenario: Nada se pierde en silencio

- **WHEN** un envío falla de cualquier forma
- **THEN** la entrada sigue existiendo en la cola o en la bandeja, y en ningún caso desaparece sin intervención de la persona

### Requirement: La hora del hecho la fija el dispositivo y la de llegada el servidor

Todo registro encolado SHALL llevar `occurred_at` fijado por el dispositivo en el momento real del hecho, y ese valor SHALL viajar sin alteración hasta la base de datos. `created_at` SHALL fijarlo el servidor en el momento de recibirlo. El evento de creación de la bitácora SHALL fecharse con la hora real del hecho, no con la de la sincronización.

#### Scenario: Venta registrada sin señal y sincronizada horas después

- **GIVEN** un registro creado a las 15:40 sin señal
- **WHEN** se sincroniza a las 21:00
- **THEN** `occurred_at` es las 15:40 y `created_at` es las 21:00

#### Scenario: La bitácora conserva la hora real

- **WHEN** se sincroniza a las 21:00 un registro creado a las 15:40
- **THEN** su evento de creación en la bitácora está fechado a las 15:40

#### Scenario: Varios registros conservan sus horas distintas

- **GIVEN** tres registros creados sin red a horas distintas
- **WHEN** se sincronizan todos en el mismo momento
- **THEN** cada uno conserva su propia hora real, y no comparten la hora de la sincronización

### Requirement: Un indicador persistente muestra cuántos registros faltan sincronizar

Mientras haya entradas pendientes, el sistema SHALL mostrar un indicador persistente y **no bloqueante** con el número de registros por sincronizar, visible tanto en la presentación de escritorio como en la móvil. El indicador SHALL desaparecer cuando la cuenta llegue a cero. Los registros con fallo definitivo SHALL distinguirse visualmente de los meramente pendientes. Activar el indicador SHALL abrir la bandeja de registros no sincronizados.

#### Scenario: La cuenta refleja lo pendiente

- **WHEN** hay tres registros pendientes de sincronizar
- **THEN** el indicador muestra tres, y no impide usar ninguna parte de la aplicación

#### Scenario: El indicador desaparece al vaciarse la cola

- **WHEN** se sincroniza el último registro pendiente
- **THEN** la cuenta llega a cero y el indicador deja de mostrarse

#### Scenario: Lo que falló se distingue de lo que espera

- **GIVEN** un registro pendiente y otro con fallo definitivo
- **THEN** el indicador los presenta de forma distinguible y la bandeja los lista por separado

#### Scenario: El indicador abre la bandeja

- **WHEN** la persona activa el indicador
- **THEN** se abre la bandeja con los registros no sincronizados, su hora real y las acciones disponibles

### Requirement: La cola pertenece a una organización y a una sesión

Cada entrada de la cola SHALL registrar la organización y la persona que la crearon. Una entrada SHALL NOT enviarse bajo una sesión de otra persona ni contra una organización distinta de aquella en la que se creó: mientras no coincidan, SHALL quedar retenida y visible en la bandeja con esa explicación. Cerrar sesión SHALL NOT vaciar la cola ni enviar sus entradas.

#### Scenario: Cambiar de organización no reencamina lo pendiente

- **GIVEN** un registro pendiente creado en la organización A
- **WHEN** la persona cambia a la organización B y se recupera la conexión
- **THEN** el registro no se envía a la organización B: queda retenido hasta volver a la A

#### Scenario: Otra persona en el mismo dispositivo

- **GIVEN** registros pendientes creados por una persona
- **WHEN** otra persona inicia sesión en el mismo dispositivo
- **THEN** esos registros no se envían bajo la sesión nueva y se muestran retenidos con su explicación

#### Scenario: Cerrar sesión conserva lo pendiente

- **WHEN** la persona cierra sesión con registros pendientes
- **THEN** los registros siguen en la cola y se envían cuando vuelve a entrar con su cuenta

### Requirement: Ante ediciones desordenadas gana la última en llegar, con constancia

Cuando dos ediciones del mismo registro lleguen al servidor —por ejemplo, una encolada sin red y otra hecha desde otro dispositivo con conexión—, el sistema SHALL conservar la última en llegar, sin bloquear ni pedir resolución manual. Ambas ediciones SHALL quedar registradas en la bitácora, cada una con su hora real y su autor, de modo que el estado descartado sea recuperable leyendo el historial. El sistema SHALL NOT introducir ningún concepto ni pantalla de conflicto.

#### Scenario: Una edición encolada pisa a una más reciente

- **GIVEN** una edición de un pedido encolada sin red a las 15:40 y otra edición del mismo pedido hecha desde otro dispositivo a las 18:00
- **WHEN** la encolada se sincroniza a las 21:00
- **THEN** el pedido queda con el contenido de la edición encolada y la bitácora conserva ambos cambios con sus horas y autores

#### Scenario: El estado descartado es recuperable

- **WHEN** una edición pisa a otra
- **THEN** el historial del pedido permite ver qué valores tenía antes de cada cambio

#### Scenario: No hay pantalla de conflicto

- **WHEN** dos ediciones del mismo registro llegan desordenadas
- **THEN** no se muestra ninguna pantalla de resolución ni se pide a la persona que elija
