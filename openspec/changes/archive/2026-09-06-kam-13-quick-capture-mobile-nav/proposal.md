# KAM-13 · Registro rápido y navegación móvil

## Why

Kamay ya sabe registrar pedidos (KAM-07/08), egresos (KAM-09), movimientos de dinero (KAM-10), capturar sin señal (KAM-11) y vender en feria (KAM-12), pero **todo eso sigue entrándose por una interfaz pensada para el escritorio**. El trabajo real del taller no ocurre ahí: ocurre en el banco de trabajo, en la calle entregando, en el puesto de feria. Hoy el celular recibe la misma interfaz encogida —una barra inferior de siete entradas que se corta, un tablero kanban horizontal en 390 px— y `/quick` sigue siendo un cascarón vacío que anuncia esta misma tarea.

El síntoma más claro de esa deuda: **el modo feria no tiene entrada**. KAM-12 construyó V6 y su salida —`exit-fair-mode.tsx` vuelve a `/quick`—, pero la puerta de ida iba a ser V16, que nunca se construyó. Hoy `/fair` solo se alcanza escribiendo la dirección.

Este cambio convierte el celular en **la herramienta de captura**, no en la versión reducida del escritorio: una puerta de entrada propia (V16), una barra inferior de cuatro entradas con sentido en el pulgar, y la garantía de que anotar un gasto nunca está a más de dos toques desde donde uno esté.

> **Posición en la secuencia.** KAM-13 llega después de KAM-11 y KAM-12, como manda el backlog: ambas están fusionadas y archivadas. Dos de los seis destinos de V16 —Consumo (KAM-18) y Tarea (KAM-16)— apuntan a pantallas que aún no existen; este cambio **no espera** a esas tareas y los deja como botones inertes con su leyenda, del mismo modo en que hoy `/quick` y `/dashboard` son cascarones que nombran la tarea que los llenará. La estructura de navegación móvil se cierra aquí, de una vez; KAM-16 y KAM-18 solo cambiarán un `href`. Ver los supuestos registrados al final.

## What Changes

### V16 · Registro rápido (nueva pantalla real en `/quick`)

- **Cuadrícula de seis botones grandes**: Venta rápida · Pedido · Compra · Gasto · Consumo · Tarea, en dos columnas, dimensionados y ubicados para el pulgar en una pantalla de 390 px.
- **Cuatro destinos vivos hoy**: Venta rápida → `/fair` (V6), Pedido → `/orders/new` (V5), Compra → `/expenses/purchases/new` (V8), Gasto → `/expenses/costs/new` (V9).
- **V16 cierra el circuito del modo feria**: es la única entrada prevista a `/fair`, y `fair-mode` ya exige que salir devuelva al registro rápido. Sin esta pantalla, el modo feria queda construido y sin puerta.
- **Dos destinos inertes hoy**: Consumo (llega en KAM-18) y Tarea (KAM-16) se pintan con el mismo tamaño y posición, deshabilitados, declarando visiblemente que aún no están disponibles. Ocupan su ranura desde el principio para que la retícula, el alcance del pulgar y el criterio de 390 px se verifiquen una sola vez.
- **La retícula se filtra por rol**, como todo menú del sistema (mapa §4.4, convención de ocultar en vez de deshabilitar): Compra y Gasto escriben en `expenses`, tabla sin ninguna política para el ayudante, así que **no aparecen** para ese rol. El caso completo de seis botones es el del dueño.
- **Lista "Registrado hoy"**: los cinco registros más recientes del día, con su tipo, su rótulo, su línea y su hora, cada uno enlazado a su detalle. Es la confirmación de que la captura llegó, y el modo de no anotar dos veces lo mismo cuando dos personas capturan a la vez.
- **"Registrado hoy" incluye lo que todavía está en la cola**, distinguido como *sin enviar*. La cola de KAM-11 cubre hoy el alta y la edición de pedido y la venta directa; si la lista leyera solo del servidor, un pedido tomado en la calle sin señal dejaría la pantalla diciendo que hoy no se registró nada, que es exactamente la duda que esta lista existe para disipar. Los egresos no están entre las operaciones cubiertas por esa cola, así que aparecen en la lista una vez guardados, como cualquier escritura directa.
- **`/quick` es móvil por vocación, no por restricción**: sigue siendo alcanzable desde un escritorio (ya lo es hoy), simplemente no es la puerta de entrada de ese dispositivo.

