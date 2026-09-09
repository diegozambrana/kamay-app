# assets Specification

## Purpose

Los activos como lo que son: ítems del catálogo con costo, fecha y mantenimiento propios, y una barra que responde de un vistazo si la máquina ya se pagó sola —el margen de caja que su línea generó desde que se compró, frente a lo que llevó gastado—, sin depreciación contable ni ninguna otra ceremonia que el taller no vaya a mantener.

> Origen: `specs/PRD/kamay-backlog.md` — KAM-19; `specs/PRD/kamay-esquema-base-de-datos-supabase.md` §7 (`asset_details`), §11 (`asset_recovery`), § Matriz de acceso; `specs/PRD/kamay-especificacion-producto-v6.md` — V11, V12, §6.1 (Activo), §16 (matriz de acceso); `specs/PRD/kamay-mapa-navegacion-ui.md` §4.1, §4.2, §5, §7, §10 (V12 y sus destinos); `specs/PRD/ARCHITECTURE.md` (convención 3: nada se borra; convención 4: nada derivado se almacena; convención 7: un solo historial).

## Requirements

### Requirement: Datos propios del activo

El sistema SHALL almacenar los datos propios de un activo en `asset_details` según el esquema canónico (§7), con `item_id` como clave primaria referida a `items`, `acquisition_cost` obligatorio y no negativo, `acquired_on` obligatorio, y `supplier_id` y `notes` opcionales. Una fila de `asset_details` SHALL existir únicamente para un ítem de tipo `asset`, y un ítem SHALL tener a lo sumo una. El `acquisition_cost` SHALL ser un dato declarado y editable, no una copia inmutable del egreso con el que se compró.

Un ítem de tipo activo SHALL seguir siendo válido sin fila de `asset_details`: sus datos de activo son un añadido, no un requisito para existir en el catálogo.

#### Scenario: Datos de activo aceptados

- **WHEN** la persona dueña guarda para un ítem de tipo activo un costo de adquisición y una fecha
- **THEN** la fila queda registrada contra ese ítem y el activo aparece en la pantalla de activos

#### Scenario: Un ítem que no es activo no tiene datos de activo

- **WHEN** se intenta guardar datos de activo para un ítem de tipo insumo o producto
- **THEN** la base de datos rechaza la operación

#### Scenario: Un solo juego de datos por activo

- **WHEN** se intenta guardar una segunda fila de datos de activo para el mismo ítem
- **THEN** la base de datos rechaza la operación

#### Scenario: Costo negativo rechazado

- **WHEN** se intenta guardar un activo con un costo de adquisición menor que cero
- **THEN** la base de datos rechaza la operación

#### Scenario: El costo declarado se puede corregir

- **WHEN** la persona dueña edita el costo de adquisición de un activo ya registrado
- **THEN** el nuevo valor queda guardado y la barra de recuperación se recalcula con él

#### Scenario: Un activo del catálogo sin datos todavía

- **WHEN** existe un ítem de tipo activo sin costo ni fecha declarados
- **THEN** el ítem sigue siendo válido en el catálogo y la pantalla de activos lo ofrece para completar sus datos, sin barra

### Requirement: El costo total del activo suma su mantenimiento

El costo total de un activo SHALL ser su `acquisition_cost` declarado más el total de los egresos que le pertenecen con papel de **mantenimiento**. El costo total SHALL derivarse en la lectura y SHALL NOT almacenarse en ninguna columna. El egreso con papel de **adquisición** SHALL NOT sumar al costo total: su importe ya está representado por el `acquisition_cost` declarado, y contarlo dos veces inflaría el costo de la máquina.

Un egreso archivado SHALL NOT sumar al costo total, del mismo modo que no suma a ningún otro derivado del sistema.

#### Scenario: Mantenimiento vinculado

- **WHEN** un activo de costo 7000 recibe un gasto de mantenimiento vinculado de 500
- **THEN** su costo total pasa a 7500 y la barra de recuperación se recalcula sobre esa cifra

#### Scenario: El egreso de adquisición no se cuenta dos veces

- **WHEN** un activo de costo 7000 tiene vinculado como adquisición el egreso de 7000 con el que se compró
- **THEN** su costo total sigue siendo 7000

#### Scenario: Mantenimiento archivado

- **WHEN** se archiva un gasto de mantenimiento vinculado a un activo
- **THEN** deja de sumar al costo total del activo

