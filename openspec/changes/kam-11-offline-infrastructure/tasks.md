> Cada tarea de prueba nombra los escenarios del delta spec que cubre (convención nº 12: ningún escenario sin prueba referenciada). Los escenarios viven en `specs/offline-capture/spec.md`, `specs/orders/spec.md` y `specs/activity-log/spec.md` de este cambio.

## 0. Requisito previo

- [x] 0.1 Verificar que KAM-08 está fusionado: existen `create_order`, `update_order` y `orderFormSchema` con `id` y `occurredAt` generados en el cliente. Es la única dependencia de este cambio (`design.md` — Migration Plan, paso 1).
- [x] 0.2 Comprobar si KAM-12 ya redefinió el requisito *El alta es una sola operación y el estado inicial lo asigna la base* en `openspec/specs/orders/spec.md`. Si lo hizo, rebasar el delta de este cambio sobre ese texto antes de seguir (`design.md` — Risks, cambios hermanos).

## 1. Migración de base de datos

- [x] 1.1 Crear `supabase/migrations/<AAAAMMDDHHMMSS>_offline_sync.sql` (archivo nuevo; no editar ninguna migración existente).
- [x] 1.2 Redefinir `create_order(jsonb, jsonb)` con `create or replace function`, conservando la firma exacta —para no invalidar los `grant execute` de KAM-08— y añadiendo `on conflict (id) do nothing` al `insert into orders` (`design.md`, decisión 5).
- [x] 1.3 Añadir `on conflict (id) do nothing` al `insert into order_items` del bucle, sin el cual el reenvío de un alta ya guardada moriría en la primera línea (`design.md`, decisión 5).
- [x] 1.4 Añadir, tras el `insert`, la comprobación de que el pedido con ese `id` pertenece a `v_org`; si no, `raise exception ... using errcode = 'insufficient_privilege'` con mensaje escrito para una persona. Nunca adoptar en silencio un identificador ajeno.
- [x] 1.5 Redefinir `log_activity()` con `create or replace function` para que, **solo en `INSERT`**, el `occurred_at` del evento sea `coalesce((v_new->>'occurred_at')::timestamptz, now())`. No tocar la rama de `UPDATE` ni la fusión de ruido (`design.md`, decisión 6).
- [x] 1.6 Verificar que la migración no crea ni altera ninguna tabla, política o `grant`: solo redefine dos funciones.

## 2. Pruebas pgTAP de la migración

- [x] 2.1 `supabase/tests/order_idempotency.test.sql`, con su propia organización: invocar `create_order` dos veces con el mismo `id` y las mismas líneas. Cubre el delta de `orders` → *El alta es una sola operación…* → «El mismo pedido enviado dos veces» (un solo pedido, un solo `code`, sin líneas duplicadas) y «El reenvío no ensucia la bitácora» (un único evento `created`).
- [x] 2.2 Ampliar `order_idempotency.test.sql` con el identificador ajeno: crear un pedido en la organización A e invocar `create_order` con ese `id` desde la B. Cubre «Identificador que pertenece a otra organización» y, en `offline-capture`, *Reenviar un registro nunca crea un segundo* → «Identificador de otra organización».
- [x] 2.3 Ampliar `order_idempotency.test.sql` comprobando que el alta normal sigue funcionando igual que en KAM-08 —estado inicial resuelto, rechazo sin líneas, número asignado— para que la redefinición no sea una regresión silenciosa.
- [x] 2.4 `supabase/tests/activity_occurred_at.test.sql`: insertar un pedido con `occurred_at` en el pasado y comprobar la fecha de su evento en la bitácora. Cubre el delta de `activity-log` → «A record created offline keeps its real time in the log» y, en `offline-capture`, *La hora del hecho…* → «La bitácora conserva la hora real» y «Varios registros conservan sus horas distintas».
- [x] 2.5 Ampliar `activity_occurred_at.test.sql` con una tabla auditada sin `occurred_at` y con los eventos posteriores de una fila que sí la tiene. Cubre «Audited table without a client-set time» y «Later changes are dated when they arrive».
- [x] 2.6 Ampliar `activity_occurred_at.test.sql` comprobando que la fusión de ediciones sucesivas de KAM-03 sigue funcionando con eventos `created` fechados en el pasado (mitigación anotada en `design.md`, decisión 6).

## 3. Aplicación instalable y service worker

