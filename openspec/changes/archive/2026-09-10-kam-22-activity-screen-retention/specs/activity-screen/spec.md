## Purpose

Convierte la bitácora en algo que se puede leer: una pantalla donde cualquier «¿qué cambió, quién y cuándo?» se responde en menos de dos minutos con filtros que se acotan en la consulta, filas que se abren para mostrar el antes y el después, y una salida hacia el registro afectado —o hacia su desarchivado—; y hace que el historial que cada pantalla de detalle muestra diga exactamente lo mismo, porque sale de la misma fuente.

## ADDED Requirements

### Requirement: La bitácora es una página completa reservada a la persona dueña

La ruta `/activity` SHALL rendir la pantalla de bitácora (V23) como página completa. Un usuario con rol `assistant` SHALL ser redirigido a su aterrizaje habitual al abrirla por dirección directa, y la entrada SHALL NOT aparecer en su menú. La guardia de interfaz SHALL NOT ser la única defensa: la bitácora SHALL seguir devolviendo cero filas a quien no es dueño aunque llegue a la pantalla por cualquier vía.

#### Scenario: La persona dueña abre la bitácora

- **WHEN** una persona dueña con sesión abre `/activity`
- **THEN** la pantalla se rinde con sus eventos

#### Scenario: El ayudante es redirigido

- **WHEN** un ayudante con sesión abre `/activity` por dirección directa
- **THEN** es redirigido fuera de la pantalla y no ve su contenido

#### Scenario: La bitácora no aparece en el menú del ayudante

- **WHEN** un ayudante con sesión mira el cascarón de la aplicación
- **THEN** ninguna entrada de navegación apunta a `/activity`

### Requirement: La cabecera declara que la bitácora no se edita y cuál es la retención vigente

La pantalla SHALL mostrar, sin que haya que abrir nada, que la bitácora no puede editarse ni borrarse y cuál es el plazo de retención vigente de la organización. El plazo mostrado SHALL leerse de la configuración de la organización y SHALL NOT ser un texto fijo.

#### Scenario: El aviso refleja la política guardada

- **WHEN** la organización tiene su retención fijada en un plazo distinto del valor por defecto y se abre la bitácora
- **THEN** la cabecera anuncia ese plazo, no el valor por defecto

#### Scenario: La inmutabilidad se declara

- **WHEN** se abre la bitácora
- **THEN** la cabecera dice que la bitácora no puede editarse ni borrarse

### Requirement: Los eventos se listan del más reciente al más antiguo, agrupados por día

La lista SHALL ordenar los eventos por el momento en que ocurrieron, del más reciente al más antiguo, y SHALL agruparlos bajo un encabezado por día con su conteo de eventos. Dos eventos del mismo instante SHALL tener un orden estable entre recargas. Las fechas y horas SHALL presentarse en la zona horaria de la organización.

#### Scenario: Orden inverso por día

- **WHEN** existen eventos de tres días distintos
- **THEN** aparecen agrupados por día, el día más reciente primero, y dentro de cada día del más reciente al más antiguo

#### Scenario: El conteo del día es el de sus eventos

- **WHEN** un día agrupa cuatro eventos
- **THEN** su encabezado anuncia cuatro eventos

#### Scenario: El orden no baila entre recargas

- **WHEN** dos eventos comparten el mismo instante y la pantalla se recarga
- **THEN** aparecen en el mismo orden que antes

### Requirement: Cada fila se lee como una frase y trae su contexto

Cada fila SHALL mostrar la hora, la persona o etiqueta que hizo el cambio, una frase en lenguaje natural que diga qué ocurrió y sobre qué registro, la línea de negocio con su color cuando el evento tenga una, el origen del cambio cuando conste, y el rótulo humano del registro afectado cuando ese registro tenga uno. La frase SHALL NOT contener nombres de tabla, nombres de columna ni identificadores internos. Un evento sin origen registrado SHALL omitir ese dato en lugar de suponerlo.

#### Scenario: Un cambio de estado se lee como frase

- **WHEN** se rinde un evento de cambio de estado de un pedido
- **THEN** la fila nombra a la persona, lo que hizo y el pedido, sin ningún nombre de tabla ni de columna

#### Scenario: Un evento sin origen no lo inventa

