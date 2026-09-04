## Context

Ver `proposal.md` — Why. Lo que condiciona el diseño es el estado del repositorio, de la plataforma y de los cambios hermanos:

- **La mitad del contrato ya está cumplida.** `orderFormSchema` viaja con `id` y `occurredAt` generados en el cliente desde KAM-08, `create_order` acepta ese `id` (`coalesce(nullif(p_order->>'id',''), gen_random_uuid())`) y `orders.occurred_at` lo fija el cliente desde KAM-07. Lo que no existe es dónde se guarda lo que no se pudo enviar.
- **`create_order` no es idempotente.** Su `insert into orders ... values` sin `on conflict` levanta `unique_violation` en el segundo envío del mismo `uuid`. ARCHITECTURE.md ya anunciaba la red de seguridad (`on conflict do nothing`), pero no está escrita.
- **`code` lo asigna un trigger de la base.** Un pedido registrado sin red no tiene número hasta llegar al servidor, y KAM-08 construyó «Guardar y crear otro» alrededor de anunciar ese número. Es la fricción real de este cambio, no la cola.
- **`log_activity()` fecha el evento con `now()`.** Veinte ventas de feria sincronizadas juntas aparecerían en la bitácora a la misma hora, contra lo que pide la especificación funcional.
- **Esta versión de Next trae `experimental.useOffline` y `useOffline()` de `next/offline`** (`node_modules/next/dist/docs/01-app/02-guides/offline-support.md`): con el flag activo, una Server Action fallida por falta de red **no rechaza**, se queda pendiente y se reintenta sola al volver la conexión. Es reintento en memoria: no sobrevive a cerrar la aplicación. Su guía de PWA (`.../progressive-web-apps.md`) confirma el manifiesto como `app/manifest.ts`, las cabeceras de `/sw.js` y señala Serwist —con ejemplo para Turbopack— como la vía para la caché por service worker.
- **No hay Background Sync en Safari de iOS**, que es el navegador del puesto de feria.
- **Cambios hermanos en curso:** KAM-12 (modo feria) declara su venta directa como *encolable* y con su propio indicador de pendientes; KAM-10 deja `payments` preparada para escribirse desde la cola. Ambos consumirán este motor sin modificarlo.

## Goals / Non-Goals

**Goals:**

- Que exista **una sola** ruta de escritura para las operaciones cubiertas y **un solo** mecanismo de reenvío, para que ningún registro pueda enviarse dos veces por dos caminos distintos.
- Que la garantía de «no duplicar» no dependa del cliente: el cliente puede perder la respuesta, reiniciarse o reintentar de más, y la base sigue teniendo un solo pedido.
- Que conectar un dominio nuevo a la cola cueste registrar una operación, no tocar el motor: KAM-09, KAM-10, KAM-12 y KAM-15 entran sin abrir `lib/offline/`.
- Que la experiencia **con** conexión no se degrade: el mismo gesto, el mismo destino, el mismo número anunciado.
- Que ningún registro pueda quedar retenido sin que la persona lo vea y pueda actuar.

**Non-Goals:**

- No se diseña la pantalla de feria (KAM-12) ni el registro rápido (KAM-13), aunque ambos se apoyen en esto.
- No se diseña caché de lectura: el cascarón se sirve sin red, los datos no. Un tablero abierto sin conexión muestra su estado vacío, no datos viejos.
- No se diseña reenvío con la aplicación cerrada. Ver decisión 2.

## Decisions

### 1. La cola guarda la intención, no la petición

Cada entrada de `outbox` guarda `{ id, seq, operation, payload, organizationId, userId, dependsOn, state, attempts, nextAttemptAt, lastError, enqueuedAt }`. `operation` es una clave de un **registro de operaciones** (`registerOperation('order.create', { send, describe })`), y `payload` es el objeto ya validado por Zod que la Server Action espera. El reenvío es volver a llamar a la misma Server Action con el mismo `payload`.

*Alternativa descartada:* guardar el `Request` serializado —cuerpo, cabeceras y URL de la invocación de Server Action— y reproducirlo con `fetch`. Se descarta porque el protocolo de invocación de Server Actions no es una API pública ni estable: el identificador de acción cambia entre compilaciones, y una entrada encolada antes de un despliegue quedaría apuntando a una acción que ya no existe. Guardando la intención, un despliegue nuevo la reenvía con el código nuevo.

**Consecuencia deliberada:** el `payload` tiene que ser serializable y estable en el tiempo. Nada de `File`, `Date` ni instancias de clase: fechas como cadenas ISO, y por eso los adjuntos quedan fuera (proposal.md, fuera de alcance).