- [x] 3.1 Añadir las dependencias `serwist` y `@serwist/next` al proyecto.
- [x] 3.2 Crear `app/manifest.ts` (convención de archivo de esta versión de Next) con nombre, nombre corto, descripción, `start_url: "/"`, `display: "standalone"`, colores de tema y fondo coherentes con el tema de la aplicación, y los iconos de 192 y 512 px.
- [x] 3.3 Generar los iconos en `public/` en ambos tamaños, más una variante `maskable`.
- [x] 3.4 Crear `app/sw.ts` con Serwist: precarga de los recursos de compilación, `CacheFirst` para `/_next/static/`, y navegaciones a la red con retorno a `/offline`. **Nada más se intercepta** —ni con `defaultCache` ni con una ruta comodín—: además de cachear datos que no deben cachearse, una ruta comodín rompe las subidas `multipart` de las Server Actions (`design.md`, decisión 2). Sin Background Sync ni reenvío de escrituras.
- [x] 3.5 Integrar Serwist en **modo configurador** (`serwist.config.mjs` + paso `postbuild`), no como plugin de `next.config.ts`: el plugin es de webpack y este proyecto compila con Turbopack, el bundler por omisión de esta versión de Next. Añadir en `next.config.ts` las cabeceras de `/sw.js` que indica la guía de PWA de Next: `Content-Type` de JavaScript, `Cache-Control: no-cache, no-store, must-revalidate` y CSP propia.
- [x] 3.6 Registrar el service worker en `app/layout.tsx` con `skipWaiting` y reclamo de clientes, para no servir una versión vieja durante días (`design.md` — Risks).
- [x] 3.7 Solicitar `navigator.storage.persist()` al arrancar cuando haya entradas pendientes, contra el desalojo de IndexedDB en iOS (`design.md` — Risks).

## 4. El núcleo de la cola (`lib/offline/`)

- [x] 4.1 Crear `lib/offline/db.ts`: base Dexie con la tabla `outbox` y los campos `{ id, seq, operation, payload, organizationId, userId, dependsOn, state, attempts, nextAttemptAt, lastError, enqueuedAt }`, `seq` autoincremental y una **versión de esquema** que, al no coincidir, retiene las entradas en lugar de enviarlas mal interpretadas.
- [x] 4.2 Crear `lib/offline/registry.ts`: registro de operaciones con `registerOperation(key, { send, describe })`. `send` recibe el `payload` y llama a la Server Action; `describe` devuelve el texto que la bandeja muestra a la persona. Una operación desconocida es un fallo definitivo, nunca una entrada perdida (`design.md`, decisión 1).
- [x] 4.3 Crear `lib/offline/backoff.ts`: espera creciente 1 s → 2 s → 4 s… con techo de 5 minutos y desorden aleatorio, más el tope de 8 intentos que convierte lo transitorio en definitivo (`design.md`, decisión 8).
- [x] 4.4 Crear `lib/offline/classify.ts`: una promesa rechazada es fallo **transitorio**; una que resuelve con `{ error }` es fallo **definitivo**. Tratar el mensaje de sesión terminada como definitivo pero recuperable, con su texto propio en la bandeja (`design.md`, decisión 8).
- [x] 4.5 Crear `lib/offline/queue.ts` con `enqueue(operation, payload, { dependsOn })`: graba la entrada con la organización y la persona de la sesión activa y devuelve su identificador (`design.md`, decisión 9).
- [x] 4.6 Crear `lib/offline/drain.ts`: vaciado secuencial en orden de `seq`, una entrada por vez, con candado para que el temporizador, el evento `online` y el arranque no lo ejecuten a la vez. Marca `blocked` a los dependientes de una entrada `failed` (`design.md`, decisión 7).
- [x] 4.7 Añadir al vaciado la comprobación de organización y persona: una entrada cuya organización o cuya persona no coincidan con la sesión activa no se envía y queda retenida con su explicación (`design.md`, decisión 9).
- [x] 4.8 Crear `lib/offline/flush-with-deadline.ts`: encolar, disparar el vaciado y esperar su resultado un plazo corto (constante única, ~2 500 ms; cero si el dispositivo se declara sin red), devolviendo el resultado real o «encolado» (`design.md`, decisión 3).
- [x] 4.9 Crear `lib/offline/README.md` explicando cómo conectar un dominio nuevo —registrar una operación, no tocar el motor— y por qué cambiar la forma de un `payload` obliga a registrar una clave nueva.

## 5. Pruebas unitarias del núcleo

