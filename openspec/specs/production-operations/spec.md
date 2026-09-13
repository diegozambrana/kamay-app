# production-operations Specification

## Purpose

Pone en pie lo que el sistema necesita para que un negocio dependa de él a diario: copias de seguridad automáticas con al menos una fuera del proveedor, una restauración efectivamente ensayada en un entorno limpio, documentada y que no vuelve a disparar nada, trabajos programados que corren solos y solo a quien los autoriza, un alta de cuentas limitada a quien trae invitación, un despliegue con dominio propio y variables separadas por ambiente, y monitoreo de errores que avise antes de que lo haga el usuario.

> Origen: `specs/PRD/kamay-backlog.md` — KAM-23, alcance «copias de seguridad… y restauración probada», «despliegue, variables de entorno, dominio y monitoreo de errores», criterio 4; `specs/PRD/kamay-especificacion-producto-v6.md` §9 (copias de seguridad automáticas con al menos una fuera del sistema), §10 (deliberadamente evitado: depender de un servicio externo para algo esencial del núcleo), §11 (seguridad y privacidad); `specs/PRD/ARCHITECTURE.md` (convención 2: el cliente de service role jamás en el bundle de cliente, y solo en trabajos programados); KAM-22 (la retención construida y sin agendar), KAM-18 (la restauración de un volcado) y KAM-04 (el alta pública en producción), que difirieron esas decisiones a esta tarea.

## Requirements

### Requirement: Backups run automatically and at least one lives outside the provider

MUST existir una copia de seguridad automática y periódica de la base de datos y de los archivos de Storage. Al menos una copia MUST residir en un destino independiente del proveedor que aloja la base, de modo que la pérdida de ese proveedor no arrastre consigo el respaldo. La periodicidad y la retención MUST estar documentadas.

#### Scenario: A backup exists outside the provider

- **WHEN** se inspecciona el estado de las copias de seguridad
- **THEN** existe al menos una copia reciente alojada fuera del proveedor de la base de datos

#### Scenario: Backups keep running without manual action

- **WHEN** transcurre el periodo declarado sin que nadie intervenga
- **THEN** se ha generado una copia nueva conforme a la periodicidad documentada

### Requirement: A restore has been performed in a clean environment and documented

La restauración MUST haberse ejecutado sobre un entorno limpio a partir de una copia real, y el sistema resultante MUST quedar operativo: se puede iniciar sesión, los datos de la organización están presentes y la aplicación funciona. El resultado del ensayo MUST quedar documentado en el repositorio, incluyendo la fecha, el origen de la copia, los pasos y el tiempo que tomó. La restauración MUST NOT volver a ejecutar los disparadores que generan datos a partir de otros —movimientos de inventario, eventos de bitácora—: lo restaurado es el estado del original, no una repetición de su historia.

#### Scenario: The restored system is operational

- **WHEN** se restaura una copia de seguridad sobre un entorno limpio
- **THEN** un usuario puede iniciar sesión, ve los datos de su organización y la aplicación opera con normalidad

#### Scenario: The rehearsal is recorded, not just described

- **WHEN** se consulta la documentación de recuperación del repositorio
- **THEN** contiene el registro de al menos un ensayo efectivamente ejecutado, con su fecha, su origen, sus pasos y su duración

#### Scenario: Restoring does not fire the triggers again

- **WHEN** se restaura una copia de una organización con compras que generaron movimientos de inventario y cambios que generaron eventos de bitácora
- **THEN** el entorno restaurado tiene exactamente los mismos movimientos de inventario y los mismos eventos de bitácora que el original, sin duplicados ni eventos nuevos atribuidos a la restauración

### Requirement: Scheduled jobs run in production and only for whoever holds their secret

Todo trabajo programado —el resumen diario de avisos y la rutina mensual de retención de la bitácora— MUST ejecutarse solo, conforme a su periodicidad declarada, en el ambiente de producción. Cada punto de entrada programado MUST rechazar toda llamada que no presente el secreto de disparo configurado, y MUST rechazarlas todas si el secreto no está configurado. La rutina de retención MUST ejecutarse por organización, y el fallo en una organización MUST NOT impedir que las demás se procesen; cada fallo MUST quedar reportado en el monitoreo de errores.

#### Scenario: Retention runs on its schedule

- **WHEN** llega el momento declarado para la rutina de retención en producción
- **THEN** la rutina se ejecuta para cada organización sin intervención de nadie

#### Scenario: A call without the secret is rejected

- **WHEN** se llama al punto de entrada de un trabajo programado sin el secreto de disparo, o con uno incorrecto
- **THEN** la llamada se rechaza y el trabajo no se ejecuta

