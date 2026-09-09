# KAM-20 · Reportes

## Why

El objetivo declarado del producto es responder **siete preguntas** sin cálculos aparte y sin abrir una hoja de cálculo (especificación §2). Diecinueve tareas después, Kamay tiene todos los hechos registrados —pedidos, ventas, compras, gastos, cobros, pagos, consumos y activos— y responde bien tres de esas preguntas: la 5 (¿ya se pagó sola la impresora?) desde KAM-19, la 6 (¿qué tengo pendiente?) desde KAM-17 y la 7 (¿qué cambió aquí?) desde KAM-03. Las cuatro primeras —**cuánto gano realmente, en qué se me va el dinero, qué me conviene empujar, qué insumos se me acaban**— siguen exigiendo abrir cuatro pantallas y sumar de cabeza.

El panel (KAM-14) responde "cómo va el mes" en cinco segundos, y esa es su virtud: **un solo periodo, sin selector, y a propósito**. La pregunta de negocio es otra. "¿Gané más en Sublimación o en Alfarería el trimestre pasado?" no cabe en el panel y no debe caber: es la pregunta de V14.

Esta tarea entrega **V14 · Reportes**: cinco informes sobre un mismo periodo y una misma línea, con la regla de reparto de gastos compartidos escrita junto al resultado, exportables, y con cada fila abriendo su registro de origen. Cierra la Fase 3.

> **Posición en la secuencia.** El backlog sitúa KAM-20 tras KAM-18 (inventario suave) y KAM-19 (activos y recuperación de inversión). **Ambas están fusionadas**: KAM-18 aportó `inventory_movements` e `item_balances`; KAM-19, `asset_details`, `asset_recovery` y —lo que más importa aquí— `line_cash_movements`, la vista al grano de fila que resuelve la línea de cada movimiento de dinero. KAM-20 se construye sobre las tres. Ver la sección *Dependencias satisfechas*.

## What Changes

### V14 · Reportes (`/reports`, página nueva, solo dueño)

Una sola pantalla con **selector de periodo** y **selector de línea** en la cabecera, y cinco informes debajo. Escritorio en retícula; en móvil, un informe por pantalla con el selector arriba (mapa §"Adaptación móvil"). La ruta es **exclusiva de la persona dueña**: no aparece en el menú del ayudante y no responde por dirección directa.

- **Selector de periodo con atajos.** Este mes, mes anterior, últimos 3 meses, este año, y un rango libre. El periodo es **uno solo para los cinco informes**: cambiarlo los recalcula todos, y las cifras cuadran entre ellos porque comparten el corte. El rango se corta en la zona horaria de la organización, con el mismo criterio que `cash_flow_by_line_month` (KAM-14).
- **Selector de línea** con la opción **Todas**. V14 es, junto a V20, una de las dos vistas que **ignoran deliberadamente** el selector global de línea en su informe comparativo (mapa §"Selector de línea", nota explícita): el comparativo muestra siempre todas las líneas, aunque el selector superior tenga una elegida.

#### Los cinco informes

1. **Rentabilidad.** Por pedido y por producto: ingresos, costo de materiales, margen y porcentaje de margen. El costo de materiales sale de los **egresos asignados al pedido** (KAM-09, la casilla "asignar a un pedido" de V9), nunca de una receta —el costeo por receta está fuera de alcance hasta la Fase 5—. **Los consumos de inventario no entran**, y no por olvido: KAM-18 graba todo consumo con origen `manual` y solo prellena la nota con la referencia del pedido, de modo que no existe forma de consultar los consumos de un pedido. Ver el supuesto 8.
2. **En qué se va el dinero.** Egresos del periodo desglosados por **categoría de gasto** y por **línea**, con compras y gastos distinguidos por `kind`, y el peso relativo de cada categoría.
3. **Qué se vende más.** Ranking de productos, **ordenable por unidades y por margen**, con ambas columnas siempre visibles: el valor del informe está justamente en distinguir el producto que vende mucho y deja poco. Incluye el canal de venta.
4. **Insumos por acabarse.** Insumos por debajo de su mínimo, con saldo, mínimo, faltante, último costo y proveedor habitual. Cada fila ofrece **crear una tarea de reposición** con V18 prellenada (mapa §"Transiciones", V14 → V18).
5. **Comparativo entre líneas.** Las tres líneas —incluida Alfarería— con ingresos, egresos y margen del periodo, después del reparto de gastos compartidos.