- [x] 5.1 `lib/offline/queue.test.ts`: encolar guarda organización, persona y hora del hecho; el `payload` sobrevive a un cierre y reapertura de la base. Cubre *La cola sobrevive al cierre de la aplicación* → «Cerrar y reabrir con registros pendientes», «Recargar la página no vacía la cola».
- [x] 5.2 `lib/offline/drain.test.ts` — orden. Cubre *El envío es secuencial y nunca envía un hijo antes que su padre* → «Padre antes que hijo al reconectar», «El hijo de un registro muerto no se envía», «Un fallo transitorio no reordena la cola».
- [x] 5.3 `lib/offline/drain.test.ts` — deduplicación. Con un `send` simulado que falla tras haber «escrito», comprobar que el reenvío conserva el mismo identificador y que la entrada se da por completada. Cubre *Reenviar un registro nunca crea un segundo* → «Dos reintentos, un solo registro», «La respuesta se pierde después de escribir».
- [x] 5.4 `lib/offline/backoff.test.ts`: la espera crece, tiene techo y el tope de intentos convierte el fallo en definitivo. Cubre *Los reintentos esperan cada vez más* → «La espera crece entre intentos».
- [x] 5.5 `lib/offline/classify.test.ts`: rechazo de red → transitorio; `{ error }` de dominio, de permisos y de sesión → definitivo con su mensaje. Cubre *Un fallo definitivo se muestra, nunca se pierde en silencio* → «Rechazo por permisos», «Nada se pierde en silencio».
- [x] 5.6 `lib/offline/drain.test.ts` — aislamiento. Cubre *La cola pertenece a una organización y a una sesión* → «Cambiar de organización no reencamina lo pendiente», «Otra persona en el mismo dispositivo», «Cerrar sesión conserva lo pendiente».
- [x] 5.7 `lib/offline/flush-with-deadline.test.ts`: con red devuelve el resultado real dentro del plazo; sin red devuelve «encolado» sin esperar. Cubre *Todo registro cubierto se guarda localmente antes de intentar enviarse* → «Registrar con red no cambia la experiencia», «La red se cae a mitad del envío».
- [x] 5.8 `lib/offline/registry.test.ts`: una operación desconocida termina en fallo definitivo y sigue existiendo en la cola. Cubre *Un fallo definitivo se muestra* → «Nada se pierde en silencio».

## 6. Estado, indicador y bandeja

- [x] 6.1 Crear `hooks/use-online-status.ts`, el hook transversal que ARCHITECTURE.md ya declaraba: eventos `online`/`offline` combinados con el resultado del último envío, porque `navigator.onLine` miente en WiFi sin salida (`design.md`, decisión 4).
- [x] 6.2 Crear `stores/sync-store.ts` alimentado por `useLiveQuery` sobre Dexie —nunca por un contador propio— con las cuentas de pendientes, retenidas y fallidas (`design.md`, decisión 11).
- [x] 6.3 `stores/sync-store.test.ts`: la cuenta refleja la tabla y llega a cero al vaciarse. Cubre *Un indicador persistente…* → «La cuenta refleja lo pendiente», «El indicador desaparece al vaciarse la cola».
- [x] 6.4 Crear `components/layout/sync-indicator.tsx`: persistente, no bloqueante, con la cuenta; distingue lo fallido de lo pendiente; desaparece a cero; al activarse abre la bandeja. Cubre «Lo que falló se distingue de lo que espera», «El indicador abre la bandeja».
- [x] 6.5 Montar el indicador en `components/layout/header.tsx` y en `components/layout/mobile-context-bar.tsx` —no en la barra inferior: sus entradas se reparten el ancho a partes iguales y un elemento que aparece y desaparece movería la navegación bajo el pulgar—, y su prueba de render en ambas presentaciones.
- [x] 6.6 Crear la bandeja de registros no sincronizados: lista de pendientes, retenidos y fallidos con su descripción, su hora real y el motivo; acciones *Reintentar* y *Descartar*, con `ConfirmDialog` para descartar. Cubre *Un fallo definitivo se muestra* → «Descartar pide confirmación», «Reintentar desde la bandeja».
- [x] 6.7 Prueba de la bandeja con Testing Library: reintentar devuelve la entrada a la cola con su contenido y su identificador originales; descartar exige confirmación.

## 7. Conectar el alta y la edición de pedidos

- [x] 7.1 Registrar las operaciones `order.create` y `order.update` en `features/orders/` mediante `registerOperation`, delegando en `createOrder` y `updateOrder` sin modificar las Server Actions.
- [x] 7.2 Cambiar el formulario de pedido para que escriba en la cola en lugar de llamar a la acción: `flushWithDeadline` decide si navega al detalle con el número o confirma como pendiente (`design.md`, decisiones 3 y 10).
- [x] 7.3 Ajustar la confirmación y el destino sin conexión: «Pedido guardado · pendiente de sincronizar», sin número, y sin navegar a un detalle que no se puede servir sin red. Cubre el delta de `orders` → *Guardar y Guardar y crear otro* → «Guardar sin conexión», «Guardar y crear otro sin conexión», «El número aparece al sincronizar».
- [x] 7.4 Comprobar que con red la experiencia de KAM-08 no cambia: mismo destino, mismo número anunciado, «Guardar y crear otro» conservando línea y canal. Cubre «Guardar lleva al detalle», «Guardar y crear otro conserva línea y canal», «El pedido guardado existe».
- [x] 7.5 Adjuntos: sin red, avisar de que la imagen requiere conexión y permitir guardar el pedido igualmente, sin encolar ningún archivo. Cubre el delta de `orders` → *Adjuntos del pedido* → «Adjuntar sin conexión».
- [x] 7.6 Comprobar que la validación del formulario sigue ocurriendo antes de encolar. Cubre *Todo registro cubierto se guarda localmente…* → «Un registro rechazado por su contenido no llega a la cola».

