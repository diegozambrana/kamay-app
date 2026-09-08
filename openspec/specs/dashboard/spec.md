# dashboard Specification

## Purpose

El panel principal V2: la pantalla que responde en cinco segundos cómo va el negocio, con una composición para la persona dueña —cifras de caja del mes, comparativo por línea, entregas próximas y últimos movimientos— y una composición propia y completa para el ayudante, de la que el dinero está ausente por construcción y no por ocultamiento.

> Origen: `specs/PRD/kamay-backlog.md` — KAM-14; `specs/PRD/kamay-especificacion-producto-v6.md` — V2, §16 (matriz de acceso); `specs/PRD/kamay-mapa-navegacion-ui.md` §4.1, §5 (V2 y sus destinos); `specs/PRD/ARCHITECTURE.md` (convención 4: nada derivado se almacena; convención 5: los estados se comparan por `kind`; convención 7: un solo historial).

## Requirements

### Requirement: El panel es la puerta de entrada de escritorio y se compone según el rol

El sistema SHALL ofrecer el panel principal en `/dashboard` para todo miembro autenticado de la organización activa, y SHALL resolver el rol en el servidor antes del primer render. La persona dueña SHALL recibir la composición completa; el ayudante SHALL recibir la variante descrita en este documento. Ninguna de las dos composiciones SHALL obtenerse ocultando piezas de la otra en el cliente: el servidor SHALL enviar únicamente las piezas que corresponden al rol.

#### Scenario: La persona dueña recibe la composición completa

- **WHEN** una persona dueña abre `/dashboard`
- **THEN** ve las tarjetas de indicadores, el comparativo por línea, las entregas próximas, los últimos movimientos de la bitácora y los marcadores de posición

#### Scenario: El ayudante recibe su propia composición

- **WHEN** un ayudante abre `/dashboard`
- **THEN** ve su propia composición y no recibe del servidor ningún dato de las piezas de dinero ni de bitácora

#### Scenario: El rol se decide antes de pintar

- **WHEN** un ayudante abre `/dashboard`
- **THEN** la primera respuesta ya viene compuesta para su rol, sin que la pantalla muestre primero piezas del dueño y las retire después

### Requirement: Indicadores de caja del mes en curso

El panel SHALL mostrar a la persona dueña cuatro indicadores: **Ingresos**, **Egresos**, **Margen** y **Por cobrar**.

Ingresos SHALL ser el dinero cobrado dentro del mes calendario en curso; Egresos, el dinero pagado dentro del mismo mes; Margen, la resta de ambos, y SHALL poder ser negativo. Los tres SHALL medirse por la fecha del movimiento de dinero, no por la fecha del pedido o del egreso al que apunta, y SHALL excluir los movimientos anulados. Por cobrar SHALL ser el saldo pendiente vivo completo, sin recorte de periodo, tal como ya lo define la capacidad `payments`.

Ningún indicador SHALL almacenarse: los cuatro SHALL derivarse en la lectura.

#### Scenario: Cobro y pago del mes

- **WHEN** en el mes en curso se cobraron 900 y se pagaron 350
- **THEN** Ingresos muestra 900, Egresos 350 y Margen 550

#### Scenario: El margen negativo se muestra tal cual

- **WHEN** en el mes en curso se cobraron 200 y se pagaron 800
- **THEN** Margen muestra −600, sin recortarse a cero

#### Scenario: Manda la fecha del movimiento, no la del pedido

- **WHEN** un pedido del mes anterior se cobra dentro del mes en curso
- **THEN** su importe suma a los Ingresos del mes en curso y no a los del mes anterior

#### Scenario: Lo anulado no cuenta

- **WHEN** un cobro del mes en curso se anula
- **THEN** deja de sumar a los Ingresos del mes

#### Scenario: Por cobrar ignora el periodo

- **WHEN** existe un pedido con saldo pendiente originado hace tres meses
- **THEN** su saldo sigue contando en Por cobrar aunque no haya movimiento en el mes en curso

#### Scenario: Un mes sin movimiento muestra cero

- **WHEN** el mes en curso no tiene ningún cobro ni pago
- **THEN** los indicadores muestran 0, no nulo ni la pantalla vacía

### Requirement: Todo el panel responde al selector de línea