#### Scenario: El costo total no vive en una columna

- **WHEN** se revisa el esquema tras esta capacidad
- **THEN** ninguna tabla guarda el costo total ni el mantenimiento acumulado de un activo

### Requirement: El margen que recupera la inversión se mide en caja desde la fecha de adquisición

El margen con el que se mide la recuperación de un activo SHALL ser el **margen de caja de su línea de negocio desde su fecha de adquisición**: el dinero cobrado de esa línea menos el dinero pagado de esa línea, contando cada movimiento por su fecha de ocurrencia y solo desde `acquired_on` inclusive, en la zona horaria de la organización. Es la misma base con la que el panel principal define *Margen*, de modo que las dos pantallas no dan dos respuestas a la misma palabra.

Los movimientos archivados y los que apuntan a un pedido o a un egreso archivado SHALL NOT contar. El margen SHALL poder ser negativo.

#### Scenario: Solo desde la fecha de adquisición

- **WHEN** la línea de un activo adquirido el 1 de marzo cobró 4000 en febrero y 3000 en abril
- **THEN** el margen que recupera ese activo cuenta los 3000 de abril y no los 4000 de febrero

#### Scenario: Manda la fecha del movimiento de dinero

- **WHEN** un pedido de la línea entregado antes de la adquisición se cobra después de ella
- **THEN** ese importe cuenta para la recuperación del activo

#### Scenario: Entregado y no cobrado todavía no recupera

- **WHEN** un pedido de la línea se entrega tras la adquisición pero nadie lo ha cobrado
- **THEN** su importe no cuenta para la recuperación, y sigue apareciendo en Por cobrar

#### Scenario: Lo anulado deja de contar

- **WHEN** se anula un cobro que contaba para la recuperación de un activo
- **THEN** el margen baja en ese importe y la barra retrocede

#### Scenario: Cada activo mira su propia línea

- **WHEN** dos activos de líneas distintas se adquirieron el mismo día
- **THEN** cada uno se mide contra el margen de su propia línea, no contra el de la organización

### Requirement: La inversión cuenta una sola vez

El dinero que ya forma parte del costo de un activo SHALL NOT restarse además como egreso de su línea en el margen con el que ese activo se mide: los pagos de egresos que pertenecen a un activo —sea con papel de adquisición o de mantenimiento— SHALL quedar excluidos de ese margen. Sin esta regla un activo tendría que generar dos veces su costo para llenar su barra.

La exclusión SHALL ser propia de la recuperación de activos y SHALL NOT alterar ningún otro derivado: los indicadores del panel principal SHALL seguir contando esos pagos como dinero que salió de caja.

#### Scenario: La compra de la máquina no castiga su propia barra

- **WHEN** un activo de costo 7000 se compró con un egreso de esa línea ya pagado, y desde entonces la línea cobró 7000 y no pagó nada más
- **THEN** su barra muestra 100 %, no 0 %

#### Scenario: El mantenimiento sube el costo pero no baja el margen

- **WHEN** un gasto de mantenimiento de 500 vinculado a un activo se paga
- **THEN** el costo total del activo sube 500 y el margen de la línea con el que se mide no baja

#### Scenario: El panel sigue viendo la salida de caja

- **WHEN** se paga en el mes en curso la compra de una máquina de 7000
- **THEN** el indicador de Egresos del panel principal incluye esos 7000

#### Scenario: Un egreso corriente sí resta

- **WHEN** la línea paga un gasto de 200 que no pertenece a ningún activo
- **THEN** ese importe baja el margen con el que se miden los activos de esa línea

### Requirement: La fórmula de recuperación vive en un solo lugar y no falla en los bordes

El porcentaje de recuperación SHALL calcularse en un único lugar del código a partir de dos ingredientes —el costo total del activo y el margen de su línea desde la adquisición— y SHALL NOT reimplementarse en ninguna pantalla, consulta ni vista. Ninguna pantalla SHALL derivar su propio porcentaje.

El porcentaje SHALL recortarse al rango de 0 % a 100 %: un margen negativo o nulo SHALL dar 0 % y un margen superior al costo SHALL dar 100 %. Un costo total de cero SHALL dar 0 % sin división por cero y SHALL NOT considerarse recuperado. Un activo SHALL considerarse **recuperado** cuando su margen iguala o supera su costo total.

