# KAM-23 · Diseño

## Context

Ver `proposal.md` — Why. Lo que importa aquí es el estado exacto del repositorio en el que aterriza este cambio, con KAM-01 a KAM-22 archivadas, porque casi todo el trabajo consiste en cerrar brechas concretas y no en construir mecanismos nuevos:

- **`app/` no tiene ni un `loading.tsx` ni un `error.tsx` ni un `not-found.tsx`.** Cero, comprobado sobre las treinta y ocho rutas. Cuando una consulta falla, el usuario ve la pantalla de error genérica de Next.
- **Los mensajes de vacío existen, sueltos y divergentes.** Cada pantalla resuelve lo suyo con un `<p>` propio, y **ninguna ofrece quitar filtros**.
- **Las primitivas ya están instaladas.** `components/ui/empty.tsx` y `components/ui/skeleton.tsx` vinieron con shadcn.
- **`tests/e2e/` tiene veintisiete archivos y los siete recorridos existen.** `task-deliverables.spec.ts` no separa «crear todos» de «crear algunos»; `assistant-permissions.spec.ts` no recorre `/expenses`, `/settings/retention` ni las rutas de exportación; quedan dos `waitForTimeout`.
- **`playwright.config.ts` fija `retries: 2` en CI.** Los reintentos son exactamente el mecanismo que hace que una suite intermitente se vea verde.
- **`supabase/tests/` tiene cincuenta y siete pruebas pgTAP y no tiene `views_security.test.sql`**, la única de las que ARCHITECTURE.md enumera que falta. Hay diez vistas en el esquema.
- **El proyecto ya exporta, en CSV y por Route Handler.** KAM-20 dejó `lib/reports/csv.ts` —RFC 4180, BOM UTF-8, cifras sin formato de moneda— y `app/(app)/reports/export/route.ts`; KAM-22 lo calcó en `app/(app)/activity/export/route.ts`, con un tope de 5.000 filas avisado. Ambas rutas se guardan con `getOwnerContext()` y reconsultan en lugar de serializar lo pintado. KAM-22 anotó que el serializador debería mudarse a `lib/export/` «el día que aparezca un tercer consumidor».
- **Las exportaciones de la purga viven en el bucket `activity-exports`, sin política para `authenticated`**: solo el service role lee y escribe (KAM-22, D8).
- **La retención está construida y sin programar.** `RetentionService.run(organizationId)` exporta, verifica y solo entonces vacía, pero no la invoca nadie. `supabase/README.md` § Trabajos programados describe cómo agendarla y sugiere `pg_cron` más `pg_net`.
- **Hay un solo trabajo programado, y no correría en producción.** `vercel.json` dispara `/api/notifications/daily` cada hora, pero `app/api/notifications/daily/route.ts` **solo exporta `POST`**, y el programador de Vercel llama con `GET`. La autorización (`lib/notifications/cron-auth.ts`) ya es la correcta: comparación en tiempo constante y rechazo total sin secreto.
- **El alta pública está cerrada en la pantalla, no en la API.** `supabase/config.toml` fija `enable_signup = false` en `[auth]`, pero el alta de invitados (`signUpAndAccept` en `actions/members.ts`) llama a `auth.signUp()` desde la sesión del invitado. En el proyecto alojado, cerrar el alta del proveedor rompe ese camino; dejarlo abierto deja crear cuentas a cualquiera.
- **Los disparadores generan datos a partir de otros datos.** `expense_items` genera movimientos de inventario (KAM-18) y toda tabla auditable genera eventos de bitácora (KAM-03). Una restauración que los dispare duplica ambos.
- **No hay despliegue, ni dominio, ni monitoreo, ni copia fuera de Supabase.** El proveedor de despliegue sí está implícito: `vercel.json` y el correo transaccional provisionado por el Marketplace de Vercel (KAM-17).
- **`next.config.ts` ya trata el service worker con `no-store`** por la lección de KAM-11.