### 2. El reenvío vive solo en la aplicación, no en el service worker

El service worker de Serwist precarga el cascarón y sirve navegaciones; **no** intercepta ni reintenta ninguna escritura, y no se usa Background Sync.

*Alternativa descartada:* Background Sync, que reenviaría con la aplicación cerrada. Se descarta por dos razones que se refuerzan: no existe en Safari de iOS, que es exactamente el dispositivo del puesto de feria, y tenerlo solo en Android significaría dos mecanismos de reenvío con dos políticas de reintento sobre las mismas entradas —la forma más fiable de duplicar un registro justo cuando la respuesta se pierde—. El criterio 5 del backlog («al reabrirla siguen en la cola y se envían») describe el comportamiento sin Background Sync, así que se toma como el contrato y se escribe en la especificación.

**Lo que el service worker intercepta, comprobado en la implementación.** Ni `defaultCache` de `@serwist/next` ni una ruta comodín. Solo dos cosas: los recursos de `/_next/static/` —que llevan su huella en el nombre— y las navegaciones, y estas últimas únicamente para poder responder con `/offline` cuando no hay red. Todo lo demás queda **fuera** del service worker: sin ruta que la empareje, la petición la resuelve el navegador como si no hubiera service worker.

Las dos razones son distintas y las dos son firmes. La primera es de producto: `defaultCache` guarda documentos y cargas RSC, de modo que un tablero podría servirse desde caché mostrando un estado que ya no existe, y quien lo mira no tiene forma de saberlo — este cambio garantiza la captura, no la lectura sin conexión. La segunda es un fallo real que apareció al ejecutar la suite de extremo a extremo: una ruta comodín que reenvía todo con `fetch(request)` **rompe las subidas `multipart` de las Server Actions**, que viajan como flujo; la prueba de la foto del catálogo (KAM-06) fallaba de forma reproducible con la ruta comodín y pasa sin ella.

*Alternativa descartada:* usar `defaultCache` y añadir excepciones para Supabase y para las escrituras. Es lo que se escribió primero y es el orden equivocado: obliga a acertar con la lista de excepciones, y lo que se olvide se cachea en silencio. Partiendo de «nada se intercepta» hay que acertar con la lista de lo que sí, y lo que se olvide simplemente va a la red.

### 3. Se encola primero y se espera un poco, en vez de intentar y caer a la cola

El formulario **nunca** llama a la Server Action. Escribe la entrada en Dexie, dispara el vaciado y espera su resultado durante un plazo corto (~2,5 s, y cero si el dispositivo se declara sin red). Si el vaciado responde dentro del plazo, la interfaz se comporta como hoy: navega al detalle con el número asignado. Si no, confirma igualmente y deja el resto a la cola.

*Alternativa descartada A:* intentar la acción directamente y encolar solo si falla. Es lo primero que uno escribe, y tiene un agujero: entre que la escritura se commitea en el servidor y la respuesta llega al dispositivo hay una ventana en la que el fallo es indistinguible de «no llegó». Al caer a la cola se reenvía algo ya guardado. El agujero se tapa igual con la idempotencia de la decisión 5, pero además obliga a mantener dos caminos de escritura con dos manejos de error.

*Alternativa descartada B:* encolar y no esperar nunca. Es la más limpia, y estropea la experiencia con conexión: KAM-08 anuncia el número del pedido al guardar y ese número solo existe tras el viaje al servidor. Confirmar sin número a alguien que tiene cobertura sería una regresión visible.

El plazo corto es un compromiso explícito: no es un tiempo de espera de red —el envío sigue vivo cuando el plazo vence—, es cuánto está dispuesta la interfaz a esperar antes de dar por buena la captura.

### 4. `experimental.useOffline` se queda apagado en este cambio

*Alternativa descartada:* activarlo y apoyar el reenvío en él. Encaja mal por tres motivos, y basta el primero: reintenta en memoria y no sobrevive a cerrar la aplicación, que es literalmente el criterio 5. Además convierte una Server Action fallida en una promesa que nunca rechaza, con lo que el vaciado de la decisión 3 no podría distinguir «tardando» de «sin red» ni aplicar su propia espera creciente. Y es una función marcada como experimental en la propia documentación de la versión: apoyar en ella la garantía central del producto sería apostar la feria a una API en movimiento.

