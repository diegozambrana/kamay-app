# KAM-13 · Diseño

## Context

Ver `proposal.md` — Why. Lo que importa aquí es el estado del código en el que aterriza este cambio:

- **`/quick` es un cascarón** (`app/(app)/quick/page.tsx`) que rinde un `MainContainer` vacío y anuncia esta tarea.
- **La barra inferior es un espejo del menú lateral**: `MobileNav` rinde `navEntriesFor(role)` completo —siete entradas para el dueño—, con icono arriba y rótulo truncado debajo. Los rótulos ya se cortan.
- **`nav-entries.ts` es la única fuente** de menú lateral y barra inferior. Este cambio la conserva como fuente única y le añade una dimensión: *dónde* vive cada entrada en móvil.
- **`defaultLandingPath(userAgent)`** en `lib/auth/routes.ts` ya decide `/quick` o `/dashboard` por user-agent en el servidor. Es el precedente de la decisión D4.
- **`useIsMobile()`** existe y usa `matchMedia` con `useSyncExternalStore`; en el servidor devuelve `false`. Sirve para decidir en cliente lo que puede corregirse tras hidratar, no para elegir qué se rinde primero.
- **`MobileNav` ya conoce rutas de captura** (`CAPTURE_ROUTES`) donde no se rinde: hoy solo el alta y la edición de pedido, con la nota de que KAM-09 añadiría las suyas y no lo hizo.
- **Los egresos ya se rinden como tarjetas en móvil** (`ExpenseCard`, `useIsMobile` en `ExpensesScreen`). No hay nada que construir ahí.
- **`expenses` no tiene ninguna política para el ayudante** (ni lectura ni escritura). Es la razón de fondo del filtrado por rol de la retícula.
- **`activity_log` es de lectura exclusiva del dueño**, lo que descarta usarlo como fuente de "Registrado hoy" (D3).
- **KAM-12 dejó el modo feria construido y sin puerta de entrada**: `app/(fair)/fair` existe, `/fair` está en `PROTECTED_PREFIXES`, y `features/fair/exit-fair-mode.tsx` ya vuelve a `/quick`. Falta la ida, y V16 es la única prevista.
- **KAM-11 dejó la cola en `lib/offline/` y su reflejo en `stores/sync-store.ts`**, con `SyncIndicator` montado en `components/layout/header.tsx` y en `components/layout/mobile-context-bar.tsx`, más `SyncTray` como bandeja. Nada de eso se rehace aquí.
- **La cola cubre `order.create`, `order.update` y `directSale.create`**, y solo eso: son las claves declaradas en `features/sync/operations.ts`. Los egresos escriben directo —el `enqueue` de `cost-form.tsx` y `purchase-form.tsx` es la subida diferida del comprobante, otra cola—. Una captura de pedido sin red no llega al servidor hasta que el outbox drena: es la razón de D3b.
- **`MainContainer` ya reserva `pb-20`** para la barra inferior; el flotante tiene que caber en ese mismo hueco, no pedir otro.

## Goals / Non-Goals

**Goals**

- Cerrar la estructura de navegación móvil de una vez: cuatro ranuras, un panel "Más", un control *+ Registrar*. Las tareas que siguen añaden destinos, no reorganizan.
- Que V16 se construya completa —seis ranuras— aunque dos destinos aún no existan, para que el criterio del pulgar en 390 px se verifique una sola vez.
- Cerrar el circuito del modo feria: darle la entrada que KAM-12 dio por supuesta.
- No tocar el esquema. Es una tarea de interfaz sobre datos que ya existen, y las tareas que sí traen esquema —KAM-16, KAM-18— no deben encontrarse compitiendo con esta por el directorio de migraciones.
- Que la barra inferior y el panel "Más" salgan del mismo `nav-entries.ts` que el menú lateral, sin una segunda lista que mantener.

**Non-Goals**

