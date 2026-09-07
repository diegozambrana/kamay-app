# quick-capture Specification

## Purpose

Convierte el celular en la herramienta de captura del taller: una pantalla de inicio propia con seis destinos de registro grandes y alcanzables con el pulgar —incluida la entrada al modo feria—, la confirmación de lo registrado hoy tanto si ya llegó al servidor como si espera en la cola, y el acceso a registrar desde cualquier pantalla sin navegar a su sección.

> Origen: `specs/PRD/kamay-backlog.md` — KAM-13; `specs/PRD/kamay-mapa-navegacion-ui.md` §2.1, §2.6, §4.2, §4.3, §5 (V16); `specs/PRD/kamay-especificacion-producto-v6.md` — V16; `specs/PRD/ARCHITECTURE.md` (ocultar lo que un rol no puede usar; nada derivado se almacena; identificadores generados en el cliente).

## Requirements

### Requirement: La pantalla de registro rápido ofrece seis destinos

El sistema SHALL ofrecer en `/quick` una retícula de seis destinos de registro —Venta rápida, Pedido, Compra, Gasto, Consumo y Tarea— presentados como botones grandes, todos con el mismo tamaño y jerarquía visual. La retícula SHALL disponerse en dos columnas y SHALL caber completa, sin desplazamiento horizontal, en un ancho de 390 px. Cada destino SHALL declarar visiblemente su indisponibilidad cuando la pantalla a la que conduce todavía no existe, en lugar de desaparecer o de conducir a una ruta inexistente.

#### Scenario: Los seis destinos están presentes

- **WHEN** una persona dueña abre `/quick`
- **THEN** la retícula ofrece los seis destinos: Venta rápida, Pedido, Compra, Gasto, Consumo y Tarea

#### Scenario: Destinos disponibles hoy

- **WHEN** se activa el destino Venta rápida, Pedido, Compra o Gasto
- **THEN** se abre respectivamente el modo feria, el alta de pedido, el alta de compra o el alta de gasto

#### Scenario: Destinos aún no construidos

- **WHEN** se abre `/quick` y se observan los destinos Consumo y Tarea
- **THEN** cada uno aparece en su ranura, no accionable y con la indicación de que aún no está disponible

#### Scenario: La retícula cabe en un teléfono

- **WHEN** se abre `/quick` en un viewport de 390 px de ancho
- **THEN** los seis destinos son visibles y accionables sin ningún desplazamiento horizontal

### Requirement: El registro rápido es la puerta del modo feria

El sistema SHALL ofrecer en `/quick` la única entrada prevista al modo feria, de modo que entrar sea siempre una acción explícita desde esta pantalla y salir devuelva a ella. Ninguna otra pantalla SHALL ofrecer un acceso al modo feria, para no reintroducir por otra vía los elementos de navegación que ese modo suprime a propósito.

#### Scenario: Entrar al modo feria

- **WHEN** se activa el destino Venta rápida en `/quick`
- **THEN** se abre el modo feria con su layout propio, sin barra superior ni inferior

#### Scenario: La ida y la vuelta cierran el circuito

- **WHEN** se entra al modo feria desde `/quick` y después se activa *Salir del modo feria*
- **THEN** se vuelve a `/quick`, con su cascarón habitual

#### Scenario: No hay otra puerta

- **WHEN** se recorren las pantallas del área autenticada distintas de `/quick`
- **THEN** ninguna ofrece un acceso al modo feria

### Requirement: La retícula de registro rápido se filtra por rol

El sistema SHALL mostrar en la retícula únicamente los destinos que el rol de la persona puede usar. Un destino que su rol no puede ejecutar SHALL estar ausente, nunca presente y deshabilitado. En particular, los destinos Compra y Gasto —que escriben egresos— SHALL estar ausentes para el ayudante.

#### Scenario: El ayudante no ve los destinos de egreso

- **WHEN** un ayudante abre `/quick`
- **THEN** los destinos Compra y Gasto no aparecen en la retícula

#### Scenario: El ayudante sí ve los destinos de trabajo

- **WHEN** un ayudante abre `/quick`
- **THEN** los destinos Pedido y Venta rápida aparecen y son accionables

#### Scenario: Un destino ausente no se alcanza por dirección

- **WHEN** un ayudante navega directamente a la ruta de alta de gasto
- **THEN** el sistema le impide registrar el egreso

### Requirement: Registrado hoy confirma la captura

El sistema SHALL mostrar en `/quick` una lista con los cinco registros más recientes del día, cada uno con su tipo, un rótulo que lo identifique, su línea de negocio y su hora. Cada elemento ya sincronizado SHALL conducir al detalle del registro correspondiente. La lista SHALL respetar la visibilidad del rol: un registro que el rol no puede leer no aparece. La lista SHALL derivarse de los registros existentes en el momento de leer y no SHALL almacenarse en ninguna columna ni store.

#### Scenario: La lista muestra lo registrado hoy

- **WHEN** hoy se han creado un pedido y una compra en la organización
- **THEN** ambos aparecen en "Registrado hoy", el más reciente primero

#### Scenario: Se limita a cinco

