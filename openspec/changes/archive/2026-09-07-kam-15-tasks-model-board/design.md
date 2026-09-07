# KAM-15 · Diseño

## Context

Ver `proposal.md` — Why. Lo que importa aquí es el estado del código y del esquema en el que aterriza este cambio:

- **El flujo `task` de `statuses` ya existe entero** (KAM-05): la columna `flow` admite `'order' | 'task'`, `resolve_statuses(org, line, p_flow)` devuelve el juego que aplica —propio de la línea si lo hay, de la organización si no—, la restricción de juego válido corre por flujo y por alcance, y la semilla de Geeko Store trae los cuatro estados de tarea como juego de organización: Por hacer (`initial`) · Haciendo (`in_progress`) · En revisión (`waiting`) · Hecho (`final`). **Este cambio no escribe una sola línea de configuración de estados.**
- **El tablero de pedidos ya resuelve el mismo problema** en `features/orders/board-view.tsx` (313 líneas): `DndContext` con `PointerSensor` y activación a 6 px, columnas `useDroppable`, tarjetas `useSortable`, `DragOverlay`, y la resolución de «soltar sobre columna o sobre tarjeta». Encima, `features/orders/board-store.ts` guarda el movimiento en vuelo y lo revierte si el servidor lo rechaza — un store genérico cuyas claves ya son solo identificadores.
- **`memberships` solo tiene rol.** No hay ninguna tabla que relacione una membresía con una línea; `is_member()` e `is_owner()` son los únicos ayudantes de seguridad. El esquema §16 deja `memberships_lines` planteada y sin decidir.
- **El patrón de búsqueda tolerante a tildes está fijado** (KAM-06): extensión `unaccent`, función `immutable_unaccent(text)`, columna generada `search_name` en `items` y `contacts`, y `lib/search/normalize.ts` con la misma regla del lado del cliente.
- **`enforce_archive_rules()` y `log_activity()` son genéricos** desde KAM-06 y KAM-03: se enganchan por trigger a cada tabla nueva. `log_activity()` lee `organization_id` y `business_line_id` de la propia fila.
- **`attachments` ya admite `entity_type = 'task'`** desde KAM-06b. Este cambio no lo usa —los adjuntos son de KAM-16— pero tampoco lo estorba.
- **La retícula de registro rápido declara sus destinos como datos** en `lib/quick-capture/destinations.ts`, con `availableFrom` para los que aún no existen. *Tarea* es uno de ellos.
- **La navegación sale de una sola declaración** (`components/layout/nav-entries.ts`), con el precedente de `barLabel`: la misma entrada dicha con la palabra que corresponde a cada superficie. La entrada *Tareas* existe hoy y apunta a `/my-tasks` en las dos superficies.
- **KAM-16 ya está propuesta** y declara como suyos `app/(app)/tasks/[id]/page.tsx`, `features/tasks/detail/`, `features/tasks/editor/` y `features/tasks/attachments/`, y da por creados `actions/tasks.ts`, `services/tasks/task-service.ts` y `tasks.body_markdown`. Este diseño respeta ese reparto al pie de la letra.
- **KAM-14 corre en paralelo** y modifica `user-auth` → *Authenticated shell frames every app screen* y `quick-capture` → *Registrar está a dos toques*. Ninguno de los dos requisitos se toca aquí (D9).

## Goals / Non-Goals

**Goals**

- Que el tablero de tareas y el de pedidos compartan mecánica de arrastre sin compartir semántica: las columnas salen del mismo resolvedor, la cola sigue siendo solo de pedidos.
- Que «su línea» pase de frase del backlog a fila de una tabla, y que el recorte lo aplique RLS, no una condición en `services/`.
- Que la no sincronización entre pedidos y tareas sea verificable contando filas, no leyendo pantallas.
- Que el alta quepa en tres interacciones sin que eso obligue a inventar una línea por omisión arbitraria.
- Dejar el esquema de tareas completo en una migración, para que KAM-16, KAM-17 y KAM-21 añadan comportamiento y no columnas.

**Non-Goals**

- No se define nada de V18: ni la página, ni la edición campo a campo, ni el Markdown, ni los adjuntos. La ranura `app/(app)/tasks/[id]/` se deja libre para KAM-16.
- No se generaliza la cola. `is_queue` puede marcarse en un estado de tarea —la restricción de la base lo permite— pero el tablero de tareas no pinta posiciones ni ordena por llegada, y ninguna prueba lo exige.
- No se toca la configuración de estados ni su pantalla.
- No se amplía la cola de captura sin conexión de KAM-11 a las tareas.

