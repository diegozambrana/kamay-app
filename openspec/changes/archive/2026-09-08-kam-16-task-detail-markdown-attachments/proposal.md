# KAM-16 · Detalle de tarea, Markdown y adjuntos

## Why

Una tarea de taller no cabe en un título. «Set de 6 tazas artesanales» son dos semanas de modelado, secado, primera quema, esmaltado y segunda quema, con fotos del avance, la ficha del esmalte y el número del proveedor. Hoy ese contexto vive fuera de Kamay —en el cuaderno, en el chat, en la cabeza de quien la empezó— y cuando la tarea vuelve de *En revisión* a *Por hacer* nadie recuerda por qué.

KAM-15 dará la tarea y su tablero: título, línea, estado, responsable, fecha límite. Lo que no dará es **dónde vive el trabajo**. Este cambio construye V18: un cuerpo en Markdown con listas de verificación que se marcan y se guardan, adjuntos que se arrastran y se comprimen solos, y el historial de lo que pasó ahí, leído de la bitácora y de ningún otro lado.

La ambición se mide en lo que evita: que alguien tenga que abrir otra herramienta para anotar cinco pasos y pegar dos fotos.

> **Posición en la secuencia.** El backlog sitúa a KAM-16 después de KAM-15, y **KAM-15 ya está implementada**: la migración `20260907120000_tasks.sql` creó `tasks` —con `body_markdown` incluida—, `actions/tasks.ts`, `services/tasks/task-service.ts` y `lib/tasks/`, y el tablero V17 vive en `features/tasks/board/`. La ruta `app/(app)/tasks/[id]/` quedó libre a propósito para esta tarea. La condición de arranque de `tasks.md` sigue siendo verificar ese estado antes de empezar. Ver los supuestos registrados al final.

> **Buena parte de los adjuntos ya está construida.** La tabla `attachments` —con `entity_type = 'task'` ya en su `check`—, los cuatro buckets privados y las tres políticas de Storage entraron con KAM-06b (`20260826180000_attachments.sql`); la compresión en el navegador (`lib/attachments/compress-image.ts`) y la subida en segundo plano (`features/expenses/receipt-upload-store.ts`) entraron con KAM-09. KAM-16 **reutiliza todo eso** en vez de reespecificarlo: lo nuevo es el uso desde la tarea, el límite por tarea y la verificación de aislamiento entre organizaciones sobre `storage.objects`, que hoy no está probada.

## What Changes

### V18 · Detalle de tarea (nueva pantalla en `/tasks/[id]`)

- **Página con dirección propia**, no un panel: la tarea es un destino al que se llega desde el tablero (V17), desde una notificación, desde un ítem del catálogo o desde un contacto, y una dirección compartible es lo que hace que esos enlaces existan. En móvil ocupa la pantalla completa, sin barra inferior, como el resto de la captura larga.
- **Cabecera editable**: título, estado, línea, responsable, fecha límite, recordatorio y etiquetas. Los campos del modelo que KAM-15 crea; esta pantalla los edita, no los define.
- **Guardado por campo, no por formulario**: una tarea se toca muchas veces al día por un solo dato. Un botón *Guardar* al pie obligaría a bajar hasta él para cambiar un responsable.

### Cuerpo en Markdown

- **Editor con barra de herramientas mínima**: negrita, cursiva, lista, lista de verificación, enlace, encabezado. Quien no sabe qué es Markdown aplica formato desde botones; quien lo sabe escribe la sintaxis directamente.
- **Dos pestañas, Escribir y Vista previa**, como en el diseño de V18.
- **Solo Markdown, y saneado al rendir**: el cuerpo se guarda tal cual se escribe. El HTML escrito a mano **no se interpreta** —`<script>`, `<iframe>` y `<img onerror=…>` no llegan al documento—, y sobre ese resultado `rehype-sanitize` desactiva además los destinos peligrosos de los enlaces, como `javascript:`. Las dos defensas actúan en cada lectura, no solo en la vista previa.
- **Listas de verificación funcionales**: un `- [ ]` en el cuerpo se rinde como casilla marcable; marcarla reescribe esa línea a `- [x]` en `body_markdown` y guarda. El estado de la casilla **no se almacena aparte**: el Markdown es la única fuente (convención nº 4).