- **WHEN** hoy se han creado siete registros en la organización
- **THEN** la lista muestra únicamente los cinco más recientes

#### Scenario: Ayer no cuenta

- **WHEN** un registro se creó ayer y ninguno hoy
- **THEN** la lista aparece vacía, con su mensaje de lista sin contenido

#### Scenario: El ayudante no ve egresos en la lista

- **WHEN** hoy se han creado un pedido y un gasto, y quien mira es un ayudante
- **THEN** la lista muestra el pedido y no muestra el gasto

#### Scenario: Cada elemento abre su registro

- **WHEN** se activa el elemento correspondiente a un pedido ya sincronizado
- **THEN** se abre el detalle de ese pedido

#### Scenario: Lo que se acaba de registrar aparece

- **WHEN** se registra un gasto desde `/quick` y se vuelve a esa pantalla
- **THEN** el gasto recién creado encabeza "Registrado hoy"

### Requirement: Registrado hoy cuenta también lo que no se ha enviado

El sistema SHALL incluir en "Registrado hoy" las capturas del día que siguen en la cola de sincronización del dispositivo, presentadas junto a las ya sincronizadas y **distinguidas visiblemente como no enviadas**. El alcance de esa mitad pendiente SHALL ser exactamente el de las operaciones que la captura sin conexión declara cubiertas, sin ampliarlo ni suponerlo: un registro cuya operación no está cubierta escribe directo y aparece en la lista solo una vez guardado. Una captura pendiente SHALL ordenarse por su hora real de encolado, no por la de llegada al servidor. Un registro SHALL aparecer una sola vez aunque figure a la vez en la cola y en el servidor. Una captura pendiente SHALL NOT ofrecer enlace a un detalle que todavía no existe; la resolución de su envío corresponde al indicador de sincronización y su bandeja, no a esta lista.

#### Scenario: Una captura sin red aparece igualmente

- **WHEN** se registra un pedido sin conexión y se vuelve a `/quick`
- **THEN** el pedido aparece en "Registrado hoy" marcado como no enviado, con su hora real

#### Scenario: Una operación no cubierta por la cola no se inventa

- **WHEN** la cola contiene una entrada cuya operación no es de las cubiertas por la retícula
- **THEN** no aparece en "Registrado hoy"

#### Scenario: La lista no queda vacía por falta de red

- **WHEN** todo lo capturado hoy sigue en la cola y no ha llegado nada al servidor
- **THEN** "Registrado hoy" muestra esas capturas en lugar de su mensaje de lista sin contenido

#### Scenario: Al sincronizarse no se duplica

- **WHEN** una captura pendiente se sincroniza y la lista se vuelve a componer
- **THEN** el registro aparece una sola vez, ya sin la marca de no enviado

#### Scenario: Lo pendiente y lo enviado se ordenan juntos

- **WHEN** hay una captura pendiente de las 15:40 y un registro sincronizado de las 16:10
- **THEN** el de las 16:10 aparece primero y el pendiente después, en una sola lista

#### Scenario: Una captura pendiente no enlaza a ninguna parte

- **WHEN** se intenta activar un elemento marcado como no enviado
- **THEN** no se navega a ningún detalle

### Requirement: Registrar está a dos toques desde cualquier pantalla móvil

El sistema SHALL ofrecer en móvil, en toda pantalla del área autenticada, un control *+ Registrar* que abre el mismo menú de destinos de la retícula de `/quick`, filtrado por el mismo rol. Desde cualquier pantalla, alcanzar el formulario de un destino disponible SHALL requerir como máximo dos interacciones: abrir el menú y elegir el destino. El control SHALL ausentarse únicamente de las pantallas de captura a pantalla completa, donde taparía las acciones de guardar y ofrecería una salida que se saltaría la confirmación de descarte. El control SHALL NOT tapar ni desplazar el indicador de registros por sincronizar.

#### Scenario: Registrar un gasto desde el catálogo

- **WHEN** una persona dueña está en el catálogo en un viewport móvil y activa *+ Registrar* y luego *Gasto*
- **THEN** llega al formulario de nuevo gasto en dos interacciones

#### Scenario: Registrar un pedido desde los egresos

- **WHEN** una persona dueña está en la bandeja de egresos en un viewport móvil y activa *+ Registrar* y luego *Pedido*
- **THEN** llega al formulario de nuevo pedido en dos interacciones

#### Scenario: El menú respeta el rol

- **WHEN** un ayudante abre el menú de *+ Registrar*
- **THEN** los destinos Compra y Gasto no aparecen en el menú

#### Scenario: Las pantallas de captura no lo muestran

- **WHEN** se abre el formulario de nuevo pedido en un viewport móvil
- **THEN** el control *+ Registrar* no se rinde

#### Scenario: En escritorio no aparece

- **WHEN** se abre cualquier pantalla del área autenticada en un viewport de escritorio
- **THEN** el control *+ Registrar* móvil no se rinde

#### Scenario: El indicador de sincronización sigue alcanzable

- **WHEN** hay registros pendientes y se abre una pantalla del área autenticada en un viewport móvil
- **THEN** el indicador de registros por sincronizar sigue visible y se puede activar con el control *+ Registrar* en pantalla
