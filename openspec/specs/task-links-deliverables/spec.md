# task-links-deliverables Specification

## Purpose

Hace que cerrar una tarea deje registros reales: vínculos bidireccionales con pedidos, contactos, ítems y egresos que reflejan el estado actual del original y nunca una copia, y entregables declarados que al cerrar se ofrecen prellenados desde la propia tarea, con la libertad explícita de no crear ninguno y cerrar igual.

> Origen: `specs/PRD/kamay-backlog.md` — KAM-21; `specs/PRD/kamay-especificacion-producto-v6.md` §6.3 (Vínculos, Entregables), V17, V18, V19, Flujos A, B y C; `specs/PRD/kamay-mapa-navegacion-ui.md` §3 (V19 · diálogo), §5 (V17→V19, V18→V19), §6 (matriz de transiciones); `specs/PRD/kamay-esquema-base-de-datos-supabase.md` §12 (`task_links`, `task_deliverables`), §16 (matriz de acceso), §18; `specs/PRD/ARCHITECTURE.md`.
>
> Presupone `tasks`, `task_links` y el tablero V17 (KAM-15), el detalle V18 (KAM-16), el catálogo y el directorio (KAM-06), los egresos (KAM-09) y los pedidos (KAM-07, KAM-08). Esta capacidad usa `task_links`; no la define.

## Requirements

### Requirement: Un buscador único resuelve los tipos vinculables

El sistema SHALL ofrecer en el detalle de la tarea un solo campo de búsqueda que resuelva a la vez pedidos, contactos, ítems, egresos y activos, sin obligar a elegir antes el tipo. La búsqueda SHALL tolerar diferencias de acentuación y de mayúsculas, con la misma regla que el resto de buscadores del sistema. Cada resultado SHALL identificar de qué tipo es y mostrar lo que distingue a ese registro de otro del mismo nombre. El buscador SHALL NOT ofrecer registros de otra organización, ni registros archivados, ni destinos ya vinculados a esa tarea. Elegir un resultado SHALL registrar el vínculo de inmediato, sin un paso de guardado aparte. Los activos SHALL ofrecerse únicamente a la persona dueña: para un ayudante SHALL NOT aparecer ninguno entre los resultados, porque los datos de activo están reservados a la persona dueña.

#### Scenario: Un término encuentra registros de varios tipos

- **WHEN** se escribe «sublimación» en el buscador de vínculos de una tarea
- **THEN** los resultados incluyen pedidos, contactos, ítems y egresos que coinciden, cada uno identificado por su tipo

#### Scenario: La búsqueda ignora acentos y mayúsculas

- **WHEN** se escribe «sublimacion» en minúsculas y sin tilde
- **THEN** aparece el ítem «Taza para sublimación» entre los resultados

#### Scenario: Un destino ya vinculado no se ofrece dos veces

- **WHEN** se busca un pedido que ya está vinculado a esa tarea
- **THEN** el pedido no aparece entre los resultados ofrecidos

#### Scenario: Los registros archivados no se ofrecen

- **WHEN** se busca un ítem que fue archivado
- **THEN** el ítem no aparece entre los resultados ofrecidos

#### Scenario: No se ofrecen registros de otra organización

- **WHEN** una persona de la organización A busca un término que coincide con un pedido de la organización B
- **THEN** ese pedido no aparece entre los resultados

#### Scenario: Elegir vincula sin más pasos

- **WHEN** se elige un contacto de los resultados
- **THEN** el vínculo queda registrado y aparece en la lista de vínculos de la tarea sin ninguna otra acción

#### Scenario: La persona dueña encuentra activos

- **WHEN** la persona dueña busca el nombre de un activo de su organización
- **THEN** el activo aparece entre los resultados, identificado como activo

#### Scenario: El ayudante no encuentra activos

- **WHEN** un ayudante busca un término que coincide con el nombre de un activo
- **THEN** ningún activo aparece entre los resultados

### Requirement: El vínculo refleja el estado actual del registro, nunca una copia

