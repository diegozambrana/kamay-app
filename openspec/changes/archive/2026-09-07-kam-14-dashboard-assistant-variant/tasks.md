> Cada tarea de prueba nombra los escenarios del delta spec que cubre (convención nº 12: ningún escenario sin prueba referenciada). Los escenarios viven en `specs/dashboard/spec.md`, `specs/payments/spec.md`, `specs/activity-log/spec.md`, `specs/quick-capture/spec.md` y `specs/user-auth/spec.md` de este cambio. Las decisiones citadas (D1–D11) son las de `design.md`.

## 1. Derivado de flujo de caja

- [x] 1.1 Crear la migración `supabase/migrations/YYYYMMDDHHMMSS_dashboard_cash_flow.sql` con la vista `cash_flow_by_line_month` (`security_invoker = true`), agregada por `(organization_id, business_line_id, month)` y con columnas `collected` y `paid` (D2). Ningún indicador en columna: convención nº 4 y criterio 5 del backlog.
- [x] 1.2 Componer la vista como `union all` de dos ramas —cobros contra `orders`, pagos contra `expenses`— para deducir la línea del destino del movimiento, no con dos `left join` y un `coalesce` (D3). Excluir los movimientos archivados y los destinos archivados.
- [x] 1.3 Calcular el mes con `date_trunc('month', p.occurred_at at time zone o.timezone)`, uniendo `organizations` para tomar su zona horaria. Nunca la del servidor (D2).
- [x] 1.4 Añadir la condición `is_owner(organization_id)` dentro de la vista (D4) con el comentario que explica por qué `security_invoker` no basta aquí: el ayudante sí lee los cobros fila a fila desde KAM-10.
- [x] 1.5 `grant select` sobre la vista a `authenticated` y `service_role`, siguiendo la nota de `20260826200000` (las vistas no heredan la lectura igual en todos los entornos).
- [x] 1.6 Añadir en la misma migración el índice `payments (organization_id, occurred_at)`, que es como consulta la vista y hoy no existe (D11).
- [x] 1.7 `supabase/tests/dashboard_cash_flow.test.sql` (pgTAP): cubre *Flujo de caja del periodo por línea* → «Cobrado y pagado del mes», «Cada movimiento cae en el mes en que ocurrió», «El movimiento anulado no suma», «La línea la pone el destino», «Un mes sin movimiento no inventa filas». Cada prueba crea su propia organización.
- [x] 1.8 Ampliar la misma prueba con el recorte de acceso: cubre *Flujo de caja del periodo por línea* → «El ayudante obtiene cero filas», «Ninguna organización ve a otra»; y *La variante del ayudante es un diseño propio, sin dinero y sin huecos* → «Tampoco por consulta directa». Distinguir explícitamente cero filas por recorte de cero filas por mes sin movimiento (riesgo declarado en design).
- [x] 1.9 Ejecutar `supabase db reset` y `supabase test db`, y regenerar el grafo con `graphify update .` (convención nº 6).

## 2. Lectura del panel