#### Reparto de gastos de la línea General/Compartido

Los egresos que caen en la línea `is_shared` no son de nadie y son de todos. Hasta hoy se quedaban ahí y ninguna línea cargaba con ellos, lo que hace que la suma de los márgenes por línea no cuadre con el margen total. V14 los **reparte** entre las líneas no compartidas, con una regla **configurable en `/settings/general`** y **escrita junto al resultado** en toda pantalla y toda exportación que la aplique.

Tres reglas, decididas con la persona usuaria:

- **Proporcional a los ingresos** de cada línea en el periodo (por defecto; es la recomendación de la especificación §"Decisiones pendientes" nº 2).
- **Partes iguales** entre las líneas activas no compartidas.
- **Manual**: porcentajes fijos por línea, que deben sumar 100 %.

La regla se aplica **en la lectura**, nunca reescribiendo el egreso: el gasto sigue perteneciendo a General/Compartido en `expenses`, y cambiar la regla cambia todos los informes, incluidos los de periodos pasados. La leyenda visible dice qué regla se usó y con qué proporciones resultantes.

#### Exportación

Cualquier informe, **con sus filtros aplicados**, se exporta a hoja de cálculo. La exportación incluye la cabecera de periodo y línea y, cuando el informe aplica reparto, la leyenda de la regla: un archivo suelto en el escritorio de alguien tiene que poder explicarse solo.

#### Cada fila abre su registro

Una fila de rentabilidad abre su pedido (V4); una de productos, su ítem (V11); una de egresos, su egreso (V7); una de insumos, su ítem (V11). Sin excepciones y sin filas muertas.

### Configuración: la regla de reparto

`/settings/general` suma el bloque **Reparto de gastos compartidos**: elección de regla, y —solo para la manual— los porcentajes por línea con validación de suma 100 %. Es el hueco que KAM-04 dejó declarado y difirió a esta tarea.

### Fuera de alcance (copiado del backlog)

- **Costeo por receta.** El costo de materiales se toma de los consumos registrados y los gastos asignados. Las fichas de producto son de la Fase 5.
- **Proyecciones, metas, tableros configurables, métricas inventadas.**

Derivado de lo anterior, tampoco entran: la **comparación entre periodos** (periodo actual contra el anterior en la misma tabla), que la especificación sitúa en la Fase 5 junto al reparto avanzado; los informes para el ayudante, que no existen ni pueden existir porque la matriz de acceso §16 le niega V14 entera; los **informes programados o enviados por correo**; la exportación a PDF; y cualquier gráfico interactivo con zoom o cruce de series —los cinco informes llevan un gráfico de lectura y su tabla ordenable equivalente, que es lo que pide V14—.

## Capabilities

### New Capabilities

- `reports`: la pantalla V14 completa —el periodo compartido por los cinco informes, el selector de línea y su excepción en el comparativo, los cinco informes con sus cifras y su ordenación, la navegación de cada fila a su registro de origen, la exportación con contexto, y el recorte a la persona dueña verificable en base de datos—.
- `shared-expense-allocation`: el reparto de los egresos de la línea General/Compartido —las tres reglas, su configuración, su aplicación en lectura y no en escritura, y la obligación de mostrar la regla junto a todo resultado que la aplique—. Es una capacidad propia y no parte de `reports` porque su regla vive en la configuración de la organización, la consumirá también KAM-19 al calcular la recuperación por línea, y su invariante —"nunca sin la leyenda"— debe poder verificarse aparte de cualquier informe concreto.

### Modified Capabilities

