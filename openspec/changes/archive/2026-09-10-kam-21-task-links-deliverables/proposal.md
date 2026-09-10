# KAM-21 · Vínculos y entregables de tareas

## Why

Cerrar una tarea en Kamay hoy no deja nada. «Set de 6 tazas artesanales» pasa a *Hecho*, la tarjeta cambia de columna, y el catálogo sigue sin las seis tazas. «Revisar filamento» se cierra y la compra sigue sin registrarse. El trabajo ocurrió; el sistema solo sabe que alguien movió un rectángulo.

Ese hueco tiene dos mitades y esta tarea cierra las dos.

La primera es el **vínculo**: una tarea que nació de un pedido debería poder decirlo, y ese pedido debería poder decir que existe la tarea. KAM-15 guardó el vínculo desde el primer día —*Crear tarea para este pedido* escribe su fila en `task_links`— pero nadie puede verlo, ni añadir otro, ni quitarlo: no hay buscador de vínculos, y ningún pedido, ítem o contacto muestra qué tareas lo referencian. El dato está y la relación es invisible.

La segunda es el **entregable**: declarar al empezar qué debe existir al terminar, y que al cerrar la tarea el sistema ofrezca crearlo con lo que ya sabe. No obligarlo —el asistente es una oferta, no un peaje—, pero tampoco hacer que la persona vuelva a escribir el título, la línea y las notas que ya escribió, ni que vuelva a subir las fotos que ya subió.

La ambición se mide, como en KAM-16, en lo que evita: que cerrar una tarea signifique después abrir tres pantallas más a mano y recordar de memoria lo que había en ella.

> **Posición en la secuencia.** El backlog sitúa a KAM-21 tras KAM-17 y KAM-18, y ambas —junto con KAM-19 y KAM-20— **se implementaron y archivaron mientras esta propuesta se escribía**. La secuencia del backlog queda respetada sin esfuerzo, y el activo, que se había aparcado, entra (supuesto 2). Lo que esta tarea presupone: `tasks`, `task_links` y el tablero V17 (KAM-15), el detalle V18 con su Markdown y sus adjuntos (KAM-16), el catálogo y el directorio (KAM-06), los egresos de compra y de gasto (KAM-09), los pedidos con su detalle (KAM-07, KAM-08) y los activos con `asset_details`, la pantalla V12 y la rama `asset` de `validate_task_link()` ya operativa (KAM-19).

> **`task_links` ya existe.** KAM-15 la creó completa —el `check` de los cinco tipos, el trigger `validate_task_link()`, los tres índices, la política «según la tarea» y el `audit`— y dejó anotado que «el buscador de vínculos, los bloques *Tareas relacionadas* y los otros cuatro tipos son de KAM-21». Esta tarea **no la redefine**: la usa. La única tabla nueva es `task_deliverables`.

## What Changes

### Vínculos que se ven desde los dos lados

- **Buscador único de vínculos en V18.** Una sola caja resuelve pedidos, contactos, ítems, egresos y activos, con la misma normalización tolerante a acentos y mayúsculas que ya usan el catálogo y el directorio (`normalizeForSearch`). El resultado dice de qué tipo es cada acierto; elegirlo escribe la fila en `task_links`. Los activos solo se ofrecen a la persona dueña (supuesto 9).
- **El vínculo refleja el estado actual, no una copia.** La tarjeta de un pedido vinculado muestra el estado que el pedido tiene **ahora**. Nada del registro apuntado se copia a la tarea: se lee al rendir (convención nº 4).
- **Quitar un vínculo es quitar la relación, no el registro.** Se retira la fila de `task_links`; el pedido, el ítem o el contacto no se tocan.
- **Bloques «Tareas relacionadas» en V4 (pedido), V11 (ítem), V12 (activo) y V13 (contacto)**, cada uno listando las tareas que lo referencian con su estado y su fecha límite, y llevando al detalle de cada una. Es la mitad que faltaba de «bidireccionales y visibles desde ambos lados».
- **Archivar un registro vinculado avisa primero.** Antes de confirmar el archivado de un pedido, un ítem, un contacto o un egreso, el sistema dice qué tareas lo referencian. El archivado sigue adelante si se confirma y **ningún vínculo se rompe**: nada se borra en Kamay, y la tarea sigue mostrando el registro con su marca de archivado.

### Entregables declarados y asistente de cierre

