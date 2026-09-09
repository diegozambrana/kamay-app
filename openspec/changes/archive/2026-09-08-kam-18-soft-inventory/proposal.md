# KAM-18 · Inventario suave

## Why

El taller ya registra lo que compra (KAM-09) y lo que vende (KAM-07, KAM-12), pero **no sabe qué le queda**. Hoy `items.min_stock` existe como columna desde KAM-06 y no la lee nadie: el catálogo lo muestra como un dato muerto, y la tarjeta *Insumos bajo mínimo* del panel es un marcador de posición que dice con todas las letras que no está disponible. La consecuencia práctica es la que la especificación describe en el flujo F: el saldo de un insumo no coincide con el estante y no hay dónde mirar por qué.

El riesgo de resolverlo mal está nombrado en el propio objetivo del backlog: **exigir una disciplina de registro que nadie va a sostener**. Un inventario que obliga a anotar cada gramo de sublimación deja de anotarse en dos semanas, y entonces el saldo miente con la autoridad de un número. Por eso el diseño es «suave»: la entrada la genera sola la compra que ya se registra, el consumo cuesta tres interacciones o menos, y el ajuste por conteo **no pide explicación** — porque pedirla es la forma más segura de que nadie ajuste y el saldo se aleje para siempre de la realidad.

Este cambio construye la pieza que faltaba entre el catálogo y el dinero: `inventory_movements` como único documento de verdad, `item_balances` como vista derivada, y las tres superficies donde el saldo se vuelve útil — el detalle del ítem (V11), la alerta del panel y la del catálogo.

> **Posición en la secuencia.** El backlog sitúa KAM-18 en la fase 3 dependiendo de KAM-09, archivada: `expenses`, `expense_items` y la función `create_expense` existen y **no se rehacen aquí**. No hay ningún cambio hermano en `openspec/changes/`: este es el único en curso. KAM-19 (activos) y KAM-20 (reportes) dependen de esta tarea y no se anticipan. KAM-17 (avisos), que el backlog coloca antes, **no está construida**: el aviso «insumo bajo mínimo» es suyo y aquí solo se construyen las dos alertas visuales que el backlog pide explícitamente.

## What Changes

### El documento y su derivado

- **Tabla `inventory_movements` con su DDL canónico completo** (§10): `kind` restringido a `in`, `out` y `adjustment`; `quantity` con signo y distinta de cero; la restricción `sign_matches_kind` que impide una entrada negativa o una salida positiva; `source_type` restringido a `expense_item`, `order_item`, `manual` y `count`; sus dos índices de consulta y el **índice único parcial `(source_type, source_id)`** sobre los orígenes documentales.
- **Los movimientos no se editan ni se archivan.** La tabla no lleva `archived_at` y ningún rol recibe privilegio de `UPDATE`: `authenticated` obtiene `select` e `insert` y nada más. Una corrección es siempre un movimiento nuevo, como en contabilidad, y el error queda tan visible como la corrección.
- **Vista `item_balances` con `security_invoker = true`** (§11), tal como la define el esquema: saldo por ítem de tipo insumo, su `min_stock` y la bandera `below_min` calculada. El saldo **nunca se almacena**.
- **`item_last_cost` se reutiliza tal cual.** La vista y su servicio existen desde KAM-09; la sección *Evolución de precios* de V11 lee de `expense_items` y de esa vista, sin crear ninguna estructura nueva.

### Entradas automáticas desde las compras

- **Un trigger sobre `expense_items`** inserta la entrada de inventario de cada línea de compra de un insumo, con `source_type = 'expense_item'` y `source_id` = el identificador de la línea. Es la única vía automática que existe en todo el cambio.
- **La idempotencia la garantiza la base, no la aplicación**: el índice único parcial hace que la misma línea sincronizada dos veces —el caso real que la cola de KAM-11 produce— deje **una sola** entrada. El trigger absorbe el conflicto en vez de romper el alta de la compra.
- **Solo los insumos mueven inventario.** Una línea de compra cuyo ítem sea producto o activo no genera movimiento: `item_balances` solo contempla `kind = 'supply'`, y una entrada sin saldo que la refleje sería ruido en el historial.
- **Archivar una compra no toca el inventario.** El insumo entró físicamente al taller; si además no entró, se corrige con un ajuste por conteo, que es lo que el criterio nº 7 del backlog exige. El sistema no genera movimientos que nadie pidió.

### Registro rápido de consumo

- **Formulario mínimo de consumo** —ítem, cantidad, nota opcional— alcanzable desde tres sitios: el detalle del ítem (con el ítem ya puesto), el detalle de un pedido o de una tarea (con la nota prellenada con su referencia) y el destino **Consumo** de la retícula de registro rápido, que hoy está inerte. En los tres casos la operación cuesta **tres interacciones o menos**.
- **Todo consumo registrado por una persona es `source_type = 'manual'`**, venga de donde venga. El origen `order_item` queda declarado en el `check` del esquema y **sin uso en esta tarea**: el índice único lo limitaría a un movimiento por línea de pedido, y consumir tres insumos distintos para la misma línea es el caso normal, no la excepción.
- **El consumo lo registra también el ayudante.** La matriz de acceso §16 le da *Leer, crear* sobre `inventory_movements`: es quien está delante del estante.
- **Consumo y ajuste entran en la cola de KAM-11.** Se registra su operación en el registro de operaciones existente, con identificador `uuid` generado en el dispositivo y `occurred_at` fijado por el cliente. Es lo que V16 promete para toda su retícula y lo que ya hace Venta rápida; el motor de la cola no se toca.