El sistema SHALL mostrar cada vínculo de una tarea leyendo el registro apuntado en el momento de rendirlo, de modo que refleje su estado, su nombre y sus datos **actuales**. El sistema SHALL NOT almacenar en el vínculo ninguna copia de los datos del registro apuntado más allá de su tipo y su identificador. Un vínculo cuyo destino esté archivado SHALL seguir mostrándose, señalando esa condición, y SHALL NOT desaparecer ni quedar sin resolver. Un vínculo a un activo SHALL NOT rendirse ante quien no es la persona dueña —ni resuelto ni como entrada sin acceso—, de modo que un ayudante no deduzca la existencia de un activo que no puede leer.

#### Scenario: El estado del pedido cambia después de vincularlo

- **WHEN** se vincula un pedido en estado *En cola*, el pedido pasa a *En producción* y se vuelve a abrir la tarea
- **THEN** el vínculo muestra *En producción*, el estado actual del pedido

#### Scenario: El nombre del registro cambia después de vincularlo

- **WHEN** se renombra un ítem vinculado y se vuelve a abrir la tarea
- **THEN** el vínculo muestra el nombre nuevo

#### Scenario: Un destino archivado sigue visible

- **WHEN** se archiva un contacto vinculado a una tarea y se abre esa tarea
- **THEN** el vínculo sigue mostrándose con el nombre del contacto y señalando que está archivado

#### Scenario: El ayudante no ve el vínculo a un activo

- **WHEN** un ayudante abre una tarea que tiene un vínculo a un activo y otro a un pedido
- **THEN** ve el vínculo al pedido y la sección no contiene el del activo, ni resuelto ni rotulado como inaccesible

### Requirement: Los vínculos se quitan sin tocar el registro apuntado

El sistema SHALL permitir quitar un vínculo desde el detalle de la tarea. Quitarlo SHALL retirar únicamente la relación: el pedido, el contacto, el ítem o el egreso apuntado SHALL quedar intacto, sin archivar y sin modificar. El mismo destino SHALL poder volver a vincularse después. Un mismo destino SHALL NOT poder quedar vinculado dos veces a la misma tarea.

#### Scenario: Quitar el vínculo no toca el pedido

- **WHEN** se quita el vínculo de una tarea con un pedido
- **THEN** el vínculo desaparece de la tarea y el pedido conserva todos sus datos y su estado

#### Scenario: Se puede volver a vincular

- **WHEN** se quita un vínculo y se vuelve a elegir el mismo destino en el buscador
- **THEN** el vínculo se registra de nuevo

#### Scenario: No hay vínculos duplicados

- **WHEN** se intenta registrar por segunda vez el mismo destino en la misma tarea
- **THEN** la operación se rechaza y solo queda un vínculo

### Requirement: Los registros vinculados muestran sus tareas relacionadas

El sistema SHALL mostrar un bloque **Tareas relacionadas** en el detalle de pedido, en el detalle de ítem, en el panel de contacto y en el panel de detalle de activo, listando las tareas que referencian a ese registro con su título, su estado actual y su fecha límite cuando la tenga, y llevando al detalle de cada una. El bloque SHALL respetar la visibilidad de tareas por rol y por línea: SHALL listar únicamente las tareas que quien mira puede ver. Un registro sin tareas que lo referencien SHALL mostrar el bloque con su mensaje de lista sin contenido, nunca un error.

#### Scenario: El pedido muestra sus tareas

- **WHEN** se abre el detalle de un pedido que tiene dos tareas vinculadas
- **THEN** el bloque *Tareas relacionadas* lista ambas con su estado actual

#### Scenario: Desde la tarea relacionada se llega a la tarea

- **WHEN** se activa una tarea del bloque *Tareas relacionadas* de un ítem
- **THEN** se abre el detalle de esa tarea

#### Scenario: Sin tareas relacionadas el bloque queda vacío

- **WHEN** se abre el panel de un contacto que ninguna tarea referencia
- **THEN** el bloque se rinde con su mensaje de lista sin contenido

#### Scenario: El ayudante solo ve lo que le corresponde

- **WHEN** un ayudante abre un pedido que tiene una tarea vinculada de una línea que no alcanza
- **THEN** esa tarea no aparece en el bloque de tareas relacionadas

#### Scenario: El panel del activo muestra sus tareas