- [x] 2.1 Crear `services/dashboard/dashboard-service.ts` con `cashFlowForMonth(organizationId, month, lineId | null)`: lee `cash_flow_by_line_month` y devuelve el agregado de la línea activa y el desglose por línea en una sola consulta, sin sumar en JavaScript lo que la vista ya suma (D2).
- [x] 2.2 Añadir `receivables(organizationId, lineId | null)` leyendo `receivables_by_line`, que ya existe desde KAM-10. No rehacerla.
- [x] 2.3 Añadir `upcomingDeliveries(organizationId, lineId | null, today)`: pedidos no archivados con `due_date` no nula y `<= today + 7 días`, **restringidos a los estados de tipo `initial`, `in_progress` y `waiting`**, con el `kind` de su estado, ordenados por `due_date` ascendente y acotados. Sin ninguna decisión de retraso en la consulta (D7). El recorte por estado se añadió al implementar 7.1: con doce meses sembrados, los pedidos ya entregados desplazaban de la lista a los pendientes.
- [x] 2.4 Crear `lib/dashboard/period.ts` con el mes en curso en la zona horaria de la organización (`monthRangeInTimezone`), reutilizando el criterio de `todayInTimezone` de `lib/orders/overdue` en vez de una segunda forma de resolver "hoy".
- [x] 2.5 Crear `lib/dashboard/indicators.ts` con las derivadas puras: `marginOf(collected, paid)`, el relleno de líneas sin movimiento a cero y el orden del comparativo.
- [x] 2.6 `lib/dashboard/indicators.test.ts`: cubre *Indicadores de caja del mes en curso* → «Cobro y pago del mes», «El margen negativo se muestra tal cual», «Un mes sin movimiento muestra cero»; y *Comparativo por línea* → «Una línea sin movimiento sigue apareciendo».
- [x] 2.7 `lib/dashboard/period.test.ts`: cubre *Indicadores de caja del mes en curso* → «Manda la fecha del movimiento, no la del pedido» sobre el límite de mes, incluida una fecha que cae en meses distintos según la zona horaria.
- [x] 2.8 `services/dashboard/dashboard-service.test.ts`: cubre *Todo el panel responde al selector de línea* → «Con "Todas" se suman las líneas», «La línea sale del destino del movimiento»; y *Entregas próximas* → «Ventana de siete días», «Sin fecha comprometida no entra», «Terminado no aparece», «Lo vencido y pendiente no se olvida por antiguo».
- [x] 2.9 `services/activity/activity-service.test.ts`: cubre *Últimos movimientos de la bitácora* → «Filtrado por la línea activa», comprobando que el filtro de línea llega a la consulta y no se aplica después en memoria.

## 3. Lectura de la bitácora

- [x] 3.1 Crear `services/activity/activity-service.ts` con `recent(organizationId, { limit, lineId })`: consulta acotada a `activity_log`, orden descendente por `occurred_at`, tope de filas impuesto por el servicio y no por quien llama (D8). Sin comprobación de rol: la RLS de la tabla ya recorta al dueño.
- [x] 3.2 Crear `lib/activity/describe.ts`: función pura que convierte un evento en una frase —persona, acción, registro— sin nombres de tabla ni de columna, con atribución al `actor_label` cuando no hay persona y una redacción genérica legible para una acción desconocida (D8).
- [x] 3.3 `lib/activity/describe.test.ts`: cubre *An event can be rendered as a natural-language sentence* → «A status change reads as a sentence», «A system actor is named», «An unknown action degrades gracefully».
- [x] 3.4 `supabase/tests/activity_recent.test.sql` (pgTAP): cubre *Recent activity is read through one bounded, owner-only query* → «Newest first, capped», «Restricted to one business line», «Assistant still reads nothing», «Another organization's events never appear».

## 4. Piezas del panel

- [x] 4.1 Crear `features/dashboard/indicator-cards.tsx`: las cuatro tarjetas —Ingresos, Egresos, Margen, Por cobrar— con formato de moneda de la organización, margen negativo mostrado tal cual y el enlace a reportes previsto por *Cada pieza del panel lleva a su pantalla*.
- [x] 4.2 Crear `features/dashboard/line-comparison.tsx`: barras horizontales en CSS (D6), una fila por línea activa, con la línea activa destacada cuando no es "Todas" y una tabla equivalente para lectura asistida. Sin librería de gráficos.
- [x] 4.3 Crear `features/dashboard/upcoming-deliveries.tsx`: lista ordenada por fecha, vencidos primero y destacados, decidiendo el destacado con `isOverdue` de `lib/orders/overdue` (D7). Cada entrada enlaza al detalle de su pedido. La variante del ayudante la rinde sin ningún importe.
- [x] 4.4 Crear `features/dashboard/recent-activity.tsx`: los cinco eventos más recientes redactados con `describe`, con acceso a la pantalla de bitácora.
- [x] 4.5 Crear `features/dashboard/placeholder-card.tsx` y rendir con ella los marcadores de pendientes (KAM-17) e insumos bajo mínimo (KAM-18): rótulo definitivo, leyenda de no disponible, sin cifras y sin controles que no lleven a ninguna parte.
- [x] 4.6 `features/dashboard/line-comparison.test.tsx`: cubre *Comparativo por línea* → «Una fila por línea», «Las barras tienen lectura textual».
- [x] 4.7 `features/dashboard/upcoming-deliveries.test.tsx`: cubre *Entregas próximas* → «Lo vencido encabeza y se destaca», «Vencido pero en espera no alarma», «Terminado no aparece», «Lo vencido y pendiente no se olvida por antiguo», «La entrada lleva a su pedido».
- [x] 4.8 `features/dashboard/recent-activity.test.tsx`: cubre *Últimos movimientos de la bitácora* → «Los cinco más recientes», «En lenguaje natural».
- [x] 4.9 `features/dashboard/placeholder-card.test.tsx`: cubre *Marcadores de posición declarados* → «Los dos marcadores están rotulados», «El marcador no engaña».

