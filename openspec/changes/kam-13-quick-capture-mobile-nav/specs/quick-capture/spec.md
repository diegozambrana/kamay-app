## Purpose

Convierte el celular en la herramienta de captura del taller: una pantalla de inicio propia con seis destinos de registro grandes y alcanzables con el pulgar, la confirmación de lo registrado hoy, y el acceso a registrar cualquier cosa desde cualquier pantalla sin navegar a su sección.

> Origen: `specs/PRD/kamay-backlog.md` — KAM-13; `specs/PRD/kamay-mapa-navegacion-ui.md` §2.1, §2.6, §4.2, §5 (V16); `specs/PRD/kamay-especificacion-producto-v6.md` — V16; `specs/PRD/ARCHITECTURE.md` (ocultar lo que un rol no puede usar; nada derivado se almacena).

## ADDED Requirements

### Requirement: La pantalla de registro rápido ofrece seis destinos

El sistema SHALL ofrecer en `/quick` una retícula de seis destinos de registro —Venta rápida, Pedido, Compra, Gasto, Consumo y Tarea— presentados como botones grandes, todos con el mismo tamaño y jerarquía visual. La retícula SHALL disponerse en dos columnas y SHALL caber completa, sin desplazamiento horizontal, en un ancho de 390 px. Cada destino SHALL declarar visiblemente su indisponibilidad cuando la pantalla a la que conduce todavía no existe, en lugar de desaparecer o de conducir a una ruta inexistente.

#### Scenario: Los seis destinos están presentes

- **WHEN** una persona dueña abre `/quick`
- **THEN** la retícula ofrece los seis destinos: Venta rápida, Pedido, Compra, Gasto, Consumo y Tarea

#### Scenario: Destinos disponibles hoy

- **WHEN** se activa el destino Pedido, el destino Compra o el destino Gasto
- **THEN** se abre respectivamente el alta de pedido, el alta de compra o el alta de gasto

#### Scenario: Destinos aún no construidos

- **WHEN** se abre `/quick` y se observan los destinos Venta rápida, Consumo y Tarea
- **THEN** cada uno aparece en su ranura, no accionable y con la indicación de que aún no está disponible

#### Scenario: La retícula cabe en un teléfono

- **WHEN** se abre `/quick` en un viewport de 390 px de ancho
- **THEN** los seis destinos son visibles y accionables sin ningún desplazamiento horizontal

### Requirement: La retícula de registro rápido se filtra por rol

El sistema SHALL mostrar en la retícula únicamente los destinos que el rol de la persona puede usar. Un destino que su rol no puede ejecutar SHALL estar ausente, nunca presente y deshabilitado. En particular, los destinos Compra y Gasto —que escriben egresos— SHALL estar ausentes para el ayudante.

#### Scenario: El ayudante no ve los destinos de egreso

- **WHEN** un ayudante abre `/quick`
- **THEN** los destinos Compra y Gasto no aparecen en la retícula

#### Scenario: El ayudante sí ve los destinos de trabajo

- **WHEN** un ayudante abre `/quick`
- **THEN** el destino Pedido aparece y es accionable

#### Scenario: Un destino ausente no se alcanza por dirección

- **WHEN** un ayudante navega directamente a la ruta de alta de gasto
- **THEN** el sistema le impide registrar el egreso

### Requirement: Registrado hoy confirma la captura

El sistema SHALL mostrar en `/quick` una lista con los cinco registros más recientes creados hoy en la organización, cada uno con su tipo, un rótulo que lo identifique, su línea de negocio y su hora. Cada elemento SHALL conducir al detalle del registro correspondiente. La lista SHALL respetar la visibilidad del rol: un registro que el rol no puede leer no aparece. La lista SHALL derivarse de los registros existentes en el momento de leer y no SHALL almacenarse en ninguna columna ni store.

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

- **WHEN** se activa el elemento correspondiente a un pedido
- **THEN** se abre el detalle de ese pedido

#### Scenario: Lo que se acaba de registrar aparece

- **WHEN** se registra un gasto desde `/quick` y se vuelve a esa pantalla
- **THEN** el gasto recién creado encabeza "Registrado hoy"

### Requirement: Registrar está a dos toques desde cualquier pantalla móvil

El sistema SHALL ofrecer en móvil, en toda pantalla del área autenticada, un control *+ Registrar* que abre el mismo menú de destinos de la retícula de `/quick`, filtrado por el mismo rol. Desde cualquier pantalla, alcanzar el formulario de un destino disponible SHALL requerir como máximo dos interacciones: abrir el menú y elegir el destino. El control SHALL ausentarse únicamente de las pantallas de captura a pantalla completa, donde taparía las acciones de guardar y ofrecería una salida que se saltaría la confirmación de descarte.

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
