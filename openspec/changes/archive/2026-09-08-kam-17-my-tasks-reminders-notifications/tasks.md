# Tareas · KAM-17

> **Condición de arranque.** Verificar antes de empezar que KAM-16 está fusionada: `app/(app)/tasks/[id]/page.tsx` existe, `features/tasks/detail/` rinde V18 y `lib/markdown/` está en su sitio. Si no lo está, parar: este cambio enlaza a esa pantalla desde V20, desde la bandeja y desde el correo.
>
> Convención nº 12: cada escenario del delta spec tiene al menos una prueba aquí. Los escenarios se citan por su nombre entre comillas.

## 1. Provisión y verificación previa

- [x] 1.1 Verificar la condición de arranque y anotar el resultado; parar si KAM-16 no está fusionada.
- [ ] 1.2 Provisionar Resend con `vercel integration add resend/resend-email` (previo `vercel link` si hace falta) y traer las variables con `vercel env pull --yes`. No instalar el SDK a mano ni sustituirlo por un simulacro.
- [x] 1.3 Añadir `CRON_SECRET` y `APP_URL` al entorno, en Vercel y en `.env.local`, y documentarlas junto al resto en el README.
- [x] 1.4 Registrar en `vercel.json` la entrada de cron `0 * * * *` contra `/api/notifications/daily` — **desactivada o apuntando a un manejador que solo responde 401** hasta el paso 8.3, para que ningún despliegue intermedio genere avisos a medias.

## 2. Base de datos

- [x] 2.1 Migración nueva `<timestamp>_notifications.sql`: tabla `notifications` según el esquema canónico §15 —`organization_id`, `user_id`, `type` con su `check` de los seis valores, `title`, `body`, `entity_type`, `entity_id`, `read_at`, `created_at`— más la columna `dedupe_key` de D3 y el índice `(user_id, read_at, created_at desc)`.
- [x] 2.2 En la misma migración: unicidad `(user_id, dedupe_key)`, que es lo que hace reejecutable el trabajo programado.
- [x] 2.3 En la misma migración: tabla `notification_preferences` con `(organization_id, user_id)` único, un booleano por cada uno de los seis tipos, `daily_summary_hour` (`check` 0–23) y `email_enabled`.
- [x] 2.4 RLS de ambas tablas: lectura y escritura restringidas a `user_id = auth.uid()` dentro de la organización; sin política `DELETE` en ninguna de las dos (convención nº 3).
- [x] 2.5 pgTAP de la migración — obligatorio antes de fusionar. Cubre: "Tipo fuera del catálogo", "No hay borrado", "Aislamiento entre organizaciones", "Las notificaciones son de quien las recibe", "Nadie toca las de otro" y "El ayudante configura las suyas" (a nivel de política).
- [x] 2.6 pgTAP del `check` de `daily_summary_hour` y de la unicidad de `dedupe_key`: insertar dos veces la misma llave y comprobar que la segunda no crea fila.
- [x] 2.7 Regenerar el grafo con `graphify update .` tras la migración (convención nº 6).

## 3. Lógica pura de notificaciones (`lib/notifications/`)

- [x] 3.1 `defaults.ts` — preferencias por omisión (los seis tipos activos, hora predeterminada del resumen, correo activo) y su lectura por `coalesce` para quien no tiene fila. Prueba: "Sin fila guardada".
- [x] 3.2 `dedupe.ts` — construcción de las cinco llaves de D3. Pruebas: "Reejecución sin duplicados" y "Vencida una vez, no cada día" (misma tarea, tres días, una sola llave).
- [x] 3.3 `plan.ts` — la función pura que decide a quién avisar de qué, a partir de tareas, miembros, preferencias y el «ahora» de la organización. Sin red, sin Supabase, sin reloj del sistema.
- [x] 3.4 Pruebas de agrupación del resumen sobre `plan.ts`: "Cinco tareas, un aviso", "Sin nada que vencer, sin aviso".
- [x] 3.5 Pruebas de preferencias sobre `plan.ts`: "Apagado, no generado", "Los demás tipos no se ven afectados", "El apagado es de quien lo hace".
- [x] 3.6 Pruebas de hora local sobre `plan.ts`: "Dos horas distintas en la misma organización", "La zona horaria manda".
- [x] 3.7 Pruebas de fecha límite ausente: "Tarea sin fecha, sin avisos", "Se le pone fecha".
- [x] 3.8 Pruebas de los tipos de tarea sobre `plan.ts`: "Asignar avisa a quien recibe", "Asignarse a uno mismo no avisa", "El nombre del estado no decide nada" (estado resuelto por `kind`), "Estancada en curso", "Una tarea cerrada calla".
- [x] 3.9 Prueba de que `plan.ts` no genera nada de tipo `stock_below_min`: "Nada se rompe por su ausencia".
- [x] 3.10 `destination.ts` — resolución del destino de cada aviso a partir de `entity_type` y `entity_id`, incluido el caso del registro archivado. Pruebas: "Del aviso a la tarea", "Del resumen a los pendientes", "Registro ya no disponible".
- [x] 3.11 Verificar cobertura ≥ 90 % en `lib/notifications/`.

