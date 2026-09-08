# KAM-17 · Mis pendientes, recordatorios y avisos

## Why

Kamay ya sabe qué hay que hacer, pero no lo dice. Las tareas existen desde KAM-15, su detalle desde KAM-16, y `tasks.due_at` y `tasks.remind_at` se rellenan desde la primera pantalla —pero nadie los lee nunca. La fecha límite es hoy un adorno: se escribe, se guarda, y el día que vence no pasa absolutamente nada. Quien quiere saber qué le toca hoy tiene que abrir el tablero, mirar columna por columna y calcularlo de cabeza.

Las tres piezas que faltan se sostienen entre sí y por eso entran juntas:

- **Una pantalla que responda «¿qué hago hoy?»** — V20, cuatro grupos por fecha, no un kanban. En el celular esta es *la* pantalla de tareas: el mapa de navegación ya manda la tercera ranura de la barra inferior a `/my-tasks`, y hoy esa ranura abre un cascarón vacío.
- **Avisos que lleguen sin la aplicación abierta** — la tabla `notifications`, la bandeja V21 detrás de una campana que hoy se abre para decir que no está disponible, y correo para lo vencido y lo asignado.
- **Un freno contra el ruido**, porque un sistema de avisos mal calibrado se silencia una vez y para siempre. La regla del backlog es explícita y es la que ordena el diseño: cinco tareas que vencen hoy generan **un** aviso, no cinco.

> **Posición en la secuencia.** El backlog sitúa a KAM-17 después de KAM-16, y **KAM-16 está implementada**: `/tasks/[id]` existe, el detalle edita `due_at` y `remind_at`, y el historial lee de `activity_log`. Lo que este cambio necesita del pasado ya está: `tasks` con sus fechas e índices (`20260907120000_tasks.sql`), `statuses.kind` para saber qué es «en curso», `lib/tasks/overdue.ts` con el semáforo de fechas, `lib/auth/routes.ts` con el `next` saneado del inicio de sesión, y los cascarones que KAM-13 y KAM-14 dejaron reservados a propósito.

## What Changes

### V20 · Mis pendientes (`/my-tasks`, hoy un cascarón vacío)

- **Cuatro grupos con contador** — *Vencidas*, *Hoy*, *Próximos 7 días*, *Sin fecha* —, en ese orden y sin excepción: lo vencido va primero porque es lo que duele.
- **Deliberadamente ciega al selector de línea.** El mapa de navegación la nombra junto a Reportes como una de las dos únicas vistas que lo ignoran: aquí el valor está en verlo todo junto.
- **Acciones rápidas por fila** — marcar hecha (que la deja tachada en su sitio, no la hace desaparecer), reprogramar con un toque, abrir el detalle.
- **Deslizar para posponer a mañana** en móvil, con equivalente accesible por teclado y botón para quien no desliza.
- **El ayudante ve solo lo suyo**: las tareas de su línea o asignadas a él, como manda la matriz de permisos.

### `notifications` y V21 · Bandeja

- **Tabla `notifications`** según el esquema canónico §15, con sus seis tipos, su RLS y su índice por usuario y no leídas.
- **V21 como panel lateral** colgado de la campana de la barra superior —hoy inerte—: lista cronológica agrupada por tipo, no leídas destacadas, contador real en la campana, marcar leída, y un enlace a las preferencias.
- **Cada aviso lleva a su registro**, no a una pantalla genérica: `entity_type` + `entity_id` resuelven el destino.

### Generación de avisos

- **Seis tipos**: `due_summary` (resumen diario), `task_assigned`, `task_review`, `task_overdue`, `task_stalled`, `stock_below_min`.
- **Trabajo programado** en `app/api/`, disparado por cron, que arma el resumen diario a la hora que cada usuario eligió, en la zona horaria de su organización, y detecta lo vencido y lo estancado.
- **La agrupación la hace quien genera, no quien muestra**: el trabajo diario inserta **un** `due_summary` por usuario con el conteo, jamás una fila por tarea.
- **Nunca dos avisos por lo mismo**: cada tipo tiene una llave de idempotencia y el trabajo es reejecutable sin duplicar nada.
- **Sin fecha límite no hay aviso de vencimiento.** Ni recordatorio, ni vencida, ni resumen.
- **La bitácora no genera notificaciones en ningún caso**, y esto se verifica, no solo se declara.

### Preferencias de notificación (`/settings/notifications`)

- **Tabla `notification_preferences` por organización y usuario**: cada uno de los seis tipos apagable por separado, la hora del resumen diario, y si quiere correo además del aviso en la aplicación.
- **Sección accesible a los dos roles.** Es la primera excepción a «V15 solo dueño», y es deliberada: son preferencias de la persona, no configuración del taller. Un ayudante que no puede silenciar sus propios avisos los silencia apagando el correo entero.
- **Un tipo apagado no se genera ni se envía**, y ningún otro tipo se ve afectado.

