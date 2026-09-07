# KAM-15 · Tareas: modelo y tablero

## Why

Kamay ya registra el dinero y el trabajo comprometido con clientes: pedidos, egresos, cobros, feria y captura móvil. Lo que sigue viviendo fuera del sistema es **el pendiente propio** — «revisar el filamento», «preparar la feria de agosto», «diseñar el arte del #142» —, que hoy está en un cuaderno, en un chat o en la cabeza de quien lo pensó. El Principio 3 de la especificación dice que lo que se piensa y lo que se hace viven juntos; hasta esta tarea, solo vive lo que se hace.

El riesgo de construirlo mal está nombrado en la propia especificación: **que el tablero de tareas se convierta en un segundo tablero de pedidos**. Si un cambio de estado de pedido generase una tarea, o si una tarea cerrada moviese un pedido, el taller acabaría con dos tableros que dicen lo mismo a destiempo y nadie sabría cuál mirar. Por eso la regla no es una preferencia de diseño sino la convención nº 10 del proyecto: **un pedido nunca genera una tarea automáticamente**, y la única vía es la acción explícita del usuario.

Este cambio construye el modelo de tarea y su tablero (V17): columnas resueltas por el mismo `resolve_statuses` que ya sirve a los pedidos, arrastre en ambos sentidos —volver de *En revisión* a *Por hacer* es lo normal, no una excepción a justificar—, alta en tres interacciones, y la acción *Crear tarea para este pedido* que deja la decisión donde corresponde.

> **Posición en la secuencia.** El backlog sitúa KAM-15 en la fase 2 dependiendo solo de KAM-05, que está archivada: el flujo `task` de `statuses`, su resolución por línea y los cuatro estados sembrados de Geeko Store existen desde entonces y **no se rehacen aquí**. KAM-14 (panel) está en curso en paralelo y no comparte requisito con este cambio; KAM-16 (detalle V18) ya está propuesto **dando por supuesto** todo lo que esta tarea construye. Ver los supuestos registrados al final.

## What Changes

### Modelo de tarea

- **Tabla `tasks` con su DDL canónico completo**, incluidas las columnas que llenan las tareas siguientes (`body_markdown` en KAM-16, `remind_at` en KAM-17, `closed_without_deliverables` en KAM-21). Se crean inertes en una sola migración en vez de en cuatro `alter table` sucesivos, y KAM-16 ya está escrita contando con que `body_markdown` exista.
- **Título y línea bastan para guardar**: el resto es opcional. `business_line_id` es `not null`, como en todo registro económico del sistema (§Modelo conceptual: toda tarea pertenece a una línea).
- **El estado inicial lo asigna la base**, resolviendo el juego que aplica a la línea con `resolve_statuses(org, line, 'task')` y tomando el de `kind = 'initial'`. Ningún nombre de estado aparece en el código (convención nº 5).
- **`closed_at` es derivado de la posición, no un campo que se edite**: un trigger lo escribe al entrar en un estado de tipo `final` y lo borra al salir. Arrastrar hacia atrás desde *Hecho* deja la tarea abierta otra vez, sin rastro raro.
- **Tablas `tags` y `task_tags`**: etiquetas por organización, creadas al vuelo desde el buscador, con la misma normalización de búsqueda tolerante a tildes que ya usa el catálogo.
- **`membership_lines`**: la tabla auxiliar que el esquema §16 deja planteada y que ninguna tarea anterior necesitó. Es lo que da sentido a «su línea» en el criterio de visibilidad del ayudante.
- **`task_links` en su forma mínima**: la tabla con su DDL canónico y su trigger de validación, pero con una sola vía de escritura —la acción *Crear tarea para este pedido*— y ninguna interfaz de vínculos. El buscador único, los bloques *Tareas relacionadas* en pedido, ítem y contacto, y los otros cuatro tipos vinculables son de KAM-21.

### Visibilidad del ayudante por línea

- **El dueño asigna líneas a un ayudante** desde Configuración → Miembros. Es la traducción de «su línea», que hasta hoy no existía en ninguna tabla.
- **Un ayudante sin líneas asignadas ve todas**: la asignación es una restricción que se declara, no un permiso que se concede. Encender la tabla no puede dejar a ciegas al ayudante que ya trabaja en las tres líneas.
- **La regla la aplica RLS, no la aplicación**: el ayudante ve las tareas de sus líneas, las de la línea compartida y las asignadas a él, cualquiera sea la línea. El dueño ve todas. Ninguna consulta de `services/` reimplementa el recorte.

### V17 · Tablero de tareas (`/tasks`)

