# KAM-13 · Registro rápido y navegación móvil

## Why

Kamay ya sabe registrar pedidos (KAM-07/08), egresos (KAM-09) y movimientos de dinero (KAM-10), pero **todo eso solo se usa cómodo sentado frente a una computadora**. El trabajo real del taller no ocurre ahí: ocurre en el banco de trabajo, en la calle entregando, en el puesto de feria. Hoy el celular recibe la misma interfaz del escritorio encogida —una barra inferior de siete entradas que se corta, un tablero kanban horizontal en 390 px, y `/quick` como un cascarón vacío que anuncia esta misma tarea.

Este cambio convierte el celular en **la herramienta de captura**, no en la versión reducida del escritorio: una puerta de entrada propia (V16), una barra inferior de cuatro entradas con sentido en el pulgar, y la garantía de que anotar un gasto nunca está a más de dos toques desde donde uno esté.

> **Prerequisito parcial declarado.** El backlog sitúa a KAM-13 después de KAM-12 (modo feria) y KAM-11 (sin conexión), y tres de los seis botones de V16 apuntan a pantallas que aún no existen. Este cambio **no espera** a esas tareas: construye la retícula completa y deja los tres destinos pendientes como botones inertes con su leyenda, del mismo modo en que hoy `/quick` y `/dashboard` son cascarones que nombran la tarea que los llenará. La estructura de navegación móvil se cierra aquí, de una vez; KAM-12, KAM-16 y KAM-18 solo cambiarán un `href`. Ver los supuestos registrados al final.

## What Changes

### V16 · Registro rápido (nueva pantalla real en `/quick`)

- **Cuadrícula de seis botones grandes**: Venta rápida · Pedido · Compra · Gasto · Consumo · Tarea, en dos columnas, dimensionados y ubicados para el pulgar en una pantalla de 390 px.
- **Tres destinos vivos hoy**: Pedido → `/orders/new` (V5), Compra → `/expenses/purchases/new` (V8), Gasto → `/expenses/costs/new` (V9).
- **Tres destinos inertes hoy**: Venta rápida (llega en KAM-12), Consumo (KAM-18) y Tarea (KAM-16) se pintan con el mismo tamaño y posición, deshabilitados, declarando visiblemente que aún no están disponibles. Ocupan su ranura desde el principio para que la retícula, el alcance del pulgar y el criterio de 390 px se verifiquen una sola vez.
- **La retícula se filtra por rol**, como todo menú del sistema (mapa §4.4, convención de ocultar en vez de deshabilitar): Compra y Gasto escriben en `expenses`, tabla sin ninguna política para el ayudante, así que **no aparecen** para ese rol. El caso completo de seis botones es el del dueño.
- **Lista "Registrado hoy"**: los cinco registros más recientes del día en la organización, con su tipo, su rótulo, su línea y su hora, cada uno enlazado a su detalle. Es la confirmación de que la captura llegó, y el modo de no anotar dos veces lo mismo cuando dos personas capturan a la vez.
- **`/quick` es móvil por vocación, no por restricción**: sigue siendo alcanzable desde un escritorio (ya lo es hoy), simplemente no es la puerta de entrada de ese dispositivo.

### Navegación móvil

- **La barra inferior pasa de siete entradas a cuatro**: Inicio (V16) · Pedidos (V3) · Tareas · Más. Hoy la barra rinde las mismas siete entradas del menú lateral, que en 390 px se aprietan hasta cortar los rótulos.
- **"Más" abre un panel** con el resto de secciones según el rol: Egresos, Catálogo, Contactos, Configuración —y, cuando existan, Activos, Reportes y Bitácora—.
- **"Tareas" apunta a `/my-tasks`** (V20 · Mis pendientes), no al tablero: en el celular interesa "qué hago hoy". Esa pantalla llega en KAM-17, así que este cambio crea su **cascarón**, igual que KAM-02 creó el de `/quick`. La cuarta ranura queda ocupada desde ahora y la barra no vuelve a cambiar de forma.
- **Botón *+ Registrar* omnipresente en móvil**: un botón de acción flotante, presente en toda pantalla del grupo `(app)` salvo las de captura a pantalla completa, que abre el mismo menú de creación de V16. Con él, registrar un gasto desde cualquier pantalla son dos toques: *+ Registrar* → *Gasto*.
- **Una sola fuente para las tres superficies**: el menú lateral de escritorio, la barra inferior y el panel "Más" se derivan del mismo `nav-entries.ts` filtrado por rol, sin listas paralelas que se desincronicen.