## 4. Correo (`lib/email/`)

- [x] 4.1 Puerto `sendEmail(message)` y adaptador nulo que acumula en memoria, usado por todas las pruebas. Ninguna prueba toca la red.
- [ ] 4.2 Adaptador de Resend en `lib/email/resend.ts`, apoyado en las variables provisionadas en 1.2.
- [x] 4.3 Plantillas de los tres correos —resumen diario, tarea vencida, tarea asignada— en texto y HTML mínimo, con el enlace `${APP_URL}/tasks/<id>`. Prueba de que el enlace apunta a la tarea concreta.
- [x] 4.4 Prueba de que solo esos tres tipos generan correo: "Los demás tipos no viajan por correo".

## 5. Servicios y acceso a datos (`services/notifications/`)

- [x] 5.1 `notification-service.ts` — listar las de una persona agrupadas por tipo, contar no leídas, marcar leída, marcar todas, e insertar con `on conflict do nothing` sobre `dedupe_key`.
- [x] 5.2 `preference-service.ts` — leer con valores por omisión y guardar con `upsert`.
- [x] 5.3 Servicio de creación privilegiada, único punto que recibe el cliente de service role (D5). Ninguna otra rebanada importa `lib/supabase/admin.ts`.
- [x] 5.4 Prueba de arquitectura: `lib/supabase/admin.ts` no se importa desde `features/`, ni desde `actions/` salvo la excepción declarada en D5.
- [x] 5.5 Verificar cobertura ≥ 90 % en `services/notifications/`.

## 6. Grupos de pendientes y tarjeta del panel

- [x] 6.1 `lib/tasks/groups.ts` — los cuatro grupos a partir de las tareas abiertas y el «hoy» de la organización, reutilizando `dueSignal()` de `lib/tasks/overdue.ts` y con ventana propia de siete días (D8).
- [x] 6.2 Pruebas de `groups.ts`: "Los cuatro grupos y su orden", "Lo vencido primero", "El día es el de la organización", "Una tarea sin fecha", "Grupo sin tareas", "Lo cerrado no vuelve".
- [x] 6.3 Ampliar `services/tasks/task-service.ts` con la consulta de pendientes por alcance de rol, apoyada en los índices que `tasks` ya declara. Prueba: "El ayudante ve lo suyo", "El dueño lo ve todo".
- [x] 6.4 Tarjeta de pendientes real en `features/dashboard/`, alimentada por la misma función que V20. Pruebas: "Los tres conteos", "El ayudante cuenta lo suyo", "El selector no altera la cuenta", "De la tarjeta a los pendientes", "Sin nada pendiente".
- [x] 6.5 Retirar `PENDING_TASKS_PLACEHOLDER` de `placeholder-card.tsx`, `owner-dashboard.tsx` y `assistant-dashboard.tsx`, dejando `LOW_STOCK_PLACEHOLDER` intacto. Pruebas: "El marcador que queda está rotulado", "El marcador no engaña", "Pendientes ya no es marcador".

## 7. Interfaz de lectura: bandeja V21 y campana

- [x] 7.1 `features/notifications/` — panel lateral V21: lista cronológica inversa agrupada por tipo, no leídas destacadas, enlace a preferencias. Pruebas: "Agrupada por tipo", "Bandeja vacía".
- [x] 7.2 `components/layout/notification-bell.tsx` — contador real y apertura de V21; retirar la leyenda de «todavía no disponible». Pruebas: "Contador real", "Sin nada sin leer".
- [x] 7.3 Actualizar `components/layout/header.test.tsx`, que hoy afirma que la bandeja no está disponible.
- [x] 7.4 `actions/notifications.ts` — marcar leída y marcar todas. Prueba: "Marcar leída".
- [x] 7.5 Rendido de un aviso de tipo `stock_below_min` en la bandeja, sin generador detrás. Prueba: "Nada se rompe por su ausencia".

## 8. Generación de avisos

