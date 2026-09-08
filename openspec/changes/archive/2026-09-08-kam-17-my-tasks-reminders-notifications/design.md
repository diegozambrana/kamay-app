# Diseño · KAM-17

## Context

Ver `proposal.md` — *Why*. Lo que aquí importa es el estado del código y lo que ese estado permite o impide.

**Lo que ya existe y este cambio reutiliza sin tocar:**

- `tasks` con `due_at`, `remind_at`, `assignee_id`, `closed_at` e índices por `(organization_id, due_at)` y por `assignee_id` filtrados a lo vigente y abierto (`20260907120000_tasks.sql`). La consulta de los cuatro grupos cae exactamente sobre esos índices.
- `lib/tasks/overdue.ts` — `dueSignal()` ya distingue `overdue`, `today`, `soon`, `later` y `none` contra un «hoy» que recibe como parámetro. Los cuatro grupos de V20 son una función de la misma familia, no una reescritura.
- `statuses.kind` (`initial | in_progress | waiting | final | cancelled`) y las funciones que resuelven el juego de una línea. *Marcar hecha* y *tarea estancada* se apoyan en ellas, nunca en nombres.
- `lib/auth/routes.ts` — `PROTECTED_PREFIXES`, `sanitizeNextPath()` (ya defiende contra redirección abierta) y `defaultLandingPath()`. El criterio de aceptación nº 6 —«sin sesión, entra y llega a la tarea»— es cablear lo que ya está probado.
- `app/(app)/my-tasks/page.tsx`, `components/layout/notification-bell.tsx` y `PENDING_TASKS_PLACEHOLDER`: tres cascarones creados a propósito por KAM-13 y KAM-14, con la nota de que KAM-17 los llenaría.
- `lib/supabase/admin.ts` — el cliente de service role, hasta hoy sin ningún consumidor.

**Restricciones que ordenan todo lo demás:**

- Convención nº 1: nada consulta Supabase fuera de `services/`; `"use server"` solo en `actions/`.
- Convención nº 2: el service role, solo en trabajos programados y generación de notificaciones. Este cambio es el primero que lo usa, y por tanto el primero que debe demostrar que no se filtra al resto.
- Convención nº 3: no hay `DELETE`. Una notificación se marca leída.
- Convención nº 6: migración nueva con su pgTAP; jamás editar una existente.
- `ARCHITECTURE.md` §Enrutado: los trabajos programados son manejadores de ruta en `app/api/*`. No hay `app/api/` todavía: este cambio lo estrena.
- No existe ninguna infraestructura de correo, ni proveedor, ni plantillas, ni variables de entorno.

## Goals / Non-Goals

**Goals:**

- Que la generación de avisos sea **una función pura decidiendo y una capa fina escribiendo**: quién recibe qué se calcula sin tocar la red, para que la regla anti-ruido sea verificable con pruebas unitarias baratas y no con un trabajo programado difícil de sembrar.
- Que el trabajo programado sea **reejecutable sin daño**. Un cron que no se puede volver a lanzar es un cron que no se puede arreglar.
- Que la excepción de rol de `/settings/notifications` no debilite el resto de V15: la guardia debe volverse más precisa, no más laxa.
- Que el correo sea **sustituible y comprobable sin red**, para que ninguna prueba dependa de un proveedor externo.

**Non-Goals:**

- Entrega en tiempo real. La campana cuenta al cargar la página y al abrir la bandeja; no hay suscripción por websocket. Un aviso que aparece treinta segundos tarde no le cuesta nada a un taller de tres personas, y una suscripción por organización sí cuesta complejidad.
- Poda o retención de notificaciones. Llega con la política de retención de KAM-22.
- Plantillas de correo con diseño. Texto y HTML mínimo legible; el correo es un enlace con contexto, no una pieza de marca.
- Reintentos con cola para el correo fallido. Se registra el fallo y se sigue; el aviso en la aplicación es la garantía.

## Decisions

### D1 · Dos tablas nuevas: `notifications` y `notification_preferences`

`notifications` sale literal del esquema canónico §15, sin añadir ni quitar columnas —salvo lo que exige D3—. `notification_preferences` es nueva y no está en el canónico; el esquema no la previó porque el backlog decía «preferencias en V15» y V15 es del dueño. Se sitúa por `(organization_id, user_id)` con unicidad, un booleano por cada uno de los seis tipos, `daily_summary_hour` (0–23) y `email_enabled`.