Cada pieza del panel SHALL recalcularse para la línea de negocio activa. Con la línea "Todas", los indicadores SHALL sumar todas las líneas de la organización. Al cambiar la línea activa, los indicadores, el comparativo, las entregas próximas y los últimos movimientos SHALL reflejar la nueva selección sin recargar manualmente la página.

La línea de un movimiento de dinero SHALL deducirse del pedido o del egreso al que apunta.

#### Scenario: Con "Todas" se suman las líneas

- **WHEN** la línea activa es "Todas" y hay tres líneas con 100, 200 y 300 cobrados en el mes
- **THEN** el indicador de Ingresos muestra 600

#### Scenario: Al elegir una línea se recalcula todo

- **WHEN** se cambia el selector de "Todas" a Sublimación
- **THEN** los cuatro indicadores, el comparativo, las entregas próximas y los últimos movimientos pasan a mostrar solo lo de Sublimación

#### Scenario: La línea sale del destino del movimiento

- **WHEN** se cobra un pedido de la línea Alfarería
- **THEN** ese cobro suma a los Ingresos de Alfarería, aunque el movimiento de dinero no declare línea por sí mismo

### Requirement: Comparativo por línea

El panel SHALL mostrar a la persona dueña, además de las cifras agregadas, las mismas tres cifras de caja del mes desglosadas **por línea de negocio**, una fila por línea activa de la organización. El comparativo SHALL mostrarse aunque la línea activa no sea "Todas", y SHALL destacar la línea activa en ese caso. Toda representación gráfica del comparativo SHALL tener una lectura textual equivalente con las mismas cifras.

Una línea sin movimiento en el mes SHALL aparecer con sus tres cifras en cero, no ausente.

#### Scenario: Una fila por línea

- **WHEN** la organización tiene tres líneas activas y la línea activa es "Todas"
- **THEN** el comparativo muestra las tres, cada una con sus ingresos, egresos y margen del mes

#### Scenario: Una línea sin movimiento sigue apareciendo

- **WHEN** una de las líneas no tuvo ningún cobro ni pago en el mes
- **THEN** aparece en el comparativo con ceros, no desaparece de la comparación

#### Scenario: Las barras tienen lectura textual

- **WHEN** el comparativo se representa con barras
- **THEN** las mismas cifras están disponibles como texto legible por lector de pantalla

### Requirement: Entregas próximas

El panel SHALL listar los pedidos no archivados **cuya entrega sigue pendiente** —los que están en un estado de tipo `initial`, `in_progress` o `waiting`— cuya fecha comprometida caiga dentro de los próximos siete días o ya haya pasado, ordenados por fecha comprometida ascendente, con los vencidos destacados y primero. Un pedido en un estado de tipo `final` o `cancelled` SHALL NOT aparecer: ya se entregó o ya no se va a entregar, y con meses de historia acumulada esos pedidos desplazarían de la lista a los que sí siguen comprometidos. La pertenencia a la lista y el destacado SHALL decidirse por el `kind` del estado, nunca por su nombre.

Un pedido sin fecha comprometida SHALL NOT aparecer. Un pedido vencido cuya entrega sigue pendiente SHALL aparecer por antigua que sea su fecha: un compromiso atascado es exactamente lo que esta lista existe para no dejar olvidar.

Cada entrada SHALL llevar al detalle de su pedido.

#### Scenario: Ventana de siete días

- **WHEN** un pedido vence dentro de cinco días y otro dentro de veinte
- **THEN** el primero aparece en entregas próximas y el segundo no

#### Scenario: Lo vencido encabeza y se destaca

- **WHEN** un pedido en un estado de tipo `in_progress` venció hace dos días
- **THEN** aparece primero en la lista y destacado como vencido

#### Scenario: Vencido pero en espera no alarma

- **WHEN** un pedido vencido está en un estado de tipo `waiting`
- **THEN** aparece en la lista sin destacarse como vencido

#### Scenario: Terminado no aparece

- **WHEN** un pedido con fecha pasada está en un estado de tipo `final` o `cancelled`
- **THEN** no aparece en la lista

#### Scenario: Lo vencido y pendiente no se olvida por antiguo

- **WHEN** un pedido en un estado de tipo `in_progress` venció hace tres meses
- **THEN** sigue apareciendo en la lista, destacado como vencido