### Ajuste por conteo

- **Un diálogo que pregunta una sola cosa: cuánto hay.** El sistema calcula la diferencia contra el saldo derivado y guarda un movimiento `adjustment` con `source_type = 'count'`. **No se pide justificación ni motivo**, ni se ofrece un campo obligatorio que invite a inventarlo.
- **Queda registrado quién y cuándo**, por `created_by` y por la bitácora, que es lo que el criterio nº 4 pide. La nota existe y es opcional.
- **Un conteo que coincide con el saldo no escribe nada**: `quantity <> 0` lo impide en la base, y la interfaz lo dice en lugar de fallar.

### Mínimo y alerta

- **El mínimo se edita donde ya se edita el ítem**, sin pantalla nueva: la columna `min_stock` existe desde KAM-06 y el formulario ya la ofrece. Lo que cambia es que a partir de ahora **significa algo**.
- **Tarjeta *Insumos bajo mínimo* del panel**, que sustituye al marcador de posición de KAM-14 en su misma ranura: los insumos por debajo de su mínimo, ordenados por lo lejos que están de él, cada uno abriendo su detalle. Respeta el selector de línea como el resto del panel.
- **Distintivo en el catálogo (V10)** sobre las filas de insumo por debajo del mínimo. Es un distintivo, no una columna de saldo: el catálogo sigue sin mostrar cifras de inventario ni de costo.

### V11 · Detalle de ítem, tres secciones nuevas

- **Saldo**, para los insumos: la cifra derivada, su mínimo y su estado respecto de él, con las acciones *Registrar consumo* y *Ajuste por conteo*.
- **Movimientos**: entradas, consumos y ajustes con su cantidad, su origen, su autor y su fecha, en orden descendente. Es la sección que resuelve el flujo F («este número no cuadra»).
- **Evolución de precios de compra**: el último costo conocido y la serie de precios pagados, leída de `expense_items`. **Solo la ve el dueño**, y no por un `if` en el código: `item_last_cost` es una vista con `security_invoker` sobre una tabla sin política de lectura para el ayudante, y devuelve cero filas por sí sola.

**Fuera de alcance** (copiado del backlog):
- Recetas de producto y descuento automático al producir (Fase 5).
- Merma como concepto propio; por ahora se anota como consumo.
- Valoración de inventario, costo promedio ponderado, punto de reorden automático.

Derivado de lo anterior, tampoco entran: el aviso y la notificación de insumo bajo mínimo (KAM-17); el stock de piezas terminadas y su descuento en el modo feria, que el esquema deja fuera de `item_balances` al filtrar `kind = 'supply'`; `asset_details` y la barra de recuperación (KAM-19); el informe *Insumos por acabarse* de V14 (KAM-20); las tareas relacionadas y los proveedores habituales del detalle de ítem (KAM-21); y el saldo por variante — `variant_id` se guarda en el movimiento, pero la vista canónica agrupa por ítem.

## Capabilities

### New Capabilities

- `inventory`: el documento de movimiento y su derivado —tabla inmutable, vista de saldo, entrada automática idempotente desde las líneas de compra—, el registro rápido de consumo, el ajuste por conteo sin justificación, el significado operativo del mínimo y sus dos alertas, y las tres secciones de inventario y costos del detalle del ítem.

### Modified Capabilities

- `catalog-directory`: cambian dos requisitos. *Pantalla de detalle de ítem (V11)* deja de prohibir las secciones de saldo, movimientos y evolución de costos y pasa a exigirlas, con la evolución de precios reservada al dueño. *Pantalla de catálogo (V10)* suma el distintivo de insumo bajo mínimo, manteniendo la prohibición de mostrar cifras de saldo o de costo en las filas.
- `dashboard`: cambia el requisito *Marcadores de posición declarados*. La tarjeta *Insumos bajo mínimo* deja de ser marcador y muestra contenido real; el único marcador que sobrevive es el de pendientes, hasta KAM-17.
- `quick-capture`: cambia el requisito *La pantalla de registro rápido ofrece seis destinos*. El destino **Consumo** deja de estar inerte y abre el registro de consumo. Es el último de los seis, así que el requisito deja de tener excepciones.

## Impact

**Código afectado**