- La navegación de escritorio no cambia. El menú lateral sigue rindiendo las mismas entradas y el botón flotante de escritorio es de KAM-14.
- No se define el contenido de *Mis pendientes*: aquí solo se reserva la ranura y el `href`. El del modo feria ya está definido por KAM-12 y no se toca; solo se le añade la entrada.
- No se rehace nada de la infraestructura de sincronización: el indicador, la bandeja y la cola son de KAM-11. Este cambio los lee y se aparta de su sitio.
- No se introduce ninguna abstracción de "capacidad de rol" nueva. El filtrado por rol sigue siendo la lista de `roles` que ya declara cada entrada.

## Decisions

### D1 · Las seis ranuras se declaran como datos, con su estado de disponibilidad

Un módulo `lib/quick-capture/destinations.ts` declara los seis destinos: clave, rótulo, icono, `href`, roles que lo ven, y `availableFrom` — la tarea que lo habilita, o ausente si ya está disponible. La retícula, el menú del botón *+ Registrar* y sus pruebas leen de ahí.

*Por qué:* los dos destinos que faltan se habilitarán en dos tareas distintas (KAM-16, KAM-18) y por dos personas-sesión distintas. Habilitar uno debe ser borrar un campo de una línea, no editar dos componentes. Además garantiza sin esfuerzo que la retícula y el menú de *+ Registrar* ofrezcan exactamente lo mismo, que es lo que exige el escenario «El menú respeta el rol».

*Alternativa descartada:* escribir los seis botones a mano en el JSX de la retícula y repetirlos en el menú. Es lo más corto hoy y la fuente garantizada de divergencia mañana.

*Nota:* `availableFrom` es metadato de planificación que se rinde como texto ("Llega con el inventario"), no como identificador de tarea visible al usuario. Venta rápida **no** lo lleva: su destino, `/fair`, existe desde KAM-12.

### D2 · Las entradas de navegación ganan un campo `mobile`, no una lista aparte

`NavEntry` gana `mobile: "bar" | "more"`. `navEntriesFor(role)` no cambia; se añaden dos derivadas puras, `bottomBarEntriesFor(role)` y `moreEntriesFor(role)`, que particionan esa misma lista. La entrada `/quick` cambia su rótulo de "Registrar" a "Inicio" y se declara `bar`; se añade `/my-tasks` como `bar`; `/dashboard` pasa a `more` —en el celular el panel no es la puerta de entrada—; el resto queda en `more`.

*Por qué:* mantiene la promesa que ya hace el comentario de cabecera de `nav-entries.ts` —una sola fuente para todas las superficies— y hace que el escenario «One declaration feeds every surface» sea verificable con una prueba unitaria pura, sin rendir nada.

*Alternativa descartada:* una constante `BOTTOM_BAR_HREFS` en `mobile-nav.tsx`. Convierte la barra en una segunda lista que hay que recordar actualizar, y el olvido no rompe ninguna prueba.

*Un rótulo por superficie:* `/quick` se llama **Registrar** en el menú lateral —donde compite con Panel, que es la puerta de entrada del escritorio (mapa §4.1)— e **Inicio** en la barra inferior, donde la puerta sí es la captura (§4.2). Se resuelve con un `barLabel` opcional, no con dos entradas: sigue siendo la misma sección dicha con la palabra que corresponde a cada sitio. Renombrarla en las dos superficies a la vez rompía el menú de escritorio, que es como se descubrió.

*Invariante que la prueba debe fijar:* `bottomBarEntriesFor(role)` devuelve exactamente tres entradas para todo rol —Inicio, Pedidos, Tareas—; la cuarta ranura es "Más", que no es una entrada de navegación sino el disparador del panel. Que sean tres y no cuatro es lo que impide que una tarea futura cuele una quinta sección en la barra sin darse cuenta.

### D3 · "Registrado hoy" se compone en un servicio, sin vista de base de datos

`RecentCaptureService.listToday(organizationId, timezone)` consulta las tablas de origen —hoy `orders` y `expenses`— acotando cada una a los cinco más recientes del día, las normaliza a una forma común (`{ kind, id, label, lineId, occurredAt, href }`), las mezcla, ordena por `created_at` descendente y devuelve cinco. Cada consulta pasa por RLS, así que el ayudante simplemente no recibe filas de `expenses` y no hace falta ninguna regla de rol en el servicio.