## Goals / Non-Goals

**Goals**

- Que los cuatro estados transversales sean **estructurales, no disciplinados**: que una ruta nueva sin sus estados falle una comprobación automática.
- Que la estabilidad de la suite e2e se **demuestre**, no se infiera de una ejecución verde con reintentos.
- Que la exportación no abra el agujero que veintidós tareas de aislamiento cerraron: sale por la sesión de quien la pide, por RLS y por políticas de Storage, sin service role.
- Que la verificación del anexo §20 sea **catálogo contra catálogo**, no una lista escrita a mano que envejece en silencio.
- Que la restauración quede ensayada de verdad, con su acta en el repositorio, y que restaurar no repita la historia.
- Que todo trabajo programado corra en producción por el mismo mecanismo, con la misma puerta.
- Que ninguna decisión de este cambio introduzca una dependencia de un servicio externo para algo esencial del núcleo (especificación §10, «deliberadamente evitado»).

**Non-Goals**

- No se rediseña ninguna vista entregada. Aplicarle sus cuatro estados no es rehacerla.
- No se reescriben las exportaciones de informes ni de la bitácora filtrada: se mudan de carpeta junto con su serializador y siguen haciendo lo mismo.
- No se persigue conformidad WCAG completa ni cobertura de lector de pantalla certificada: el objetivo declarado es «sin fallos críticos».
- No se construye panel de métricas de la aplicación ni optimización de escala (fuera de alcance del backlog).
- No se toca el modo sin conexión más allá de comprobar que su indicador no se confunde con un estado de error.

## Decisions

### D1 · Los cuatro estados son un juego de componentes en `components/shared/`, y el nivel de ruta los cablea

`components/shared/` gana cuatro piezas sobre las primitivas ya instaladas: `EmptyState` (vacío inicial: mensaje + acción), `FilteredEmptyState` (sin resultados + «Quitar filtros»), `ListSkeleton` / `BoardSkeleton` / `DetailSkeleton` (esqueletos con la forma real) y `ErrorState` (explicación humana + reintentar). Cada segmento de ruta con datos gana su `loading.tsx` y su `error.tsx`, cableado al `retry()` que Next entrega. La raíz gana `app/global-error.tsx` y `app/not-found.tsx`.

*Por qué el nivel de ruta y no un estado dentro del componente:* el proyecto rinde en servidor y la carga la resuelve el propio framework con `Suspense`; `loading.tsx` es la única forma de que el esqueleto aparezca **antes** de que el componente exista. Y `error.tsx` es la única frontera que atrapa un fallo de renderizado en servidor, que es precisamente el caso que hoy muestra la pantalla genérica de Next.

*Por qué `retry()` y no una recarga ni `reset()`:* el requisito exige que la aplicación no se recargue por completo. En Next 16.3 el límite de error recibe dos funciones: `retry()` vuelve a **pedir los datos** y a rendir el segmento; `reset()` solo limpia el estado de error sin volver a pedirlos. Como las páginas son componentes de servidor que fallan al consultar, reintentar sin volver a pedir repetiría el mismo fallo: la que corresponde es `retry()`. Conserva el cascarón, el tema, el contexto de organización y la cola de sincronización.

*Alternativa descartada:* un componente `DataView` genérico que envuelva toda lista y decida el estado por sí mismo. Obligaría a reescribir las pantallas entregadas —tablero con arrastre, tabla, calendario, cuadrícula, gráficos de informes— para meterlas en un molde común, y el molde acabaría con escapes.

### D2 · La distinción «vacío inicial» / «sin resultados» la decide el estado de los filtros, no el conteo

Un `useFilterState()` común a las vistas con filtros expone `hasActiveFilters` y `clearFilters()`. La vista elige `EmptyState` o `FilteredEmptyState` según ese booleano, nunca según si la consulta anterior devolvió filas.