### Adjuntos en la tarea

- **Zona de arrastre** sobre la lista de adjuntos, con alternativa de *elegir del equipo* para quien no arrastra.
- **Las imágenes se comprimen en el navegador** antes de subir, reutilizando `compressImage`; los archivos que no son imagen suben tal cual y se rechazan si pasan de 5 MB.
- **Suben en segundo plano**: mientras un adjunto viaja, el resto de la tarea —título, cuerpo, estado, responsable— sigue editable, y cada adjunto en vuelo se ve como tal.
- **Miniatura para las imágenes**, ficha con nombre, peso y autor para lo demás, cada uno con su URL firmada.
- **Límite de 15 adjuntos vigentes por tarea**, con mensaje claro al intentar el decimosexto; quitar uno lo archiva, nunca lo borra, y libera ranura.

### Historial de la tarea

- **Bloque al pie que lee de `activity_log`** filtrado por `table_name = 'tasks'` y el `record_id` de la tarea, con el mismo patrón de `OrderService.history()`. **No se crea ninguna segunda tabla de historial** (convención nº 7).
- **Para el ayudante el bloque queda vacío**, porque RLS reserva la bitácora al dueño; se rinde su mensaje de lista sin contenido, no un error.

**Fuera de alcance** (copiado del backlog):
- Vínculos y entregables (KAM-21).
- Edición colaborativa simultánea, comentarios, menciones.
- Previsualización de PDF dentro de la aplicación.

Derivado de lo anterior, tampoco entran: la tabla `tasks`, el tablero V17 y el alta de tarea —los construye KAM-15, y este cambio los presupone—; el cierre con entregables V19 (KAM-21); *Mis pendientes*, los recordatorios y los avisos (KAM-17), pese a que `remind_at` se edite aquí; la tabla `attachments`, los buckets y sus políticas de Storage, ya instalados por KAM-06b; y la sección *Vínculos* del diseño de V18, que se deja fuera con su ranura sin pintar hasta KAM-21.

## Capabilities

### New Capabilities

- `task-detail`: la pantalla V18 —cabecera editable con guardado por campo, cuerpo en Markdown con editor, vista previa saneada y listas de verificación que persisten, adjuntos arrastrables con compresión, subida en segundo plano y límite por tarea, y el bloque de historial leído de la bitácora—.

### Modified Capabilities

Ninguna. El destino *Tarea* de la retícula de registro rápido, que `quick-capture` declara hoy como no accionable, lo enciende KAM-15 junto con el alta de tarea que ese destino abre; KAM-16 no toca esa capacidad (supuesto 2).

## Impact

**Código afectado**

- `app/(app)/tasks/[id]/page.tsx` — página nueva: carga la tarea, sus adjuntos firmados y su historial, y rinde V18.
- `features/tasks/detail/` — cabecera, campos con guardado propio y composición de la pantalla (rebanada nueva; `features/tasks/board/` es de KAM-15).
- `features/tasks/editor/` — editor Markdown, barra de herramientas, pestañas y vista previa saneada.
- `features/tasks/attachments/` — zona de arrastre, miniaturas y store de subida en segundo plano por tarea.
- `actions/tasks.ts` — acciones de actualización de campo, alternar casilla, adjuntar y retirar adjunto. **Lo crea KAM-15**; este cambio le añade las suyas.
- `services/tasks/task-service.ts` — lectura del detalle e `history()`. **Lo crea KAM-15**; este cambio le añade lo que falte.
- `lib/markdown/` — saneado y utilidades de casillas (`toggleChecklistItem`), en `lib/` por ser lógica pura y cubrible al 90 %.
- `components/layout/mobile-nav.tsx` — `/tasks/[id]` se suma a las rutas de pantalla completa móvil.

**Se lee pero no se modifica:** `services/catalog/attachment-service.ts`, `lib/attachments/compress-image.ts` y `lib/catalog/photos.ts`, que ya resuelven ruta, subida, archivado, firma y compresión; `features/expenses/receipt-upload-store.ts`, como patrón del store de subida —el de tareas es de varios archivos por registro, no de uno—.

