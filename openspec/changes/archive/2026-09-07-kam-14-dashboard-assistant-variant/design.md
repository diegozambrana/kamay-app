# KAM-14 · Diseño

## Context

Motivación en `proposal.md`; requisitos en `specs/`. Lo que importa aquí es el estado del código y del esquema que este cambio encuentra:

- **`/dashboard` es un cascarón** desde KAM-02, ya presente en `nav-entries.ts` como entrada de ambos roles (`mobile: "more"`).
- **El dinero ya está modelado.** `payments` guarda cada movimiento con `direction`, `amount`, `occurred_at` y **exactamente un destino** (`order_id` o `expense_id`, impuesto por `exactly_one_target`). No tiene `business_line_id`: la línea vive en el pedido o el egreso.
- **Ya hay derivados de dinero**: `order_totals` y `expense_totals` (con `paid`), y los agregados `receivables_by_line` / `payables_by_line`, todos con `security_invoker = true`. Son **saldos vivos**, sin noción de periodo.
- **La regla de retraso ya existe una sola vez**: `lib/orders/overdue.ts` (`isOverdue`, `todayInTimezone`), comparando por `StatusKind` y nunca por nombre.
- **La bitácora existe y nadie la lee en conjunto**: `activity_log` con índice `(organization_id, occurred_at desc)` y `(organization_id, business_line_id, occurred_at desc)`; su RLS ya recorta al dueño. `OrderService.history()` la lee por registro.
- **`organizations.timezone`** existe (`America/La_Paz` por omisión); `lib/orders/overdue.ts` ya la usa para decidir "hoy".
- **RLS del ayudante sobre `payments` es partida**: puede leer los movimientos `direction = 'in'` —los registra él—; no ve `expenses` en absoluto.
- **`RegisterButton`** (KAM-13) existe y es `md:hidden`.

Ese último punto es la restricción que manda en todo el diseño: **`security_invoker` por sí solo no oculta los ingresos al ayudante**, porque los cobros sí le son legibles fila a fila. El criterio 3 del backlog pide que no pueda obtener los montos "por consulta directa", así que el recorte tiene que estar escrito en algún sitio, y ese sitio no puede ser la interfaz.

## Goals / Non-Goals

**Goals:**

- Una sola fuente derivada para el flujo de caja del mes, utilizable por el panel hoy y por V14 mañana sin reescribirla.
- Que el criterio "el ayudante no ve montos" sea comprobable en pgTAP, no solo en Playwright.
- Dos composiciones de pantalla independientes, decididas en el servidor.
- Cerrar el cascarón (campana y *+ Registrar* de escritorio) sin adelantar el contenido de KAM-17.

**Non-Goals:**

- Elegir la librería de gráficos del proyecto: la elige KAM-20 con V14 delante.
- Un selector de periodo, una regla de reparto de gastos compartidos o cualquier informe: son de V14.
- Refactorizar los tres mapas de rótulos de acción duplicados en `order-detail.tsx`, `expense-detail.tsx` e `item-detail.tsx`. El nuevo redactor nace en `lib/`, y KAM-22 los recogerá al construir V23.
- Tocar la barra inferior móvil, sus ranuras o el aterrizaje por dispositivo.

## Decisions

### D1 · Los indicadores del mes se miden en caja, no en devengado

Ingresos = movimientos `in` del mes; Egresos = movimientos `out` del mes; Margen = la resta. **Decidido con la persona usuaria.**

*Por qué:* es la lectura que el taller entiende sin explicación —"cuánto entró y cuánto salió este mes"— y la que corresponde a un negocio que cobra en efectivo y a plazos irregulares. Además hace honesta la tarjeta *Por cobrar*, que pasa a ser exactamente lo que le falta a la caja para igualar lo facturado.

*Alternativa descartada:* devengado (`order_totals.total` por `occurred_at` del pedido). Es la lectura contable correcta y la que V14 probablemente ofrecerá, pero en el panel obliga a explicar por qué el margen del mes no coincide con lo que hay en el bolsillo.

*Consecuencia asumida:* un pedido facturado en marzo y cobrado en abril aporta al margen de abril. Queda escrito como supuesto en la propuesta y como escenario en el spec, para que nadie lo lea como un error dentro de seis meses.

### D2 · Un derivado nuevo, `cash_flow_by_line_month`, en vez de calcular en el servicio

El criterio 5 del backlog es explícito: *ningún indicador se almacena, todos se derivan de las vistas*. Y la convención nº 4 pone las cifras derivadas en vistas con `security_invoker = true`, no en la aplicación.

La vista agrega por `(organization_id, business_line_id, month)` y expone `collected` y `paid`. El mes se calcula con la zona horaria de la organización:

```
date_trunc('month', p.occurred_at at time zone o.timezone)
```