**Por qué una tabla y no `organizations.settings`:** el jsonb ya carga la retención y el reparto, que son de la organización. Estas preferencias son de la persona, y meterlas ahí obligaría a una estructura anidada por usuario dentro de un documento que el dueño edita — con lo que un ayudante editando sus preferencias escribiría sobre una fila de configuración del taller. La RLS resultante sería «puedes escribir este jsonb pero solo esta rama», que no se puede expresar en una política de fila.

**Por qué no `memberships.settings`:** `memberships` no tiene columna de ajustes y añadirle una alteraría una tabla existente para un uso que crecerá (KAM-18 añadirá el aviso de inventario, KAM-22 el de retención). Una tabla propia se extiende con una migración nueva; una columna jsonb en `memberships` se extiende cambiando datos.

**Ausencia de fila = valores por omisión.** La lectura de preferencias resuelve por `coalesce` contra una constante de `lib/notifications/defaults.ts`, y guardar hace `upsert`. Así nadie tiene que sembrar filas al invitar a un usuario, y una organización creada antes de esta migración funciona sin migración de datos.

### D2 · La decisión de a quién avisar es una función pura

`lib/notifications/plan.ts` recibe **datos ya leídos** —tareas con su fecha y su estado, miembros con sus preferencias, el «ahora» de la organización— y devuelve la lista de notificaciones a crear. No conoce Supabase, no conoce Resend, no conoce la hora del sistema.

El manejador de ruta hace tres cosas en este orden: leer con service role, llamar a `plan()`, escribir lo que devuelva. Toda la regla anti-ruido —el resumen agrupado, el respeto de preferencias, el umbral de estancamiento, que una tarea sin fecha no genere nada— vive en la función pura y se prueba con tablas de entrada y salida. El cobertura mínima del 90 % en `lib/` deja de ser una carga y pasa a ser lo que verifica los criterios de aceptación 1, 2, 7 y 8.

**Alternativa descartada:** generar los avisos en SQL, con una función de base disparada por `pg_cron`. Habría sido menos código, pero la lógica de agrupación por zona horaria y por preferencias en PL/pgSQL es exactamente el tipo de regla que hay que poder leer y cambiar deprisa, y `ARCHITECTURE.md` ya decidió que los trabajos programados son manejadores de ruta.

### D3 · Idempotencia por llave, no por consulta previa

Cada notificación lleva una `dedupe_key` textual, única por `(user_id, dedupe_key)`, construida por la función pura:

- `due_summary` → `due_summary:<fecha local de la organización>`
- `task_assigned` → `task_assigned:<task_id>:<assignee_id>`
- `task_overdue` → `task_overdue:<task_id>:<due_at>`
- `task_review` → `task_review:<task_id>:<status_id>`
- `task_stalled` → `task_stalled:<task_id>:<fecha de entrada al estado>`

La inserción es un `insert ... on conflict do nothing`. Esto es lo que hace el trabajo reejecutable y lo que impide que una tarea tres días vencida genere tres avisos: la llave incluye la fecha límite, no el día de la pasada. Reprogramar la tarea cambia la llave y sí vuelve a avisar, que es lo correcto.

Es una columna que el esquema canónico §15 no lista. Se añade porque sin ella el criterio «nunca dos avisos por lo mismo» solo se puede cumplir leyendo antes de escribir, y dos pasadas concurrentes del cron se colarían por esa ventana. Queda anotada como desviación deliberada del canónico en `tasks.md`.

### D4 · Un cron horario que resuelve la hora local de cada organización

Una sola entrada en `vercel.json` (`0 * * * *`) contra `POST /api/notifications/daily`. En cada pasada el trabajo:

1. Lee las organizaciones vigentes con su `timezone`.
2. Para cada una calcula la hora local actual.
3. Selecciona a los usuarios cuyo `daily_summary_hour` coincide con esa hora local, y les arma el resumen.
4. Con independencia de la hora, recorre lo vencido y lo estancado de todas las organizaciones —esos avisos no dependen de una hora elegida—.

**Por qué no una entrada de cron por hora ni por zona:** Vercel limita el número de crons y la lista tendría que crecer con cada zona horaria nueva. Una pasada horaria que filtra por hora local escala a cualquier organización sin tocar la configuración de despliegue.