- **Tabla `task_deliverables`** con su DDL canónico: el tipo declarado, y el trío `fulfilled_type` / `fulfilled_id` / `fulfilled_at` que registra qué se creó y cuándo.
- **Sección *Entregables esperados* en V18**: se declaran cero, uno o varios, uno por tipo. Los seis tipos del esquema son construibles: **nuevo producto**, **nuevo insumo**, **nuevo proveedor**, **compra registrada**, **gastos registrados** y **nuevo activo** —este último solo para la persona dueña—.
- **V19 · Asistente de cierre**, un diálogo que se abre al llevar la tarea a un estado de tipo `final` —desde el arrastre en V17 o desde el cambio de estado en V18— **solo si tiene entregables declarados sin cumplir**. Muestra un formulario por entregable, cada uno **prellenado desde la tarea** —título, línea, adjuntos, notas del cuerpo— y con su casilla de inclusión.
- **Tres salidas, todas legítimas**: *Crear seleccionados y cerrar*, ***Cerrar sin crear nada*** y *Cancelar*. Cerrar sin crear nada no pide justificación, no advierte y no bloquea.
- **Marca discreta de cerrada sin entregables**: `closed_without_deliverables` —la columna que KAM-15 dejó inerte a propósito— y un filtro del tablero que la encuentra. Discreta significa una señal sobria en la tarjeta y en el detalle, no una alerta.
- **Lo creado queda enlazado desde la tarea.** Cumplir un entregable escribe también su fila en `task_links`, así que el producto recién creado aparece en los vínculos de la tarea y la tarea aparece en las *Tareas relacionadas* del producto. La creación queda en la bitácora por los triggers `log_activity()` que ya llevan `items`, `contacts` y `expenses`: **no se escribe ningún historial nuevo** (convención nº 7).
- **Reabrir limpia la marca, no los registros.** Sacar la tarea de un estado `final` borra `closed_at` (ya lo hace el trigger de KAM-15) y baja `closed_without_deliverables`; lo que se creó, creado queda.

### Añadidos a lo ya construido

- **Tarjeta del tablero (V17)**: íconos de vínculos y de entregables, junto al de adjuntos, como pide la especificación de V17.
- **Filtros del tablero**: por vínculo y por *cerradas sin entregables*, sumados a los de responsable, etiqueta y estado que ya existen.

**Fuera de alcance** (copiado del backlog):
- Plantillas de tarea y tareas recurrentes.
- Entregables encadenados o condicionales.
- Justificación obligatoria al cerrar sin crear nada.

Derivado de lo anterior, tampoco entran: la tabla `task_links`, su trigger y sus políticas, ya instaladas por KAM-15, ni la rama `asset` de ese trigger, que KAM-19 ya cerró contra `asset_details`; el modelo de activos, la pantalla V12 y la barra de recuperación (KAM-19), de la que esta tarea solo suma un bloque al panel; *Mis pendientes* y los avisos (KAM-17); los movimientos de inventario que una compra genera (KAM-18), que su propio trigger recoge sin que este código los nombre; la pantalla de bitácora V23 y su filtro por tarea (KAM-22); y el bloque *Tareas relacionadas* en el detalle de egreso, que el backlog no pide —un egreso es destino de vínculo y de aviso al archivar, pero no muestra bloque—.

## Capabilities

### New Capabilities

- `task-links-deliverables`: el buscador único de vínculos y su gestión desde V18, los bloques *Tareas relacionadas* con su lectura del estado actual, el aviso al archivar un registro referenciado, la tabla `task_deliverables` con su declaración desde V18 y su regla de rol para el activo, el asistente de cierre V19 con sus formularios prellenados y sus tres salidas, la marca de cerrada sin entregables y el enlace de vuelta de cada registro creado.

### Modified Capabilities

- `tasks`: la tarjeta del tablero suma los íconos de vínculos y entregables; los filtros del tablero suman *por vínculo* y *cerradas sin entregables*; y soltar una tarea en una columna de tipo `final` con entregables declarados sin cumplir abre V19 en lugar de cerrarla en silencio —el arrastre hacia atrás sigue sin pedir nada—.
- `orders`: el detalle del pedido suma el bloque *Tareas relacionadas*.
- `catalog-directory`: el detalle de ítem (V11) deja de prohibir la sección de tareas relacionadas y pasa a mostrarla; el panel de contacto (V13) también la muestra.
- `assets`: el panel de detalle de activo (V12) suma el bloque *Tareas relacionadas*, y el requisito de vínculo a activo deja de limitarse a la validación en la base —el buscador de V18 ya lo crea, solo ante la persona dueña—.