*Por qué no una vista:* una vista `union` con `security_invoker = true` sería más elegante y escalaría mejor a cuatro o cinco tipos de registro, pero cuesta una migración, su prueba pgTAP y una regeneración del grafo, y sirve solo a la mitad servidor de la lista: la mitad pendiente vive en el dispositivo y habría que mezclarla igual (D3b). Con dos orígenes de servidor, el sobre-consumo es de cinco filas y la mezcla es una función pura y trivialmente probable.

*Por qué no `activity_log`:* sería la fuente natural ("un solo historial", convención nº 7) y ya distingue las inserciones, pero su única política de lectura es `is_owner`. V16 es de ambos roles: el ayudante vería la lista siempre vacía.

*Cuándo revisar la decisión:* cuando el tercer o cuarto origen entre (las ventas directas de KAM-12 son filas de `orders` y no suman consulta; los consumos de KAM-18 y las tareas de KAM-16 sí). A partir de cuatro consultas por render, la vista `union` gana y esta decisión debe reevaluarse en esa tarea.

*Zona horaria:* "hoy" se resuelve con la zona de la organización, como ya hace `todayInTimezone` para el retraso de pedidos. Un taller que registra a las 23:40 no debe ver su registro caer en el día equivocado.

### D3b · "Registrado hoy" mezcla el servidor con la cola, y `recordId` es la clave de la mezcla

La lista tiene dos orígenes. El de servidor es D3. El local es `useSyncStore().items`, el reflejo de la cola de KAM-11 que ya alimenta `SyncIndicator`: se filtran las entradas cuyo `operation` sea una creación cubierta por la retícula y cuyo `enqueuedAt` caiga hoy, se normalizan a la misma forma, se marcan como no enviadas y se mezclan por hora descendente con las del servidor.

**La deduplicación es exacta, no heurística.** KAM-11 genera el `uuid` en el cliente y ese identificador es el que acaba siendo llave primaria (convención nº 9), de modo que `entry.recordId` y el `id` de la fila sincronizada son el mismo valor. Componer la lista es: tomar las filas del servidor, añadir las entradas de la cola cuyo `recordId` no esté ya entre ellas, ordenar y cortar en cinco. No hace falta comparar montos ni horas para saber si dos elementos son el mismo hecho.

*Por qué mezclar en vez de leer solo del servidor:* dos de los cuatro destinos vivos —Pedido y Venta rápida— encolan. Sin la cola, tomar un pedido en la calle sin señal deja la pantalla afirmando que hoy no se registró nada, justo la duda que esta lista existe para disipar y en el contexto donde más importa. El `SyncIndicator` de la tira de contexto dice *cuántos* faltan, no *qué* se capturó; son dos preguntas distintas.

*Alcance de la mitad pendiente:* exactamente las operaciones que la cola lleva, ni una más. Los egresos no están entre ellas —`offline-capture` cubre "las operaciones declaradas como cubiertas", y hoy esas son las tres de `operations.ts`— así que un gasto aparece en la lista solo una vez guardado. Ampliar la cobertura de la cola es trabajo de la capacidad `offline-capture`, no de esta pantalla: aquí se lee lo que haya.

*Por qué la lista no ofrece reintentar ni descartar:* eso es la bandeja de KAM-11, a un toque en el indicador de arriba. Dos superficies que resuelven la misma cola son dos superficies que se contradicen. La lista informa; la bandeja decide.

*Consecuencia aceptada:* la parte pendiente es del dispositivo, no de la organización — la cola de la otra persona no se ve. Es inevitable y coherente: lo pendiente aún no es un hecho compartido.

*Elemento pendiente sin enlace:* mientras una captura no se haya enviado no hay detalle que abrir, así que su fila no navega. Se rinde como fila inerte con su marca, no como enlace roto.

### D4 · La vista por omisión de pedidos se decide por user-agent, en el servidor

`app/(app)/orders/page.tsx` ya calcula `view` desde `searchParams` con `board` como omisión. La omisión pasa a `isMobileUserAgent(headers().get("user-agent"))` → `"list"` : `"board"`. El patrón de detección se extrae del `MOBILE_UA_PATTERN` que ya vive en `lib/auth/routes.ts` y se exporta como función propia, para no duplicar la expresión regular.