- **WHEN** la persona dueña activa la tarjeta de un activo que una tarea referencia
- **THEN** el panel del activo muestra esa tarea en su bloque de tareas relacionadas

### Requirement: Archivar un registro referenciado avisa y no rompe nada

El sistema SHALL informar, antes de confirmar el archivado de un pedido, un ítem, un contacto o un egreso, qué tareas lo referencian, enumerándolas. El aviso SHALL NOT impedir el archivado: confirmado, el registro SHALL archivarse. Tras el archivado, todo vínculo que lo apuntara SHALL seguir existiendo y SHALL seguir resolviéndose al mismo registro, señalando que está archivado. Un registro que ninguna tarea referencie SHALL archivarse sin aviso adicional.

#### Scenario: El aviso enumera las tareas

- **WHEN** se archiva un ítem referenciado por tres tareas
- **THEN** antes de confirmar se muestran esas tres tareas

#### Scenario: El archivado sigue adelante

- **WHEN** se confirma el archivado tras el aviso
- **THEN** el registro queda archivado

#### Scenario: Ningún vínculo queda roto

- **WHEN** se abre una tarea cuyo destino vinculado acaba de archivarse
- **THEN** el vínculo sigue presente, resuelve al mismo registro y lo señala como archivado

#### Scenario: Sin referencias no hay aviso

- **WHEN** se archiva un contacto que ninguna tarea referencia
- **THEN** el archivado no muestra ningún aviso de tareas

### Requirement: Una tarea declara qué debe existir al terminarla

El sistema SHALL permitir declarar en una tarea cero, uno o varios entregables esperados, almacenados en `task_deliverables` según el esquema canónico, con un solo entregable por tipo y por tarea. Los tipos declarables SHALL ser los del esquema: nuevo producto, nuevo insumo, nuevo proveedor, compra registrada, gastos registrados y nuevo activo. El entregable *Nuevo activo* SHALL ofrecerse únicamente a la persona dueña, porque solo ella puede registrar datos de activo; para un ayudante SHALL NOT aparecer entre los tipos declarables. Un entregable declarado SHALL poder retirarse mientras no esté cumplido. Una tarea sin entregables declarados SHALL ser válida y SHALL cerrarse sin ningún paso adicional.

#### Scenario: Declarar dos entregables

- **WHEN** se declaran *Nuevo producto* y *Gastos registrados* en una tarea
- **THEN** ambos quedan registrados como entregables esperados de esa tarea

#### Scenario: No se declara dos veces el mismo tipo

- **WHEN** se intenta declarar *Nuevo producto* en una tarea que ya lo tiene declarado
- **THEN** la operación se rechaza y sigue habiendo un solo entregable de ese tipo

#### Scenario: Retirar un entregable no cumplido

- **WHEN** se retira un entregable declarado y aún no cumplido
- **THEN** deja de figurar entre los entregables esperados de la tarea

#### Scenario: El ayudante no puede declarar un activo

- **WHEN** un ayudante abre el selector de entregables de una tarea
- **THEN** *Nuevo activo* no aparece entre los tipos ofrecidos

#### Scenario: Una tarea puede no declarar ninguno

- **WHEN** se cierra una tarea sin entregables declarados
- **THEN** se cierra sin abrir ningún asistente y sin ninguna marca

### Requirement: Entrar en un estado final con entregables pendientes abre el asistente de cierre

El sistema SHALL abrir el asistente de cierre cuando una tarea entra en un estado de tipo `final` teniendo al menos un entregable declarado sin cumplir, tanto si el cambio viene de soltarla en una columna del tablero como si viene de cambiar su estado desde el detalle. La decisión SHALL tomarse por el tipo del estado y nunca por su nombre. Una tarea sin entregables declarados, o con todos cumplidos, SHALL cerrarse directamente sin abrir el asistente. Salir de un estado de tipo `final` SHALL NOT abrir nada ni pedir confirmación.

#### Scenario: Soltar en la columna final abre el asistente

- **WHEN** se arrastra al tablero una tarea con un entregable declarado hasta una columna de tipo `final`
- **THEN** se abre el asistente de cierre con ese entregable

#### Scenario: Cambiar el estado desde el detalle abre el asistente

