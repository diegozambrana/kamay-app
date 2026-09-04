## Context

Ver `proposal.md` § Why para la motivación y `specs/fair-mode/spec.md` para los requisitos.

Lo que condiciona este diseño y no está en ninguno de los dos:

- **`orders` ya está preparada.** `kind` acepta `'direct_sale'`, `order_needs_customer` solo exige cliente cuando `kind = 'order'`, `contact_id` es opcional y el trigger de numeración no distingue tipos. `order_totals` ya suma ambos. **No hace falta tocar ninguna tabla.**
- **`create_order` ya se blindó.** Fija `'order'` literal y no acepta `kind` como parámetro; su comentario apunta explícitamente a este cambio: *«la venta directa tiene su propio flujo (V6, KAM-12) y no entra por aquí»*.
- **El servicio de pedidos ya filtra `kind = 'order'`** en la consulta del tablero. Lo que falta es que eso sea un requisito con prueba, no una coincidencia.
- **Todo juego de estados tiene al menos un `final`.** `assert_status_set_valid` lo garantiza desde KAM-05, así que resolver el estado de una venta directa nunca puede quedarse sin candidato.
- **`payments` la trae KAM-10** con `direction_matches_target`: un movimiento contra un pedido es siempre `in`. Un cobro de feria es exactamente eso, sin ninguna variante.
- **`sales_channels` no tiene canal por omisión.** No hay columna que marque uno, y no se va a inventar (convención nº 11).
- **KAM-11 ya está**, en la historia de esta rama (`925892f`): Serwist, Dexie, `lib/offline/` completo y `features/sync/`. Este diseño se escribió contra un contrato supuesto y ahora está reescrito contra la API real (decisión 5). Tres hechos suyos condicionan todo lo que sigue:
  - El punto de entrada de una escritura es **`capture()`**, no `enqueue()`: encola y, con red, espera hasta `FLUSH_DEADLINE_MS` (2 500 ms) al vaciado.
  - **El service worker no cachea ninguna ruta de negocio**, por decisión escrita: garantiza la captura, no la lectura sin conexión. Toda navegación va a red y, sin red, cae en `/offline`.
  - El indicador y la bandeja de pendientes viven en `components/layout/header.tsx` y `mobile-context-bar.tsx` — **el cascarón que el modo feria no monta**.
- **`create_order` ya es idempotente.** KAM-11 la redefinió en `20260903210000_offline_sync.sql` con un retorno temprano cuando el `id` ya existe, conservando `'order'` literal. Es el patrón exacto que `create_direct_sale` debe replicar.

## Goals / Non-Goals

**Goals:**

- Que una venta sea **un solo sobre**: una llamada, una transacción, un elemento en la cola. Todo lo que se parta en dos es una oportunidad de que llegue la mitad.
- Que el camino con red y el camino sin red sean **el mismo camino**. Dos caminos distintos es donde aparecen los duplicados y las ventas perdidas.
- Que la separación entre pedido y venta directa esté **en la base de datos**, no en la disciplina de quien escriba la próxima consulta.
- Que salir del modo feria por accidente sea **imposible por construcción**, no improbable por cuidado.

**Non-Goals:**

- Escribir la cola, el service worker o la política de reintentos. Es KAM-11; aquí solo se consume y se declara qué se espera de ella.
- Optimizar el descuento de inventario al vender. Es KAM-18; este diseño deja la costura señalada y nada más.
- Hacer que la venta directa sea editable con una pantalla propia. Sigue las vías generales del pedido.

## Decisions

### 1. La venta directa reutiliza `orders`, sin tabla ni columna nuevas

El esquema canónico (§ 9) ya decidió esto y dejó escrito el motivo: separar las tablas obliga a duplicar `order_items`, `payments` y **toda consulta de ingresos**, que a partir de ahí tiene que unir dos fuentes y mantenerse sincronizada para siempre. El precio de reutilizar es que la interfaz debe filtrar por `kind` en el tablero; el precio de separar se paga en cada reporte, indefinidamente.

*Alternativas descartadas:* tabla `direct_sales` propia (multiplica el trabajo de KAM-20 y de KAM-14 sin ganar nada, porque los dos flujos comparten exactamente los mismos campos); un `flow = 'direct_sale'` en `statuses` (introduce un concepto ausente de la especificación funcional para modelar un ciclo que no existe: la venta nace terminada).