## Decisions

### D1 · La tabla `tasks` se crea con su DDL canónico completo, columnas inertes incluidas

`tasks` nace con `body_markdown`, `remind_at`, `closed_at`, `closed_without_deliverables` y su restricción `reminder_needs_due_date`, aunque KAM-15 solo escriba una parte.

*Por qué:* la convención nº 6 prohíbe editar una migración existente, así que la alternativa es una migración con `alter table` por cada tarea posterior — cuatro archivos para llegar al mismo sitio, con la restricción `reminder_needs_due_date` separada de la columna que restringe. Además KAM-16 **ya está escrita** declarando «ninguna migración» y contando con que `body_markdown` exista: crearla aquí es lo que sostiene esa propuesta.

*Alternativa descartada:* crear solo lo que esta tarea usa. Es más limpio en abstracto y obliga a tres migraciones más en concreto, cada una con su prueba pgTAP para añadir una columna.

*Límite:* inerte significa que **nada la escribe y nada la lee** en este cambio. `closed_without_deliverables` se queda en su `default false` hasta KAM-21; ninguna consulta de KAM-15 la menciona.

### D2 · `closed_at` lo mantiene un trigger, no la aplicación

Un trigger `before update` sobre `tasks` escribe `closed_at = now()` cuando el nuevo estado es de `kind = 'final'` y lo pone a `null` cuando deja de serlo. Actúa **solo si cambia `status_id`**, igual que `maintain_order_queued_at` en pedidos.

*Por qué:* es la misma clase de dato que `queued_at` —el instante de un hecho, no un agregado— y la convención nº 4 no lo alcanza. Ponerlo desde `actions/` significaría que cada vía de escritura futura (el detalle de KAM-16, el cierre de KAM-21, un cambio desde *Mis pendientes*) tendría que acordarse de hacerlo, y la que se olvide dejará tareas cerradas sin fecha de cierre.

*Consecuencia buscada:* arrastrar desde *Hecho* hacia atrás **reabre** la tarea sin ningún código que lo pida. El criterio nº 2 —volver atrás sin efectos secundarios— se cumple por construcción, no por una rama que alguien recordó escribir.

*Comparado por `kind`, nunca por nombre* (convención nº 5): el trigger lee `kind` de `statuses`, y por eso una organización que renombre *Hecho* a *Entregado* no rompe nada.

### D3 · El estado inicial lo asigna la base, resolviendo el juego de la línea

Un trigger `before insert` deja pasar `status_id` si viene puesto y, si no, lo resuelve con `resolve_statuses(new.organization_id, new.business_line_id, 'task')` tomando el de `kind = 'initial'` con menor `position`.

*Por qué:* es el patrón que ya usa el alta de pedido —«el alta es una sola operación y el estado inicial lo asigna la base»— y es lo que permite que el alta rápida mande dos campos, título y línea, sin que el cliente tenga que consultar antes cuál es el estado inicial de esa línea. También cierra la puerta a que dos vías de alta resuelvan el estado inicial de forma distinta.

*Alternativa descartada:* resolverlo en `actions/tasks.ts`. Añade un viaje a la base antes del `insert` y deja la regla en un sitio donde el formulario prellenado desde el pedido tendría que repetirla.

### D4 · `membership_lines`, y la ausencia de filas significa «todas»

```
membership_lines (
  membership_id    uuid not null references memberships(id),
  business_line_id uuid not null references business_lines(id),
  organization_id  uuid not null references organizations(id),
  primary key (membership_id, business_line_id)
)
```

La visibilidad la decide una función `security definer` estable, `has_line_access(org uuid, line uuid) returns boolean`, que devuelve verdadero si (a) la membresía del usuario en esa organización **no tiene ninguna línea declarada**, (b) la línea está entre las declaradas, o (c) la línea es la compartida (`business_lines.is_shared`).

*Por qué la ausencia es permisiva:* la migración se aplica sobre una organización en marcha donde el ayudante trabaja en las tres líneas y nadie ha pedido restringirlo. Si «sin filas» significara «sin acceso», aplicar la migración lo dejaría a ciegas hasta que alguien entrase a Configuración a devolverle lo que ya tenía. Una restricción se declara; su ausencia no es una restricción total.

*Por qué la línea compartida siempre entra:* General/Compartido es donde vive lo transversal por definición del modelo conceptual. Un ayudante restringido a Alfarería que no viera las tareas compartidas tendría un agujero exactamente donde está lo que le concierne a todos.

