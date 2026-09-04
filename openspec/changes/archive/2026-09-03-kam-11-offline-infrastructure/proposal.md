# KAM-11 · Infraestructura sin conexión

## Why

Kamay ya sabe registrar pedidos (KAM-08), pero solo sabe hacerlo con señal. En el taller y sobre todo en el puesto de feria eso no es una degradación: es una pérdida. Una venta que no se pudo registrar porque el teléfono no tenía cobertura no se registra después —se olvida—, y la especificación funcional lo declara sin matices: *«sin conexión obligatorio en venta rápida, pedidos, gastos y creación de tareas»* y *«registrar debe sentirse instantáneo aun con mala señal»*. El riesgo «venta de feria no registrada por falta de señal» está catalogado como **alto** en la propia especificación, y su única mitigación declarada es esta.

Este cambio instala la infraestructura que faltaba —service worker, cola outbox durable y motor de reenvío— y la conecta al primer productor real, el alta y la edición de pedidos. No es una pantalla: es la garantía de que ninguna pantalla de registro pueda fallar por falta de red. KAM-12 (modo feria) depende de que esta pieza exista y funcione, y es la prueba crítica del proyecto.

El repositorio ya está preparado a medias para esto y conviene decirlo: la convención nº 9 exige llaves `uuid` generables en el cliente, `orders.occurred_at` lo fija el cliente desde KAM-07, y `orderFormSchema` ya viaja con `id` y `occurredAt` propios desde KAM-08. Lo que falta es dónde se guarda lo que todavía no se pudo enviar, y quién lo envía después.

> **Prerequisito declarado:** este cambio asume **KAM-08 · Alta y edición de pedidos** fusionado. Es su única dependencia: `create_order` y `update_order` son las operaciones que la cola reenvía.

## What Changes

### La aplicación se vuelve instalable y sobrevive sin red

- **Manifiesto** en `app/manifest.ts` (convención de archivo de esta versión de Next), con iconos de 192 y 512 px, `display: standalone` y `start_url: /`.
- **Service worker con Serwist**: precarga del cascarón de la aplicación y de los recursos estáticos, de modo que abrir la aplicación sin red muestre la interfaz en lugar del dinosaurio del navegador. Cabeceras propias para `/sw.js` (sin caché, `Content-Type` correcto, CSP estricta), como indica la guía de PWA de Next.
- **El service worker no reintenta escrituras.** No se usa Background Sync: no existe en Safari de iOS —el navegador del puesto de feria— y tener dos mecanismos reenviando la misma operación es la forma más segura de duplicarla. El reenvío vive en un único lugar, la cola.

### Una cola outbox durable en Dexie

- **`lib/offline/`**: base Dexie con una tabla `outbox` de entradas `{ id, seq, operation, payload, dependsOn, state, attempts, nextAttemptAt, lastError, enqueuedAt }`, y un **registro de operaciones** al que cada dominio aporta la suya. KAM-11 registra `order.create` y `order.update`; KAM-09, KAM-10 y KAM-12 registran las suyas en sus propios cambios sin tocar el motor.
- **Escritura encolada primero**: el formulario no llama a la Server Action, escribe en la cola y dispara el vaciado. Con red, el vaciado responde en el mismo gesto y la experiencia de KAM-08 no cambia —se navega al detalle con el número asignado—; sin red, se confirma igual y la entrada queda esperando.
- **Orden padre → hijo** garantizado por vaciado estrictamente secuencial en orden de encolado, más `dependsOn` para no enviar un hijo cuyo padre murió.
- **Reintento con espera creciente** y desorden aleatorio (1 s, 2 s, 4 s… con techo de 5 minutos), disparado por el evento `online`, por el arranque de la aplicación y por un temporizador.
- **Fallo transitorio y fallo definitivo son cosas distintas**: un error de red se reintenta; un rechazo del dominio o de permisos no se reintenta nunca —reintentarlo daría el mismo rechazo para siempre— y pasa a una bandeja visible donde la persona reintenta o descarta.
- **Deduplicación por `uuid`**: la entrada conserva su identificador entre reintentos, y la base ignora el segundo envío del mismo registro. Un reenvío tras una respuesta perdida no crea un pedido gemelo.

### La base de datos se vuelve idempotente y honesta con la hora

- **`create_order` gana `on conflict (id) do nothing`** en una migración nueva, con verificación posterior de que el pedido existente pertenece a la organización que lo reenvía. Es la red de seguridad que ARCHITECTURE.md ya anunciaba y la única defensa que cubre *todas* las rutas de escritura, no solo la de la cola.
- **`log_activity()` deja de fechar el evento de creación con la hora de sincronización**: cuando la tabla auditada tiene `occurred_at`, el evento `created` toma esa hora. La especificación funcional lo pide literalmente —«fecha y hora: del hecho real, no de la sincronización»— y sin esto la bitácora de una feria sin señal muestra veinte ventas a la misma hora, la de la reconexión.

### La persona ve siempre cuánto falta

- **Indicador persistente y no bloqueante** con el número de registros por sincronizar, en la barra superior de escritorio y en la inferior móvil. A cero, desaparece. Al tocarlo, abre la bandeja de sincronización.
- **Bandeja de sincronización**: lista de lo pendiente y de lo que falló, con la fecha real de cada registro y las acciones *Reintentar* y *Descartar*. Descartar pide confirmación y deja constancia; nada desaparece en silencio.
- **`useOnlineStatus`**, el hook transversal que ARCHITECTURE.md ya declaraba y que hasta ahora no existía.