- **WHEN** se rinde un evento anterior a que el sistema registrara el origen
- **THEN** la fila se rinde completa y sin dato de origen

#### Scenario: El autor no humano se nombra por su etiqueta

- **WHEN** un evento no tiene persona autora pero sí etiqueta de autor
- **THEN** la fila atribuye el cambio a esa etiqueta

### Requirement: La fila expandida muestra el antes y el después de los campos que cambiaron

Al expandir una fila, el sistema SHALL mostrar una tabla de campo, valor anterior y valor nuevo que contenga **únicamente los campos que cambiaron**. Los nombres de campo SHALL presentarse en el idioma visible del producto y SHALL NOT ser nombres de columna. Los valores SHALL presentarse de forma legible: una referencia a otro registro SHALL leerse por su nombre y no por su identificador, un importe SHALL llevar su moneda y una fecha SHALL presentarse en la zona horaria de la organización. Un valor ausente SHALL rendirse con una marca de vacío, nunca como texto nulo. Un evento cuyo detalle ya fue vaciado por la retención SHALL rendirse expandido con la explicación de que el detalle ya no está disponible, no como una tabla vacía ni como un error.

#### Scenario: Solo los campos que cambiaron

- **WHEN** se expande un evento cuyo cambio afectó a un solo campo
- **THEN** la tabla muestra exactamente ese campo, con su valor anterior y su valor nuevo, y ninguna otra fila

#### Scenario: Una referencia se lee por su nombre

- **WHEN** se expande un evento de cambio de estado
- **THEN** el antes y el después muestran los nombres de los estados, no sus identificadores

#### Scenario: Ningún nombre de columna llega a la pantalla

- **WHEN** se expande cualquier evento
- **THEN** ninguna etiqueta de campo coincide con el nombre de la columna de la base de datos

#### Scenario: Un detalle purgado se explica

- **WHEN** se expande un evento cuyo detalle fue vaciado por la política de retención
- **THEN** la fila explica que el detalle ya no está disponible y sigue mostrando quién, qué y cuándo

### Requirement: Los filtros se aplican en la consulta y viven en la dirección

La pantalla SHALL ofrecer filtros por rango de fechas, línea de negocio, usuario, tipo de registro y tipo de acción. Cada filtro SHALL aplicarse dentro de la consulta a la bitácora y SHALL NOT recortar un resultado ya cargado. El estado de los filtros SHALL vivir en la dirección de la página, de modo que compartir el enlace reproduzca el mismo resultado y volver atrás recupere el filtro anterior. Los filtros SHALL poder combinarse entre sí.

#### Scenario: El filtro se aplica en la consulta

- **WHEN** se filtra por una línea de negocio en una organización con más eventos de otras líneas que el tamaño de una página
- **THEN** la primera página se llena con eventos de esa línea, sin huecos por eventos descartados después de leerlos

#### Scenario: El filtro se comparte por enlace

- **WHEN** se abre en una sesión nueva la dirección resultante de aplicar un filtro
- **THEN** la pantalla se rinde con ese mismo filtro aplicado

#### Scenario: Volver atrás recupera el filtro anterior

- **WHEN** se aplica un filtro y después se navega hacia atrás
- **THEN** la pantalla vuelve al filtro que tenía antes

#### Scenario: Los filtros se combinan

- **WHEN** se filtra a la vez por usuario y por tipo de acción
- **THEN** solo aparecen los eventos que cumplen ambas condiciones

### Requirement: La búsqueda encuentra los eventos de un registro por su identificador

La pantalla SHALL ofrecer una búsqueda que acote la lista a los eventos de un registro concreto a partir del identificador con el que ese registro se muestra a las personas, y SHALL aceptar también el identificador interno pegado tal cual. Una búsqueda que no corresponde a ningún registro SHALL producir el estado de «ningún resultado», no un error. La búsqueda SHALL NOT recorrer el contenido de los cambios.

#### Scenario: Buscar por el número del pedido

- **WHEN** se busca el número con el que un pedido se muestra
- **THEN** la lista queda acotada a los eventos de ese pedido

#### Scenario: Buscar por identificador interno

- **WHEN** se pega el identificador interno de un registro
- **THEN** la lista queda acotada a los eventos de ese registro