*Por qué una función y no la condición en línea:* la política de `tasks`, la de `task_tags`, la de `task_links` y las consultas de `services/` necesitan la misma regla. Escrita una vez, `security definer`, con `search_path` fijo — el patrón exacto de `is_member()` e `is_owner()`.

*Desviación del DDL canónico, declarada:* el esquema §16 la nombra `memberships_lines`. Se escribe `membership_lines` —las líneas de una membresía—, que es la forma que sigue el resto del esquema (`order_items`, `task_tags`, `expense_items`: el primer término en singular califica al segundo). Se anota aquí porque la convención del proyecto es que toda desviación del DDL canónico quede escrita en la propia migración, como hicieron `item_variants` y `order_items` con su `organization_id`.

*`organization_id` en la tabla:* redundante con `memberships`, y presente por la misma razón que en `order_items` — la convención nº 2 lo exige en toda tabla, y `log_activity()` lo lee de la propia fila.

### D5 · La política de `tasks` es la del esquema §16, con `has_line_access` en el hueco que dejó abierto

```sql
create policy "tasks: leer" on tasks for select to authenticated
using (
  is_owner(organization_id)
  or (is_member(organization_id)
      and (assignee_id = auth.uid()
           or has_line_access(organization_id, business_line_id)))
);
```

Las políticas de `insert` y `update` llevan la misma condición en su `with check`: el ayudante crea y edita tareas dentro de lo que ve (matriz §16: *solo de su línea o asignadas a él*), y archivar sigue siendo del dueño por el trigger genérico `enforce_archive_rules()`. No hay política de `DELETE` en ninguna de las cinco tablas.

*El `or assignee_id = auth.uid()` va primero a propósito:* una tarea asignada a alguien la ve esa persona **aunque sea de una línea que no le toca**. Es el caso de «te encargo esto de Alfarería aunque tú lleves 3D», que el criterio nº 5 nombra explícitamente con su «o asignadas a él».

*`task_tags` y `task_links` heredan la visibilidad de su tarea* con un `exists` sobre `tasks`, que a su vez aplica la política de arriba. `tags` es legible por todo miembro: es una lista de nombres de la organización, sin nada sensible, y el ayudante la necesita para etiquetar.

### D6 · El cascarón de arrastre se extrae; la cola se queda en pedidos

Se crea `components/board/kanban-board.tsx` con lo que los dos tableros hacen igual: sensores, columnas soltables, `DragOverlay`, resolución de «soltar sobre columna o sobre tarjeta» y la llamada al movimiento. Recibe columnas, elementos, un `renderCard` y un `onMove`, más un `onReorder` opcional. `features/orders/board-view.tsx` se refita sobre él conservando `queuePositions` y `sortByArrival`, que son suyos. El store optimista pasa a `stores/board-store.ts` con nombres neutros (`recordId`) y lo usan los dos.

*Por qué se refita pedidos y no se copia el archivo:* dos mecánicas de arrastre separadas divergen en el primer arreglo, y el que se arregle en un tablero no llegará al otro. Las pruebas unitarias de `board-store`, `order-card` y `orders-screen`, más el e2e del tablero, son la red que hace verificable el refit: si el tablero de pedidos sigue verde, la extracción fue fiel.

*Alternativa descartada:* un componente genérico que también absorba la cola. Metería el concepto de posición de llegada en un tablero que no lo tiene, con un parámetro que en tareas siempre valdría lo mismo.

*Orden de trabajo:* la extracción y el refit van **antes** de construir el tablero de tareas, para que el cascarón nazca probado por el consumidor que ya existe.

### D7 · El alta rápida resuelve la línea sin preguntar, y con «Todas» usa la compartida

El compositor vive en la cabecera de la columna inicial: activar *+ Nueva tarea*, escribir el título, confirmar con Enter. Tres interacciones. La línea sale del selector global —que `business-line-context` ya preselecciona en los formularios de creación— y, cuando el selector está en «Todas», se usa la línea compartida de la organización.

*Por qué la compartida y no la primera de la lista:* una tarea anotada mientras se miran todas las líneas es, por definición, una que todavía no se ha adscrito a ninguna; eso es exactamente General/Compartido. Elegir la primera línea la archivaría en Sublimación sin decírselo a nadie. La línea queda visible en la tarjeta y es modificable desde el panel compacto, así que corregirla no cuesta nada.