### Adaptaciones móviles de lo ya construido

- **Pedidos en lista por omisión en móvil**: `/orders` sin `?view=` resuelve a `list` en un user-agent móvil y a `board` en el resto, del mismo modo en que ya se decide el aterrizaje tras entrar. El kanban sigue disponible como alternativa explícita, con desplazamiento por columnas.
- **Egresos como tarjetas** ya se cumple desde KAM-09 (`ExpenseCard`): aquí solo se verifica, no se reconstruye.
- **Formularios de captura a pantalla completa** ya se cumple para el alta y la edición de pedido (la barra inferior no se rinde en esas rutas): este cambio **extiende esa regla a las rutas de compra y gasto**, que KAM-09 dejó fuera de la lista.
- **Ninguna vista del grupo `(app)` exige desplazamiento horizontal** en 390 px para completar su acción principal.

**Fuera de alcance** (copiado del backlog):
- Aplicación nativa o publicación en tiendas.
- Notificaciones push (KAM-17 cubre correo y avisos dentro de la aplicación).

Derivado de lo anterior, tampoco entran: la pantalla de venta rápida V6 y el grupo de rutas `(fair)` (KAM-12); la cola sin conexión, el service worker y el indicador de pendientes por sincronizar (KAM-11) —"Registrado hoy" lee del servidor, no de una cola local—; el contenido de *Mis pendientes* y el de la campana de notificaciones (KAM-17); el formulario de consumo (KAM-18); el alta de tareas (KAM-16); el botón flotante *+ Registrar* **de escritorio** y el contenido del panel principal (KAM-14).

## Capabilities

### New Capabilities

- `quick-capture`: la pantalla de registro rápido V16 —su retícula de seis destinos filtrada por rol, la lista "Registrado hoy" y el menú de creación—, y el acceso a registrar desde cualquier pantalla móvil mediante el botón *+ Registrar*.

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
- `features/quick-capture/*` — retícula, menú de creación, botón flotante y lista "Registrado hoy" (feature nueva).
- `services/` — un servicio de lectura para "Registrado hoy" sobre pedidos y egresos.
- `lib/auth/routes.ts` — la detección de user-agent móvil se reutiliza para la vista por omisión de pedidos.

**Base de datos:** ninguna migración. No hay tabla ni vista nueva; "Registrado hoy" se compone en el servicio a partir de consultas acotadas sobre tablas existentes, y RLS decide qué ve cada rol sin ninguna regla adicional (ver `design.md`).

**Dependencias:** ninguna nueva.

**Pruebas:** unitarias sobre el reparto de entradas entre barra y "Más", el filtrado por rol de la retícula y la composición de "Registrado hoy"; e2e con viewport de 390 px para el recorrido de gasto y el de pedido, la ausencia de desplazamiento horizontal y la lista por omisión en pedidos.

## Supuestos registrados

1. **La secuencia del backlog se rompe a propósito, y solo hacia adelante.** KAM-13 se construye antes que KAM-11 y KAM-12 porque su valor —la estructura de navegación del celular— no depende de ellas; lo que sí depende (los tres destinos) queda declarado e inerte, nunca oculto. Decisión tomada con el dueño del producto al proponer el cambio.
2. **La retícula de V16 se filtra por rol.** El backlog dice "seis botones" sin mencionar el rol; la matriz de acceso deja `expenses` fuera del alcance del ayudante por completo. Se resuelve ocultando, que es la convención del proyecto (mapa §4.4), y el criterio de los seis botones alcanzables con el pulgar se verifica sobre el caso del dueño, que es el peor caso.
3. **"Registrado hoy" es de la organización, no de la persona.** El backlog dice "los últimos cinco registros" sin precisar el alcance. En un taller de dos personas, ver lo que acaba de anotar la otra evita el registro duplicado, que es exactamente el error que esta lista debe prevenir. RLS ya recorta lo que cada rol puede ver.
4. **La detección de móvil para la vista de pedidos es por user-agent, en el servidor.** El proyecto ya toma esa decisión así para el aterrizaje tras entrar (`defaultLandingPath`). Decidirlo en el cliente produciría un tablero que aparece y se convierte en lista después de hidratar.