#### Scenario: Una búsqueda sin correspondencia

- **WHEN** se busca un identificador que no corresponde a ningún registro de la organización
- **THEN** la pantalla muestra el estado de «ningún resultado» y ofrece quitar los filtros

### Requirement: La pantalla nunca carga la bitácora entera

La pantalla SHALL leer los eventos por páginas acotadas y SHALL avanzar por un cursor sobre el orden de la lista, nunca por un desplazamiento que obligue a recorrer lo ya leído. El tamaño de página SHALL tener un techo impuesto por el sistema, y quien llama SHALL NOT poder pedir un número ilimitado de eventos. La pantalla SHALL NOT pedir el total de eventos que cumplen el filtro. Con una bitácora de cien mil eventos, la primera página de la lista filtrada SHALL rendirse en menos de dos segundos.

#### Scenario: La primera página está acotada

- **WHEN** se abre la bitácora de una organización con cien mil eventos
- **THEN** se leen como mucho los eventos de una página, no todos

#### Scenario: Cargar más continúa donde quedó

- **WHEN** se pide la página siguiente
- **THEN** los eventos devueltos continúan exactamente donde terminó la anterior, sin repetir ni saltarse ninguno

#### Scenario: El techo de página no se puede superar

- **WHEN** se solicita una página mayor que el techo del sistema
- **THEN** se devuelven como mucho tantos eventos como permite el techo

#### Scenario: Respuesta bajo dos segundos con cien mil eventos

- **WHEN** se consulta la lista filtrada sobre una bitácora de cien mil eventos
- **THEN** el resultado llega en menos de dos segundos y la consulta se resuelve por índice

### Requirement: Desde el evento se llega al registro afectado

Un evento cuyo registro tiene pantalla propia SHALL ofrecer el paso a esa pantalla. Un evento cuyo registro no tiene pantalla propia SHALL rendirse igual, sin enlace. Un enlace SHALL NOT dejar de ofrecerse por el hecho de que el registro esté archivado.

#### Scenario: El evento de un pedido lleva a su pedido

- **WHEN** se activa un evento de un pedido
- **THEN** se abre el detalle de ese pedido

#### Scenario: Un evento sin destino se rinde sin enlace

- **WHEN** se rinde un evento de un registro que no tiene pantalla propia
- **THEN** el evento aparece completo y sin enlace, y nada queda roto

#### Scenario: Lo archivado sigue siendo alcanzable

- **WHEN** se activa un evento de un registro archivado
- **THEN** se abre su detalle

### Requirement: Un evento de archivado permite desarchivar, y el desarchivado queda registrado

Un evento con acción de archivado cuyo registro sigue archivado SHALL ofrecer desarchivarlo. El desarchivado SHALL respetar las mismas validaciones que el desarchivado desde la pantalla del propio registro, y SHALL producir a su vez un evento de desarchivado en la bitácora. Un evento de archivado cuyo registro ya fue desarchivado SHALL NOT ofrecer la acción. Un registro cuyo tipo no admite desarchivado SHALL NOT ofrecer la acción.

#### Scenario: Desarchivar desde el evento

- **WHEN** se desarchiva un registro desde su evento de archivado
- **THEN** el registro vuelve a estar vigente con toda su historia

#### Scenario: El desarchivado se registra

- **WHEN** se desarchiva un registro desde la bitácora
- **THEN** aparece un evento nuevo de desarchivado con su autor y su hora

#### Scenario: Ya desarchivado, sin acción

- **WHEN** se mira un evento de archivado cuyo registro ya volvió a estar vigente
- **THEN** el evento no ofrece desarchivar

### Requirement: El resultado filtrado se exporta

La pantalla SHALL permitir exportar el resultado del filtro vigente como un archivo tabular descargable. El archivo SHALL contener los eventos que cumplen el filtro —no solo los que la pantalla tiene cargados— con la fecha, el autor, la frase en lenguaje natural, el registro afectado y el detalle del cambio en forma legible, y SHALL NOT contener el contenido interno de los cambios en su forma cruda. La exportación SHALL tener un techo de filas impuesto por el sistema; cuando el resultado lo supere, el sistema SHALL avisarlo antes de exportar en lugar de recortar en silencio. Los valores que contengan separadores, comillas o saltos de línea SHALL escaparse de modo que el archivo se abra correctamente.