**Base de datos:** **ninguna migración**. `attachments` ya admite `entity_type = 'task'`, los cuatro buckets y sus políticas ya existen desde KAM-06b, y `tasks.body_markdown` llega con KAM-15. Este cambio no crea ni altera ninguna tabla, vista, índice o política.

**Dependencias nuevas:** `react-markdown`, `remark-gfm` (listas de verificación y tablas) y `rehype-sanitize` (exigido por el backlog).

**Pruebas:** unitarias sobre el saneado del Markdown, el alternado de casillas, la elección de compresión y los límites; integración pgTAP sobre las políticas de `storage.objects` entre organizaciones —hoy sin cubrir— y sobre los adjuntos con `entity_type = 'task'`; e2e sobre editar el cuerpo, marcar una casilla y adjuntar una imagen.

**Dependencia de secuencia:** KAM-15 debe estar fusionado antes de implementar este cambio. `tasks.md` abre con esa verificación.

## Supuestos registrados

1. **El límite de 15 adjuntos es una constante del código, no una preferencia de la organización.** El backlog dice «el límite configurado» sin decir dónde se configura, y V15 no tiene ninguna sección de límites. El proyecto ya resolvió el mismo caso así en pedidos —`orders` fija «hasta 20 por pedido y 5 MB por archivo» sin columna ni pantalla—, y añadir una preferencia obligaría a tocar la configuración de la organización, que está fuera de alcance. Se declara en `lib/` junto al resto de constantes de adjuntos.

2. **El destino *Tarea* de V16 lo enciende KAM-15, no KAM-16. — CONFIRMADO.** `quick-capture` lo dejó inerte esperando «KAM-16», pero el mapa de navegación dice que ese botón abre «V18 o diálogo» y el alta rápida de tarea —título y línea bastan— pertenece a KAM-15. KAM-15 ya se implementó y lo encendió: el destino apunta a `/tasks/new`, y su delta de `quick-capture` deja solo Consumo como pendiente. **KAM-16 no toca esa capacidad.**


3. **Lo que KAM-16 sustituye al llegar es un panel, no una página.** KAM-15 dejó `app/(app)/tasks/[id]/` sin crear a propósito, tal como esta propuesta pedía. La edición de responsable, fecha límite y etiquetas vive mientras tanto en `features/tasks/board/task-sheet.tsx`, un `Sheet` que abre la tarjeta del tablero. Al construir V18, la tarjeta pasa a enlazar a `/tasks/[id]` y ese panel se retira —o se conserva para el móvil, si al implementarlo se ve que ahí sigue teniendo sentido—. Lo que **no** hay que rehacer: `tasks`, `actions/tasks.ts`, `services/tasks/task-service.ts` y `lib/tasks/`, todos creados por KAM-15 con `body_markdown` ya en la tabla.

4. **El cuerpo se guarda crudo y se sanea al rendirlo.** Sanear al guardar destruiría lo que el usuario escribió y haría irreversible un falso positivo; sanear al rendir mantiene el original intacto y protege cada lectura, incluida la de un cuerpo escrito antes de que el saneado existiera. El criterio de aceptación exige que no se ejecuten, no que no se guarden.

5. **Marcar una casilla es una escritura sobre `body_markdown`.** No hay tabla de ítems de lista de verificación en el esquema, y no se inventa ninguna: el Markdown es el dato (convención nº 11). El alternado reescribe únicamente la línea de esa casilla, para no pisar una edición simultánea del resto del cuerpo.

6. **Los adjuntos de tarea exigen conexión**, igual que los de pedido (`orders`). No entran en la cola de captura sin conexión: sin red la zona de arrastre lo informa y el resto de la tarea sigue editable y guardable.

7. **La sección *Vínculos* del diseño de V18 no se pinta.** El backlog la reserva a KAM-21. Se deja sin ranura en lugar de pintarla inerte, a diferencia de lo que hizo `quick-capture` con su retícula: allí la disposición de seis botones había que verificarla completa en 390 px; aquí una sección vacía solo ocuparía pantalla sin nada que verificar.