## 5. Las dos composiciones

- [x] 5.1 Crear `features/dashboard/owner-dashboard.tsx`: retícula con indicadores, comparativo, entregas próximas, últimos movimientos y los dos marcadores.
- [x] 5.2 Crear `features/dashboard/assistant-dashboard.tsx` como composición hermana e independiente (D5): entregas próximas como pieza principal y con más detalle, los dos marcadores, y ni una sola pieza de dinero o bitácora — tampoco vacía.
- [x] 5.3 Reescribir `app/(app)/dashboard/page.tsx`: resolver rol y línea activa en el servidor, cargar **solo** los datos de la composición que corresponde —sin consultar el flujo de caja cuando el rol es ayudante— y rendir el componente correspondiente. Página delgada; ninguna consulta a Supabase fuera de `services/` (convención nº 1).
- [x] 5.4 Apilar ambas composiciones en una columna en 390 px sin desplazamiento horizontal, respetando el `overflow-x-clip` del layout y el espacio que reservan la barra inferior y el botón flotante.
- [x] 5.5 Declarar visiblemente los destinos que aún no existen (reportes, bitácora, bandeja) en lugar de enlazar a rutas inexistentes.
- [x] 5.6 `features/dashboard/assistant-dashboard.test.tsx`: cubre *La variante del ayudante es un diseño propio, sin dinero y sin huecos* → «Ningún importe en pantalla», «Sin huecos donde estaban las piezas del dueño», «Las entregas encabezan su pantalla»; y *Últimos movimientos de la bitácora* → «El ayudante no tiene esta pieza».
- [x] 5.7 `features/dashboard/owner-dashboard.test.tsx`: cubre *El panel es la puerta de entrada de escritorio y se compone según el rol* → «La persona dueña recibe la composición completa»; y *Cada pieza del panel lleva a su pantalla* → «Del indicador a reportes», «Del movimiento a la bitácora», «Destino inexistente, declarado».

## 6. Cascarón: campana y *+ Registrar* de escritorio

- [x] 6.1 Añadir la campana con contador a `components/layout/header.tsx` (D9): presente para ambos roles, sin insignia cuando el contador es cero, y al activarse explica que la bandeja llega con KAM-17. Ningún `href` a una ruta inexistente.
- [x] 6.2 Quitar el `md:hidden` de `features/quick-capture/register-button.tsx` y darle posición y separación propias en escritorio, sin tapar contenido ni el `SyncIndicator` (D10). El menú y su filtrado por rol no se tocan: siguen saliendo de `destinationsFor(role)`.
- [x] 6.3 Verificar que `isCaptureRoute` sigue retirando el botón, ahora también en escritorio (D10).
- [x] 6.4 `components/layout/header.test.tsx`: cubre *Authenticated shell frames every app screen* → «Desktop shell shows the top bar», «Both roles get the bell», «Nothing unread shows no badge», «The tray does not exist yet».
- [x] 6.5 Ampliar `features/quick-capture/register-button.test.tsx`: cubre *Registrar está a dos toques desde cualquier pantalla* → «El menú respeta el rol», «Las pantallas de captura no lo muestran», «En escritorio no aparece», «Un solo menú para las dos superficies», «El indicador de sincronización sigue alcanzable».
- [x] 6.6 Comprobar que las pruebas ya existentes del cascarón siguen pasando sin cambios de comportamiento: *Authenticated shell frames every app screen* → «Mobile shell shows the bottom bar», «Owner sees the owner-only entries», «Assistant does not see owner-only entries», «One declaration feeds every surface» (cubiertas por `components/layout/nav-entries.test.ts` y `mobile-nav.test.tsx` desde KAM-13).