- **WHEN** se cambia desde el detalle el estado de una tarea con entregables declarados a uno de tipo `final`
- **THEN** se abre el asistente de cierre

#### Scenario: Sin entregables se cierra directo

- **WHEN** se lleva a un estado de tipo `final` una tarea sin entregables declarados
- **THEN** la tarea se cierra sin abrir el asistente

#### Scenario: La decisión se toma por el tipo del estado

- **WHEN** una organización llama *Entregado* a su estado de tipo `final` y *Terminado* a uno de tipo `en curso`
- **THEN** el asistente se abre al entrar en *Entregado* y no al entrar en *Terminado*

#### Scenario: Retroceder no abre nada

- **WHEN** se saca una tarea cerrada de su estado de tipo `final`
- **THEN** no se abre ningún asistente ni se pide confirmación

### Requirement: El asistente ofrece un formulario prellenado por entregable

El sistema SHALL mostrar en el asistente un formulario por cada entregable declarado sin cumplir, cada uno con su casilla de inclusión y prellenado con lo que la tarea ya sabe: su título, su línea de negocio, sus adjuntos y las notas de su cuerpo, en los campos que correspondan a ese tipo de entregable. Todo valor prellenado SHALL ser modificable antes de crear. Las casillas SHALL poder marcarse y desmarcarse por separado, de modo que se creen todos, algunos o ninguno.

#### Scenario: Dos entregables, dos formularios prellenados

- **WHEN** se abre el asistente de una tarea con dos entregables declarados
- **THEN** se ofrecen los dos formularios, cada uno prellenado con el título, la línea, los adjuntos y las notas de la tarea

#### Scenario: Lo prellenado se puede cambiar

- **WHEN** se corrige el nombre propuesto en un formulario del asistente antes de crear
- **THEN** el registro se crea con el nombre corregido

#### Scenario: Se elige cuál incluir

- **WHEN** se desmarca uno de los dos entregables y se confirma la creación
- **THEN** se crea solo el entregable marcado y el otro queda declarado sin cumplir

### Requirement: El asistente ofrece tres salidas y ninguna se penaliza

El sistema SHALL ofrecer en el asistente las salidas *Crear seleccionados y cerrar*, *Cerrar sin crear nada* y *Cancelar*. *Crear seleccionados y cerrar* SHALL crear los entregables marcados y cerrar la tarea. *Cerrar sin crear nada* SHALL cerrar la tarea sin crear ningún registro, SHALL NOT pedir justificación, SHALL NOT mostrar advertencia y SHALL NOT bloquear nada. *Cancelar* SHALL dejar la tarea como estaba: sin cerrar, en el estado que tenía antes del intento, y sin crear nada. Si la creación de un entregable falla, la tarea SHALL NOT quedar cerrada a medias: o se crean los marcados y se cierra, o no se crea ninguno y la tarea sigue abierta con el motivo a la vista.

#### Scenario: Cerrar sin crear nada no pide nada

- **WHEN** se elige *Cerrar sin crear nada*
- **THEN** la tarea queda cerrada, no se crea ningún registro y no se pide justificación ni se muestra advertencia

#### Scenario: Cancelar devuelve la tarea a su estado anterior

- **WHEN** se arrastra una tarea a la columna final y se elige *Cancelar* en el asistente
- **THEN** la tarea vuelve a su columna anterior, sigue abierta y no se crea nada

#### Scenario: Crear seleccionados cierra la tarea

- **WHEN** se marcan los dos entregables y se elige *Crear seleccionados y cerrar*
- **THEN** se crean los dos registros y la tarea queda cerrada

#### Scenario: Un fallo no deja la tarea a medias

- **WHEN** la creación de uno de los entregables marcados falla
- **THEN** no se crea ninguno, la tarea sigue abierta y se muestra el motivo

### Requirement: El registro creado queda enlazado desde la tarea y visible en la bitácora

El sistema SHALL registrar en el entregable cumplido qué se creó y cuándo, y SHALL dejar además el registro creado vinculado a la tarea, de modo que aparezca entre sus vínculos y la tarea aparezca en las tareas relacionadas de ese registro. La creación SHALL quedar en la bitácora del sistema como creación de ese registro, con su autor y su hora. El sistema SHALL NOT mantener ninguna tabla, columna o store de historial propio de entregables. Un entregable ya cumplido SHALL NOT volver a ofrecerse en el asistente.