### 2. `create_direct_sale(p_sale, p_items, p_payment)`: la venta, sus líneas y su cobro en una transacción

Hermana de `create_order`, en la base y no en la aplicación, por el mismo motivo que aquella: el estado inicial, la atomicidad y la numeración son **garantías de datos**, y viven donde no se pueden saltar. Se añade el cobro al mismo argumento porque una venta de feria cobrada es un solo hecho: si el cobro se enviara aparte, la cola tendría que garantizar orden y atomicidad entre dos elementos, y el primer fallo de red dejaría ventas sin cobro que nadie va a reconciliar en un puesto de feria.

`p_payment` nulo registra la venta sin cobro; es el caso raro, no el imposible. `security invoker` como todas: RLS sigue siendo la autorización real y la función no puede hacer nada que quien la llama no pudiera hacer a mano.

*Alternativas descartadas:* orquestar venta + cobro desde la Server Action con dos llamadas (deja de ser atómico en cuanto una falla, y sin conexión ni siquiera hay servidor donde orquestar); reutilizar `create_order` con un parámetro `kind` (rompe el blindaje que KAM-08 puso a propósito y mezcla dos altas con reglas opuestas sobre el cliente y sobre el estado).

### 3. El estado sale de `resolve_statuses(..., 'order')` filtrando `kind = 'final'` por menor `position`

Misma función que usa el tablero, misma comparación por `kind` y nunca por nombre (convención nº 5), y así una venta directa **jamás puede nacer en un estado que su línea no tenga**. Si el dueño renombra «Entregado» a «Vendido», no cambia nada. El flujo consultado sigue siendo `'order'`: no se crea uno nuevo (ver D1).

*Alternativa descartada:* guardar la venta sin estado (`status_id` es `not null`, y hacerlo nullable obligaría a que todo consumidor de `orders` tratara el caso).

### 4. La cuadrícula de más vendidos es una vista derivada, no una consulta suelta

Vista con `security_invoker = true` (convención nº 4) que agrega `order_items` de los últimos 90 días por ítem y línea. Vive en la base por dos razones: la ventana de 90 días queda en **un solo sitio** para que KAM-20 la herede sin volver a decidirla, y el orden de la cuadrícula —lo primero que se ve al abrir el puesto— no depende de que la aplicación arme bien un `group by`.

Los productos sin ventas no salen de la vista: la consulta de la cuadrícula parte del catálogo vendible y hace `left join` con la vista, de modo que un producto nuevo aparece igual, al final y por nombre. Ordenar solo por la vista dejaría invisible cualquier producto recién creado, que es justo el que más falta hace mostrar.

*Alternativa descartada:* ordenar por ventas de todo el histórico (un éxito de hace dos años empuja hacia abajo lo que hoy se vende, y la cuadrícula deja de servir).

### 5. Cómo se apoya este cambio en `lib/offline/` de KAM-11

Reescrita contra la API real. La versión anterior describía un contrato supuesto —`enqueue(envelope)` con `{id, kind, payload, occurredAt}` y un `usePendingCount()` filtrable— que KAM-11 no entrega con esa forma. Lo que entrega sirve igual, y en dos puntos sirve mejor:

| Pieza | API real | Cómo la usa la feria |
| --- | --- | --- |
| Encolar | `capture(input, deps)` con `input = { recordId, operation, payload, organizationId, userId, dependsOn? }` | `recordId` es el `uuid` de la venta, generado en el cliente; `operation` es `directSale.create`; el `payload` es el sobre de `lib/fair/sale-envelope.ts` |
| Hora del hecho | **No es campo de la entrada**: `enqueuedAt` lo pone la cola | `occurredAt` viaja **dentro del `payload`**, fijado por el cliente al confirmar, igual que hace `order-form.tsx` en el alta |
| Orden padre → hijo | `dependsOn` + `seq` | **No aplica**: una venta es un solo sobre, con su cobro dentro (decisión 2) |
| Idempotencia | La cola reintenta con el mismo `recordId`; la dedupe la pone la base | `create_direct_sale` replica el retorno temprano que KAM-11 puso en `create_order` (decisión 2, tarea 1.8) |
| Registro de operaciones | `registerOperation(key, { send, describe })`, invocado desde `features/sync/operations.ts` al cargar el módulo | La feria **añade su par de líneas ahí**, como anticipa el comentario de ese archivo. No se toca el motor |
| Conteo de pendientes | `useSyncStore` — reactivo, con `items` que llevan `entry.operation` | **No hace falta que KAM-11 filtre por tipo**: la feria filtra por `operation` sobre `items`, en su propio indicador. Era una fila del contrato viejo que se resuelve sin tocar nada |
| Motor de vaciado | `SyncProvider` — componente sin interfaz que registra las operaciones, refleja la cola en el store y dispara el vaciado al reconectar y cada 30 s | El layout `(fair)` **lo monta igual que `(app)`**. Es headless: no arrastra ningún elemento de navegación (decisión 7) |
| Fallos permanentes | `sync-tray.tsx` con `retryEntry` / `discardEntry`, montado en el cascarón `(app)` | La feria monta **su propia** presentación sobre las mismas funciones: la bandeja de `(app)` no está disponible aquí |
| Service worker | No cachea rutas de negocio; navegación sin red → `/offline` | Ver decisión 12: la feria no lo cambia para toda la aplicación, abre desde un snapshot propio |

Las dos filas que sí obligaron a diseñar algo nuevo —el plazo de `capture()` y el arranque en frío— son las decisiones 6 y 12.

### 6. Un solo camino de escritura: siempre se encola, con red y sin ella

Confirmar una venta **siempre** llama a `capture()` y devuelve de inmediato; la cola decide si envía ahora o después. La interfaz nunca espera al servidor y nunca ramifica según `navigator.onLine`.

«De inmediato» exige una precisión que la API real impone: `capture()` espera por omisión hasta 2 500 ms al vaciado cuando hay red, para que en el resto de la aplicación un registro salga dentro del mismo gesto. **La feria pasa `deadlineMs: 0`.** Es el mismo punto de entrada que usa `order-form.tsx`, con el plazo a cero: la venta se encola, el vaciado se dispara y sigue vivo por su cuenta, y la pantalla vuelve a la cuadrícula sin esperarlo. Un pedido se registra una vez cada varias horas y puede permitirse dos segundos y medio de espera a cambio de saber que salió; una venta de feria ocurre cada quince segundos y no puede permitirse ninguno. El criterio 3 —vuelta a la cuadrícula en menos de un segundo— no admite otra lectura.

Es la decisión que sostiene los criterios 3, 4 y 5 a la vez. Un camino en línea que escribe directo y otro sin conexión que encola parecen equivalentes hasta que la red está *a medias* —el caso real de una feria, no la red desconectada del laboratorio—: ahí la petición directa cuelga treinta segundos, el usuario reintenta y aparece el duplicado. Con un solo camino, la red a medias es indistinguible de la red caída, y el reintento lo gobierna la cola.

*Alternativa descartada:* escribir directo con red y encolar sin ella (dos caminos, dos comportamientos bajo latencia, y la prueba crítica solo cubriría uno).

### 7. El modo feria es un grupo de rutas, no una bandera de layout

`app/(fair)/` con su propio `layout.tsx`. El cascarón de `(app)` —cabecera, barra inferior, botón flotante— **no se renderiza**, en lugar de renderizarse oculto.

El criterio 1 dice «no existe ningún elemento de navegación tocable». Una barra escondida con CSS existe: reaparece con un cambio de estilo, con un `prefers-reduced-motion`, con un foco de teclado. Un layout que no la monta no puede fallar así, y la prueba —contar elementos de navegación en el DOM— se vuelve trivial de escribir y difícil de burlar.

*Alternativa descartada:* `/fair` dentro de `(app)` con el cascarón condicionado por la ruta (funciona hasta que alguien añade un elemento global al cascarón sin pensar en la feria).

### 8. El carrito vive en un store de Zustand; la sesión de feria, en el mismo store persistido

El carrito es efímero por diseño: se vacía en cada venta y no vale la pena que sobreviva a nada. La **sesión de feria** —línea y canal elegidos al entrar— sí sobrevive a cerrar la aplicación, porque volver a configurarla en medio de una feria es exactamente la fricción que este modo existe para eliminar; pero no vive en `localStorage` aparte: viaja **dentro del `fairSnapshot` de Dexie** (decisión 12), junto al catálogo que se capturó con ella. Son el mismo hecho —«esta es la feria que estoy atendiendo»— y partirlo en dos almacenes distintos abre la puerta a que uno sobreviva sin el otro: línea elegida y catálogo ausente, o al revés.