- `org-configuration`: se añade el requisito de **configurar la regla de reparto de gastos compartidos** en `/settings/general`, con sus tres modos, la validación de la suma 100 % en el modo manual y el recorte a la persona dueña. KAM-04 lo declaró explícitamente fuera de su alcance y lo difirió aquí.
- `expenses`: se añade el requisito de **agregación de egresos por categoría y línea dentro de un periodo**, con compras y gastos distinguidos por `kind`. Hoy `expense_totals` es un total por egreso, sin periodo ni agrupación; el informe *en qué se va el dinero* necesita el agregado, y componerlo en el servicio contradiría la convención nº 4.
- `payments`: `cash_flow_by_line_month` (KAM-14) agrega **por mes calendario**, que es exactamente lo que el panel necesita y lo que V14 no puede usar: un periodo de V14 puede empezar el día 12. Se añade el requisito de **flujo de caja por línea dentro de un rango arbitrario**, del que el agregado mensual pasa a ser un caso particular.
- `orders`: se añade el requisito de **ranking de productos vendidos dentro de un periodo, con unidades y margen**. Los hechos de venta viven en `order_items`, que es de esta capacidad. `best_selling_products` (KAM-12, capacidad `fair-mode`) tiene la ventana de 90 días **incrustada en la vista** y no expone margen: sirve a la retícula de feria y no puede servir a un informe con periodo elegido. El requisito nuevo no lo sustituye ni lo toca; declara el ranking con periodo como lectura propia.

## Impact

**Código afectado**

- `app/(app)/reports/page.tsx` — ruta nueva; resuelve rol en el servidor y responde 404/redirección al ayudante antes del primer render, como ya hace `/expenses`.
- `app/(app)/settings/general/` — suma el bloque de la regla de reparto.
- `features/reports/*` — cabecera con los dos selectores, los cinco informes con su gráfico y su tabla ordenable, la leyenda de reparto, el botón de exportar y la composición móvil (feature nueva).
- `features/settings/*` — formulario de la regla de reparto.
- `services/reports/*` — una lectura por informe; `services/configuration/*` para leer y guardar la regla.
- `lib/reports/*` — resolución del periodo y sus atajos en la zona horaria de la organización, **la fórmula de margen y la del reparto en un solo lugar cada una**, y la serialización a hoja de cálculo.
- `components/layout/*` — la entrada *Reportes* del menú "Más" y de la barra superior, filtrada por rol.

**Se lee pero no se modifica:** `order_totals`, `expense_totals`, `receivables_by_line` (KAM-09/KAM-10); `item_last_cost` (KAM-09); `best_selling_products` (KAM-12); `item_balances` (KAM-18); `line_cash_movements` y `asset_recovery` (KAM-19); `resolve_statuses` y la comparación por `kind` (KAM-05); `organizations.timezone` y `currency` (KAM-02); `BusinessLineProvider` (KAM-04).

**Base de datos:** una migración nueva con las vistas y funciones derivadas de los informes —todas con `security_invoker = true` (convención nº 4) y con el recorte a la persona dueña **dentro** de la definición, como `cash_flow_by_line_month`, para que el criterio 6 sea una prueba pgTAP y no una comprobación de navegador—, más los índices que las hagan responder en el presupuesto, más su prueba pgTAP. **Ninguna tabla nueva. Ninguna cifra almacenada.** La regla de reparto se guarda en `organizations.settings`, que existe desde KAM-02 y sigue sin usarse.

**Dependencias:** el componente `chart` de shadcn/ui —sobre Recharts—, que KAM-14 difirió explícitamente a esta tarea "que elegirá su herramienta conociendo sus cinco informes" y que llega por el registro de componentes que el proyecto ya usa. **Ninguna dependencia nueva para la exportación**: el CSV se escribe a mano. Ambas decisiones se justifican en `design.md` (D7 y D8).

**Pruebas:** integración comparando **cada uno de los cinco informes** contra el cálculo directo sobre una semilla conocida, y comprobando que el ayudante obtiene cero filas de cada derivado; pgTAP sobre el acceso por rol y sobre el reparto; unitarias sobre la resolución del periodo y sus atajos, la fórmula de margen, las tres reglas de reparto y sus casos límite —ingresos cero, una sola línea activa, porcentajes que no suman 100— y la serialización; e2e sobre cambio de periodo y de línea, ordenación por margen, exportación, apertura de una fila y acceso denegado al ayudante.