*Por qué:* decidirlo por el conteo produce el error clásico —una organización vacía con un filtro puesto ofrece «Quitar filtros» y al quitarlos sigue vacía—, que es justo lo que el criterio 2 quiere evitar.

### D3 · Una prueba recorre `app/` y exige `loading.tsx` y `error.tsx` en todo segmento con datos

Una prueba unitaria recorre el árbol de `app/`, junta los segmentos que contienen `page.tsx`, descuenta una lista corta y **justificada** de exclusiones (autenticación, `offline` y las que no cargan datos) y falla si a alguno le falta `loading.tsx` o `error.tsx`.

*Por qué:* es la diferencia entre «aplicamos los estados» y «los estados están aplicados». Sin esta prueba, la ruta número treinta y nueve nace sin ellos y nadie se entera hasta que un usuario ve una pantalla en blanco.

*Alternativa descartada:* una regla de ESLint. Habría que escribirla y mantenerla como plugin propio para algo que una prueba de veinte líneas resuelve.

### D4 · La intermitencia se persigue con `retries: 0` en un trabajo dedicado, no bajando los reintentos del pipeline

`playwright.config.ts` conserva `retries: 2` en el paso normal de CI —un reintento salva un pull request de un hipo de red del runner—. Se añade un **trabajo de estabilidad** que ejecuta la suite completa con `retries: 0` y repeticiones (`--repeat-each`), y es el que demuestra el criterio 1. Cualquier prueba que falle allí es intermitente por definición y se corrige en su causa.

*Por qué separarlo:* bajar los reintentos a cero en el pipeline principal convierte cada hipo de infraestructura en un pull request rojo y entrena a reintentar sin mirar. Separar «este cambio no rompió nada» de «la suite es estable» deja cada objetivo con la configuración que le corresponde.

*Contrapartida aceptada:* el trabajo de estabilidad tarda. Corre sobre `main` y bajo demanda, no en cada pull request. El requisito de CI del delta de `project-foundation` lo fija así.

### D5 · La exportación completa es un Route Handler calcado de los de KAM-20 y KAM-22, que produce un ZIP de CSV

`app/(app)/settings/export/route.ts` sigue el patrón que el proyecto ya usa para exportar: usa `createClient()` de `@/lib/supabase/server` —la sesión de quien pide—, delega toda consulta a `services/export/export-service.ts` (convención nº 1), lee cada tabla **por páginas hasta agotarla**, y devuelve el archivo con su `Content-Disposition`, escrito por flujo. La ruta se guarda con el contexto de miembro, no de dueño: RLS decide qué sale para cada rol.

*`lib/reports/csv.ts` se muda a `lib/export/csv.ts`*, con sus pruebas, y los dos consumidores existentes actualizan su importación. Es la deuda que KAM-22 dejó anotada, y la exportación completa es el tercer consumidor que la justifica. `lib/export/` gana además la composición del archivo comprimido, como función pura cubrible al 90 %.

*Formato — decisión del usuario:* un archivo comprimido con un CSV por tabla. Reutiliza el serializador que ya resuelve el escapado, el BOM que evita que Excel abra «Sublimación» como «SublimaciÃ³n» y las cifras sumables, y admite **tal cual** las exportaciones de la purga, que ya son CSV.

*Alternativa descartada:* un `.xlsx` con una hoja por tabla. Más cómodo para abrir, pero pone un segundo serializador junto a `toCsv()` —lo que KAM-22 rechazó expresamente— y obliga a convertir en hojas los CSV de la purga.

*Por qué un Route Handler y no una Server Action:* una Server Action devuelve datos serializados a React, no un archivo con sus cabeceras; y el proyecto ya tiene probado este camino dos veces.

*Por qué sin tope:* la exportación filtrada de la bitácora corta a 5.000 filas y lo avisa, porque es una consulta interactiva. La completa es un respaldo, y un respaldo cortado es peor que ninguno. La lectura por páginas y la escritura por flujo son las que la mantienen dentro del tiempo y la memoria de la función.