### Correo transaccional

- **Resend**, provisionado vía el Marketplace de Vercel, detrás de un adaptador `lib/email/` fino para que el envío sea sustituible y comprobable sin red.
- **Solo para lo vencido y lo asignado**, más el resumen diario. Los demás tipos viven dentro de la aplicación.
- **El enlace del correo abre exactamente esa tarea.** Quien no tiene sesión pasa por el inicio de sesión y aterriza en la tarea, no en el panel: `sanitizeNextPath` ya existe y esto es aplicarlo.

### El panel deja de mentir

- **La tarjeta de pendientes** de V2 —hoy un `PlaceholderCard`— muestra vencidas en rojo, hoy y próximos 7 días, y enlaza a V20. *Insumos bajo mínimo* sigue siendo marcador de posición hasta KAM-18.

**Fuera de alcance** (copiado del backlog):
- Notificaciones push al celular.
- Sonidos, insignias animadas, gamificación.
- Recordatorios sobre pedidos; en esta fase solo tareas e inventario.

Derivado de lo anterior, tampoco entran: **el generador de `stock_below_min`**, porque `inventory_movements` y los mínimos llegan con KAM-18 —el tipo se declara en el `check` y en las preferencias, y su generador queda sin escribir (supuesto 4)—; la tarjeta *Insumos bajo mínimo* del panel, que sigue inerte; los vínculos y entregables de tarea (KAM-21); la pantalla de bitácora (KAM-22); y cualquier cambio al tablero V17 o al detalle V18 más allá de enlazarlos.

## Capabilities

### New Capabilities

- `notifications`: la generación de avisos y su bandeja —la tabla `notifications` con sus seis tipos, la regla de agrupación e idempotencia, las preferencias por usuario con cada tipo apagable y la hora del resumen, el trabajo programado que arma el resumen y detecta lo vencido y lo estancado, el correo transaccional con enlace profundo a la tarea, la bandeja V21 y el contador de la campana—.
- `my-tasks`: la pantalla V20 —los cuatro grupos por fecha con su contador y su orden, el alcance por rol, la ceguera deliberada al selector de línea, y las acciones rápidas de marcar hecha, reprogramar y posponer a mañana—.

### Modified Capabilities

- `dashboard`: la tarjeta de pendientes deja de ser marcador de posición y pasa a mostrar los tres conteos con su enlace a V20; el marcador que sigue declarado es solo el de insumos bajo mínimo.

`tasks` **no** se modifica. Que `due_at` y `remind_at` dejen de ser datos inertes es una consecuencia observable de la capacidad `notifications`, que es donde se especifica; el modelo de tarea, su tablero y su visibilidad por rol siguen exactamente como los dejó KAM-15. Inventar aquí un requisito de `tasks` duplicaría el de `notifications` y crearía dos verdades sobre la misma conducta.

## Impact

**Código afectado**

- `app/(app)/my-tasks/page.tsx` — deja de ser cascarón: carga los cuatro grupos y rinde V20.
- `app/(app)/settings/notifications/page.tsx` — sección nueva, y la única de `/settings` abierta al ayudante; obliga a mover la guardia de rol del `layout` a las secciones que sí son del taller.
- `app/api/notifications/daily/route.ts` — trabajo programado: resumen diario, vencidas y estancadas. Cliente de service role, autorizado por secreto de cron.
- `features/tasks/my-tasks/` — pantalla V20, grupos, fila con acciones rápidas y gesto de posponer (rebanada nueva).
- `features/notifications/` — panel V21, contador de la campana y lista agrupada por tipo.
- `features/settings/notifications-section.tsx` — el formulario de preferencias.
- `features/dashboard/owner-dashboard.tsx` y `assistant-dashboard.tsx` — la tarjeta de pendientes real reemplaza a `PENDING_TASKS_PLACEHOLDER`.
- `components/layout/notification-bell.tsx` y `header.tsx` — la campana pasa a contar de verdad y a abrir V21.
- `features/settings/settings-nav.tsx` — entrada *Notificaciones*.
- `actions/notifications.ts` — marcar leída, marcar todas, guardar preferencias, posponer a mañana y marcar hecha desde V20.
- `services/notifications/notification-service.ts` y `preference-service.ts` — todo el acceso a Supabase.
- `lib/notifications/` — agrupación del resumen, respeto de preferencias, llaves de idempotencia y resolución del destino de cada aviso (lógica pura, cubrible al 90 %).
- `lib/tasks/groups.ts` — cálculo de los cuatro grupos, junto a `overdue.ts`.
- `lib/email/` — adaptador de envío y plantillas.
- `lib/auth/routes.ts` — `/settings/notifications` como excepción al rol dueño.
- `vercel.json` — la entrada de cron.