> **Nota de coordinación, resuelta.** KAM-18 y KAM-19 modificaban el mismo requisito `Pantalla de detalle de ítem (V11)` y ambas se archivaron antes que esta tarea, dejando en el spec principal sus escenarios de inventario y de activo junto a la frase «SHALL NOT mostrar … proveedores habituales **ni tareas relacionadas**». El delta de KAM-21 se reescribió sobre ese texto ya consolidado: conserva los cuatro escenarios ajenos, recorta la prohibición a los proveedores habituales y añade los dos suyos. No queda nada pendiente de `/opsx:update` en las hermanas.

El **aviso al archivar** no se reparte en cuatro deltas: es una sola conducta —enumerar las tareas que referencian un registro antes de confirmar su archivado— que se declara una vez en la capacidad nueva, nombrando los cuatro tipos afectados. Ninguna de las capacidades de pedidos, catálogo, directorio y egresos declara hoy que archivar no avise, así que no hay nada que contradecir en ellas; repetir el requisito cuatro veces solo crearía cuatro sitios donde mantenerlo.

## Impact

**Base de datos**

- **Una migración nueva**: `task_deliverables` con su DDL canónico (§12), su `organization_id` —exigido por la convención nº 2 y por `log_activity()`, que lo lee de la propia fila—, sus privilegios sin `DELETE`, su RLS «según la tarea» heredada del patrón de `task_links`, y su trigger `audit`. Su prueba pgTAP acompaña la migración.
- **Ninguna alteración de `tasks` ni de `task_links`.** `closed_without_deliverables` ya está en la tabla desde KAM-15; esta tarea es la primera que la escribe. El `check` de `task_links` ya admite los cinco tipos.
- El trigger `validate_task_link()` conserva su rama `asset` devolviendo `false` hasta KAM-19; esta tarea no la toca y el buscador no ofrece activos.

**Código afectado**

- `services/tasks/task-service.ts` — se amplía: buscador de vínculos, listado de vínculos con el estado actual de cada destino, `unlink`, tareas que referencian un registro (para los bloques y para el aviso al archivar), declaración y cumplimiento de entregables. **Lo crearon KAM-15 y KAM-16**; aquí se le añade.
- `actions/tasks.ts` — acciones nuevas: vincular, desvincular, declarar y retirar entregables, y el cierre con entregables como **una sola acción transaccional**. **Lo creó KAM-15**; aquí se le añade.
- `lib/tasks/deliverables.ts` — los seis tipos como dominio, cuáles son construibles hoy, y el prellenado puro de cada formulario a partir de la tarea (título, línea, notas, adjuntos). En `lib/` por ser lógica pura y cubrible al 90 %.
- `features/tasks/links/` — buscador único, lista de vínculos y bloque reutilizable *Tareas relacionadas*.
- `features/tasks/deliverables/` — declaración en V18 y diálogo V19.
- `features/orders/order-detail.tsx`, `features/catalog/item-detail.tsx`, `features/contacts/contacts-screen.tsx` — cada uno suma el bloque *Tareas relacionadas*.
- `features/orders/order-detail.tsx`, `features/catalog/item-detail.tsx`, `features/contacts/contacts-screen.tsx`, `features/expenses/expense-detail.tsx` — cada uno pasa su archivado por el aviso.
- `features/tasks/board/task-card.tsx` y `tasks-screen.tsx` — íconos y filtros nuevos.
- `features/tasks/detail/task-detail.tsx` — se encienden las dos secciones que KAM-16 dejó sin pintar.

**Se lee pero no se modifica:** `lib/search/normalize.ts` (la normalización de búsqueda ya resuelta), `lib/tasks/prefill.ts` (el precedente de prellenado, de pedido a tarea; aquí el sentido es el inverso), `actions/catalog.ts`, `actions/contacts.ts` y `actions/expenses.ts` como destinos de creación de los entregables, y `services/catalog/attachment-service.ts` para arrastrar los adjuntos de la tarea al registro creado.

**Dependencias nuevas:** ninguna.

**Pruebas:** unitarias sobre el prellenado de cada tipo de entregable y sobre el dominio de tipos; pgTAP sobre `task_deliverables` —RLS entre organizaciones, ausencia de `DELETE`, unicidad por tipo— y sobre la escritura de los cuatro tipos de vínculo; integración sobre la creación de los cinco tipos desde el asistente; e2e `task-deliverables.spec.ts` con las tres salidas del diálogo.

## Supuestos registrados