*Por qué en la vista y no en el servicio:* porque la misma cifra la van a querer V14 y los reportes, y dos implementaciones del mismo agregado divergen. Y porque una consulta agregada desde el cliente de Supabase obligaría a traerse los movimientos y sumarlos en JavaScript, que es exactamente lo que la convención nº 4 evita.

*Alternativa descartada:* extender `receivables_by_line` con columnas de periodo. Mezcla un saldo vivo con un flujo de periodo en la misma fila; son dos preguntas distintas y una de ellas dejaría de tener sentido en cuanto V14 pida otro periodo.

*Nota de forma:* la vista devuelve una fila por mes con movimiento. Un mes sin movimiento **no** produce fila; el cero lo pone quien consume, no la vista. Inventar filas obligaría a generar series de fechas dentro de la vista para un caso que la interfaz resuelve con un `?? 0`.

### D3 · La línea del movimiento se deduce con `union all`, no con dos `left join`

`payments` apunta a un pedido **o** a un egreso, nunca a los dos. La vista se compone como la unión de dos ramas —la de cobros contra `orders`, la de pagos contra `expenses`— y agrega después.

*Por qué:* con dos `left join` cada fila arrastra dos columnas de línea de las que una siempre es nula, y el `coalesce` que las junta es justo el punto donde un error futuro pasa desapercibido. Con `union all`, cada rama es legible por separado y `direction_matches_target` ya garantiza que ninguna fila cae en las dos.

*Efecto lateral favorable:* la rama de pagos toca `expenses`, tabla sin política de lectura para el ayudante. Aunque el recorte de D4 desapareciera, esa rama seguiría dándole cero.

### D4 · El recorte al dueño va dentro de la vista, no solo en `security_invoker`

La vista lleva una condición explícita `is_owner(organization_id)`.

*Por qué:* es el único modo de cumplir el criterio 3 del backlog. El ayudante lee sus propios cobros por política de `payments` (KAM-10, D5), así que una vista que solo confiara en `security_invoker` le devolvería los ingresos agregados de la organización — precisamente el monto que no puede ver. La condición dentro de la vista convierte el criterio en una prueba pgTAP de una línea: el ayudante selecciona y obtiene cero filas.

*Alternativa descartada:* filtrar en el servicio según el rol. Cumple en pantalla y falla en el criterio, que habla de consulta directa. Y deja la regla de permisos en la capa donde este proyecto ha decidido no ponerla.

*Alternativa descartada:* una función `security definer` que devuelva el agregado. Más maquinaria para el mismo resultado, y saca la cifra del régimen de vistas que el resto del dinero ya sigue.

*Se acepta el precio:* la vista no es reutilizable por una futura pantalla de ingresos para el ayudante. No existe tal pantalla ni está prevista: la matriz de acceso §16 se lo prohíbe.

### D5 · Dos composiciones, no una con condicionales

`app/(app)/dashboard/page.tsx` resuelve el rol en el servidor y rinde `OwnerDashboard` o `AssistantDashboard`, dos componentes hermanos con su propia disposición. La página no carga los datos de dinero cuando el rol es ayudante.

*Por qué:* el criterio 4 pide que la variante del ayudante no tenga huecos. Una sola composición con `{isOwner && …}` produce inevitablemente el diseño del dueño con agujeros —es lo que el criterio prohíbe— y además envía al cliente datos que ese rol no debe recibir, aunque no los pinte.

*Alternativa descartada:* una composición con `slots` por rol. Es la misma pantalla disfrazada; el reequilibrio que pide el criterio 4 no es mover piezas, es otra jerarquía visual.

### D6 · El comparativo se dibuja con barras CSS

Barras horizontales con `div` y Tailwind, con una `<table>` equivalente para lectores de pantalla. **Decidido con la persona usuaria.**

*Por qué:* son tres líneas y tres cifras. Una librería de gráficos aquí es peso en el bundle de la pantalla con el presupuesto de carga más estricto del proyecto (1,5 s), y una decisión de herramienta tomada antes de conocer los cinco informes de V14.

*Alternativa descartada:* `recharts` + `shadcn/chart`. Se pospone a KAM-20, que la necesitará de verdad y sabrá qué le pide.

### D7 · Entregas próximas reutiliza `isOverdue`, no reimplementa la regla

El servicio trae los pedidos no archivados con `due_date <= hoy + 7 días`, junto con el `kind` de su estado; el destacado de vencido lo decide `isOverdue` de `lib/orders/overdue.ts`, y "hoy" lo da `todayInTimezone` con la zona de la organización.

*Por qué:* la regla ya está escrita, ya está probada y su comentario dice explícitamente "vive aquí y solo aquí". Un panel con su propio criterio de retraso sería la segunda definición, y la primera vez que difieran nadie sabrá cuál es la buena.