### D6 · Las exportaciones de la purga se abren a la persona dueña con una política de Storage, no con la clave de servicio

Una migración nueva añade una política `select` sobre `storage.objects` para el bucket `activity-exports`, con la misma forma que las demás del proyecto: la primera carpeta de la ruta es el `organization_id`, y la condición es `is_owner()` de esa organización. Escritura y borrado siguen sin política: solo el sistema escribe, y nadie borra.

*Por qué política y no service role tras comprobar el rol:* la convención nº 2 prohíbe el cliente de service role en una acción disparada por el usuario, y comprobar el rol a mano es exactamente la disciplina que RLS existe para no tener que recordar. KAM-22 lo dejó dicho: abrirla a la persona dueña «exigiría una política de Storage por rol». Es la primera política por rol en Storage del proyecto; su pgTAP fija que el ayudante y la otra organización quedan fuera.

### D7 · La retención se programa con el Cron de Vercel, por el mismo camino que el resumen diario

`app/api/activity/retention/route.ts`, calcado del resumen diario: comprueba el secreto con `isAuthorizedCron()`, recorre las organizaciones con el cliente de service role —la convención nº 2 lo permite en trabajos programados— y llama a `RetentionService.run()` una por una, cada una en su propio `try`, reportando cada fallo al monitoreo. `vercel.json` gana su entrada mensual junto a la del resumen diario.

*Los puntos de entrada programados responden a `GET`*, que es el método con el que llama el programador de Vercel. Hoy el del resumen diario solo exporta `POST` y **no correría**; se corrige en el mismo paso, con una prueba de integración que llama a los dos como lo haría el programador.

*Corregido en la implementación — el resumen diario se agenda con `pg_cron`:* el plan Hobby de Vercel solo admite trabajos **diarios** y rechaza el despliegue entero, incluso una vista previa, con «Hobby accounts are limited to daily cron jobs». La pasada horaria no es negociable sin degradar el reparto por zona horaria (KAM-17), así que la agenda `pg_cron` con `pg_net` y el secreto de disparo pasa al Vault, que es lo que esta decisión quería evitar. La retención se queda en `vercel.json`: una vez al mes cabe de sobra, y es el trabajo que necesita el service role y `RetentionService`, no SQL —el `cron.schedule` que el anexo de esquema propone, un `update` directo sobre `activity_log`, no sirve, porque la especificación exige exportar y verificar antes de vaciar—. La migración no lleva el secreto escrito: lo lee del Vault en cada pasada y, si no existe, no llama a nadie, de modo que en local es inerte.

*Por qué por organización y aislado:* una organización con un fallo de exportación no puede dejar sin retención a las demás. Como `RetentionService.run()` no vacía nada si la exportación no se verifica, un fallo deja esa organización exactamente como estaba.

### D8 · El alta de cuentas se limita con un hook de Auth que consulta las invitaciones

Una migración nueva crea una función para el hook *before user created* de Supabase Auth: recibe el evento de alta, busca una invitación vigente —no aceptada, no vencida, no archivada— para ese correo, y rechaza el alta si no la encuentra. `supabase/config.toml` la registra y habilita el alta del proveedor, que queda abierta solo en apariencia: la puerta la guarda la función. El proyecto alojado se configura igual.

*Por qué el hook — decisión del usuario:* es la única de las tres salidas que cierra el alta sin tocar la convención nº 2. Cerrar el alta del proveedor rompería `signUpAndAccept`; crear la cuenta con la API de administración pondría service role en una acción de usuario; dejarla abierta permite cuentas vacías sin límite.

*La función corre con los privilegios mínimos que Auth le concede* y se revoca a `authenticated` y `anon`, como `purge_activity_detail()`. Su pgTAP cubre los cuatro casos: sin invitación, vigente, aceptada, vencida o archivada.