**Autorización:** cabecera con `CRON_SECRET` comparada en tiempo constante. Sin ella, 401 y ninguna escritura. Es la única puerta del sistema que corre con service role, y por eso lleva su propia prueba.

**El desfase de una hora es aceptable:** alguien que elige las 07:00 recibe su resumen dentro de la hora de las 07:00. Precisión al minuto exigiría un cron por minuto y no compra nada en un taller.

### D5 · `task_assigned` se genera en la acción, no en el cron

Los cinco tipos de tarea no son iguales: *asignada* y *revisión* son reacciones a un hecho puntual, y esperar hasta la próxima pasada horaria para avisar de una asignación sería absurdo. Se generan dentro de la Server Action que cambia el responsable o el estado, después de que la escritura de la tarea haya tenido éxito.

Aquí hay una tensión real con la convención nº 2: es una acción disparada por un usuario, y usa service role. Se resuelve así: **la acción escribe la tarea con el cliente de sesión —RLS intacta— y solo la creación de la notificación pasa por un servicio de `services/notifications/` que recibe el cliente privilegiado**, con la organización ya resuelta por la acción. El privilegio se limita a insertar en `notifications` para un destinatario que la RLS de la propia tarea ya validó. Es exactamente el caso que la convención nombra —«generación de notificaciones»— y no una puerta trasera para escribir datos del taller.

`task_overdue`, `task_stalled` y `due_summary` sí son del cron: dependen del paso del tiempo, no de un acto.

### D6 · La guardia de rol baja del layout a las secciones

Hoy `app/(app)/settings/layout.tsx` llama a `getOwnerContext()` y redirige al ayudante. Con una sección abierta a ambos roles eso deja de servir. El layout pasa a cargar el contexto de sesión sin exigir rol, y **cada `page.tsx` de sección declara su exigencia**: las siete existentes siguen pidiendo dueño; `notifications` no.

**Por qué no sacar `/settings/notifications` fuera de `/settings`:** el mapa manda *V21 → Preferencias → V15 → Notificaciones*, y una preferencia de notificaciones colgando del perfil sería un segundo sitio donde buscar ajustes. Se conserva la dirección que el mapa dicta y se paga el precio de una guardia más fina.

**Consecuencia visible:** `SettingsNav` rinde para el ayudante una sola pestaña. Se acepta: una pestaña sola es más honesta que ocultar la navegación.

La seguridad real sigue siendo la RLS —`is_owner` en cada tabla de configuración, y `user_id = auth.uid()` en `notification_preferences`—. La guardia de rutas es interfaz, y esta reorganización no la convierte en la defensa.

### D7 · El correo detrás de un puerto, con un adaptador nulo en pruebas

`lib/email/` expone `sendEmail(message)` y nada más. La implementación de Resend vive en `lib/email/resend.ts`; las pruebas usan un adaptador que acumula en memoria. Ninguna prueba —unitaria, de integración o e2e— toca la red.

El envío ocurre **después** de que la notificación exista en la base. Si el correo falla, se registra y el trabajo continúa: la bandeja es la garantía y el correo es el refuerzo. Esto hace que el criterio «el correo falla, el aviso queda» sea una consecuencia del orden de las operaciones y no de un manejo de errores que haya que recordar.

**Enlace del correo:** `${APP_URL}/tasks/${id}`. Sin sesión, el proxy redirige a `/auth/login?next=/tasks/<id>` y `sanitizeNextPath()` ya rechaza cualquier destino externo. No se construye ninguna ruta de retorno nueva.

**Provisión:** `vercel integration add resend/resend-email` es el primer paso de `tasks.md`, antes de escribir código de correo. No se instala el SDK a mano ni se simula con un `.env.example`.

### D8 · Los cuatro grupos se calculan en el servidor, con `dueSignal` como base

`lib/tasks/groups.ts` toma las tareas abiertas del alcance del rol y el «hoy» de la organización, y devuelve los cuatro grupos ordenados. Reutiliza `dueSignal()` en lugar de reimplementar la comparación de fechas: `overdue` y `today` salen directos, *Próximos 7 días* es una ventana de siete días —no los dos de `SOON_DAYS`, que es el umbral del semáforo de color y no el de la agrupación—, y *Sin fecha* es `none` con la tarea abierta.