#### Scenario: Recuperación parcial

- **WHEN** un activo de costo total 7000 acumula un margen de 3500 desde su adquisición
- **THEN** su barra muestra 50 %

#### Scenario: La línea todavía no genera margen

- **WHEN** un activo de costo total 7000 acumula un margen de −800 desde su adquisición
- **THEN** su barra muestra 0 %, sin error y sin porcentaje negativo

#### Scenario: Recuperación exacta

- **WHEN** el margen acumulado iguala exactamente el costo total
- **THEN** la barra muestra 100 % y el activo consta como recuperado

#### Scenario: Recuperación superada

- **WHEN** el margen acumulado es el doble del costo total
- **THEN** la barra muestra 100 % y no 200 %, y el activo consta como recuperado

#### Scenario: Costo total cero

- **WHEN** un activo tiene costo total cero
- **THEN** la barra muestra 0 %, no se produce ninguna división por cero y el activo no consta como recuperado

### Requirement: Un activo sin línea propia no muestra porcentaje

Un activo cuyo ítem está marcado como compartido entre líneas SHALL mostrar su costo, su fecha y su mantenimiento acumulado, y SHALL declarar de forma visible que su recuperación no es atribuible a una sola línea, en lugar de mostrar una barra en 0 %. El sistema SHALL NOT repartir el margen entre líneas para resolverlo: esa regla pertenece a los reportes.

#### Scenario: Activo compartido

- **WHEN** se abre la pantalla de activos y uno de ellos es un ítem compartido entre líneas
- **THEN** su tarjeta muestra costo, fecha y mantenimiento, y declara que la recuperación no es atribuible a una línea, sin barra

#### Scenario: Sin reparto inventado

- **WHEN** un activo compartido convive con líneas que sí tienen margen
- **THEN** el sistema no le asigna ninguna parte de ese margen

### Requirement: Pantalla de activos (V12)

El sistema SHALL ofrecer la pantalla de activos en `/assets` como página completa, con una tarjeta por activo que muestre nombre, línea o "Compartido", costo de adquisición, fecha de adquisición, mantenimiento acumulado y barra de recuperación con su porcentaje. La pantalla SHALL responder al selector de línea activa. Un activo recuperado SHALL indicarse de forma sobria —la barra completa y una marca discreta—, sin felicitación ni destaque desproporcionado.

La lista SHALL excluir los activos cuyo ítem está archivado y SHALL ofrecer el filtro "Ver archivados" común a todo listado. La pantalla SHALL ser utilizable en un viewport de 390 px, apilada en una columna y sin desplazamiento horizontal.

#### Scenario: Una tarjeta por activo

- **WHEN** la persona dueña abre `/assets` en una organización con dos activos
- **THEN** ve dos tarjetas, cada una con nombre, línea, costo, fecha, mantenimiento y barra

#### Scenario: La pantalla sigue el selector de línea

- **WHEN** se cambia el selector de "Todas" a la línea 3D
- **THEN** la lista muestra solo los activos de esa línea

#### Scenario: El recuperado se indica sin fiesta

- **WHEN** un activo alcanza el 100 %
- **THEN** su barra aparece completa con una marca discreta de recuperado, sin destacar la tarjeta por encima de las demás

#### Scenario: Archivados fuera por omisión

- **WHEN** el ítem de un activo está archivado
- **THEN** no aparece en la lista salvo que se active "Ver archivados"

#### Scenario: Una columna en 390 px

- **WHEN** se abre la pantalla en un viewport de 390 px
- **THEN** las tarjetas se apilan en una columna y ninguna obliga a desplazarse horizontalmente

### Requirement: Detalle del activo en panel

Activar una tarjeta SHALL abrir el detalle del activo en un panel lateral, con sus datos —costo, fecha, proveedor enlazado a su ficha si lo tiene, notas—, la lista de sus egresos de mantenimiento con fecha e importe, el egreso de adquisición si está vinculado, el desglose del costo total y el historial leído de la bitácora. Cada egreso listado SHALL llevar a su detalle. El detalle SHALL permitir editar los datos del activo y vincular un egreso de mantenimiento.

#### Scenario: Detalle con sus gastos

- **WHEN** se activa la tarjeta de un activo con dos gastos de mantenimiento vinculados
- **THEN** el panel muestra los dos con su fecha e importe, y el costo total desglosado