*Alternativa descartada:* guardar el carrito como borrador en la base (una escritura por toque, en el peor sitio posible para escribir).

### 9. El paso de inicio de feria resuelve la línea y el canal sin inventar un canal por omisión

No hay columna que marque un canal por omisión y no se añade (convención nº 11). El paso de inicio preselecciona el primer canal por `position` y deja cambiarlo; si la línea activa es «Todas», exige elegir línea. Cuando ambas cosas están resueltas y persistidas, el paso no vuelve a aparecer y se entra directo a la cuadrícula.

*Alternativa descartada:* añadir `is_default` a `sales_channels` (concepto nuevo para un problema de una sola pantalla; si algún día lo pide V15, entra por su propio cambio).

### 10. `fair-offline.spec.ts` pertenece a este cambio

KAM-11 prueba su cola con unitarias y una e2e de infraestructura sobre un registro cualquiera. El recorrido completo —veinte ventas sin red, reconexión, veinte registros con hora real y ninguno duplicado— se escribe aquí, porque aquí es donde el recorrido existe. Se ejecuta con `context.setOffline(true)` de Playwright, no simulando el estado de red en la aplicación: lo que hay que probar es el comportamiento real del navegador, no la rama que el código cree tomar.

Las veinte ventas se miden comparando el tiempo de la primera con el de la vigésima; «sin degradación perceptible» se fija como umbral concreto en la prueba para que el criterio 4 sea verificable y no un deseo.

### 11. La costura de inventario queda señalada y sin abrir

Vender no descuenta stock: `inventory_movements` llega en KAM-18. La venta directa ya deja todo lo necesario —ítem, variante y cantidad en `order_items`—, así que KAM-18 podrá derivar el consumo sin volver a este cambio. **No se añade ninguna columna ni ningún campo «en previsión»**, que es como se acumulan los derivados almacenados que la convención nº 4 prohíbe.

### 12. El modo feria abre sin red desde un snapshot explícito, no precacheando la ruta

El service worker de KAM-11 manda toda navegación a red y, sin red, responde `/offline`. Tal cual, llegar al puesto sin señal y abrir la aplicación no lleva a la cuadrícula: lleva a una página que dice que no hay conexión. Eso vacía de contenido el criterio 4, que es el criterio por el que existe esta pantalla.

La regla de KAM-11 es correcta y no se toca para el resto de la aplicación: *un tablero servido desde caché muestra un estado que ya no existe, y quien lo mira no tiene forma de saberlo*. Lo que se hace es darle a la feria un camino propio que **no incurre en ese defecto**, porque el dato lo captura la persona a propósito y se muestra con su antigüedad:

- Al entrar al modo feria **con red**, la aplicación guarda en Dexie un `fairSnapshot`: el catálogo vendible de la línea —id, nombre, precio, foto—, la línea y el canal de la sesión, y el instante de la captura.
- `/fair` se precachea como **cascarón** (documento y sus recursos, sin datos) y renderiza desde ese snapshot.
- La cuadrícula muestra siempre **de cuándo es** el catálogo cargado. Sin red y con snapshot: se vende. Sin red y sin snapshot: se dice que hay que abrir la feria una vez con señal, no se muestra una cuadrícula vacía sin explicación.

La diferencia con precachear la ruta a secas no es de implementación, es de honestidad: el HTML cacheado de `/fair` serviría precios de anoche **sin decirlo**. El snapshot los sirve con su hora encima.

*Alternativas descartadas:* precachear el documento `/fair` con `StaleWhileRevalidate` (barato, y exactamente el defecto que KAM-11 razonó evitar); cachear los datos de catálogo por línea para toda la aplicación (difumina la regla de KAM-11 fuera de la feria, que es donde esa regla protege de verdad).

### 13. El indicador de pendientes de la feria es propio, y filtra por operación

`SyncIndicator` vive en `header.tsx` y en `mobile-context-bar.tsx`, las dos piezas del cascarón `(app)` que la feria no monta (decisión 7). La feria monta su propio indicador sobre las **mismas fuentes**: `useSyncStore` para el conteo reactivo y `retryEntry` / `discardEntry` para las acciones.