### D9 · Las copias fuera del proveedor las produce un trabajo programado del repositorio

Un flujo de trabajo programado del repositorio ejecuta `supabase db dump` —esquema y datos por separado— y sincroniza los objetos de Storage hacia un almacenamiento independiente del proveedor de la base, con cifrado en reposo y retención declarada. La retención propia de Supabase se conserva como primera línea; ésta es la que satisface «al menos una fuera del sistema».

*Por qué el repositorio y no el Cron de Vercel:* el volcado necesita el CLI de Supabase y un tiempo que no cabe en una función. La infraestructura de flujos programados del repositorio ya existe y no añade un proveedor.

*El destino se elige en la implementación* con dos condiciones no negociables: independiente del proveedor de la base, y con credenciales de escritura que no puedan leer ni borrar el histórico.

### D10 · La restauración es un procedimiento en `docs/` que se ejecuta y se firma con su resultado, y que carga los datos sin disparadores

`docs/recuperacion.md` describe el procedimiento paso a paso y, al final, la **bitácora de ensayos**: fecha, origen de la copia, entorno, pasos, incidencias y duración. El criterio 4 se satisface cuando esa bitácora tiene al menos una entrada real.

*El orden del procedimiento es el que evita repetir la historia:* primero el esquema sin disparadores, luego los datos, luego los disparadores —o, si se restaura solo datos sobre un esquema existente, con los disparadores desactivados durante la carga—. Así ni `expense_items` genera movimientos que ya están en el volcado, ni el trigger de auditoría escribe eventos a nombre de quien restaura. El ensayo compara conteos de `inventory_movements` y de `activity_log` entre el origen y el restaurado; ese es el escenario que lo verifica.

*Por qué documento y no script:* un script de restauración da la ilusión de estar cubierto sin haberse ejecutado nunca. Lo que se entrega es el ensayo, y el documento es su acta.

### D11 · La accesibilidad se audita dentro de Playwright, sobre las vistas que la suite ya visita

La auditoría corre con un motor de reglas integrado en las pruebas de extremo a extremo, en los puntos donde los recorridos ya dejaron la aplicación en un estado interesante —tablero con datos, formulario con errores, diálogo abierto, modo feria, captura móvil, informes con gráficos—. Falla ante gravedad crítica o seria; lo demás se registra. Se ejecuta en cada pull request y en los dos temas, porque el contraste es propiedad del par color-fondo.

*La alternativa de teclado al arrastre no es una regla automática*, es una prueba de comportamiento: enfocar una tarjeta, moverla con teclado, comprobar que el estado del registro cambió igual que al arrastrar.

### D12 · El presupuesto de carga se mide con Playwright y limitación de red y CPU, contra una semilla de doce meses, en el trabajo de estabilidad

Una prueba dedicada limita CPU y red al perfil de gama media, carga el panel principal contra una organización sembrada con doce meses de actividad, y falla si supera los 2 segundos hasta ser utilizable.

*Por qué no una herramienta de auditoría de páginas:* el panel exige sesión, organización y datos, y Playwright ya sabe autenticarse.

*La semilla es la mitad del valor.* Las vistas derivadas cuestan en proporción a los datos; medir con tres pedidos no mide nada. Se genera de forma determinista.

*Se mide en el trabajo de estabilidad, no en cada pull request*, porque el tiempo de un runner compartido varía y una medición ajustada convertiría el presupuesto en ruido. El requisito de CI del delta de `project-foundation` lo refleja así.

### D13 · `views_security.test.sql` y los controles del anexo interrogan al catálogo, no a una lista

La prueba recorre `pg_class` filtrando vistas de los esquemas de la aplicación y comprueba `security_invoker=true` en sus `reloptions`, sin enumerar ninguna. La misma forma se aplica a los puntos automatizables del anexo §20: tablas sin `organization_id` o sin RLS, tablas auditables sin disparador, columnas de importe con tipo de punto flotante.