- [x] 8.1 Generar `task_assigned` y `task_review` desde las Server Actions de `actions/tasks.ts` que cambian responsable y estado, tras el éxito de la escritura y con el reparto de clientes de D5. Prueba de integración: asignar a otra persona crea el aviso; asignarse a uno mismo no.
- [x] 8.2 `app/api/notifications/daily/route.ts` — lee con service role, llama a `plan()`, escribe lo que devuelva y envía los correos que correspondan, en ese orden. El envío ocurre después de que la notificación exista.
- [x] 8.3 Autorización del manejador por `CRON_SECRET` con comparación en tiempo constante, y activación de la entrada de cron registrada en 1.4. Prueba: "Disparo sin credencial".
- [x] 8.4 Prueba de integración del trabajo con datos sembrados en dos organizaciones de zonas horarias distintas: "Cada aviso a su organización" y la reejecución sin duplicados de extremo a extremo.
- [x] 8.5 Prueba de que un fallo del envío de correo no impide la notificación: "El correo falla, el aviso queda".
- [x] 8.6 Prueba de que apagar el correo deja el aviso en la bandeja: "Correo apagado, aviso presente".
- [x] 8.7 Prueba explícita de que la bitácora no genera notificaciones: sembrar decenas de eventos de `activity_log` de varios tipos y comprobar cero filas nuevas en `notifications`. Escenario: "Actividad intensa, bandeja tranquila".

## 9. Preferencias y guardia de `/settings`

- [x] 9.1 Bajar la guardia de rol de `app/(app)/settings/layout.tsx` a cada `page.tsx` de sección: las siete existentes siguen exigiendo dueño (D6).
- [x] 9.2 `app/(app)/settings/notifications/page.tsx` — sección abierta a los dos roles, con la nota de que son preferencias personales y el resto de la configuración es del dueño.
- [x] 9.3 `features/settings/notifications-section.tsx` — los seis interruptores, la hora del resumen y el interruptor de correo, con la advertencia de desfase de hasta una hora (D4).
- [x] 9.4 Entrada *Notificaciones* en `features/settings/settings-nav.tsx`, que para el ayudante rinde una sola pestaña.
- [x] 9.5 Pruebas de la guardia: "El ayudante configura las suyas", "Las demás secciones de configuración siguen siendo del dueño".
- [x] 9.6 Prueba de que el interruptor de insumo bajo mínimo existe y se apaga: "Preferencia presente, aviso ausente".
- [x] 9.7 Verificar que ninguna de las siete secciones existentes quedó sin guardia tras 9.1 — una por una, no de un vistazo.

## 10. V20 · Mis pendientes

- [x] 10.1 `app/(app)/my-tasks/page.tsx` deja de ser cascarón: carga los cuatro grupos por alcance de rol y rinde V20.
- [x] 10.2 `features/tasks/my-tasks/` — cuatro grupos con contador, en orden fijo, con la línea visible en cada fila. Pruebas: "El selector no filtra aquí", "Cada tarea dice su línea".
- [x] 10.3 Marcar hecha vía `TaskService.moveToStatus()` al estado de tipo `final` de la línea (D9), con tachado en su sitio y deshacer. Pruebas: "Tachada, no desaparecida", "El cierre pasa por el estado", "Deshacer", "El nombre del estado final no decide nada".
- [x] 10.4 Posponer a mañana: gesto de deslizar en móvil más control equivalente por teclado y puntero, con «mañana» calculado en la zona horaria de la organización. Pruebas: "Un solo gesto", "Sin deslizar", "Mañana es el de la organización", "Deshacer el aplazamiento".
- [x] 10.5 Reprogramar a fecha elegida y abrir el detalle desde la fila. Pruebas: "Reprogramar a una fecha", "Abrir el detalle".
- [x] 10.6 Filtros que respetan la agrupación. Pruebas: "Los contadores siguen al filtro", "Filtro sin resultados".
- [x] 10.7 Comprobar la pantalla en 390 px y la ranura de la barra inferior. Pruebas: "Desde la barra inferior", "Cabe en 390 px", "El tablero sigue existiendo".

## 11. Enlace profundo desde el correo

- [x] 11.1 Verificar que el proxy y `sanitizeNextPath()` cubren `/tasks/<id>` sin cambios, y añadir `/settings/notifications` donde haga falta en `lib/auth/routes.ts`.
- [x] 11.2 e2e: abrir el enlace del correo con sesión activa. Escenario: "Con sesión, directo".
- [x] 11.3 e2e: abrir el enlace sin sesión, identificarse y aterrizar en la tarea. Escenario: "Sin sesión, entra y llega".
- [x] 11.4 Prueba de que un destino externo se descarta: "No se admite un destino externo".

## 12. e2e y cierre