## 7. Semilla de doce meses

- [x] 7.1 Sembrar doce meses de pedidos, egresos y movimientos de dinero repartidos entre tres líneas, con cobros y pagos en meses distintos de sus documentos para que la lectura en caja se distinga de la devengada (D1, D11). **No en Geeko Store sino en una organización propia, `Kamay Histórico`**: se comprobó midiendo que 36 pedidos más en Geeko rompen las suites de tablero, alta de pedidos y modo feria, cuyas fixtures son esas mismas filas (la cuadrícula de feria se ordena por lo más vendido de los últimos 90 días).
- [x] 7.2 Comprobar que la semilla ya trae un pedido vencido en cada tipo de estado relevante —`in_progress`, `waiting`, `final`— y uno sin fecha comprometida: KAM-07 los sembró a propósito y `seed_geeko.test.sql` los vigila, así que no se duplican.
- [x] 7.3 Verificar que la semilla ampliada no rompe las pruebas pgTAP existentes ni `seed_geeko.test.sql`.

## 8. Pruebas de extremo a extremo

- [x] 8.1 Crear `tests/e2e/assistant-permissions.spec.ts` (exigida por el backlog): el ayudante entra, abre el panel y ninguna cifra monetaria aparece en pantalla; su composición no tiene secciones vacías donde el dueño tiene las suyas. Cubre *El panel es la puerta de entrada de escritorio y se compone según el rol* → «El ayudante recibe su propia composición», «El rol se decide antes de pintar»; y *La variante del ayudante…* → «Ningún importe en pantalla».
- [x] 8.2 Ampliar el mismo archivo con el recorrido del dueño y el selector de línea. Cubre *Todo el panel responde al selector de línea* → «Al elegir una línea se recalcula todo»; e *Indicadores de caja del mes en curso* → «Por cobrar ignora el periodo», «Lo anulado no cuenta» (anulando un cobro y comprobando que el indicador baja).
- [x] 8.3 Añadir la comprobación de 390 px: el panel se apila en una columna, no exige desplazamiento horizontal, y entrar desde un teléfono sigue aterrizando en el registro rápido. Cubre *El panel es utilizable en un teléfono* → «Una columna en 390 px», «El aterrizaje no cambia».
- [x] 8.4 Añadir la medición del presupuesto de carga sobre la semilla de doce meses —la organización `Kamay Histórico`—, sobre la carga de la ruta y no sobre una pintura parcial. Se mide solo en el proyecto de escritorio: los dos proyectos corren a la vez contra el mismo servidor y la segunda medición mediría la contención. Cubre *El panel carga dentro de su presupuesto* → «Doce meses sembrados».
- [x] 8.5 Añadir la comprobación de que el flotante *+ Registrar* de escritorio no tapa controles en el panel ni en el tablero, y el recorrido de dos interacciones desde el panel. Cubre *Registrar está a dos toques desde cualquier pantalla* → «Registrar una compra desde el panel en escritorio»; y las ya existentes «Registrar un gasto desde el catálogo» y «Registrar un pedido desde los egresos», que siguen verificadas en `tests/e2e/mobile-capture.spec.ts`.

## 9. Cierre

- [x] 9.1 Comprobar por inspección del esquema que ninguna tabla guarda ingresos, egresos, margen ni saldo del panel. Cubre *El panel carga dentro de su presupuesto* → «Nada se precalcula en una columna».
- [x] 9.2 Ejecutar la secuencia completa de CI: `lint → typecheck → test:unit → supabase start → test:integration → build → test:e2e`, con cobertura mínima del 90 % en `lib/` y `services/`.
- [x] 9.3 Ejecutar `openspec validate kam-14-dashboard-assistant-variant --strict` y dejar el cambio listo para archivar.