### Navegación móvil

- **La barra inferior pasa de siete entradas a cuatro**: Inicio (V16) · Pedidos (V3) · Tareas · Más. Hoy la barra rinde las mismas siete entradas del menú lateral, que en 390 px se aprietan hasta cortar los rótulos.
- **"Más" abre un panel** con el resto de secciones según el rol: Egresos, Catálogo, Contactos, Configuración —y, cuando existan, Activos, Reportes y Bitácora—.
- **"Tareas" apunta a `/my-tasks`** (V20 · Mis pendientes), no al tablero: en el celular interesa "qué hago hoy". Esa pantalla llega en KAM-17, así que este cambio crea su **cascarón**, igual que KAM-02 creó el de `/quick`. La cuarta ranura queda ocupada desde ahora y la barra no vuelve a cambiar de forma.
- **Botón *+ Registrar* omnipresente en móvil**: un botón de acción flotante, presente en toda pantalla del grupo `(app)` salvo las de captura a pantalla completa, que abre el mismo menú de creación de V16. Con él, registrar un gasto desde cualquier pantalla son dos toques: *+ Registrar* → *Gasto*.
- **El indicador de sincronización de KAM-11 sigue donde está y sigue alcanzable**: vive en la tira de contexto móvil (`mobile-context-bar.tsx`), que este cambio no toca. Ni la barra de cuatro ranuras ni el botón flotante deben taparlo ni desplazarlo.
- **Una sola fuente para las tres superficies**: el menú lateral de escritorio, la barra inferior y el panel "Más" se derivan del mismo `nav-entries.ts` filtrado por rol, sin listas paralelas que se desincronicen.

### Adaptaciones móviles de lo ya construido

- **Pedidos en lista por omisión en móvil**: `/orders` sin `?view=` resuelve a `list` en un user-agent móvil y a `board` en el resto, del mismo modo en que ya se decide el aterrizaje tras entrar. El kanban sigue disponible como alternativa explícita, con desplazamiento por columnas.
- **Egresos como tarjetas** ya se cumple desde KAM-09 (`ExpenseCard`): aquí solo se verifica, no se reconstruye.
- **Formularios de captura a pantalla completa** ya se cumple para el alta y la edición de pedido (la barra inferior no se rinde en esas rutas): este cambio **extiende esa regla a las rutas de compra y gasto**, que KAM-09 dejó fuera de la lista pese a dejar la nota.
- **Ninguna vista del grupo `(app)` exige desplazamiento horizontal** en 390 px para completar su acción principal.

**Fuera de alcance** (copiado del backlog):
- Aplicación nativa o publicación en tiendas.
- Notificaciones push (KAM-17 cubre correo y avisos dentro de la aplicación).

Derivado de lo anterior, tampoco entran: la pantalla de venta rápida en sí y el grupo de rutas `(fair)` —construidos en KAM-12; aquí solo se les da entrada—; el indicador persistente de registros por sincronizar y la bandeja de no sincronizados —construidos en KAM-11 (`features/sync/`); aquí se leen y se respetan, no se rehacen—; el contenido de *Mis pendientes* y el de la campana de notificaciones (KAM-17); el formulario de consumo (KAM-18); el alta de tareas (KAM-16); el botón flotante *+ Registrar* **de escritorio** y el contenido del panel principal (KAM-14).

## Capabilities

### New Capabilities

- `quick-capture`: la pantalla de registro rápido V16 —su retícula de seis destinos filtrada por rol, la lista "Registrado hoy" con lo enviado y lo pendiente, y el menú de creación—, y el acceso a registrar desde cualquier pantalla móvil mediante el botón *+ Registrar*.

### Modified Capabilities

- `user-auth`: el requisito *Authenticated shell frames every app screen* cambia. La barra inferior móvil deja de ser un espejo del menú lateral y pasa a tener exactamente cuatro entradas, con el resto de secciones bajo "Más" y sin desplazamiento horizontal en 390 px.
- `orders`: el requisito *Vistas alternativas y filtros del tablero* cambia. La vista por omisión deja de ser siempre el tablero: en móvil es la lista, con el tablero disponible como alternativa explícita.