#### Scenario: Se exporta lo filtrado, no lo cargado

- **WHEN** se exporta un filtro cuyo resultado supera lo que la pantalla tiene cargado y no llega al techo del sistema
- **THEN** el archivo contiene todos los eventos que cumplen el filtro

#### Scenario: El archivo es legible

- **WHEN** se abre un archivo exportado
- **THEN** cada fila trae la fecha, el autor, la frase y el detalle del cambio en lenguaje legible, sin contenido crudo

#### Scenario: Un resultado por encima del techo se avisa

- **WHEN** se pide exportar un resultado mayor que el techo del sistema
- **THEN** el sistema lo advierte antes de producir el archivo

#### Scenario: Un valor con separadores no rompe el archivo

- **WHEN** un valor exportado contiene el separador del formato, comillas o un salto de línea
- **THEN** el archivo se abre con ese valor íntegro en una sola celda

### Requirement: El vacío inicial y el resultado sin coincidencias se distinguen

Una bitácora sin ningún evento SHALL rendirse con un mensaje de que todavía no hay movimientos. Un filtro que no devuelve nada SHALL rendirse con un mensaje distinto, que diga que ningún evento coincide y ofrezca quitar los filtros.

#### Scenario: Sin eventos todavía

- **WHEN** se abre la bitácora de una organización que no tiene ningún evento
- **THEN** la pantalla dice que todavía no hay movimientos y no ofrece quitar filtros

#### Scenario: Ningún evento coincide

- **WHEN** un filtro no devuelve ningún evento en una organización que sí tiene eventos
- **THEN** la pantalla dice que ninguno coincide y ofrece quitar los filtros

### Requirement: El historial de un registro coincide con la bitácora filtrada por ese registro

El bloque de historial de una pantalla de detalle SHALL mostrar exactamente los mismos eventos que la bitácora general devuelve filtrada por ese registro, con la misma redacción y el mismo orden. El sistema SHALL NOT mantener ninguna otra tabla, columna o store de historial. Para quien no puede leer la bitácora, el bloque SHALL rendirse vacío con su mensaje de lista sin contenido, nunca como un error.

#### Scenario: Los eventos coinciden uno a uno

- **WHEN** se comparan los eventos del historial de un pedido con los de la bitácora general filtrada por ese pedido
- **THEN** son los mismos eventos, en el mismo orden

#### Scenario: La redacción es la misma

- **WHEN** el mismo evento se rinde en el historial de su registro y en la bitácora general
- **THEN** ambas frases dicen lo mismo

#### Scenario: El ayudante ve el bloque vacío, no un error

- **WHEN** un ayudante abre un registro que puede ver
- **THEN** el bloque de historial se rinde vacío con su mensaje de lista sin contenido

### Requirement: Toda pantalla de detalle con historial lo lee de la bitácora y lleva a ella

Las pantallas de detalle de pedido, de ítem, de contacto, de tarea y de activo SHALL mostrar el bloque de historial, y ese bloque SHALL ofrecer el paso a la bitácora ya filtrada por ese registro. Las cinco SHALL redactar sus eventos con la misma redacción, de modo que un mismo evento no se lea de dos maneras según la pantalla desde la que se mire. El aviso de que la pantalla de bitácora aún no existe SHALL desaparecer de todas ellas y del panel principal.

#### Scenario: El activo se suma a la redacción común

- **WHEN** se abre el detalle de un activo con cambios y se compara su historial con el del mismo evento en la bitácora
- **THEN** ambas frases dicen lo mismo, y el bloque ofrece el paso a la bitácora filtrada por ese activo

#### Scenario: El contacto estrena historial

- **WHEN** se abre el detalle de un contacto que ha tenido cambios
- **THEN** su historial muestra esos cambios leídos de la bitácora

#### Scenario: Del historial a la bitácora filtrada

- **WHEN** se activa el paso a la bitácora desde el historial de una tarea
- **THEN** se abre la bitácora filtrada por esa tarea

#### Scenario: Ya no queda ningún aviso de pantalla pendiente

- **WHEN** se miran el panel principal y las cuatro pantallas de detalle con historial
- **THEN** ninguna anuncia que la pantalla de bitácora está por llegar