1. **KAM-21 tampoco habría necesitado a KAM-17 ni a KAM-18, y ya no importa: ambas están archivadas.** Se registra porque explica por qué el orden del backlog no es una atadura aquí. KAM-17 es *Mis pendientes*, los recordatorios y los avisos, que ninguna parte de esta tarea consulta. Con KAM-18 la relación es indirecta y en el sentido contrario: el entregable *Compra registrada* crea un egreso de compra con sus líneas, y las entradas de inventario las genera el trigger de KAM-18 sobre esas líneas sin que este código lo nombre.

2. **El activo entra entero. — DECISIÓN DEL USUARIO, revisada.** La primera versión de esta propuesta lo difería porque `asset_details` no existía, V12 no existía y `validate_task_link()` rechazaba todo vínculo de tipo `asset`. KAM-19 se implementó y archivó entretanto: la tabla está, la pantalla está, y `20260908170000_asset_recovery.sql` ya reemplazó el trigger para validar contra `asset_details`. Las tres piezas —el tipo vinculable, el bloque del panel de V12 y el entregable *Nuevo activo*— entran en esta tarea, que es a quien el backlog y la propia propuesta de KAM-19 se las asignan.

3. **El aviso al archivar es informativo, no un bloqueo. — DECISIÓN DEL USUARIO.** El criterio 7 pide que «se avise qué tareas lo referencian y ninguna quede rota». Avisar es enumerar antes de confirmar; ninguna tarea queda rota porque en Kamay nada se borra y el vínculo sobrevive intacto al archivado. Impedir el archivado sería inventar una restricción que ni el backlog ni el esquema declaran, y dejaría al usuario sin salida cuando la tarea que estorba está cerrada hace meses.

4. **Un entregable por tipo y por tarea.** Lo fija el `unique (task_id, deliverable_type)` del esquema canónico. Una tarea que deba producir dos productos distintos declara *Nuevo producto* una vez y crea el segundo a mano; el backlog deja «entregables encadenados o condicionales» fuera de alcance y multiplicar la misma fila sería la puerta de entrada a eso.

5. **El asistente se abre al entrar en un estado `final`, no al pulsar un botón *Cerrar*.** El modelo de KAM-15 no tiene una acción de cierre: cerrar **es** estar en una columna de tipo `final`, y el trigger `maintain_task_closed_at()` lo deriva. El mapa de navegación confirma las dos entradas a V19 —soltar en la columna final desde V17, cambiar a estado final desde V18— y ninguna otra. Una tarea sin entregables declarados se cierra sin ver el diálogo, como hoy.

6. **Cancelar el asistente cancela también el cambio de estado.** *Cancelar* es la tercera salida del diálogo y la única que deja las cosas como estaban: la tarea vuelve a su columna anterior y no se cierra. Sin esto, *Cancelar* y *Cerrar sin crear nada* harían lo mismo y la tercera opción sobraría.

7. **El prellenado de adjuntos copia el objeto, no solo la fila. — DECISIÓN DEL USUARIO, revisada al implementar.** La primera versión daba por hecho que dos filas de `attachments` podían apuntar al mismo objeto de Storage. No pueden: la tabla lleva `unique (bucket, storage_path)` desde KAM-06b, y esa restricción existe para que ningún objeto quede con dos dueños o con ninguno. Así que llevar las fotos de la tarea al producto **copia el objeto** a la ruta canónica del destino y escribe su fila. Cuesta bytes duplicados, acotados a lo que quede marcado en el asistente, y a cambio cada registro queda con archivos propios: retocar la foto del producto no cambia la de la tarea.

8. **La marca *cerrada sin entregables* solo se pone cuando había algo que crear.** Una tarea sin entregables declarados que se cierra no queda marcada: no cerró sin cumplir nada, es que no había nada que cumplir. Marcarla llenaría el filtro de ruido y volvería inútil la señal que el criterio 5 quiere hacer localizable.

9. **El activo es del dueño, y el vínculo hereda esa reserva. — DECISIÓN DEL USUARIO.** `asset_details` tiene las tres políticas bajo `is_owner()`, mientras que `task_links` va «según la tarea»: un ayudante puede leer la fila del vínculo aunque no pueda resolver el activo. Se resuelve **omitiendo** los vínculos de tipo `asset` para quien no es dueño, en vez de rendirlos como «sin acceso». Es la misma decisión que KAM-19 tomó en V11 —«el detalle no contiene sección de datos de activo, ni vacía ni rotulada»—: una entrada rotulada como inaccesible le diría al ayudante cuántos activos hay y cuáles tocan su trabajo, que es justo lo que esa política reserva. Por lo mismo, el buscador no ofrece activos al ayudante y el selector de entregables no le ofrece *Nuevo activo*.