*Los puntos no automatizables* —«los índices cubren los filtros reales de la interfaz», «ninguna columna guarda un valor que pueda calcularse»— se verifican a mano y se documentan con su evidencia.

### D14 · El despliegue fija la frontera de secretos con una prueba, no con una convención

Además de separar variables por ambiente, una comprobación sobre la compilación de producción busca la clave de service role en todo lo que se sirve al navegador y falla si aparece. Las variables requeridas —`CRON_SECRET` y `APP_URL` incluidas— se validan al arrancar con un esquema.

*Por qué:* una convención que nadie comprueba se rompe el día que alguien escribe `NEXT_PUBLIC_` delante del nombre equivocado, y el fallo es silencioso y total.

## Desviaciones de la implementación

Lo que la implementación cambió respecto de las decisiones de arriba, con su motivo. El detalle de cada una está en la nota de su tarea en `tasks.md`.

- **Cinco migraciones, no dos.** Además de la política de `activity-exports` (D6) y del hook de alta (D8): `revoke truncate` a `anon`, `authenticated` y `service_role` y un índice de `tasks` por línea, los dos hallazgos de la verificación del anexo §20 (`docs/anexo-bd-verificacion.md`); y `activity_log.action = 'exported'` con `record_export()`, porque la bitácora es inmutable para `authenticated` y no admitía ninguna acción para una exportación.
- **La descarga completa vive en `/settings/export/download`** y la pantalla en `/settings/export`: un segmento no admite `page.tsx` y `route.ts` a la vez.
- **Reintentar usa `retry()` de Next 16.3**, no `reset()`: `reset()` vuelve a rendir sin volver a pedir los datos.
- **Las pruebas e2e esperan a que termine el *streaming*.** Con un `loading.tsx` por segmento, la carga completa llega por partes y el contenido existe un momento dos veces en el DOM —la copia oculta del segmento `S:n`—; `tests/e2e/helpers/test.ts` ancla la espera a que no quede ningún segmento por revelar.
- **El presupuesto de 2 s se aplica a volver al panel**, con los recursos estáticos en caché y el service worker bloqueado —su petición escapa a la limitación de red de CDP—. La primera visita en frío mide ~2,4 s y queda fuera del presupuesto (pregunta abierta).
- **Las listas traen todo lo abierto y una ventana de lo cerrado** (pedidos, tareas), una ventana alfabética (contactos, catálogo) o el periodo (egresos), y toda consulta por lista de identificadores va en tandas de 100: con un año de datos, PostgREST respondía `414 URI too long` y el tablero caía.
- **Una sola validación de sesión por petición** (`lib/auth/request-user.ts`, con `cache()`): cada vista llamaba a `auth.getUser()` decenas de veces, y es lo que satura el Auth local bajo la suite e2e.
- **El trabajo de retención delega en `services/activity/retention-job.ts`** para poder probar el aislamiento por organización sin tocar la ruta, y responde 500 si alguna organización falló, para que el fallo se vea también en el registro del programador.
- **La prueba del service worker corre en su propio proyecto de Playwright** (`deployment`), después del resto: simula un despliegue cambiando `public/sw.js` en disco, y ni la intercepción de Playwright ni la de CDP a nivel de navegador ven la petición de actualización del service worker.
- **`noindex` va en cabecera y metadatos, sin `robots.txt`**: un `Disallow` impediría al rastreador leer el `noindex`.
- **El monitoreo está construido sin proveedor**: depuración, contexto, captura en servidor y navegador, y un hueco (`setMonitoringTransport`) donde se enchufa el adaptador cuando se elija.
- **`activity-retention` cambia también**: el requisito que decía que la rutina «nunca» corre sola se renombra y modifica en `specs/activity-retention/spec.md`.
- **Cada prueba e2e trabaja sobre su propia copia de una organización de la semilla.** Las secciones de Geeko Store, Kamay Histórico y Kamay Rendimiento de la semilla viven ahora en funciones `e2e.seed_*(p_org)` —con los identificadores de siempre para las organizaciones de la semilla y derivados para una copia— y `e2e.clone_*()` crea la organización, sus usuarias y la siembra en ~0,2 s. Las pruebas las piden con `geeko()`, `historico()` y `rendimiento()` (`tests/e2e/helpers/seed-copies.ts`); los bloques en serie cuyas pruebas dependen unas de otras comparten una copia por bloque. El esquema `e2e` solo existe donde se aplica la semilla y se llama por `psql`: no hay puerta en la API. Es lo que hace repetible la suite: sin ello, cobros, cola, estados y la restricción de la ayudante cruzaban de una prueba a otra.
- **La prueba del service worker corre en su propio paso de CI**, con `E2E_DEPLOYMENT=1`, y no como proyecto dependiente: Playwright no aplica `--repeat-each` a los proyectos de los que otro depende, y el trabajo de estabilidad solo habría repetido esa prueba.
- **Miniaturas generadas al subir, en el servidor** (`lib/attachments/thumbnail.ts`, con sharp): WebP de 480 px en el lado mayor junto al original (`….thumb.webp`), que `AttachmentService` crea, copia y retira con él. Las pantallas firman la miniatura y caen al original si no existe —subidas anteriores—, en la misma petición. Sin columna nueva ni plan de pago de Storage.
- **Aviso para el despliegue:** desde el 30 de octubre de 2026 las tablas nuevas de un proyecto alojado de Supabase dejan de exponerse solas a la Data API. Las migraciones de Kamay conceden sus privilegios de forma explícita, y el despliegue debe comprobar que ninguna tabla quedó sin exponer.