- **Columnas resueltas dinámicamente** por el juego de estados de la línea activa, en su orden declarado — el mismo mecanismo del tablero de pedidos, sin una segunda lista de estados en ninguna parte.
- **Arrastre en ambos sentidos sin advertencias ni efectos secundarios**: mover de *En revisión* a *Por hacer* es un cambio de estado y nada más. No hay confirmación, no hay aviso, no se toca ningún otro registro.
- **Vistas lista y calendario** sobre el mismo conjunto, con la vista y los filtros viviendo en la dirección para que el tablero sea enlazable.
- **Filtros por responsable, etiqueta y estado**, más el selector global de línea y «Ver archivados». El filtro por vínculo es de KAM-21.
- **Color de línea en cada tarjeta** cuando el selector está en «Todas», leído del token de la línea como en el resto del sistema.
- **En el celular el tablero no es la puerta**: la tercera ranura de la barra inferior sigue apuntando a *Mis pendientes* (V20, KAM-17), y `/tasks` queda como vista alcanzable pero no como destino por omisión. En el menú de escritorio, en cambio, *Tareas* pasa a abrir el tablero, que es lo que el mapa §4.1 pide para el grupo *Trabajo*.

### Alta de tarea

- **Alta rápida en el tablero**: *+ Nueva tarea* → escribir el título → confirmar. Tres interacciones, con la línea tomada del selector activo y el estado inicial puesto por la base.
- **Formulario de alta en `/tasks/new`** para cuando hace falta más que el título: responsable, fecha límite y etiquetas. Es lo que abre el destino *Tarea* de la retícula de registro rápido, que `quick-capture` dejó declarado e inerte esperando exactamente esto.
- **Panel compacto de edición desde la tarjeta** para responsable, fecha límite y etiquetas, que es el alcance de edición que pide el backlog. La pantalla de detalle completa (V18, con Markdown, adjuntos e historial) es de KAM-16 y **este cambio no crea `/tasks/[id]`**.

### *Crear tarea para este pedido*

- **Acción explícita en el detalle del pedido (V4)** que abre el formulario de alta prellenado con la línea del pedido, el vínculo al pedido, el cliente como contexto y una fecha límite sugerida anterior a la de entrega. **Todo es modificable**, incluida la fecha y el propio vínculo.
- **Ninguna sincronización, en ningún sentido**: cambiar el estado de un pedido no crea, mueve ni cierra ninguna tarea, y cerrar una tarea no mueve ningún pedido. Se verifica con una prueba que lo comprueba contando filas, no leyendo la interfaz.

**Fuera de alcance** (copiado del backlog):
- Descripción Markdown y adjuntos (KAM-16).
- Vínculos y entregables (KAM-21).
- Horas estimadas, dependencias entre tareas, comentarios, Gantt.
- **Cualquier sincronización automática entre pedidos y tareas.**

Derivado de lo anterior, tampoco entran: la pantalla `/tasks/[id]` y la edición campo a campo (KAM-16); `task_deliverables`, el cierre con entregables V19 y los bloques *Tareas relacionadas* en pedido, ítem y contacto (KAM-21); *Mis pendientes* V20, los recordatorios y los avisos (KAM-17), aunque `remind_at` se cree ahora como columna inerte; el flujo `task` de `statuses` y su semilla, ya construidos en KAM-05; y la captura de tareas sin conexión, que la cola de KAM-11 no cubre y este cambio no amplía.

## Capabilities

### New Capabilities

- `tasks`: el modelo de tarea —tabla, estado inicial resuelto, cierre derivado de la posición, etiquetas y vínculo al pedido en su forma mínima—, la visibilidad por rol y línea, el tablero V17 con sus tres vistas y sus filtros, el alta rápida y el formulario de alta, y la acción *Crear tarea para este pedido* con su garantía de no sincronización.

### Modified Capabilities

- `user-management`: se añade el requisito de **asignación de líneas a una membresía**. Hasta hoy una membresía solo tenía rol; «su línea» no existía en ninguna tabla y el criterio de visibilidad del ayudante no era expresable.
- `quick-capture`: cambia el requisito *La pantalla de registro rápido ofrece seis destinos*. El destino **Tarea** deja de estar inerte y abre el alta de tarea; solo Consumo (KAM-18) sigue esperando. El menú *+ Registrar* lo hereda sin tocarlo, porque sale de la misma declaración.
- `orders`: cambia el requisito *Detalle del pedido*, que suma la acción *Crear tarea para este pedido* y la garantía explícita de que ningún cambio de estado del pedido produce una tarea.

## Impact

**Código afectado**

- `supabase/migrations/` — una migración nueva: `tasks`, `tags`, `task_tags`, `task_links`, `membership_lines`, sus índices, el trigger de `closed_at`, el de validación de vínculos, los `audit` y las políticas de RLS de las cinco tablas.
- `app/(app)/tasks/page.tsx` y `app/(app)/tasks/new/page.tsx` — el tablero y el alta. **No** `app/(app)/tasks/[id]/`, que es de KAM-16.
- `features/tasks/board/` — tablero, tarjeta, vistas lista y calendario, filtros, alta rápida en columna y panel compacto de edición.
- `features/tasks/task-form.tsx` — formulario de alta, compartido por `/tasks/new` y por el prellenado desde el pedido.
- `components/board/` — el cascarón de arrastre que hoy vive dentro de `features/orders/board-view.tsx` se extrae para que los dos tableros compartan mecánica; la cola y sus posiciones se quedan en pedidos, que es el único flujo que las usa.
- `actions/tasks.ts` y `services/tasks/task-service.ts` — nuevos. KAM-16 ya está escrita contando con que existan y les añadirá lo suyo.
- `actions/members.ts` y `features/settings/` — la asignación de líneas a una membresía.
- `features/orders/order-detail.tsx` — la acción *Crear tarea para este pedido*.
- `components/layout/nav-entries.ts` — la entrada *Tareas* pasa a abrir `/tasks` en escritorio conservando `/my-tasks` en la ranura móvil.
- `lib/quick-capture/destinations.ts` — el destino *Tarea* gana su `href` y pierde su `availableFrom`.
- `lib/tasks/` — sugerencia de fecha desde el pedido, normalización de etiquetas y semáforo de vencimiento: lógica pura, cubrible al 90 %.