*Por qué en el servidor:* si se decidiera con `useIsMobile()`, el servidor rendiría el tablero, el cliente lo cambiaría a lista en el primer commit y el usuario vería un salto —además de pagar el render de un kanban que no va a mirar—. La detección por user-agent es imperfecta (una ventana estrecha en un escritorio sigue recibiendo tablero), pero es la que el proyecto ya eligió para el aterrizaje tras entrar, y el usuario tiene el conmutador de vista a un toque.

*Consecuencia deliberada:* la vista sigue viviendo en la dirección, así que un enlace compartido desde un escritorio abre el tablero también en un teléfono. Es lo correcto: el enlace expresa una intención.

### D5 · "Más" es un `Sheet`, no una página

El cuarto elemento de la barra abre un panel inferior con las entradas restantes. No cambia la dirección.

*Por qué:* el mapa §2.3 asigna el panel lateral al "contenido secundario que no debe hacer perder el contexto de fondo", y §2.4 fija tres niveles de profundidad. Una página `/more` gastaría un nivel entero en un índice y rompería el retroceso: volver de Catálogo llevaría al índice, no a donde se estaba.

*Detalle de accesibilidad:* el disparador es un `button`, no un `Link`; los cuatro elementos de la barra deben ser recorribles con teclado y anunciar su estado, y sólo tres de ellos son navegación.

### D6 · *+ Registrar* es un botón flotante sobre la barra, no un elemento dentro de ella

El control se rinde en el layout de `(app)`, encima de la barra inferior y desplazado a la derecha, y abre el mismo menú que la retícula. En escritorio no se rinde (`md:hidden`); el flotante de escritorio es de KAM-14.

*Por qué no una quinta ranura ni un botón central que parta la barra:* el mapa §2.6 pide que registrar esté a un toque desde cualquier pantalla, y §4.2 fija cuatro entradas nominales. Un botón central que parta la barra en 2+2 obliga a reordenar las cuatro entradas alrededor de él y deja "Tareas" y "Más" fuera del alcance cómodo del pulgar en una mano. Flotando sobre la esquina inferior derecha queda en la zona más alcanzable del pulgar y no le quita ancho a ningún rótulo.

*Colisión con la barra:* `MainContainer` ya reserva `pb-20` para la barra inferior. El flotante debe caber dentro de ese mismo hueco en lugar de pedir otro; si no cupiera, se amplía ahí una sola vez y no pantalla por pantalla.

*Colisión con el indicador de sincronización:* el `SyncIndicator` de KAM-11 vive arriba, en la tira de contexto (`mobile-context-bar.tsx`), y el flotante abajo a la derecha. No se pisan, y este cambio no toca la tira. Queda como invariante verificable —no como suposición— porque es el punto donde dos tareas comparten el borde de la pantalla.

### D7 · Los dos destinos no disponibles son botones inertes con leyenda, no enlaces rotos

Consumo (KAM-18) y Tarea (KAM-16) se rinden como `button` deshabilitado con `aria-disabled`, el mismo tamaño y la misma posición que tendrán cuando estén vivos, y una línea de texto pequeña que dice qué falta. No se navega a ninguna parte.

*Por qué no ocultarlos:* la convención del proyecto es ocultar lo que un **rol** no puede usar; esto es distinto —lo que **el producto** todavía no tiene—. Ocultarlos haría que la retícula pasara de cuatro a seis ranuras en dos tareas distintas, cambiando la disposición dos veces y obligando a re-verificar el alcance del pulgar cada vez. Declararlos es además honesto: quien usa la aplicación ve hacia dónde va.

*Por qué no navegar a un cascarón:* seis cascarones de "próximamente" son seis rutas que crear, proteger y borrar. La excepción es `/my-tasks`, que sí necesita ruta porque es destino de la barra inferior y no de un botón.

### D8 · Las rutas de captura donde la barra no se rinde se completan

`CAPTURE_ROUTES` gana `/expenses/purchases/new`, `/expenses/costs/new` y las rutas de edición correspondientes si existen. La misma lista gobierna la ausencia del botón *+ Registrar*, para que no haya dos criterios de "esto es una pantalla de captura".