**Se lee pero no se modifica:** `lib/tasks/overdue.ts` (el semáforo ya resuelve `overdue`/`today`/`soon`), `lib/auth/routes.ts::sanitizeNextPath` (el `next` del inicio de sesión ya está saneado contra redirección abierta), `services/tasks/task-service.ts` y `lib/supabase/admin.ts`.

**Base de datos:** una migración nueva, `0..._notifications.sql` — `notifications` según §15, `notification_preferences`, sus índices y su RLS, con prueba pgTAP obligatoria. Ninguna tabla existente se altera.

**Dependencias nuevas:** Resend (integración del Marketplace de Vercel, `resend/resend-email`) y su SDK. Variables de entorno nuevas: las que aporte la integración, más un secreto para autorizar el disparo del cron.

**Pruebas:** unitarias sobre la agrupación del resumen, el respeto de preferencias, el cálculo de los cuatro grupos y las llaves de idempotencia; integración pgTAP sobre la RLS de `notifications` y `notification_preferences` entre organizaciones, y sobre el trabajo programado con datos sembrados; e2e sobre posponer, marcar hecha y abrir una tarea desde un enlace externo sin sesión.

**Dependencia de secuencia:** KAM-16 debe estar fusionado. `tasks.md` abre con esa verificación.

## Supuestos registrados

1. **Las preferencias son por usuario y su sección se abre a los dos roles. — DECIDIDO CON EL USUARIO.** El backlog las sitúa «en V15», que el mapa marca *solo dueño*, pero también dice «a la hora configurada por el usuario» y el mapa manda *V21 → Preferencias → V15 → Notificaciones* para ambos roles. Las tres frases no caben juntas. Se resuelve con una tabla `notification_preferences` por `(organization_id, user_id)` y una sección `/settings/notifications` visible para dueño y ayudante, cada uno sobre sus propias filas. Todas las demás secciones de V15 siguen siendo solo del dueño.

2. **La pantalla V20 vive en `/my-tasks`, no en `/tasks/mine`.** `ARCHITECTURE.md` nombra `/tasks/mine`, pero KAM-13 ya creó `/my-tasks`, lo registró en `PROTECTED_PREFIXES` y lo cableó a la tercera ranura de la barra inferior con la nota de que la ruta tenía que existir desde ya. Cambiar la dirección ahora rompería la barra por una diferencia sin consecuencia para nadie. Se mantiene `/my-tasks`.

3. **El disparo del trabajo programado es un cron de Vercel contra un manejador de ruta**, no `pg_cron`. `ARCHITECTURE.md` §Enrutado lo dice con todas las letras: «`app/api/*`: manejadores de ruta para trabajos programados (resumen diario, retención de bitácora)». El cron corre cada hora y en cada pasada atiende a los usuarios cuya hora de resumen coincide con la hora local de su organización; así una sola entrada de cron sirve a cualquier hora elegida y a cualquier zona horaria.

4. **`stock_below_min` se declara pero no se genera.** El backlog lo lista entre los avisos de KAM-17, pero el inventario y sus mínimos llegan con KAM-18: no hay dato del que derivarlo. El tipo entra en el `check` de `notifications` y en las preferencias —para no alterar la tabla después—, la bandeja sabe rendirlo, y el generador queda explícitamente sin escribir. Es el mismo criterio con el que KAM-13 dejó inertes los destinos que no tocaban aún.

5. **Marcar hecha desde V20 mueve la tarea a su estado `final`, no escribe `closed_at` a mano.** El cierre se deriva de la posición en el tablero (capacidad `tasks`, convención nº 5): V20 resuelve el estado `final` del juego que corresponde a la línea de la tarea y la mueve allí, con lo que `closed_at` lo pone el mismo mecanismo que ya existe. Inventar aquí una segunda vía de cierre crearía dos verdades.

6. **Posponer a mañana escribe `due_at`, no un campo nuevo.** «Mañana» se calcula en la zona horaria de la organización, no en la del navegador, para que una tarea pospuesta a las 23:50 no salte dos días.

7. **El correo se envía desde el trabajo programado y desde la acción de asignar, ambos con service role.** Es exactamente el caso que la convención nº 2 autoriza —«trabajos programados y generación de notificaciones»— y ninguno de los dos escribe datos del usuario saltándose RLS: solo inserta en `notifications` para destinatarios que ya resolvió.

8. **Una notificación no se borra: se marca leída.** No existen políticas `DELETE` (convención nº 3). La bandeja muestra lo no leído destacado y lo leído debajo; la poda por antigüedad no entra en este cambio.