#### Scenario: Sin fecha comprometida no entra

- **WHEN** un pedido en curso no tiene fecha comprometida
- **THEN** no aparece en entregas próximas

#### Scenario: La entrada lleva a su pedido

- **WHEN** se activa una entrega próxima
- **THEN** se abre el detalle de ese pedido

### Requirement: Últimos movimientos de la bitácora

El panel SHALL mostrar **solo a la persona dueña** los cinco eventos más recientes de la bitácora de la organización, filtrados por la línea activa, redactados en lenguaje natural —quién, qué y cuándo—, con acceso a la pantalla completa de bitácora. Cada evento SHALL llevar al registro afectado cuando ese registro exista y sea alcanzable.

La pieza SHALL estar ausente por completo de la composición del ayudante: no vacía, no rotulada, ausente.

#### Scenario: Los cinco más recientes

- **WHEN** la organización tiene veinte eventos de bitácora
- **THEN** el panel muestra los cinco más recientes, del más nuevo al más antiguo

#### Scenario: En lenguaje natural

- **WHEN** se muestra un evento de cambio de estado de un pedido
- **THEN** se lee como una frase que nombra a la persona, la acción y el registro, sin nombres de tabla ni de columna

#### Scenario: Filtrado por la línea activa

- **WHEN** la línea activa es 3D
- **THEN** solo aparecen eventos de esa línea

#### Scenario: El ayudante no tiene esta pieza

- **WHEN** un ayudante abre el panel
- **THEN** la pieza de últimos movimientos no existe en su pantalla, ni siquiera como sección vacía

### Requirement: Tarjeta de pendientes con los tres conteos

El panel SHALL mostrar, en la ranura que hasta ahora ocupaba el marcador de posición de pendientes, el número de tareas **vencidas**, las que vencen **hoy** y las de los **próximos 7 días**, con las vencidas destacadas en rojo. Los conteos SHALL respetar el alcance del rol de quien mira, igual que la pantalla de pendientes, y SHALL ignorar el selector de línea, porque cuentan lo mismo que ella. Activar la tarjeta SHALL abrir la pantalla de pendientes. Una organización sin ninguna tarea pendiente SHALL ver la tarjeta declarándolo, con ceros reales y no con un marcador.

#### Scenario: Los tres conteos

- **WHEN** el dueño abre el panel de una organización con dos tareas vencidas, una de hoy y tres de la semana
- **THEN** la tarjeta muestra 2, 1 y 3, con el 2 destacado en rojo

#### Scenario: El ayudante cuenta lo suyo

- **WHEN** un ayudante abre el panel
- **THEN** los conteos incluyen solo las tareas de su línea y las asignadas a él

#### Scenario: El selector no altera la cuenta

- **WHEN** se selecciona una línea concreta y se observa la tarjeta
- **THEN** los conteos no cambian, igual que en la pantalla de pendientes

#### Scenario: De la tarjeta a los pendientes

- **WHEN** se activa la tarjeta de pendientes
- **THEN** se abre la pantalla de pendientes

#### Scenario: Sin nada pendiente

- **WHEN** no hay ninguna tarea pendiente en el alcance de quien mira
- **THEN** la tarjeta lo declara con ceros reales, y no como marcador de posición

### Requirement: Marcador de posición de insumos bajo mínimo

El panel SHALL reservar el sitio de la única pieza cuyo contenido sigue llegando en una tarea posterior —la tarjeta de insumos bajo mínimo— rindiéndola con su rótulo definitivo y una leyenda visible de que aún no está disponible. Ese marcador SHALL NOT ofrecer una acción que no funcione ni presentar cifras inventadas, y SHALL ocupar la misma ranura que ocupará su contenido definitivo.

#### Scenario: El marcador que queda está rotulado

- **WHEN** se abre el panel con cualquiera de los dos roles
- **THEN** la tarjeta de insumos bajo mínimo aparece con su rótulo y su leyenda de no disponible

#### Scenario: El marcador no engaña

- **WHEN** se observa el marcador de insumos bajo mínimo
- **THEN** no muestra ningún número ni ofrece ningún control que no lleve a ninguna parte

#### Scenario: Pendientes ya no es marcador

- **WHEN** se abre el panel con cualquiera de los dos roles
- **THEN** la tarjeta de pendientes muestra sus conteos y enlaza a su pantalla, sin leyenda de no disponible