*Si la organización no tuviera línea compartida:* el compositor pide la línea y el alta pasa a cuatro interacciones. Es una degradación honesta y no un fallo; Geeko Store tiene la suya desde la semilla de KAM-04.

*La medición del criterio nº 7 se registra en el e2e*: la prueba cuenta las interacciones que ejecuta y las afirma, en vez de comprobar solo que la tarea se creó.

### D8 · *Crear tarea para este pedido*: una acción, un prellenado, ningún acoplamiento

La acción del detalle del pedido navega al formulario de alta con el contexto en la dirección (`/tasks/new?orderId=…`). El servidor lee el pedido, comprueba que el usuario lo ve, y prellena línea, título sugerido, vínculo y fecha. La fecha sugerida la calcula una función pura en `lib/tasks/`: **dos días antes de la fecha comprometida del pedido**, y hoy si eso ya pasó; sin fecha comprometida, sin sugerencia. Todo es editable, incluido quitar el vínculo antes de guardar.

*Por qué el contexto viaja por la dirección y no por un store:* hace el prellenado enlazable y verificable sin montar la pantalla anterior, y deja el formulario con una sola fuente de datos iniciales.

*Por qué el vínculo se guarda al crear la tarea, en la misma transacción:* si se guardase después, una tarea creada desde un pedido podría quedar sin vínculo por un fallo de red, y no habría forma de saber cuáles — la interfaz que lo repararía es de KAM-21.

*Lo que esta decisión NO permite:* ninguna escritura en `tasks` disparada por `orders`, ni al revés. No hay trigger entre las dos tablas, y el diseño no deja ningún sitio donde ponerlo. La prueba que lo fija cuenta filas de `tasks` antes y después de mover un pedido por todos sus estados.

### D9 · La entrada de navegación gana `barHref`, y `user-auth` no se toca

`NavEntry` suma un campo opcional `barHref`, exactamente paralelo al `barLabel` que ya existe: la entrada *Tareas* declara `href: "/tasks"` y `barHref: "/my-tasks"`. El menú de escritorio abre el tablero (mapa §4.1, grupo *Trabajo*); la ranura móvil sigue abriendo *Mis pendientes* (§4.2 y §11: en el celular V17 se reemplaza por V20). `isNavEntryActive` recibe el href de la superficie que la rinde.

*Por qué no dos entradas:* dos entradas pondrían *Tareas* dos veces en el panel «Más» del celular, y el mapa dice que en móvil el tablero no es un destino de menú.

*Por qué `user-auth` no cambia:* su requisito *Authenticated shell frames every app screen* habla del cascarón y de la declaración única, no de la lista de entradas; ningún escenario suyo cambia de resultado. Es además el requisito que **KAM-14 está modificando ahora mismo** para añadir la campana: no tocarlo evita que dos cambios reescriban el mismo bloque y que el segundo en archivarse pise al primero. El requisito de que *Tareas* abra el tablero en escritorio vive en la capacidad `tasks`, que es de quien es.

### D10 · Etiquetas: creación al vuelo con el patrón de búsqueda del catálogo

`tags` lleva `search_name` como columna generada `immutable_unaccent(lower(name))`, igual que `items` y `contacts`, y `unique (organization_id, name)`. El selector busca contra esa columna y ofrece *crear «hornada-07»* cuando no hay coincidencia — el mismo gesto que el catálogo ya usa para crear un contacto al vuelo. `lib/search/normalize.ts` prepara el término del lado del cliente, sin una segunda regla de normalización.

*Por qué no una lista cerrada administrada en Configuración:* las etiquetas son agrupación transversal y efímera (`hornada-07`, `feria-agosto`); obligar a darlas de alta antes de usarlas es la forma segura de que nadie las use.

*El `unique` es sobre `name`, no sobre `search_name`:* «Hornada-07» y «hornada-07» son la misma para buscar y distintas para guardar. Unificarlas en la escritura obligaría a decidir qué mayúsculas gana; el selector, que busca normalizado, ya ofrece la existente antes de que nadie escriba la variante.

### D11 · Las tres vistas y los filtros viven en la dirección

Tablero, lista y calendario se eligen con `?view=`, y responsable, etiqueta, estado, búsqueda y «Ver archivados» viajan como parámetros, exactamente como en `features/orders/orders-screen.tsx`. Cambiar de vista conserva los filtros porque nunca salieron de la dirección.