#### Scenario: El producto creado aparece en los vínculos

- **WHEN** se cumple el entregable *Nuevo producto* desde el asistente
- **THEN** el ítem creado aparece entre los vínculos de la tarea

#### Scenario: La tarea aparece en el registro creado

- **WHEN** se abre el detalle del ítem creado como entregable
- **THEN** su bloque *Tareas relacionadas* incluye la tarea que lo originó

#### Scenario: La creación queda en la bitácora

- **WHEN** se cumple un entregable desde el asistente
- **THEN** la bitácora registra la creación de ese registro con su autor y su hora

#### Scenario: No hay un historial de entregables aparte

- **WHEN** se inspecciona de dónde sale lo ocurrido con una tarea y sus entregables
- **THEN** todo procede de la bitácora del sistema y de ninguna otra tabla de historial

#### Scenario: Un entregable cumplido no se vuelve a ofrecer

- **WHEN** se reabre una tarea con un entregable ya cumplido y se vuelve a llevar a un estado final
- **THEN** el asistente no ofrece de nuevo ese entregable

### Requirement: Cerrar sin entregables deja una marca discreta y localizable

El sistema SHALL marcar la tarea como cerrada sin entregables cuando se cierre teniendo entregables declarados sin cumplir y no se cree ninguno. La marca SHALL ser discreta —una señal sobria en la tarjeta y en el detalle, nunca una alerta ni un bloqueo— y SHALL poder localizarse mediante un filtro del tablero. Una tarea cerrada sin ningún entregable declarado SHALL NOT quedar marcada. Al reabrir la tarea la marca SHALL retirarse, y los registros que se hubieran creado SHALL permanecer.

#### Scenario: La marca aparece al cerrar sin crear nada

- **WHEN** se elige *Cerrar sin crear nada* en una tarea con un entregable declarado
- **THEN** la tarea queda marcada como cerrada sin entregables

#### Scenario: El filtro la encuentra

- **WHEN** se aplica el filtro de tareas cerradas sin entregables en el tablero
- **THEN** aparecen las tareas con esa marca y ninguna otra

#### Scenario: Sin entregables declarados no hay marca

- **WHEN** se cierra una tarea que nunca declaró ningún entregable
- **THEN** la tarea no queda marcada

#### Scenario: Crear alguno evita la marca

- **WHEN** se crean uno de dos entregables declarados y se cierra la tarea
- **THEN** la tarea no queda marcada como cerrada sin entregables

#### Scenario: Reabrir retira la marca

- **WHEN** se saca de su estado final una tarea marcada como cerrada sin entregables
- **THEN** la marca desaparece y los registros ya creados siguen existiendo

### Requirement: Los entregables solo son accesibles dentro de su organización y nadie los borra

El sistema SHALL almacenar los entregables en `task_deliverables` con su `organization_id`, y su visibilidad SHALL seguir la de su tarea: quien no puede ver la tarea SHALL NOT poder leer ni escribir sus entregables. Ninguna persona autenticada SHALL poder eliminar una fila de `task_deliverables`; retirar un entregable SHALL ser una operación de la organización dueña sobre su propia tarea y nunca un borrado ejecutable desde otra. Toda alta y todo cambio de un entregable SHALL quedar en la bitácora.

#### Scenario: Otra organización no lee los entregables

- **WHEN** un miembro de la organización A consulta los entregables de una tarea de la organización B
- **THEN** no obtiene ninguna fila

#### Scenario: Otra organización no declara entregables ajenos

- **WHEN** un miembro de la organización A intenta declarar un entregable sobre una tarea de la organización B
- **THEN** la operación se rechaza

#### Scenario: El ayudante sigue la visibilidad de la tarea

- **WHEN** un ayudante consulta los entregables de una tarea de una línea que no alcanza
- **THEN** no obtiene ninguna fila

#### Scenario: Nadie borra un entregable

- **WHEN** un usuario autenticado —incluido el dueño— ejecuta `DELETE` sobre `task_deliverables`
- **THEN** no se elimina ninguna fila