### Conflictos

- **Última escritura gana**, que es lo que ya hace `update_order` sin proponérselo. Lo que este cambio añade es la constancia: la edición que llega tarde queda en la bitácora con su hora real, junto a la que pisó, de modo que el estado descartado sea recuperable leyendo el historial. No se inventa ningún concepto nuevo de conflicto (convención nº 11).

**Fuera de alcance** (copiado del backlog):
- Lectura sin conexión de reportes y listados históricos: solo se garantiza la **captura**.
- Sincronización bidireccional o resolución manual de conflictos.

Derivado de lo anterior y de las decisiones tomadas al proponer, tampoco entran:
- **La pantalla de feria y la venta rápida** (KAM-12), que consume esta infraestructura pero no se diseña aquí.
- **Las operaciones de egresos (KAM-09), cobros (KAM-10) y tareas (KAM-15)**: el registro de operaciones queda abierto y documentado, y cada cambio conecta la suya. Mantener KAM-11 sobre pedidos es lo que le permite aplicarse justo después de KAM-08, sin heredar bloqueos de orden de fusión.
- **Los adjuntos del pedido**: siguen exigiendo conexión. KAM-08 ya separó la subida del alta precisamente para que una imagen fallida no se lleve por delante el pedido; sin red, el pedido se guarda y la imagen se añade después desde la edición.
- **Notificaciones push**, aunque el service worker las habilite técnicamente: llegan en KAM-17.
- **La caché de datos leídos** —tablero, catálogo, contactos—: el cascarón se sirve sin red, los datos no.

**Supuestos registrados:**
1. **La sincronización ocurre con la aplicación abierta.** Sin Background Sync en iOS, no hay reenvío en segundo plano: al reconectar con la aplicación cerrada, nada se envía hasta que se vuelve a abrir. El criterio 5 del backlog —«al reabrirla siguen en la cola y se envían»— describe exactamente ese comportamiento, así que se toma como el contrato.
2. **`experimental.useOffline` de esta versión de Next no se activa.** Reintenta en memoria y no sobrevive a cerrar la aplicación, que es justo lo que el criterio 5 exige; y convierte una escritura fallida en una promesa pendiente para siempre, que la cola necesita observar como fallo. Queda anotado como complemento posible para las *lecturas* en un cambio futuro.
3. **El número visible del pedido no existe hasta sincronizar.** Lo asigna un trigger de la base. Un pedido registrado sin red se confirma y se muestra como *pendiente de sincronizar*, sin número, y lo obtiene al llegar al servidor.

## Capabilities

### New Capabilities

- `offline-capture`: la garantía de que registrar no depende de la red — aplicación instalable con cascarón servido por service worker, cola outbox durable en IndexedDB con vaciado secuencial padre → hijo, reintento con espera creciente, distinción entre fallo transitorio y definitivo con bandeja de recuperación, deduplicación por identificador generado en el cliente, hora del hecho fijada por el cliente y hora de llegada por el servidor, indicador persistente de pendientes, y última escritura gana con constancia en bitácora.

### Modified Capabilities

- `orders`: el alta pasa a ser idempotente —reenviar el mismo pedido no crea un segundo, ni consume un número nuevo, ni adopta un identificador de otra organización— y a poder completarse sin red, confirmando sin número visible hasta la sincronización; los adjuntos declaran explícitamente que exigen conexión y que no entran en la cola. La regla de última escritura gana no se repite aquí: vive una sola vez en `offline-capture`.
- `activity-log`: el evento `created` de una tabla con `occurred_at` se fecha con la hora real del hecho, no con la de la sincronización.

## Impact

- **Base de datos:** una migración nueva `YYYYMMDDHHMMSS_offline_sync.sql` con `create or replace function create_order(...)` —idempotente— y `create or replace function log_activity()` —fecha real en `created`—. No se toca ninguna tabla ni ninguna política. No se edita ninguna migración existente (convención nº 6). Prueba pgTAP en el mismo commit.
- **Código de aplicación:** `lib/offline/` (base Dexie, registro de operaciones, motor de vaciado, política de espera creciente); `hooks/use-online-status.ts`; `stores/sync-store.ts`; `components/layout/sync-indicator.tsx` y la bandeja de sincronización; `app/manifest.ts`; `app/sw.ts` y el registro del service worker en el layout raíz; conexión del formulario de pedido (`features/orders/`) a la cola en lugar de a la acción directa.
- **Configuración:** `next.config.ts` gana la integración de Serwist y las cabeceras de `/sw.js`; iconos en `public/`.
- **Dependencias nuevas:** `dexie` y `dexie-react-hooks`; `serwist` y `@serwist/next` (ambas ya previstas por ARCHITECTURE.md). Ninguna otra.
- **Pruebas:** unitarias sobre la cola (orden de envío, `dependsOn`, deduplicación, espera creciente, clasificación de errores, durabilidad); pgTAP (reenvío idempotente de `create_order`, aislamiento entre organizaciones ante un identificador ajeno, y `activity_log.occurred_at` igual al del registro); e2e `offline-capture.spec.ts` con la red desconectada desde Playwright —registrar sin red, recargar, reconectar, contar exactamente un pedido con su hora real—.
- **Riesgo de calendario:** el service worker solo se comporta como en producción con `next build && next start`; en CI la prueba e2e ya corre así, en local no. Queda anotado en el diseño.
- **Grafo:** regenerar `graphify .` tras la migración (convención nº 6).