### Requirement: La variante del ayudante es un diseño propio, sin dinero y sin huecos

La composición del ayudante SHALL NOT contener ningún importe monetario: ni indicadores, ni comparativo, ni totales, ni saldos, ni importes dentro de las entregas próximas. SHALL NOT contener la pieza de bitácora. SHALL NOT presentar secciones vacías, rótulos sin contenido ni espacios reservados donde el dueño tiene sus piezas: el espacio disponible SHALL redistribuirse entre las piezas que el ayudante sí usa, empezando por las entregas próximas, que SHALL ser su pieza principal.

El recorte SHALL ser efectivo también fuera de la interfaz: un ayudante que consulte directamente la fuente de datos de los indicadores del mes SHALL obtener cero filas.

#### Scenario: Ningún importe en pantalla

- **WHEN** un ayudante abre el panel de una organización con cobros, pagos y pedidos con saldo
- **THEN** ninguna cifra monetaria aparece en la pantalla

#### Scenario: Tampoco por consulta directa

- **WHEN** un ayudante consulta directamente la fuente derivada que alimenta los indicadores del mes
- **THEN** obtiene cero filas

#### Scenario: Sin huecos donde estaban las piezas del dueño

- **WHEN** un ayudante abre el panel
- **THEN** no hay secciones vacías, rótulos sin datos ni espacios en blanco en el lugar que ocupan las tarjetas de dinero, el comparativo y la bitácora del dueño

#### Scenario: Las entregas encabezan su pantalla

- **WHEN** un ayudante abre el panel
- **THEN** las entregas próximas son la pieza principal de su composición

### Requirement: Cada pieza del panel lleva a su pantalla

El panel SHALL ser un punto de partida y no un destino: activar un indicador SHALL llevar a reportes, una entrega próxima al detalle de su pedido, un movimiento de bitácora a la pantalla de bitácora, y un marcador de posición SHALL NOT llevar a ninguna parte mientras siga siendo marcador. Cuando la pantalla de destino aún no exista, el panel SHALL declararlo visiblemente en lugar de ofrecer un enlace roto.

#### Scenario: Del indicador a reportes

- **WHEN** existe la pantalla de reportes y se activa un indicador
- **THEN** se abre esa pantalla

#### Scenario: Del movimiento a la bitácora

- **WHEN** existe la pantalla de bitácora y se activa un movimiento
- **THEN** se abre esa pantalla

#### Scenario: Destino inexistente, declarado

- **WHEN** la pantalla de destino de una pieza todavía no se ha construido
- **THEN** la pieza lo declara y no ofrece un enlace que no lleva a ninguna parte

### Requirement: El panel es utilizable en un teléfono

El panel SHALL apilarse en una sola columna en un viewport de 390 px, SHALL NOT exigir desplazamiento horizontal y SHALL mantener el orden de importancia de cada composición. La puerta de entrada del celular SHALL seguir siendo la pantalla de registro rápido: este requisito no cambia dónde aterriza cada dispositivo ni qué ranuras ocupa la barra inferior.

#### Scenario: Una columna en 390 px

- **WHEN** se abre el panel en un viewport de 390 px
- **THEN** las piezas se apilan en una columna y ninguna obliga a desplazarse horizontalmente

#### Scenario: El aterrizaje no cambia

- **WHEN** una persona inicia sesión desde un teléfono
- **THEN** sigue aterrizando en el registro rápido, no en el panel

### Requirement: El panel carga dentro de su presupuesto

El panel SHALL completar su carga en menos de 1,5 segundos con doce meses de datos sembrados, medido sobre la carga de la ruta y no sobre una pintura parcial. Ninguna cifra del panel SHALL almacenarse para conseguirlo: el presupuesto SHALL cumplirse con datos derivados en la lectura.

#### Scenario: Doce meses sembrados

- **WHEN** se abre el panel de una organización con doce meses de pedidos, egresos y movimientos de dinero sembrados
- **THEN** la pantalla queda cargada en menos de 1,5 segundos

#### Scenario: Nada se precalcula en una columna

- **WHEN** se revisa el esquema tras esta capacidad
- **THEN** ninguna tabla guarda ingresos, egresos, margen ni saldo del panel