## Risks / Trade-offs

- **Aplicar los cuatro estados toca más de treinta rutas entregadas y puede romper sus e2e** → pantalla por pantalla, cada una con su suite verde antes de pasar a la siguiente.
- **El trabajo de estabilidad puede destapar intermitencia que hoy los reintentos ocultan** → es el resultado buscado; `tasks.md` lo trata como trabajo previsto.
- **La medición de rendimiento en runners compartidos es ruidosa** → umbral con margen, semilla determinista, ejecución fuera del pull request y vigilancia de la tendencia.
- **La exportación completa de una organización grande puede agotar el tiempo o la memoria de la función** → lectura por páginas y escritura por flujo desde el primer diseño.
- **Mudar `lib/reports/csv.ts` puede romper las dos exportaciones existentes** → se muda con sus pruebas, y las pruebas de ruta de informes y de bitácora deben seguir en verde en el mismo commit.
- **La política de `activity-exports` es la primera de Storage por rol** → su pgTAP cubre dueño, ayudante y otra organización; escritura y borrado siguen sin política.
- **El hook de alta mal configurado en el proyecto alojado deja la puerta abierta o la cierra del todo** → el paso de despliegue lo verifica en producción con los dos casos: un alta sin invitación rechazada y un alta con invitación aceptada.
- ~~**El plan de Vercel puede limitar la frecuencia del Cron**~~ → **ocurrió**: el plan Hobby solo admite trabajos diarios y rechaza el despliegue completo. En vez de degradar la frecuencia, el resumen diario se agenda con `pg_cron` (ver D7); la retención mensual se queda en `vercel.json`.
- **Restaurar con los disparadores activos duplica inventario y bitácora** → el procedimiento carga los datos sin disparadores y el ensayo compara conteos entre origen y restaurado.
- **El monitoreo puede filtrar datos personales al proveedor** → depuración explícita antes de enviar, y una prueba que lo verifica.
- **Las credenciales de la copia fuera del proveedor son un objetivo** → escritura sin permiso de lectura ni de borrado del histórico.
- **La verificación del anexo §20 puede descubrir un incumplimiento real** → la corrección entra como migración nueva con su pgTAP; `tasks.md` reserva el espacio.