- [x] 12.1 e2e de V20: posponer una tarea vencida y verla cambiar de grupo.
- [x] 12.2 e2e de V20: marcar una tarea hecha y verla tachada en su sitio.
- [x] 12.3 e2e de la bandeja: recibir un aviso, verlo en la campana, abrirlo y llegar a la tarea.
- [x] 12.4 Pasar la tubería completa: `lint → typecheck → test:unit → supabase start → test:integration → build → test:e2e`.
- [x] 12.5 Repasar los ocho criterios de aceptación del backlog KAM-17 uno a uno contra las pruebas escritas, y anotar dónde se verifica cada uno.
- [x] 12.6 Anotar en el registro del cambio la desviación deliberada del esquema canónico §15 (la columna `dedupe_key` de D3) y la excepción de rol de `/settings/notifications`.

---

## Registro de cierre

### Los ocho criterios de aceptación del backlog (tarea 12.5)

| # | Criterio | Dónde se verifica |
|---|---|---|
| 1 | Cinco tareas que vencen hoy → **un solo** aviso de resumen | `lib/notifications/plan.test.ts` («cinco tareas que vencen hoy producen un solo aviso»); integración en `tests/integration/notification-generation.test.ts` |
| 2 | Un tipo desactivado no se genera ni se envía, sin afectar a los demás | `lib/notifications/plan.test.ts` («un tipo apagado no se genera», «apagar uno no afecta a los demás», «el apagado es de quien lo hace») |
| 3 | Una tarea vencida aparece en el grupo Vencidas y en el panel, primero | `lib/tasks/groups.test.ts` («lo vencido va primero»); `features/dashboard/pending-tasks-card.test.tsx` («los tres conteos»); e2e `tests/e2e/my-tasks.spec.ts` |
| 4 | Deslizar una fila la pospone a mañana en un solo gesto | `features/tasks/my-tasks/my-tasks-screen.test.tsx` («deslizar la fila… la pospone», «un roce corto no pospone nada»); e2e «posponer una tarea vencida la cambia de grupo» |
| 5 | El enlace del correo abre exactamente esa tarea | `lib/email/templates.test.ts` («apunta exactamente a esa tarea»); e2e «con sesión activa lleva directo al detalle» |
| 6 | Sin sesión, inicia sesión y llega a la tarea | e2e «sin sesión, se identifica y aterriza en esa misma tarea»; `lib/auth/routes.test.ts` |
| 7 | Una tarea sin fecha límite nunca genera avisos de vencimiento | `lib/notifications/plan.test.ts` («una tarea sin fecha no genera nada…») |
| 8 | La bitácora no genera notificaciones en ningún caso | `tests/integration/notification-generation.test.ts` («decenas de eventos de bitácora no crean ni un aviso») |

### Desviaciones y excepciones registradas (tarea 12.6)

1. **`notifications.dedupe_key` no está en el esquema canónico §15.** Se añade porque sin ella «nunca dos avisos por lo mismo» solo se puede cumplir leyendo antes de escribir, y dos pasadas concurrentes del cron se colarían por esa ventana (design D3). Con ella, generar es un `insert … on conflict do nothing` y el trabajo es reejecutable.
2. **`notification_preferences` es una tabla nueva que el canónico no previó.** El backlog situaba las preferencias «en V15», que es del dueño; son de la persona (design D1).
3. **`/settings/notifications` es la primera excepción a «V15 solo dueño».** La guardia de rol bajó del layout a cada sección; las siete del taller ya la aplicaban por su cuenta, así que no se relajó ninguna. Lo comprueba `features/settings/settings-nav.test.tsx`.
4. **Ninguna de las dos tablas lleva trigger de bitácora.** La convención nº 7 lo pide en las tablas *auditables*; un aviso es consecuencia de un hecho ya registrado, y auditarlo llenaría `activity_log` de ruido derivado.
5. **`stock_below_min` se declara sin generador**, a la espera de KAM-18 (supuesto 4 de la propuesta).
6. **Una tarea que vence más allá de los siete días no aparece en V20.** Tiene fecha —no es «Sin fecha»— y no toca aún —no es ninguno de los otros tres grupos—: se ve en el tablero, que es la vista de gestión. Es lo que mantiene los cuatro grupos siendo exactamente cuatro (`lib/tasks/groups.ts`).
7. **`server-only` se neutraliza en Vitest** mediante un alias declarado en `vitest.config.ts`. Es una guardia del empaquetador, no del corredor de pruebas; la protección real sigue en `next build`, y la prueba de arquitectura de `services/notifications/service-role-boundary.test.ts` comprueba además que nadie indebido importa el cliente privilegiado.
8. **`statusSince` se aproxima con `tasks.updated_at`.** El modelo no guarda cuándo entró una tarea en su estado actual. La aproximación sobreestima el movimiento —editar el título parece movimiento—, y esa es la dirección correcta: es preferible callar de más a llamar «estancada» a una tarea recién tocada.
