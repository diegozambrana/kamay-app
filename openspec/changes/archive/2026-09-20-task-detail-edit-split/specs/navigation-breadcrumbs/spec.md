## ADDED Requirements

### Requirement: La miga de la lista de tareas conserva la vista de origen

Cuando se llega al detalle o a la edición de una tarea desde la pantalla de tareas o desde *Mis pendientes*, el primer tramo de las migas SHALL nombrar y enlazar la pantalla de origen —«Tareas» o «Mis pendientes»— y SHALL volver a ella con la misma vista y los mismos filtros que tenía al salir: la vista (tablero, lista o calendario), la búsqueda, el responsable, la etiqueta, el estado, el filtro de vínculo, el de tareas sin entregables, «Ver archivados» y la ventana de cerrados.

La vista de origen SHALL conservarse al pasar del detalle a la edición, al volver de la edición al detalle, y al aterrizar en el detalle tras guardar. Cuando no se llegó desde ninguna de esas dos pantallas —enlace directo, recarga, una notificación, un pedido, un ítem o un contacto— el primer tramo SHALL decir «Tareas» y llevar a la pantalla de tareas sin filtros, en su vista por omisión.

Solo SHALL aceptarse como vista de origen una dirección de la propia pantalla de tareas o de *Mis pendientes*; cualquier otra SHALL ignorarse.

#### Scenario: Volver a la lista filtrada

- **WHEN** desde la vista de lista con la búsqueda «tazas» se abre una tarea y se pulsa la miga «Tareas»
- **THEN** se vuelve a la vista de lista con la búsqueda «tazas» aplicada

#### Scenario: El origen sobrevive a la edición

- **GIVEN** la vista de lista con «Ver archivados» activo
- **WHEN** se abre una tarea, se pulsa *Editar* y luego la miga «Tareas»
- **THEN** se vuelve a la vista de lista con «Ver archivados» activo

#### Scenario: Guardar aterriza en el detalle sin perder el origen

- **GIVEN** el tablero filtrado por una etiqueta
- **WHEN** se abre una tarea, se edita el responsable, se guarda y luego se pulsa la miga inicial
- **THEN** tras guardar se está en el detalle de la tarea, y la miga devuelve al tablero con esa etiqueta filtrada

#### Scenario: Desde Mis pendientes se vuelve a Mis pendientes

- **WHEN** se abre una tarea desde *Mis pendientes*, se edita y se guarda
- **THEN** el primer tramo de las migas dice «Mis pendientes» y lleva de vuelta a esa pantalla

#### Scenario: Enlace directo

- **WHEN** se abre el detalle de una tarea desde un enlace compartido y se pulsa la miga inicial
- **THEN** se llega a la pantalla de tareas sin filtros, en su vista por omisión

#### Scenario: Origen ajeno ignorado

- **WHEN** la dirección del detalle de una tarea declara como origen una dirección que no es la pantalla de tareas ni *Mis pendientes*
- **THEN** la miga inicial lleva a la pantalla de tareas sin filtros

## MODIFIED Requirements

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
| Edición de tarea (también archivada) | Tareas › *título de la tarea* › Editar |
| Nueva compra | Egresos › Nueva compra |
| Nuevo gasto | Egresos › Nuevo gasto |
| Detalle de egreso | Egresos › *tipo del egreso* (Compra o Gasto) |
| Detalle de ítem del catálogo | Catálogo › *nombre del ítem* |
| Detalle de organización (plataforma) | Organizaciones › *nombre de la organización* |
| Detalle de usuario (plataforma) | Usuarios › *nombre o correo del usuario* |

En las pantallas de tarea, el primer tramo SHALL nombrar *Mis pendientes* en lugar de *Tareas* cuando se haya llegado desde esa pantalla, según «La miga de la lista de tareas conserva la vista de origen».

Estas migas SHALL reemplazar los enlaces de vuelta propios que hoy tienen esas pantallas («← Pedidos», «← Egresos», «← Catálogo», «Volver»), de modo que no haya dos caminos de vuelta distintos en el mismo encabezado. Las pantallas de lista, ajustes, reportes, tablero de inicio y perfil SHALL NOT mostrar migas, ni tampoco un detalle mostrado como panel lateral dentro de una lista.

#### Scenario: Detalle vuelve a la lista

- **WHEN** el usuario abre el detalle del pedido #42
- **THEN** encima del título ve «Pedidos › Pedido #42», y al pulsar «Pedidos» llega a la pantalla de pedidos

#### Scenario: Edición vuelve al detalle o a la lista

- **WHEN** el usuario abre la edición del pedido #42
- **THEN** ve «Pedidos › Pedido #42 › Editar»; «Pedido #42» lleva al detalle del pedido y «Pedidos» a la lista

#### Scenario: La edición de una tarea nombra su tarea

- **WHEN** el usuario abre la edición de una tarea titulada «Cortar tazas»
- **THEN** ve «Tareas › Cortar tazas › Editar»; «Cortar tazas» lleva al detalle de la tarea y «Tareas» a la pantalla de tareas

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