#### Scenario: Del gasto a su egreso

- **WHEN** se activa uno de los gastos listados en el panel
- **THEN** se abre el detalle de ese egreso

#### Scenario: Historial del activo

- **WHEN** un activo se registró y luego se corrigió su costo
- **THEN** su historial muestra ambos eventos en orden cronológico, leídos de la bitácora

### Requirement: Alta de un activo desde el catálogo

El detalle de un ítem de tipo activo SHALL ofrecer a la persona dueña registrar y editar sus datos de activo —costo de adquisición, fecha, proveedor y notas— sin salir de esa pantalla, y SHALL llevar desde allí a la pantalla de activos. La opción SHALL NOT aparecer para un ayudante ni para un ítem que no sea de tipo activo.

#### Scenario: Alta desde el detalle del ítem

- **WHEN** la persona dueña abre un ítem de tipo activo sin datos de activo y registra costo y fecha
- **THEN** los datos quedan guardados y el activo aparece en la pantalla de activos

#### Scenario: No se ofrece donde no corresponde

- **WHEN** se abre el detalle de un ítem de tipo insumo o producto
- **THEN** no se ofrece registrar datos de activo

#### Scenario: El ayudante no ve la sección

- **WHEN** un ayudante abre el detalle de un ítem de tipo activo
- **THEN** no ve los datos de activo ni la opción de registrarlos

### Requirement: Alta de un activo desde el registro de una compra

Al registrar una compra que incluye una línea de un ítem de tipo activo sin datos de activo declarados, el sistema SHALL ofrecer a la persona dueña declararlo como activo, con el costo prellenado desde el importe de esa línea y la fecha prellenada desde la fecha de la compra, ambos editables antes de guardar. Al aceptar, el egreso SHALL quedar vinculado a ese activo con papel de adquisición.

Rechazar el ofrecimiento SHALL NOT impedir guardar la compra: la compra queda registrada igual y el activo puede declararse después desde el catálogo.

#### Scenario: Compra de una máquina

- **WHEN** la persona dueña registra una compra con una línea de un ítem de tipo activo por 7000 con fecha de ayer
- **THEN** se le ofrece declararlo activo con costo 7000 y fecha de ayer prellenados

#### Scenario: Las cifras prellenadas se pueden ajustar

- **WHEN** la persona dueña cambia el costo prellenado antes de aceptar
- **THEN** el activo queda con el costo que ella escribió, y el egreso sigue vinculado como su adquisición

#### Scenario: Rechazar no bloquea la compra

- **WHEN** la persona dueña declina declarar el activo
- **THEN** la compra se guarda igual y el ítem sigue sin datos de activo

#### Scenario: Un activo ya declarado no se vuelve a ofrecer

- **WHEN** la compra incluye una línea de un ítem de tipo activo que ya tiene sus datos declarados
- **THEN** no se ofrece declararlo de nuevo

### Requirement: Vinculación de gastos de mantenimiento a un activo

El sistema SHALL permitir a la persona dueña vincular un egreso existente a un activo con papel de mantenimiento, desde el detalle del activo o desde el detalle del egreso, y SHALL permitir deshacer ese vínculo. Solo SHALL poder vincularse un egreso de la misma organización. Al vincular o desvincular, el costo total del activo y su barra SHALL reflejar el cambio sin ninguna acción adicional.

Un egreso SHALL pertenecer a lo sumo a un activo.

#### Scenario: Vincular y ver el efecto

- **WHEN** la persona dueña vincula un gasto de 500 a un activo de costo 7000
- **THEN** el costo total pasa a 7500 y la barra se recalcula al volver a la pantalla

#### Scenario: Desvincular

- **WHEN** la persona dueña deshace el vínculo de ese gasto
- **THEN** el costo total vuelve a 7000 y el gasto deja de aparecer en el detalle del activo

#### Scenario: Un egreso pertenece a un solo activo

- **WHEN** se intenta vincular a un segundo activo un egreso ya vinculado
- **THEN** la operación se rechaza

#### Scenario: Ninguna organización vincula lo ajeno

- **WHEN** se intenta vincular a un activo un egreso de otra organización
- **THEN** la base de datos rechaza la operación

### Requirement: Activos solo para la persona dueña, verificado en la base de datos