- `supabase/migrations/` — una migración nueva: `inventory_movements` con sus restricciones e índices, la vista `item_balances`, el trigger de entrada automática sobre `expense_items`, el `audit` de bitácora y las políticas de RLS (`select` e `insert` para miembro; **ningún `update`, ninguna `delete`**).
- `app/(app)/catalog/[id]/page.tsx` — carga las tres secciones nuevas del detalle.
- `features/catalog/item-detail.tsx` — pierde el comentario que declara ausentes las secciones de inventario y gana su composición.
- `features/inventory/` — nuevo: secciones de saldo y movimientos, formulario de consumo, diálogo de ajuste por conteo y tarjeta de insumos bajo mínimo.
- `actions/inventory.ts` y `services/inventory/` — nuevos: alta de consumo, alta de ajuste, lectura de saldos y de movimientos.
- `lib/inventory/` — nuevo: esquema Zod del consumo y del ajuste, cálculo de la diferencia de un conteo, orden y rotulado de los movimientos por origen. Lógica pura, cubrible al 90 %.
- `features/dashboard/owner-dashboard.tsx`, `assistant-dashboard.tsx` y `placeholder-card.tsx` — la ranura del marcador de stock pasa a la tarjeta real; el marcador de pendientes se queda.
- `features/catalog/catalog-screen.tsx` — el distintivo de bajo mínimo en las filas de insumo.
- `lib/quick-capture/destinations.ts` — el destino *Consumo* gana su `href` y pierde su `availableFrom`.
- `features/sync/operations.ts` — se registran las operaciones de consumo y de ajuste; el motor de la cola no se toca.

**Se lee pero no se modifica:** `services/expenses/item-last-cost-service.ts` y la vista `item_last_cost` (KAM-09); todo `lib/offline/` (KAM-11); `services/catalog/item-service.ts`; `lib/business-lines/` para el selector de línea del panel.

**Base de datos:** una tabla nueva y una vista nueva. Ningún valor derivado almacenado: el saldo sale de la suma de los movimientos y se verifica contra la suma manual en pgTAP. `items` no gana ninguna columna — `min_stock` ya existía.

**Dependencias nuevas:** ninguna.

**Pruebas:** unitarias sobre el cálculo de la diferencia de un conteo, el rotulado de movimientos por origen, la clasificación de un saldo respecto de su mínimo y la activación del destino de la retícula; pgTAP `inventory_idempotency` (la misma línea de compra sincronizada dos veces deja un movimiento), `derived_values` (el saldo coincide con la suma manual y ninguna columna lo almacena), la imposibilidad de editar o borrar un movimiento, y el aislamiento entre organizaciones de la tabla y de la vista; e2e `inventory.spec.ts` recorriendo compra → consumo → ajuste y verificando el saldo en cada paso, con la medición de interacciones del consumo registrada.

## Supuestos registrados

1. **La entrada automática la hace un trigger, no la función `create_expense`.** Un trigger sobre `expense_items` cubre toda vía de escritura presente y futura —la función de hoy y cualquier alta que llegue mañana— sin que nadie tenga que acordarse. Poner la lógica dentro de `create_expense` obligaría a repetirla en cada nuevo camino, que es exactamente cómo se pierden las entradas.
2. **Solo las líneas de compra de insumos generan entrada.** El esquema define `item_balances` sobre `kind = 'supply'`; una entrada para un producto o un activo no aparecería en ningún saldo y solo ensuciaría el historial del ítem. Comprar un activo es lo que KAM-19 registra como adquisición, no como stock.
3. **Archivar una compra deja su entrada en pie.** Decisión tomada explícitamente: el criterio nº 7 del backlog dice que los movimientos no se editan ni se archivan y que una corrección es siempre un ajuste nuevo. Un ajuste compensatorio automático haría aparecer en el historial una fila que nadie registró, y el objetivo de la sección *Movimientos* es justamente que cada línea tenga un autor reconocible.
4. **Todo consumo humano es `source_type = 'manual'`.** Decisión tomada explícitamente. El origen `order_item` queda en el `check` del esquema, sin escritura en esta tarea: el índice único `(source_type, source_id)` admitiría un solo movimiento por línea de pedido, y el caso real —varios insumos consumidos para la misma línea— quedaría bloqueado. El enlace del consumo con el pedido que lo motivó se anota en la nota; un enlace de primera clase, si hace falta, es materia de KAM-21.
5. **El consumo y el ajuste se encolan sin conexión.** Decisión tomada explícitamente. V16 declara que sus seis destinos funcionan sin conexión y Venta rápida ya lo cumple; activar *Consumo* sin encolarlo dejaría la retícula con una promesa desigual entre botones idénticos. El coste son dos operaciones registradas y sus pruebas de cola, no una línea del motor.
6. **El saldo es por ítem, no por variante.** La vista canónica del esquema agrupa por `i.id` y el movimiento guarda `variant_id` sin usarlo para agregar. Se respeta: partir el saldo por variante multiplicaría los conteos físicos que la persona debe hacer, que es la disciplina que este cambio evita imponer.
7. **La tarjeta del panel respeta el selector de línea.** El requisito *Todo el panel responde al selector de línea* de KAM-14 no admite excepciones, y un insumo compartido (`business_line_id` nulo) aparece en cualquier selección, igual que en el resto del sistema.
8. **El distintivo del catálogo no reintroduce cifras.** El requisito de V10 prohíbe columnas de saldo y de último costo, y esa prohibición se conserva palabra por palabra: lo que se añade es un distintivo binario sobre la fila, no un número. El número vive en el detalle.