## 8. Prueba de extremo a extremo

- [x] 8.1 Crear `tests/e2e/offline-capture.spec.ts`: con la pantalla ya cargada, desconectar la red desde Playwright (`context.setOffline(true)`), registrar un pedido y comprobar que se confirma sin error y que el indicador muestra uno. Cubre *Todo registro cubierto…* → «Registrar sin red» y el delta de `orders` → «Guardar sin conexión».
- [x] 8.2 Ampliar la prueba: recargar la página sin red y comprobar que la entrada sigue pendiente. Cubre *La cola sobrevive al cierre de la aplicación* → «Recargar la página no vacía la cola». **Va en el bloque de compilación de producción**: sin service worker el navegador ni siquiera recibe el HTML de una recarga sin red, así que en `next dev` la comprobación no puede existir.
- [x] 8.3 Ampliar la prueba: reconectar, esperar a que el indicador llegue a cero y comprobar que existe **exactamente un** pedido, con su hora real y su número ya asignado. Cubre «Dos reintentos, un solo registro», *La hora del hecho…* → «Venta registrada sin señal y sincronizada horas después» y «El número aparece al sincronizar».
- [x] 8.4 Ampliar la prueba: registrar tres pedidos sin red y comprobar que al reconectar aparecen los tres, cada uno con su hora, y que el indicador baja de tres a cero. Cubre «Varios registros conservan sus horas distintas», «La cuenta refleja lo pendiente», «El indicador desaparece al vaciarse la cola».
- [x] 8.5 Marcar para el proyecto de CI —que corre contra `npm run start`— la comprobación que exige compilación de producción: abrir la aplicación **desde cero** sin red y ver la interfaz de Kamay. Cubre *La aplicación es instalable…* → «Abrir la aplicación sin conexión» (`design.md` — Risks, service worker en desarrollo).
- [x] 8.6 Comprobar en la misma prueba que no existe ninguna pantalla de conflicto y que la navegación no se bloquea durante los reintentos. Cubre *Ante ediciones desordenadas gana la última en llegar* → «No hay pantalla de conflicto» y *Los reintentos esperan cada vez más* → «Los reintentos no bloquean la interfaz».

## 9. Conflictos y bitácora

- [x] 9.1 Prueba de integración de última escritura gana: una edición encolada con hora antigua que llega después de otra más reciente deja el contenido de la encolada y ambos cambios en la bitácora. Cubre *Ante ediciones desordenadas…* → «Una edición encolada pisa a una más reciente», «El estado descartado es recuperable».
- [x] 9.2 Comprobar que `update_order` no necesitó ningún cambio para esto y dejarlo escrito donde corresponda: la regla ya la cumplía, lo que faltaba era la constancia. Queda escrito en la cabecera de `supabase/tests/order_conflict.test.sql`.

## 10. Cierre

- [x] 10.1 `npm run lint`, `npm run typecheck`, `npm run test:unit` y `npm run test:integration` en verde; cobertura mínima 90 % en `lib/offline/` (medida: 95,8 % de sentencias, 92,3 % de ramas, 97,1 % de líneas sobre `lib/offline/`, `stores/sync-store.ts` y `hooks/use-online-status.ts`).
- [x] 10.2 `supabase db reset` y `supabase test db` sin error.
- [x] 10.3 `next build && next start` y ejecutar `npm run test:e2e` contra la compilación de producción, que es el único modo en que el service worker se comporta como en producción.
- [x] 10.4 Regenerar el grafo con `graphify .` tras la migración (convención nº 6) y versionar `graphify-out/`.
- [x] 10.5 Verificar en el manifiesto y el service worker desplegados que un navegador compatible ofrece instalar la aplicación. Cubre *La aplicación es instalable…* → «El navegador ofrece instalarla».
- [x] 10.6 Revisar que ninguna ruta de escritura quedó duplicada: el formulario de pedido ya no llama a `createOrder` ni a `updateOrder` directamente, y el service worker no reenvía nada. Cubre «El service worker no duplica el reenvío».