**Se lee pero no se modifica:** `resolve_statuses` y todo `configurable-statuses` (KAM-05); `lib/business-lines/colors.ts`; `lib/catalog/` para la normalización de búsqueda tolerante a tildes; `features/orders/` salvo el detalle y la extracción del cascarón de arrastre.

**Base de datos:** cinco tablas nuevas y ningún valor derivado almacenado. `closed_at` no es una excepción: no resume ni agrega nada, registra el instante de un hecho, igual que `queued_at` en pedidos. KAM-14 añade en paralelo una vista de flujo de caja en otra migración; los dos archivos no se tocan.

**Dependencias nuevas:** ninguna. `@dnd-kit` ya está instalado desde KAM-07.

**Pruebas:** unitarias sobre la validación mínima del alta, el prellenado desde el pedido, la fecha sugerida, la normalización de etiquetas y el reparto de la entrada de navegación entre superficies; pgTAP sobre la visibilidad de tareas por rol y línea, la ausencia de `DELETE`, el aislamiento entre organizaciones y el trigger de `closed_at`; e2e sobre el alta en tres interacciones o menos —con la medición registrada—, el arrastre hacia atrás y la comprobación de que un cambio de estado de pedido no crea ninguna tarea.

## Supuestos registrados

1. **`membership_lines` se crea en esta tarea.** El backlog no la menciona y el esquema §16 la deja como decisión abierta («requiere una tabla auxiliar si se decide restringir ayudantes por línea»). El criterio de aceptación nº 5 la exige: sin ella, «su línea» no significa nada y el criterio solo podría cumplirse a medias. Se crea aquí, con su pantalla de asignación, porque es la primera tarea que la necesita.
2. **Un ayudante sin líneas asignadas ve todas las líneas.** La lectura contraria —sin asignación no ve nada— dejaría a ciegas al ayudante de Geeko Store en el momento de aplicar la migración, sin que nadie hubiese pedido restringirlo. La restricción se declara explícitamente; su ausencia no es una restricción total.
3. **La línea compartida siempre es visible.** Un ayudante restringido a Alfarería sigue viendo las tareas de General/Compartido: lo transversal es de todos por definición (§Modelo conceptual), y ocultarlo convertiría la línea compartida en un agujero negro para quien tiene líneas asignadas.
4. **`task_links` se crea completa y se usa mínima.** La tabla lleva su `check` con los cinco tipos canónicos, pero en KAM-15 solo se escribe `entity_type = 'order'` y solo desde una acción. Crearla ahora es lo que permite que el criterio nº 4 se cumpla de verdad —el vínculo queda guardado— sin absorber la interfaz de vínculos de KAM-21, y evita que las tareas creadas antes de KAM-21 nazcan huérfanas de la relación que las originó.
5. **La tarjeta del tablero no abre una página de detalle en esta tarea.** KAM-16 declara `app/(app)/tasks/[id]/page.tsx` como página nueva suya; crearla aquí sería disputarse el mismo archivo. La tarjeta abre un panel compacto con responsable, fecha límite y etiquetas —el alcance de edición que pide el backlog—, y KAM-16 sustituye ese destino por V18. Si al implementar KAM-16 se prefiere conservar el panel para el móvil, esa propuesta se actualiza; este cambio no depende de ello.
6. **El alta rápida con el selector en «Todas» usa la línea compartida.** El criterio nº 7 exige tres interacciones o menos y la línea es obligatoria, así que con «Todas» activa hay que resolverla sin preguntar. General/Compartido es exactamente lo que la especificación reserva para lo transversal, y queda visible y modificable en la tarjeta recién creada. Elegir la primera línea de la lista, en cambio, archivaría la tarea en un sitio arbitrario sin decirlo.
7. **El cascarón de arrastre se extrae y el tablero de pedidos se refita sobre él.** La alternativa —copiar trescientas líneas de `dnd-kit` a `features/tasks/`— deja dos mecánicas de arrastre que divergen al primer arreglo. Las pruebas unitarias y e2e de pedidos son la red que hace verificable el refit; la cola y sus posiciones no se generalizan, porque tareas no las usa.
8. **El destino *Tarea* de V16 lo enciende esta tarea, no KAM-16.** `quick-capture` lo dejó inerte nombrando a KAM-16, pero el alta de tarea —título y línea bastan— es de KAM-15. KAM-16 ya registró el mismo supuesto desde su lado (su supuesto 2), así que las dos propuestas coinciden.