`asset_details` SHALL tener RLS activo y SHALL NOT ofrecer ninguna política de lectura ni de escritura al ayudante: un ayudante que la consulte directamente SHALL obtener cero filas, y toda escritura suya SHALL ser rechazada. El derivado de recuperación SHALL devolverle cero filas por la misma razón. Ningún usuario autenticado SHALL poder ejecutar `DELETE` sobre `asset_details`. Toda consulta SHALL filtrar además por `organization_id`, y una organización SHALL NOT alcanzar los activos de otra. Las altas y los cambios SHALL registrarse en la bitácora mediante el trigger de auditoría, en la misma migración que crea la tabla.

#### Scenario: El ayudante no lee los activos

- **WHEN** un ayudante consulta `asset_details` de su organización
- **THEN** obtiene cero filas

#### Scenario: El ayudante no escribe activos

- **WHEN** un ayudante intenta registrar o modificar datos de un activo
- **THEN** la base de datos rechaza la operación

#### Scenario: El ayudante tampoco lee la recuperación

- **WHEN** un ayudante consulta el derivado de recuperación de inversión
- **THEN** obtiene cero filas

#### Scenario: Nada se borra

- **WHEN** un usuario autenticado intenta ejecutar `DELETE` sobre `asset_details`
- **THEN** la operación se rechaza

#### Scenario: Ninguna organización ve a otra

- **WHEN** la persona dueña de una organización consulta los activos
- **THEN** obtiene únicamente los de su propia organización

#### Scenario: El alta queda en la bitácora

- **WHEN** se registran los datos de un activo
- **THEN** el evento aparece en la bitácora con su autor y su fecha

### Requirement: Activos solo en el menú del dueño y redirección por dirección directa

La entrada "Activos" SHALL aparecer en el menú de la persona dueña —en el menú lateral de escritorio y dentro del panel "Más" del celular— y SHALL NOT aparecer en el del ayudante. Un ayudante que abra `/assets` por dirección directa SHALL ser redirigido a su aterrizaje habitual, sin pantalla de "no autorizado", igual que ocurre con `/expenses`.

#### Scenario: El menú del ayudante no la ofrece

- **WHEN** un ayudante abre su menú en cualquiera de las dos superficies
- **THEN** no contiene "Activos"

#### Scenario: El menú del dueño la ofrece en ambas superficies

- **WHEN** la persona dueña abre su menú lateral de escritorio o el panel "Más" del celular
- **THEN** contiene "Activos" y lleva a la pantalla de activos

#### Scenario: Dirección directa del ayudante

- **WHEN** un ayudante abre `/assets` escribiendo la dirección
- **THEN** es llevado a su aterrizaje habitual, sin mensaje de acceso denegado

### Requirement: Un activo es un destino vinculable válido para una tarea

La validación de vínculos de tarea SHALL aceptar `entity_type = 'asset'` cuando el identificador corresponde a un activo existente, y SHALL seguir rechazando el vínculo cuando no corresponde a ninguno. Esta capacidad SHALL limitarse a la validación en la base de datos: ninguna interfaz crea vínculos a activos todavía.

#### Scenario: Vínculo a un activo existente

- **WHEN** se guarda un vínculo de tarea con `entity_type = 'asset'` apuntando a un activo de la organización
- **THEN** la base de datos lo acepta

#### Scenario: Vínculo a un activo inexistente

- **WHEN** se guarda un vínculo de tarea con `entity_type = 'asset'` cuyo identificador no corresponde a ningún activo
- **THEN** la base de datos rechaza la operación

### Requirement: Semilla de activos de Geeko Store

Tras reiniciar la base de datos local, la organización de ejemplo SHALL contar con al menos dos activos con sus datos completos en líneas distintas, uno de ellos con al menos un gasto de mantenimiento vinculado y uno con el egreso de adquisición vinculado, y con movimientos de dinero anteriores y posteriores a las fechas de adquisición. La semilla SHALL bastar para ver la pantalla de activos con barras en estados distintos sin capturar datos a mano.

#### Scenario: Semilla presente tras el reinicio

- **WHEN** se reinicia la base de datos local
- **THEN** existen al menos dos activos con costo y fecha, uno con mantenimiento vinculado y uno con su egreso de adquisición vinculado

#### Scenario: Las barras no salen todas iguales

- **WHEN** se abre la pantalla de activos sobre la semilla
- **THEN** las barras muestran estados distintos entre sí, incluida al menos una que no está en 0 %