## Impact

**Código afectado**

- `app/(app)/quick/page.tsx` — deja de ser cascarón; carga los registros del día y rinde V16.
- `app/(app)/my-tasks/page.tsx` — cascarón nuevo, destino de la cuarta entrada hasta KAM-17.
- `app/(app)/layout.tsx` — suma el botón *+ Registrar* móvil junto a `MobileNav`.
- `app/(app)/orders/page.tsx` — la vista por omisión se decide por dispositivo.
- `components/layout/nav-entries.ts` — declara qué entradas viven en la barra inferior y cuáles bajo "Más"; añade `/my-tasks`.
- `components/layout/mobile-nav.tsx` — cuatro ranuras y entrada "Más"; su lista de rutas de captura crece con compra y gasto.
- `components/layout/main-container.tsx` — el `pb-20` que ya despeja la barra debe despejar también el flotante.
- `features/quick-capture/*` — retícula, menú de creación, botón flotante y lista "Registrado hoy" (feature nueva).
- `services/` — un servicio de lectura para la parte servidor de "Registrado hoy".
- `lib/auth/routes.ts` — la detección de user-agent móvil se reutiliza para la vista por omisión de pedidos; `/my-tasks` se suma a los prefijos protegidos.

**Se lee pero no se modifica:** `stores/sync-store.ts` y `lib/offline/` (KAM-11) para la parte pendiente de "Registrado hoy"; `components/layout/mobile-context-bar.tsx`, que aloja el indicador de sincronización; `app/(fair)/` y `features/fair/` (KAM-12), a los que solo se les añade la entrada desde V16.

**Base de datos:** ninguna migración. No hay tabla ni vista nueva; "Registrado hoy" se compone en el servicio a partir de consultas acotadas sobre tablas existentes, y RLS decide qué ve cada rol sin ninguna regla adicional (ver `design.md`).

**Dependencias:** ninguna nueva.

**Pruebas:** unitarias sobre el reparto de entradas entre barra y "Más", el filtrado por rol de la retícula y la composición de "Registrado hoy" con sus dos orígenes; e2e con viewport de 390 px para el recorrido de gasto, el de pedido, la ida y vuelta al modo feria, la ausencia de desplazamiento horizontal y la lista por omisión en pedidos.

## Supuestos registrados

1. **Solo se adelanta a KAM-16 y KAM-18.** KAM-11 y KAM-12 ya están fusionadas, así que la secuencia del backlog se respeta salvo por dos destinos de la retícula, que quedan declarados e inertes, nunca ocultos. Construir la retícula completa desde el principio evita cambiar su disposición dos veces y re-verificar el alcance del pulgar en cada una.
2. **La retícula de V16 se filtra por rol.** El backlog dice "seis botones" sin mencionar el rol; la matriz de acceso deja `expenses` fuera del alcance del ayudante por completo. Se resuelve ocultando, que es la convención del proyecto (mapa §4.4), y el criterio de los seis botones alcanzables con el pulgar se verifica sobre el caso del dueño, que es el peor caso.
3. **"Registrado hoy" es de la organización, no de la persona.** El backlog dice "los últimos cinco registros" sin precisar el alcance. En un taller de dos personas, ver lo que acaba de anotar la otra evita el registro duplicado, que es exactamente el error que esta lista debe prevenir. RLS ya recorta lo que cada rol puede ver. La parte pendiente, en cambio, es por fuerza local: la cola vive en el dispositivo de quien capturó.
4. **La cola y el servidor se identifican por el mismo `uuid`.** KAM-11 genera el identificador en el cliente y es el que acaba siendo llave primaria (convención nº 9), así que una entrada pendiente y su fila ya sincronizada comparten `recordId`. Eso hace la deduplicación exacta y no heurística.
5. **La detección de móvil para la vista de pedidos es por user-agent, en el servidor.** El proyecto ya toma esa decisión así para el aterrizaje tras entrar (`defaultLandingPath`). Decidirlo en el cliente produciría un tablero que aparece y se convierte en lista después de hidratar.