**El «hoy» de la organización, no el del navegador.** Se resuelve en el servidor desde `organizations.timezone`, igual que ya hace el resto del sistema. Es lo que hace verificable el escenario de posponer a las 23:50.

La misma función alimenta la tarjeta del panel: los conteos de V2 y los grupos de V20 son la misma cuenta, y hacerlos dos veces sería la manera de que dejaran de coincidir.

### D9 · Marcar hecha resuelve el estado `final`, no escribe `closed_at`

V20 llama a `TaskService.moveToStatus()` con el estado de tipo `final` del juego de la línea de la tarea, que es lo que ya hace el arrastre del tablero. `closed_at` lo pone el mecanismo existente. No se crea ninguna segunda vía de cierre.

El tachado optimista vive en el cliente durante la sesión de la pantalla; deshacer es mover de vuelta al estado anterior, que la fila recuerda.

### D10 · La bandeja no agrupa nada: solo presenta lo que le llega

La agrupación por tipo de V21 es visual —un encabezado por tipo—, y la agrupación anti-ruido ya la hizo el generador. Esta separación es lo que hace que el criterio nº 1 sea comprobable en la capa de generación, sin depender de qué hace la interfaz. Si algún día la bandeja cambiara de forma, la regla seguiría cumpliéndose.

## Risks / Trade-offs

- **El cron se ejecuta dos veces a la vez** (reintento de la plataforma, despliegue solapado) → `dedupe_key` con `on conflict do nothing`: la segunda pasada no inserta nada. Es la razón por la que D3 elige una llave y no una consulta previa.
- **Una organización con muchas tareas hace lenta la pasada horaria** → el recorrido usa los índices parciales que `tasks` ya declara y solo lee tareas abiertas con fecha. Si algún día no bastara, la partición natural es por organización, que ya es la unidad del bucle.
- **El primer uso de service role abre la puerta a que se cuele en otras acciones** → el cliente privilegiado se inyecta únicamente en `services/notifications/`, y ninguna otra rebanada lo importa. Una prueba de arquitectura verifica que `lib/supabase/admin.ts` no se importa desde `features/` ni desde el resto de `actions/`.
- **Un ayudante con una sola pestaña en Configuración parece un error de la aplicación** → la pantalla lo declara: la sección explica que ahí van sus preferencias personales y que el resto de la configuración es del dueño.
- **La hora del resumen se desfasa hasta 59 minutos** → asumido en D4. Se documenta en la propia pantalla de preferencias («alrededor de las 07:00»), para que nadie lo lea como un fallo.
- **Resend introduce una dependencia externa y un coste** → el puerto de D7 mantiene el resto del sistema ignorante del proveedor; sustituirlo es escribir otro archivo en `lib/email/`. Y un fallo del proveedor degrada a avisos solo dentro de la aplicación, no a pérdida de datos.
- **`stock_below_min` declarado sin generador puede leerse como una promesa incumplida** → el interruptor existe y la pantalla dice a qué fase pertenece, con el mismo criterio con el que KAM-13 y KAM-14 rotularon sus cascarones.

## Migration Plan

1. Provisionar Resend y traer sus variables de entorno **antes** de escribir código de correo; añadir `CRON_SECRET` y `APP_URL`.
2. Migración `<timestamp>_notifications.sql`: `notifications` (canónico §15 + `dedupe_key`), `notification_preferences`, índices y RLS de ambas, con su pgTAP. Ninguna tabla existente se altera.
3. Capas de lectura y escritura sin interfaz: `services/notifications/`, `lib/notifications/`, `lib/email/`.
4. Interfaz que solo lee: bandeja V21, contador de la campana, tarjeta del panel. Hasta aquí nada genera avisos, y nada de lo existente cambia de conducta.
5. V20 y sus acciones.
6. Preferencias y la reorganización de la guardia de `/settings` — el paso con más riesgo de regresión sobre lo ya construido, y por eso el último antes de encender la generación.
7. Generación: primero la acción de asignar, después el manejador de ruta y la entrada de cron.

**Reversión:** retirar la entrada de cron de `vercel.json` detiene toda la generación programada sin desplegar código; el resto de la aplicación sigue funcionando con las notificaciones que ya existan. Las tablas nuevas no son leídas por ninguna pantalla anterior a este cambio, así que revertir la interfaz no deja huérfano ningún dato.