*Por qué se repite el patrón en vez de generalizarlo:* la pantalla de pedidos y la de tareas comparten forma pero no filtros —una tiene cobros y modo de entrega, la otra responsable y etiquetas—, y la abstracción que las cubriera a las dos tendría más parámetros que código. Lo que sí se comparte es el cascarón de arrastre (D6), que es donde estaba la duplicación cara.

### D12 · El panel compacto de la tarjeta, y la ranura de V18 que se deja libre

La tarjeta abre un `Sheet` con responsable, fecha límite y etiquetas — el alcance de edición que pide el backlog. No se crea `app/(app)/tasks/[id]/`.

*Por qué:* KAM-16 declara esa página como suya y construye ahí la edición campo a campo. Crearla aquí como cascarón sería disputarse el archivo y obligaría a KAM-16 a reescribirlo entero. El panel, en cambio, es una superficie que KAM-16 puede sustituir por una navegación con una línea de cambio.

*Riesgo aceptado:* si KAM-16 se retrasa, las tareas se editan por panel más tiempo del previsto. Es funcional y completo para lo que KAM-15 promete; lo que falta —Markdown, adjuntos, historial— no cabía en esta tarea de todos modos.

## Risks / Trade-offs

- **[El refit del tablero de pedidos rompe algo que las pruebas no cubren]** → La extracción va primero y en su propio bloque de tareas, con `test:unit` y el e2e de pedidos como puerta antes de tocar nada de tareas. Si el refit no puede dejarse verde, la señal es que la extracción no era fiel y hay que revisar D6, no seguir adelante con dos mecánicas.
- **[La política de `tasks` es la más compleja del proyecto y una condición mal puesta filtra tareas entre líneas]** → Se prueba en pgTAP con la matriz completa: dueño, ayudante sin líneas, ayudante con una línea, tarea asignada de otra línea, línea compartida, y otra organización. La función `has_line_access` se prueba aparte de la política, para que un fallo diga cuál de las dos falló.
- **[Las columnas inertes de D1 invitan a que alguien las use antes de tiempo]** → Cada una lleva en la migración el comentario de qué tarea la enciende, y ninguna consulta de este cambio las nombra. El delta spec no declara ningún escenario sobre ellas: si aparece uno, es que el alcance se movió.
- **[La ausencia de filas en `membership_lines` significando «todas» puede leerse al revés en una revisión futura]** → Queda escrito en la migración, en el delta spec de `user-management` con su escenario propio, y probado en pgTAP: un ayudante sin líneas ve las tres.
- **[`membership_lines` se solapa con lo que KAM-14 hace en Configuración]** → KAM-14 no toca `features/settings/members-section.tsx` ni `actions/members.ts`; su alcance es el panel V2 y sus vistas. El solape real es cero, pero conviene fusionar en el orden del backlog.
- **[Dos cambios en paralelo añaden una migración cada uno]** → Los dos archivos son nuevos y distintos, y la convención nº 6 prohíbe editar los existentes, así que no hay conflicto de contenido. El único cuidado es que la marca de tiempo del nombre respete el orden de fusión.
- **[La línea compartida como omisión del alta rápida puede acumular tareas sin adscribir]** → Es visible en la tarjeta con su color y filtrable como cualquier otra línea, así que el montón se ve. La alternativa —preguntar siempre— incumple el criterio nº 7.

## Migration Plan

1. **Una sola migración** `supabase/migrations/<ts>_tasks.sql`, en el orden que fija el esquema §18 (`010_tasks`): `membership_lines` y `has_line_access()` primero —la política de `tasks` depende de la función—, luego `tasks`, `tags`, `task_tags` y `task_links`, sus índices, sus triggers (`assign_initial_task_status`, `maintain_task_closed_at`, `validate_task_link`, `enforce_archive`, `audit`), sus privilegios y sus políticas.
2. **Sin datos que migrar**: las cinco tablas nacen vacías y ninguna tabla existente cambia de forma. La semilla de Geeko Store puede sumar un par de tareas de ejemplo, pero ninguna prueba depende de ellas: toda prueba crea su propia organización.
3. **`graphify .` tras la migración** (convención nº 6), con `graphify-out/` versionado en el mismo commit.
4. **Vuelta atrás:** revertir el commit y `supabase db reset`. No hay estado que preservar en ninguna de las cinco tablas, y ninguna tabla anterior queda alterada — es lo que hace que la vuelta atrás sea limpia y la razón de que `membership_lines` sea una tabla nueva en vez de una columna en `memberships`.