## Dependencias satisfechas

Las dos tareas que el backlog pone antes de KAM-20 están fusionadas, y cada una dejó algo que este cambio usa:

- **KAM-18 · Inventario suave** — `item_balances` con su `below_min` es la fuente entera del informe *insumos por acabarse*. `inventory_movements` **no** se usa para costear: no lleva costo unitario y su consumo no se enlaza al pedido (supuesto 8).
- **KAM-19 · Activos** — `line_cash_movements` resuelve la línea de negocio de cada cobro y de cada pago al grano de fila, con el recorte al dueño ya dentro y `security_invoker`. Es la base sobre la que se agregan los informes de dinero, y evita reescribir esa unión por tercera vez. `asset_recovery` no se lee desde V14, pero comparte con ella la fórmula de margen por línea, que por eso vive en un solo módulo.

## Supuestos registrados

1. **KAM-20 entra completo, con sus cinco informes.** Decidido con la persona usuaria frente a la alternativa de recortar el alcance. Se planificó mientras KAM-18 y KAM-19 seguían pendientes y se aplica con las dos ya fusionadas, de modo que ninguna de sus piezas queda esperando.
2. **Tres reglas de reparto: proporcional a ingresos (por defecto), partes iguales y manual.** Decidido con la persona usuaria. El backlog pide "regla configurable" sin enumerarlas; la especificación §"Decisiones pendientes" nº 2 recomienda la proporcional como valor por defecto.
3. **El reparto se aplica en la lectura, nunca reescribiendo el egreso.** Es la única lectura compatible con la convención nº 4 (nada derivado se almacena) y con el criterio 3, que exige que la regla se pueda ver junto al resultado: una regla ya materializada en filas no se puede mostrar, solo se puede creer.
4. **Los informes de dinero se miden en caja, igual que el panel.** KAM-14 fijó ese criterio (su supuesto 1) y anticipó que V14 "podrá ofrecer la lectura devengada sin contradecirlo". Ofrecer las dos bases aquí duplicaría cada cifra y el criterio 1 —"las cifras cuadran entre los informes"— dejaría de tener un significado único. Se registra como deuda declarada, no como omisión.
5. **Los atajos de periodo son cinco: este mes, mes anterior, últimos 3 meses, este año, rango libre.** El backlog dice "selector de periodo con atajos" sin enumerarlos. Se toman los que el mapa §"Recorridos" ya ejercita (`V2 → V14` llega con "periodo mes anterior") más el rango de doce meses que el criterio 8 exige poder pedir.
6. **El presupuesto de 3 segundos del criterio 8 se mide sobre la semilla de Geeko Store ampliada a doce meses de movimientos**, sobre la carga completa de la ruta y no sobre una pintura parcial. Es el mismo protocolo con el que KAM-14 verificó su presupuesto de 1,5 s.
7. **La exportación produce CSV con separador de coma y codificación UTF-8 con BOM.** El backlog dice "hoja de cálculo" sin fijar formato. CSV se abre en cualquier herramienta, no arrastra dependencia de escritura de XLSX y conserva las cifras sin formato de moneda, que es lo que quiere quien va a seguir calculando. El BOM es lo que evita que los acentos se rompan al abrirlo en Excel.
8. **El costo de materiales se limita a los egresos asignados al pedido.** Decidido con la persona usuaria al descubrir, ya con KAM-18 fusionada, que un consumo de inventario no se puede atribuir a un pedido: `inventory_movements` no lleva costo unitario, y KAM-18 decidió explícitamente que todo consumo nace con `source_type = 'manual'` —dejando `'order_item'` declarado y sin uso— porque un pedido consume varios insumos y el índice único de aquella tabla no lo admitía. Enlazarlos sería modificar una capacidad ya fusionada, y eso excede KAM-20. **La consecuencia a tener presente:** la marca *sin costo registrado* será el caso frecuente y no la excepción, y por eso el informe la trata como pieza central. Costear de verdad exige las fichas de producto de la Fase 5.