Queda anotado que su terreno natural es el complementario —las **lecturas** y las navegaciones, donde una promesa pendiente es exactamente lo que se quiere—, y que puede evaluarse en KAM-12 o KAM-14 sin tocar nada de lo que aquí se decide. La señal de conectividad de este cambio, mientras tanto, es `useOnlineStatus` sobre los eventos `online`/`offline` más el propio resultado del último envío: `navigator.onLine` miente en WiFi sin salida, y un envío que acaba de fallar por red es mejor evidencia que cualquier bandera del sistema operativo.

### 5. La no duplicación se garantiza en la base, no en el cliente

`create_order` se redefine en una migración nueva con `on conflict (id) do nothing` en el pedido y en cada línea, y devuelve `v_id` en ambos casos. Después del `insert`, la función comprueba que el pedido con ese `id` es de `v_org`; si no lo es, levanta `insufficient_privilege`.

*Alternativa descartada:* que la cola marque la entrada como enviada antes de recibir la respuesta, o que compruebe con una lectura si el pedido ya existe antes de reintentar. Lo primero pierde registros cuando el envío falla de verdad; lo segundo añade un viaje de red que también puede fallar, y sigue teniendo la misma ventana entre la lectura y la escritura. La idempotencia en la base es la única que cierra la ventana, y además cubre las rutas que no pasan por la cola: la semilla, las pruebas y cualquier cliente futuro.

La comprobación de organización no es teórica ni es paranoia sobre colisiones de `uuid` v4: sin ella, `on conflict do nothing` convertiría un identificador ajeno en un «ya existe, todo bien» silencioso, y la persona vería un pedido que no es suyo o un error incomprensible. Con ella, el rechazo es explícito y la prueba pgTAP lo fija.

**Las líneas también llevan `on conflict do nothing`**, aunque el reenvío de un alta ya guardada no llegue a insertarlas: el `insert` del pedido no falla, simplemente no inserta, y el bucle de líneas se ejecuta igual. Sin la cláusula, el reenvío moriría en la primera línea.

### 6. La bitácora toma la hora del registro cuando el registro la tiene

`log_activity()` se redefine para que, en `INSERT`, `occurred_at` del evento sea `coalesce((to_jsonb(new)->>'occurred_at')::timestamptz, now())`. Genérico: sirve para `orders` hoy y para `payments` y las ventas de feria mañana, sin tocar la función otra vez.

*Alternativa descartada:* añadir una columna `synced_at` a la bitácora, o un tipo de evento `synced`. Se descarta por la convención nº 11 —ningún concepto nuevo que no esté en el modelo conceptual— y porque el dato ya existe: `created_at` de la fila es la hora de llegada. La bitácora responde «cuándo pasó»; el registro responde «cuándo llegó».

**Solo el evento `created`.** Para `updated`, `archived` y `status_changed` no hay ninguna columna que lleve la hora real del gesto —`updated_at` lo pone el servidor al recibirlo—, así que inventar una haría mentir a la bitácora en la dirección contraria. Se deja `now()` y se escribe en la especificación.

**Cuidado con la fusión de ruido.** La consolidación de ediciones sucesivas busca eventos con `occurred_at > now() - interval '5 minutes'` y solo aplica a `updated`, que conserva `now()`. Un evento `created` fechado en el pasado no entra en esa ventana ni la altera. Queda comprobado por prueba.

### 7. Vaciado estrictamente secuencial, con `dependsOn` para lo que no debe salir

Un único vaciado activo a la vez, en orden de `seq` autoincremental, una entrada por vez. El orden padre → hijo sale gratis: el padre se encoló antes. `dependsOn` no ordena —eso ya lo hace `seq`—; sirve para **retener**: si una entrada acaba en `failed`, sus dependientes pasan a `blocked` y no se envían nunca solos.

*Alternativa descartada:* enviar en paralelo con un grafo de dependencias. Más rápido con veinte ventas encoladas, y no hace falta: veinte inserciones secuenciales sobre una conexión recuperada tardan menos que el gesto de guardar el teléfono en el bolsillo, y el orden serie es lo único que hace la reproducción determinista y depurable. Si algún día el volumen lo pide, el paralelismo se añade sin cambiar el modelo de datos de la cola.

**El vaciado tiene un candado**, para que el temporizador, el evento `online` y el arranque no lo ejecuten tres veces a la vez sobre la misma entrada.

### 8. Fallo transitorio y fallo definitivo se distinguen por la forma de la respuesta

Las Server Actions de este proyecto devuelven `{ error: string }` para un rechazo del dominio y **lanzan** cuando la red falla. Esa diferencia es la clasificación:

- La promesa **rechaza** (`TypeError: Failed to fetch`, aborto, tiempo agotado) → transitorio: se reintenta con espera creciente (1 s, 2 s, 4 s… hasta 5 minutos, con desorden aleatorio para no sincronizar a todos los dispositivos de una feria en el mismo instante).
- La promesa **resuelve con `{ error }`** → definitivo: la entrada pasa a `failed` y aparece en la bandeja. Reintentar un rechazo por contenido, por permisos o por sesión terminada daría el mismo rechazo para siempre.
- Un tope de intentos (8) convierte lo transitorio en definitivo, para que una entrada rota no reintente en silencio durante días.

*Alternativa descartada:* reintentarlo todo. Es lo que hace que una cola se atasque para siempre en su primera entrada envenenada y que las demás nunca salgan, que es justo lo que el criterio 6 del backlog prohíbe.

**«Sesión terminada» es el caso incómodo:** es definitivo para el intento actual pero se cura solo con volver a entrar. Se trata como definitivo y se muestra en la bandeja con su mensaje —«tu sesión terminó, vuelve a entrar y reintenta»— y el botón de reintentar, que es lo que ya devuelven las acciones hoy (`NO_SESSION`). Al reintentar con sesión válida, la entrada sale sin haberse tocado.

### 9. La cola lleva organización y persona, y no se envía sin que coincidan

`organizationId` y `userId` se graban al encolar. El vaciado compara con la sesión activa: si no coinciden, la entrada no se envía y se muestra retenida.

*Alternativa descartada:* mandar la organización en el `payload` y dejar que la acción decida. No sirve: las acciones toman la organización del **contexto de sesión**, deliberadamente (convención nº 2), así que un pedido encolado en la organización A se guardaría en la B sin que nada lo impidiera —RLS incluida, porque la sesión sí tiene permiso sobre B—. Es el único agujero de aislamiento que abre esta funcionalidad y se cierra en el cliente porque es donde se abre.

Cerrar sesión **no** vacía la cola: los datos son de la persona, no de la sesión. IndexedDB es por origen, así que una base compartida en un dispositivo compartido es exactamente el escenario que esta decisión cubre.

### 10. Un pedido sin número se presenta como pendiente, no con un número falso

El pedido encolado no tiene `code`. La confirmación dice «Pedido guardado · pendiente de sincronizar» en lugar de «Pedido #142 guardado», y «Guardar» sin conexión **no navega a ninguna parte**: se queda en el formulario, ya limpio y listo para el siguiente, con esa confirmación a la vista.

*Ajustado durante la implementación.* La idea inicial era «volver al origen», y no se sostiene: sin red, `/orders` tampoco se puede servir —el tablero es una ruta dinámica—, así que volver atrás cambiaría un guardado correcto por una pantalla de error. Quedarse es además lo que quiere quien está registrando en serie, que es exactamente el escenario sin conexión.

*Alternativa descartada:* asignar un número provisional en el cliente y reconciliarlo después. Se descarta sin dudarlo: el número visible es lo que la gente dice en voz alta y escribe en la etiqueta del paquete. Dos pedidos con el mismo «#143» provisional en dos teléfonos de la misma feria es un daño mucho peor que la ausencia temporal de número. La numeración se queda donde ya está, en el trigger de la base, que es el único que puede garantizar unicidad por organización.

### 11. El indicador se alimenta de la cola, no de un contador propio

`SyncStore` (Zustand) refleja lo que hay en Dexie mediante `useLiveQuery`, y `components/layout/sync-indicator.tsx` lo pinta en la cabecera de escritorio y en la barra inferior móvil del grupo `(app)`. El modo feria de KAM-12 reutiliza el mismo componente en su propio cascarón.

*Alternativa descartada:* un contador incrementado y decrementado por quien encola y por quien envía. Se desincroniza a la primera pestaña duplicada o al primer recargado a mitad de vaciado, y entonces el indicador —cuya única función es que la persona confíe en que nada se perdió— pasa a ser exactamente lo contrario. Que la única fuente sea la tabla hace imposible esa clase de error.

## Risks / Trade-offs