## Migration Plan

1. **Controles de catálogo primero** (`views_security.test.sql` y los demás del anexo §20). Son baratos y, si encuentran algo, conviene saberlo antes de construir encima.
2. **Juego de componentes de estado + prueba de cobertura de rutas**, y aplicación pantalla por pantalla.
3. **Cierre y estabilización de la suite e2e** y trabajo de estabilidad en CI.
4. **Accesibilidad**: alternativa de teclado en los tableros, corrección de hallazgos críticos, auditoría integrada.
5. **Rendimiento**: semilla de doce meses, medición, paginación donde falte, imágenes.
6. **Exportación**: mudanza del serializador, política de `activity-exports`, servicio, ruta, evento de bitácora.
7. **Alta según invitación**: migración del hook, registro en `config.toml`, pruebas.
8. **Trabajos programados**: puntos de entrada en `GET`, ruta de retención, entrada mensual en `vercel.json`.
9. **Operación**: variables por ambiente y comprobación de secretos, despliegue con dominio, hook y alta configurados en el proyecto alojado, monitoreo con depuración, copias fuera del proveedor.
10. **Ensayo de restauración** sobre entorno limpio, con su acta en `docs/recuperacion.md`. Va al final porque restaura el sistema tal como quedará en producción.

**Retroceso:** los pasos 1 a 5 son código y pruebas: revertir el commit basta, salvo las dos migraciones del paso 1 —el índice y la revocación de `truncate`—, que no hace falta retirar. Las tres migraciones de los pasos 6 y 7 se retiran con una migración nueva que borra la política o la función y desregistra el hook (convención nº 6), sin tocar datos; la acción `exported` se conserva, porque puede haber eventos que la usen. El paso 8 se desactiva quitando la entrada de `vercel.json`: la retención vuelve a su estado de KAM-22 sin consecuencias, porque nunca vacía sin exportar. El paso 9 se revierte volviendo al despliegue anterior, que la plataforma conserva.

## Open Questions

- **El proveedor de monitoreo** queda por elegir. Las condiciones —depuración antes de enviar, fallo silencioso, versión, ruta y organización en el reporte— acotan la decisión sin cambiar las pruebas; el precedente de KAM-17 inclina a provisionarlo por el Marketplace de Vercel.
- **El destino concreto de las copias fuera del proveedor** queda por elegir entre almacenamientos de objetos de propósito general, con las dos condiciones de D9.
- ~~La lista definitiva de rutas excluidas de la prueba de cobertura de estados~~ — cerrada en `app/route-states.test.tsx`, cada exclusión con su motivo.
- ~~Cómo cumple la suite e2e «cada prueba crea su propia organización»~~ — copias de la semilla por prueba (ver *Desviaciones*).
- **Cuántas veces valida la sesión cada vista.** Cada precarga del menú rinde el layout de `(app)`, que llama a `auth.getUser()`: una vista completa cuesta 27–45 idas y vueltas a Auth. En local satura el contenedor de Auth bajo la suite en paralelo; en producción es latencia y carga. Las salidas —validar el JWT en local con `getClaims()` y claves asimétricas (una sesión cerrada sigue valiendo hasta que su token vence, ~1 h, como ya ocurre en RLS), o no precargar el menú— cambian la seguridad o la experiencia, y las decide la persona usuaria.
- ~~Si el plan de Vercel admite el Cron horario del resumen diario~~ — cerrada: no lo admite en Hobby, y la pasada horaria pasó a `pg_cron` (tarea 10.4).
- **Si la primera visita en frío entra en el presupuesto de carga**, o solo la visita de vuelta (tarea 6.2).
- ~~Cómo se producen las miniaturas~~ — generadas al subir, en el servidor (ver *Desviaciones*).