*Consecuencia:* un pedido vencido en estado de espera **aparece en la lista** —sigue siendo una entrega comprometida— pero no se destaca. Está escrito como escenario.

### D8 · Un `ActivityService.recent()` acotado y un redactor en `lib/activity/`

La lectura de bitácora del panel es un servicio nuevo con tope de filas y filtro opcional de línea. La conversión de un evento a frase vive en `lib/activity/describe.ts`, pura y unitariamente probada.

*Por qué separarlo:* la consulta es de `services/` por convención nº 1, y la redacción no toca Supabase, así que es de `lib/` y se prueba sin base de datos. KAM-22 construirá V23 sobre las dos piezas en vez de escribir una tercera forma de leer la bitácora.

*Qué no hace:* no unifica los tres mapas de rótulos ya duplicados en las pantallas de detalle. Ese barrido es de KAM-22, cuando exista la pantalla que los justifica.

### D9 · La campana es cascarón declarado, no un enlace roto

Vive en `components/layout/header.tsx`, con contador en cero y sin insignia. Al activarla, explica que la bandeja llega con KAM-17.

*Por qué no esperarse a KAM-17:* el mapa §4.1 la declara elemento siempre disponible de la barra superior y el alcance de KAM-14 la pide. Dejar su sitio cerrado ahora evita reabrir la barra superior después; KAM-17 solo cambiará la fuente del contador y el destino.

*Por qué no un `<Link href="/notifications">`:* la ruta no existe y un 404 es peor que una explicación.

### D10 · *+ Registrar* deja de ser `md:hidden` y no se duplica

El mismo `RegisterButton` y el mismo menú de KAM-13 pasan a rendirse también en escritorio, con posición y separación propias de esa superficie. La lista de destinos y su filtrado por rol no se tocan.

*Por qué:* el spec de `quick-capture` ya obliga a que las superficies no puedan ofrecer destinos distintos. Un botón de escritorio con su propio menú sería exactamente la lista paralela que ese requisito existe para impedir.

*Lo que sí cambia:* la regla de las pantallas de captura (`isCaptureRoute`) pasa a valer también en escritorio, que es coherente —el formulario de pedido a pantalla completa tiene el mismo problema de salida sin confirmación— y evita dos criterios de "esto es captura".

### D11 · El presupuesto de 1,5 s se mide sobre datos sembrados de doce meses

Se amplía la semilla de Geeko Store con doce meses de pedidos, egresos y movimientos, y la medición se hace sobre la carga de la ruta en Playwright, no sobre una pintura parcial.

*Índices previstos:* `payments` tiene índices por destino pero ninguno por `(organization_id, occurred_at)`, que es como consulta la vista nueva. Se añade en la misma migración. Los índices de `activity_log` y de `orders (organization_id, due_date)` ya sirven a las otras dos consultas.

## Risks / Trade-offs

- **La lectura en caja sorprende a quien espera devengado** → queda escrita como supuesto en la propuesta, como escenario en el spec y visible en la pantalla: la tarjeta *Por cobrar* junto a las tres de caja es la que cuenta la otra mitad de la historia.
- **La condición `is_owner` dentro de la vista es invisible desde la aplicación**: una consulta que devuelve cero filas se parece a un mes sin movimiento → la prueba pgTAP distingue los dos casos explícitamente, y la variante del ayudante ni siquiera consulta la vista.
- **Doce meses sembrados no son doce meses reales.** El presupuesto se cumple contra un volumen simulado → la vista se apoya en índices y no en materialización, así que el margen de crecimiento es el del índice; si algún día no basta, la salida es una vista materializada con refresco, no una columna calculada.
- **Tres marcadores de posición en una pantalla** (pendientes, insumos, campana) pueden hacerla parecer inacabada → cada uno lleva su leyenda y su rótulo definitivo, y el reequilibrio del ayudante evita que su variante quede compuesta mayoritariamente por promesas.
- **`RegisterButton` flotando en escritorio puede tapar contenido** en pantallas densas como el tablero → se verifica en e2e que no cubre controles en el tablero ni en el panel, y la regla de pantallas de captura lo retira donde estorbaría de verdad.

## Migration Plan

1. Migración nueva `YYYYMMDDHHMMSS_dashboard_cash_flow.sql`: la vista `cash_flow_by_line_month`, su `grant` a `authenticated` y `service_role`, y el índice `payments (organization_id, occurred_at)`. Sin cambios de tabla, sin datos que mover.
2. Su prueba pgTAP en la misma tanda (convención nº 6): ninguna migración se fusiona sin ella.
3. `graphify update .` tras el cambio de esquema.
4. Semilla ampliada a doce meses: solo datos de desarrollo y prueba, sin efecto en producción.
5. Retroceso: la vista y el índice se dejan caer sin pérdida de datos, ya que ninguna cifra vive en ellos. El panel volvería a su cascarón.