- **Sin reenvío con la aplicación cerrada.** Alguien que registra veinte ventas sin señal, cierra la aplicación y guarda el teléfono no sincroniza al recuperar cobertura hasta volver a abrirla. → Es una limitación de plataforma, no una decisión evitable (decisión 2). Se mitiga siendo explícitos: el indicador es persistente y no llega a cero hasta que todo salió, y la especificación lo fija como comportamiento esperado en lugar de dejarlo como sorpresa.
- **Almacenamiento del navegador desalojable.** iOS puede purgar IndexedDB de sitios no instalados tras semanas sin uso. → El manifiesto y la instalación en pantalla de inicio son parte de este cambio precisamente porque una aplicación instalada tiene almacenamiento persistente; además se solicita `navigator.storage.persist()` al arrancar con entradas pendientes.
- **Dos cambios hermanos modifican el mismo requisito.** KAM-12 también redefine *El alta es una sola operación y el estado inicial lo asigna la base* (exclusividad de `kind`), y KAM-11 le añade la idempotencia. → Son párrafos distintos del mismo requisito y no se contradicen, pero el segundo en archivarse tiene que rebasar su delta sobre el resultado del primero, no sobre el texto de KAM-08. Anotado aquí para que la revisión lo vea antes que el archivado.
- **El plazo corto de la decisión 3 hace que una red muy lenta se comporte como una red caída.** Alguien con cobertura pésima verá «pendiente de sincronizar» aunque el pedido llegue dos segundos después. → Es el comportamiento correcto para el producto —confirmar rápido y no bloquear— y el indicador lo resuelve solo en segundos. El plazo es una constante en un único sitio, ajustable con una prueba que lo cubre.
- **El service worker solo se comporta como en producción con `next build && next start`.** En desarrollo, Serwist se deshabilita o sirve un service worker distinto, y `npm run test:e2e` en local levanta `next dev`. → La prueba de captura sin conexión se escribe para no depender de la caché del service worker —desconecta la red **después** de tener la pantalla cargada— de modo que valga en ambos modos; lo que sí exige producción (abrir la aplicación sin red desde cero) se marca para el proyecto de CI, que ya corre contra `npm run start`.
- **Un service worker mal invalidado sirve una versión vieja de la aplicación durante días.** Es el fallo clásico de las PWA y aquí sería grave: código viejo escribiendo en una cola cuyo formato cambió. → Cabeceras `no-store` para `/sw.js` como indica la guía de Next, `skipWaiting` con reclamo de clientes, y una versión de esquema en la base Dexie que, al no coincidir, retiene las entradas y avisa en lugar de enviarlas mal interpretadas.
- **La cola es un formato de datos con vida propia entre despliegues.** Una entrada encolada hoy puede reenviarse tras un despliegue que cambió el `payload` esperado. → `operation` incluye versión implícita en su clave y el registro rechaza como definitiva cualquier operación desconocida, que acaba en la bandeja en vez de perderse. Cambiar la forma de un `payload` obliga a registrar una clave nueva; queda escrito en `lib/offline/README` para quien conecte el siguiente dominio.
- **`create or replace function log_activity()` toca la función más transversal del sistema.** Un error ahí rompe la escritura de todas las tablas auditadas. → El cambio es de una sola expresión, la migración lleva su prueba pgTAP en el mismo commit, y las pruebas existentes de bitácora (KAM-03) siguen siendo el arnés de regresión.

## Migration Plan

1. **Requisito previo:** KAM-08 fusionado. No hay ningún otro.
2. Dependencias: `dexie`, `dexie-react-hooks`, `serwist`, `@serwist/next`.
3. Migración nueva `YYYYMMDDHHMMSS_offline_sync.sql`, en este orden: `create or replace function create_order(jsonb, jsonb)` con `on conflict do nothing` y comprobación de organización → `create or replace function log_activity()` con la hora real en `created`. Ninguna tabla, ninguna política, ningún `grant` cambian: las funciones conservan su firma exacta, así que los `grant execute` de KAM-08 siguen vigentes.
4. Su prueba pgTAP en el mismo commit (convención nº 6).
5. `supabase db reset`, `supabase test db`, `npm run test:unit`, `next build && next start` para probar el service worker, `npm run test:e2e`, y `graphify .` para regenerar el grafo.
6. **Rollback:** la migración solo redefine dos funciones y ambas son compatibles hacia atrás —un cliente sin cola sigue llamando a `create_order` igual—. Revertir exige una migración nueva que reponga las dos definiciones anteriores. El código de cliente se revierte con el despliegue; lo único que no se recupera es lo que quedara en la cola de un dispositivo, que seguiría ahí hasta que se vuelva a desplegar una versión que sepa vaciarla.
7. **Orden con los cambios hermanos:** independiente de KAM-09 y KAM-10. KAM-12 **depende** de este: si se aplicaran a la vez, KAM-11 va primero.