Filtra `items` por `entry.operation === 'directSale.create'`. Quien atiende un puesto necesita saber cuántas **ventas** faltan por sincronizar, no cuántos registros de toda la organización: un pedido encolado ayer desde el taller no es asunto suyo ahora, y sumarlo al contador convierte un número que debe tranquilizar en uno que confunde.

*Alternativa descartada:* pedir a KAM-11 que `useSyncStore` acepte un filtro (no hace falta: `items` ya lleva `operation`, y filtrar en el consumidor no obliga a tocar código ajeno ya probado).

## Risks / Trade-offs

- **El snapshot de feria puede quedar viejo: precios cambiados anoche, un producto archivado esta mañana** → Por eso se muestra siempre su hora en la cuadrícula, y por eso se refresca cada vez que se entra al modo con red. Es el mismo trato que hace cualquier terminal de punto de venta que trabaja sin línea, y es honesto porque la antigüedad está a la vista. Lo que **no** se hace es servirlo callando, que es lo que haría precachear la ruta.
- **Montar `SyncProvider` en el layout `(fair)` dispara un vaciado cada 30 s durante toda la feria** → Es lo que se quiere: las ventas salen en cuanto haya un hueco de señal. El barrido no toca la interfaz y `drainOutbox` tiene su propio cerrojo (`resetDrainLock`), así que no compite consigo mismo.
- **Reutilizar `orders` significa que toda consulta futura de pedidos debe recordar filtrar `kind`** → Se convierte en requisito con tres escenarios en el delta de `orders`, de modo que olvidarlo rompe una prueba y no una feria. El filtro vive en el servicio, en un solo sitio.
- **La cuadrícula ordenada por ventas de 90 días puede quedar vacía en una organización nueva** → El `left join` con el catálogo vendible garantiza que siempre haya cuadrícula; sin historial, es el catálogo por nombre.
- **«Menos de un segundo» y «sin degradación perceptible» son criterios de tiempo, y los tiempos en CI son ruidosos** → Se miden como umbrales holgados sobre el propio recorrido, no como valores absolutos de máquina, y se documenta el umbral en la prueba. Un criterio de tiempo con margen sigue detectando la regresión que importa: la que multiplica el tiempo, no la que le suma 50 ms.
- **Un ayudante puede registrar ventas y sus cobros, y las ventas no tienen aprobación** → Es deliberado y coherente con KAM-10, donde el ayudante cobra pedidos: atender el puesto es su trabajo. La bitácora deja constancia de cada venta y de quién la registró.
- **El cobro dentro de la misma llamada acopla la venta al movimiento de dinero** → Es el acoplamiento que se busca: una venta de feria cobrada es un solo hecho. La función acepta `p_payment` nulo, así que registrar la venta sin cobro sigue siendo posible sin ninguna vía especial.

## Migration Plan

Este repositorio encadena ramas KAM en vez de fusionarlas a `main`, que sigue en el commit inicial. Las dos dependencias ya están en la historia de la rama de trabajo:

1. **KAM-10** (`27e47aa`): `payments`, `order_totals.paid`. ✓
2. **KAM-11** (`925892f`): `lib/offline/`, Serwist, Dexie, `SyncProvider`. ✓
3. **Este cambio**: migración `YYYYMMDDHHMMSS_direct_sales.sql` con `create_direct_sale(...)` y la vista de más vendidos, más la ampliación de la semilla.

Fuera de la migración, este cambio toca dos archivos de KAM-11 de forma aditiva: `features/sync/operations.ts` gana el registro de `directSale.create`, y `app/sw.ts` gana la regla de cascarón de `/fair` (decisión 12). Ninguno de los dos cambia el comportamiento existente.

La migración **solo añade** una función y una vista: no crea tablas, no altera columnas y no redefine ninguna vista existente. Revertirla es eliminar ambas y las ventas directas ya registradas siguen siendo filas válidas de `orders` —visibles en `order_totals` y en los ingresos—, simplemente sin pantalla para crear más. El grupo de rutas `(fair)` se retira sin tocar `(app)`.

Tras la migración, regenerar el grafo con `graphify update .` (convención nº 6).