#### Scenario: A missing secret closes the door

- **WHEN** el ambiente no tiene configurado el secreto de disparo y llega cualquier llamada al punto de entrada
- **THEN** la llamada se rechaza, incluida la del propio programador

#### Scenario: One organization's failure does not stop the others

- **WHEN** la rutina de retención falla al procesar una organización
- **THEN** las demás organizaciones se procesan igual y el fallo queda reportado en el monitoreo, sin haber vaciado el detalle de la organización que falló

### Requirement: Only a pending invitation can create an account

La creación de una cuenta MUST rechazarse en la propia plataforma de autenticación, y no solo en la interfaz, cuando el correo no tiene una invitación vigente —no aceptada, no vencida y no archivada— en alguna organización. La comprobación MUST NOT depender de credenciales elevadas en la aplicación. El inicio de sesión, la recuperación de contraseña y la aceptación de una invitación por parte de un usuario que ya tiene cuenta MUST seguir funcionando.

#### Scenario: Signing up without an invitation is rejected

- **WHEN** alguien intenta crear una cuenta directamente contra la API de autenticación con un correo que no tiene ninguna invitación vigente
- **THEN** la plataforma rechaza el alta y no se crea ninguna cuenta

#### Scenario: A pending invitation lets the invitee sign up

- **WHEN** una persona abre un enlace de invitación vigente y crea su cuenta con el correo invitado
- **THEN** la cuenta se crea y la invitación se acepta

#### Scenario: A spent invitation does not open the door

- **WHEN** alguien intenta crear una cuenta con un correo cuya única invitación ya fue aceptada, venció o fue archivada
- **THEN** la plataforma rechaza el alta

#### Scenario: Existing users are unaffected

- **WHEN** un usuario con cuenta inicia sesión, recupera su contraseña o acepta una invitación a otra organización
- **THEN** la operación funciona como antes

### Requirement: Environments are separated and secrets never reach the browser

Cada ambiente MUST tener su propio juego de variables de entorno, y ningún valor de un ambiente MAY usarse en otro. La clave de service role MUST NOT aparecer en el paquete que se entrega al navegador ni en ninguna respuesta de la aplicación. `.env.example` MUST enumerar toda variable requerida, sin contener ningún valor real.

#### Scenario: The service role key is absent from the client bundle

- **WHEN** se inspecciona la compilación de producción entregada al navegador
- **THEN** la clave de service role no aparece en ningún archivo servido al cliente

#### Scenario: A missing variable fails at startup, not at first use

- **WHEN** la aplicación arranca sin una variable de entorno requerida
- **THEN** falla de inmediato indicando cuál falta, en lugar de fallar más tarde durante una operación del usuario

### Requirement: The application is deployed on its own domain with production settings

La aplicación MUST estar desplegada y accesible en un dominio propio sobre conexión cifrada. La compilación de producción MUST NOT servir cabeceras ni configuraciones destinadas al desarrollo, y el service worker MUST invalidarse en cada despliegue para que ningún usuario quede servido por una versión anterior.

#### Scenario: The production domain serves the application over HTTPS

- **WHEN** se abre el dominio de producción
- **THEN** la aplicación responde sobre conexión cifrada y redirige el tráfico no cifrado

#### Scenario: A new deployment reaches returning users

- **WHEN** un usuario que ya tenía la aplicación instalada la abre después de un despliegue
- **THEN** recibe la versión nueva y no queda servido indefinidamente por la anterior

#### Scenario: The application is not indexable

- **WHEN** un rastreador solicita el dominio de producción
- **THEN** la aplicación indica que no debe indexarse

### Requirement: Errors are monitored in server and browser without leaking personal data

Los errores no controlados del servidor y del navegador MUST reportarse a un servicio de monitoreo con información suficiente para diagnosticarlos —versión desplegada, ruta y organización— y MUST NOT incluir datos personales de clientes, importes, contenido de adjuntos ni credenciales. El fallo del monitoreo MUST NOT afectar el funcionamiento de la aplicación.

#### Scenario: An unhandled error is reported with context

- **WHEN** se produce un error no controlado en una ruta de la aplicación
- **THEN** el servicio de monitoreo recibe el error junto con la versión desplegada, la ruta y la organización

#### Scenario: Personal data never reaches the monitoring service

- **WHEN** se produce un error mientras se manipula un registro con datos de cliente e importes
- **THEN** el reporte enviado no contiene nombres, contactos, importes ni contenido de adjuntos

#### Scenario: Monitoring failure is invisible to the user

- **WHEN** el servicio de monitoreo no está disponible y ocurre un error
- **THEN** la aplicación presenta su estado de error con normalidad y no falla adicionalmente por causa del monitoreo
