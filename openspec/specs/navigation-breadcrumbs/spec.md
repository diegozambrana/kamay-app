# navigation-breadcrumbs Specification

## Purpose

Da a toda pantalla de alta, edición y detalle un camino de vuelta uniforme y visible —migas de pan sobre el título— para que la persona siempre sepa dónde está y pueda volver a la lista, o al detalle desde la edición, con un solo gesto.

> Origen: `specs/PRD/kamay-mapa-navegacion-ui.md` §8 (regla de retorno) y §12 (estados transversales); `specs/PRD/kamay-especificacion-producto-v6.md` §5 (legible en taller y feria).

## Requirements

### Requirement: Migas de pan en pantallas de alta, edición y detalle

Toda pantalla de alta, edición o detalle SHALL mostrar, encima de su título, una ruta de migas de pan que empieza en la pantalla de lista de su sección y termina en la pantalla actual. Cada tramo anterior al último SHALL ser un enlace a esa pantalla; el último SHALL nombrar la pantalla actual, SHALL NOT ser un enlace y SHALL marcarse como la página actual para tecnologías de asistencia. La ruta SHALL formar parte del encabezado común de las pantallas, de modo que tenga la misma apariencia y posición en todas.

Las rutas SHALL ser:

| Pantalla | Ruta |
|---|---|
| Nuevo pedido | Pedidos › Nuevo pedido |
| Detalle de pedido | Pedidos › Pedido #N |
| Edición de pedido (también archivado) | Pedidos › Pedido #N › Editar |
| Nueva tarea | Tareas › Nueva tarea |
| Detalle de tarea | Tareas › *título de la tarea* |
| Nueva compra | Egresos › Nueva compra |
| Nuevo gasto | Egresos › Nuevo gasto |
| Detalle de egreso | Egresos › *tipo del egreso* (Compra o Gasto) |
| Detalle de ítem del catálogo | Catálogo › *nombre del ítem* |
| Detalle de organización (plataforma) | Organizaciones › *nombre de la organización* |
| Detalle de usuario (plataforma) | Usuarios › *nombre o correo del usuario* |

Estas migas SHALL reemplazar los enlaces de vuelta propios que hoy tienen esas pantallas («← Pedidos», «← Egresos», «← Catálogo», «Volver»), de modo que no haya dos caminos de vuelta distintos en el mismo encabezado. Las pantallas de lista, ajustes, reportes, tablero de inicio y perfil SHALL NOT mostrar migas, ni tampoco un detalle mostrado como panel lateral dentro de una lista.

#### Scenario: Detalle vuelve a la lista

- **WHEN** el usuario abre el detalle del pedido #42
- **THEN** encima del título ve «Pedidos › Pedido #42», y al pulsar «Pedidos» llega a la pantalla de pedidos

#### Scenario: Edición vuelve al detalle o a la lista

- **WHEN** el usuario abre la edición del pedido #42
- **THEN** ve «Pedidos › Pedido #42 › Editar»; «Pedido #42» lleva al detalle del pedido y «Pedidos» a la lista

#### Scenario: Alta vuelve a la lista

- **WHEN** el usuario abre «Nueva compra»
- **THEN** ve «Egresos › Nueva compra», y «Egresos» lleva a la bandeja de egresos

#### Scenario: El último tramo no es un enlace

- **WHEN** el usuario abre el detalle de una tarea titulada «Cortar tazas»
- **THEN** el último tramo dice «Cortar tazas», no es un enlace y se anuncia como la página actual

#### Scenario: Un solo camino de vuelta

- **WHEN** el usuario abre el detalle de un ítem del catálogo
- **THEN** el encabezado muestra la miga «Catálogo › *nombre*» y no muestra además el enlace «← Catálogo»

#### Scenario: Panel de plataforma

- **WHEN** un administrador de plataforma abre el detalle de una organización
- **THEN** ve «Organizaciones › *nombre*», y «Organizaciones» lleva a la lista de organizaciones del panel, sin un botón «Volver» aparte

#### Scenario: Las listas no llevan migas

- **WHEN** el usuario abre la pantalla de pedidos, de tareas o de egresos
- **THEN** el encabezado no muestra migas de pan

### Requirement: La miga de la lista de pedidos conserva la vista de origen

Cuando se llega a una pantalla de alta, detalle o edición de pedido desde la pantalla de pedidos, la miga «Pedidos» SHALL volver a esa pantalla con la misma vista y los mismos filtros que tenía al salir (tablero, lista o calendario; búsqueda; «Ver archivados»). Cuando no se llegó desde allí —enlace directo, recarga, otra sección— SHALL llevar a la pantalla de pedidos sin filtros, en su vista por omisión. La vista de origen SHALL conservarse al pasar del detalle a la edición y de vuelta. Solo SHALL aceptarse como vista de origen una dirección de la propia pantalla de pedidos; cualquier otra SHALL ignorarse.

#### Scenario: Volver al calendario filtrado

- **WHEN** el usuario, en la vista de calendario con la búsqueda «tazas», abre un pedido y pulsa la miga «Pedidos»
- **THEN** vuelve al calendario con la búsqueda «tazas» aplicada

#### Scenario: De la edición a la lista con filtros

- **WHEN** el usuario, desde la vista de lista con «Ver archivados» activo, abre un pedido, pulsa «Editar» y luego la miga «Pedidos»
- **THEN** vuelve a la vista de lista con «Ver archivados» activo

#### Scenario: Enlace directo

- **WHEN** el usuario abre el detalle de un pedido desde un enlace compartido y pulsa «Pedidos»
- **THEN** llega a la pantalla de pedidos sin filtros, en su vista por omisión

#### Scenario: Origen ajeno ignorado

- **WHEN** la dirección de un detalle de pedido declara como origen una dirección que no es la pantalla de pedidos
- **THEN** la miga «Pedidos» lleva a la pantalla de pedidos sin filtros

### Requirement: Migas legibles en móvil

En pantallas angostas, la ruta de migas SHALL ocupar una sola línea sin desplazamiento horizontal de la página: el último tramo SHALL recortarse con puntos suspensivos cuando no quepa, y los tramos enlazados SHALL seguir visibles y con un área táctil de al menos 44 × 44 px.

#### Scenario: Título largo en un teléfono

- **WHEN** en un viewport de 390 px se abre el detalle de una tarea con un título de 80 caracteres
- **THEN** la miga «Tareas» es visible y pulsable, el título en la miga se recorta con puntos suspensivos y la página no se desplaza horizontalmente