*Por qué:* KAM-09 dejó la nota y no la aplicó; hoy la barra inferior se rinde sobre el formulario de gasto, tapando el guardar y ofreciendo una salida que se salta la confirmación de descarte que `discard-guard.tsx` sí implementa en pedidos.

## Risks / Trade-offs

- **La detección por user-agent falla en una ventana estrecha de escritorio** → el usuario recibe el tablero en un viewport donde la lista sería mejor. Mitigación: el conmutador de vista está a un toque y la elección persiste en la dirección. No se intenta adivinar mejor: mezclar user-agent y `matchMedia` produce exactamente el salto tras hidratar que D4 evita.
- **Dos botones inertes pueden leerse como una aplicación incompleta** → mitigación: la leyenda dice qué llega, no "próximamente" a secas, y cuatro de los seis destinos funcionan desde el primer día. Desaparece en KAM-16 y KAM-18.
- **"Registrado hoy" hace dos consultas por render de `/quick`, y crecerá** → mitigación: cada una está acotada a cinco filas y a un día. La decisión D3 fija el umbral (cuatro orígenes) en que hay que sustituirlas por una vista, para que la deuda tenga fecha y no se descubra tarde.
- **Cambiar `nav-entries.ts` toca una pieza que usan el menú lateral y la barra** → un error de partición deja una sección inalcanzable en escritorio o en móvil. Mitigación: la prueba unitaria afirma la partición completa —toda entrada visible para un rol está en la barra **o** en "Más", nunca en ninguna ni en las dos— y no solo el contenido de cada mitad.
- **"Registrado hoy" depende de la forma interna de la cola de KAM-11** → si `OutboxEntry` o las claves de `features/sync/operations.ts` cambian, la mitad pendiente de la lista se rompe en silencio: seguiría rindiendo, solo que sin las entradas pendientes. Mitigación: la normalización de una entrada a fila de lista se aísla en una función pura con su prueba, de modo que un cambio de forma rompa una prueba unitaria y no la pantalla. No se lee Dexie directamente: se lee `useSyncStore`, que es la superficie que KAM-11 declaró para esto.
- **La mitad pendiente de la lista es local y la sincronizada es de la organización** → dos personas capturando a la vez ven listas distintas hasta que ambas colas drenan. Mitigación: es inherente a una cola por dispositivo y está declarado como supuesto nº 3 del `proposal.md`; la marca de "no enviado" lo hace visible en vez de misterioso.
- **Dos superficies hablan de la misma cola** — la lista de V16 y el indicador de la tira de contexto → mitigación: reparto explícito en D3b. La lista dice *qué* se capturó y no ofrece acciones; el indicador dice *cuántos* faltan y es el único que reintenta o descarta.
- **`/my-tasks` es un cascarón alcanzable con un toque desde la barra** → una de las cuatro ranuras no hace nada útil hasta KAM-17. Mitigación: el cascarón nombra la tarea que lo llenará, como ya hacen `/quick` y `/dashboard`; es el mismo precio, aceptado, de cerrar la estructura de una vez.

## Migration Plan

No hay migración de base de datos ni de datos. El despliegue es un cambio de interfaz:

1. `lib/quick-capture/destinations.ts` y las derivadas de `nav-entries.ts` con sus pruebas unitarias: son puras y no cambian nada rendido.
2. `/my-tasks` como cascarón y su prefijo protegido en `lib/auth/routes.ts`; sin esto la barra apuntaría a una ruta que el proxy no reconoce.
3. La retícula —con la entrada al modo feria, que cierra un circuito hoy abierto—, la lista "Registrado hoy" con sus dos orígenes, el menú y el botón flotante; después la barra de cuatro ranuras y el panel "Más". Este es el único momento en que la navegación móvil queda a medias, y dura un commit.
4. La vista por omisión de pedidos y el completado de `CAPTURE_ROUTES`.
5. e2e en 390 px al final, cuando las cuatro piezas están puestas.

**Reversión:** revertir el commit. Al no haber esquema ni datos, no queda nada que deshacer aparte del código; el único residuo sería `/my-tasks` si alguien hubiera guardado el enlace, que devolvería 404 como cualquier ruta inexistente.
