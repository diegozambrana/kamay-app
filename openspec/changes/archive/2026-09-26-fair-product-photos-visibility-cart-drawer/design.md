## Context

La venta rápida (V6, KAM-12) funciona así hoy:

- `app/(fair)/fair/page.tsx` pide el catálogo con `FairSaleService.listSellableProducts`, que filtra `items` (producto, sin archivar, con precio, de la línea o compartido) y ordena en memoria con `best_selling_products`.
- `FairScreen` guarda ese catálogo con `useFairSessionStore.start` en un snapshot de Dexie (`kamay-outbox`, tabla `fairSnapshots`, versión 2), y lo rescata con `restore` si se abre sin red. El snapshot guarda por producto `{ id, name, salePrice, quantitySold }`.
- `ProductGrid` agrega al carrito con un toque (`cart.add`, +1). `CartBar` lista las líneas y ofrece *Cobrar*. `CheckoutSheet` (hoja inferior) propone el total, pide el método y confirma. `confirm()` vacía el carrito y cierra la hoja **antes** de `await captureSale` (decisión 6 de KAM-12). Si falla, se muestra un `role="alert"`.
- Las fotos de ítem son `attachments` con `entity_type = 'item'` en el bucket privado `item-photos`, con una miniatura derivada (`thumbnailPath`). `AttachmentService.signedThumbnailUrls` firma en lote con un TTL de 1 h y prefiere la miniatura. El catálogo (V10) ya resuelve «la foto vigente es la más reciente» con `listForEntities` + `signedThumbnailUrls`.
- `items` no tiene ningún indicador de visibilidad. `archived_at` retira el ítem de todos los listados, por eso no sirve para esto.
- No hay librería de toasts en el proyecto (`components/ui` no tiene `sonner`).
- Hay sesiones hermanas en `.claude/worktrees/*` con migraciones `20260922100000_*` y `20260922110000_*`.

## Goals / Non-Goals

**Goals:**
- Un solo punto de verdad para «qué productos van a la feria»: la consulta de `FairSaleService`.
- Imágenes que sobreviven horas sin señal, sin tocar la regla de KAM-11 de no cachear rutas ni respuestas de negocio en el service worker.
- Mantener intactos `create_direct_sale`, el sobre de venta (`buildSaleEnvelope`) y el formato de la cola (`OUTBOX_SCHEMA_VERSION` no cambia).

**Non-Goals:**
- Reescribir la cola, la sincronización o el paso de inicio (`FairStart`).
- Añadir una librería de notificaciones para toda la aplicación.

## Decisions

### 1. `items.show_in_fair boolean not null default true`, no un `is_active` genérico

La columna nombra exactamente lo que controla. Con `default true`, al aplicar la migración ninguna feria se vacía y los productos nuevos aparecen solos (el mismo motivo por el que KAM-12 parte del catálogo y no de la vista de más vendidos). Un `is_active` genérico competiría con `archived_at` y dejaría abierta la pregunta de qué significa «inactivo pero no archivado» en pedidos y reportes.

- `add column ... not null default true` en Postgres 11+ no reescribe la tabla y no dispara el trigger de bitácora, así que la bitácora no registra una edición por cada ítem, como pide el escenario.
- Para insumos y activos, la regla por tipo vive en `lib/catalog/fields.ts`, que es donde ya viven `salePrice` y `minStock`. Se añade `showInFair` a la tabla de campos por tipo. Como la columna es booleana y no nula, «no corresponde» se traduce a forzar `true`, no a `null`. Así un insumo que algún día se reclasificara no nacería oculto. La acción de servidor aplica la regla antes de llamar a `ItemService`.
- El ajuste es visible y editable para cualquier rol que hoy edita productos. No se añade ninguna política RLS: es una columna más de `items`.
- Se añade `show_in_fair` a `COLUMNS` de `item-service.ts` como parte del mismo literal sin partir (un `COLUMNS` concatenado rompe la inferencia de `.select()`).

**Alternativas:** una tabla `fair_catalog(item_id, business_line_id)` para elegir productos por feria o por línea. Da más control, pero introduce un concepto nuevo (convención 11) y un paso más para abrir la feria. Se descarta: no se pidió.

### 2. La URL de la miniatura viaja con el catálogo y los bytes se guardan en Dexie

`listSellableProducts` añade dos pasos a lo que ya hace: `AttachmentService.listForEntities(org, 'item', ids)` y `signedThumbnailUrls`. Se queda con la primera foto por ítem, que es la más reciente, igual que V10. `FairProduct` gana `photoUrl: string | null`. El servicio de feria recibe el `AttachmentService` construido con el mismo cliente; no duplica la consulta.

En el cliente, `useFairSessionStore.start`:
1. fija la sesión y pinta la cuadrícula de inmediato, usando `photoUrl` (red disponible);
2. guarda el snapshot como hoy;
3. **después**, sin bloquear, descarga cada `photoUrl` con `fetch`, con concurrencia limitada (4) y un tiempo máximo por imagen, y guarda cada `Blob` en una tabla nueva de Dexie.

La sesión (`useFairSessionStore`) convierte las miniaturas guardadas en `URL.createObjectURL(blob)` al cargarlas, y revoca las del juego anterior al reemplazarlas. `useFairPhotoUrls` solo elige, por producto, la copia local si es de la foto vigente, si no la URL firmada. Se descartó crear las URLs en un efecto del componente: la regla `react-hooks/set-state-in-effect` lo prohíbe, y crearlas durante el render las revocaría en el doble montaje de desarrollo con la tarjeta todavía mostrándolas.

- **Tabla nueva, no un campo del snapshot.** `db.version(3).stores({ fairPhotos: "id, snapshotId" })`, con `{ id: "<snapshotId>:<itemId>", snapshotId, itemId, attachmentId, blob }`. La versión 3 solo añade una tabla, igual que la 2: las entradas de la cola sobreviven y `OUTBOX_SCHEMA_VERSION` no cambia. Separar las fotos del snapshot evita reescribir megas cada vez que se guarda el snapshot, y deja la lectura de la cuadrícula ligera.
- **Reutilizar entre capturas.** Si ya hay una foto guardada para ese `itemId` con el mismo `attachmentId`, no se descarga otra vez. Al renovar la captura, se borran las fotos de ítems que ya no están en el snapshot o cuyo `attachmentId` cambió. Esto limita el crecimiento a una miniatura por producto y por feria.
- **Fallo de descarga = sustituto.** Un `fetch` fallido o una cuota llena no rompen `start`: se registra, se deja el producto sin blob y la tarjeta muestra el sustituto. La venta nunca depende de una imagen.
- `FairSnapshotProduct` gana `photoAttachmentId: string | null` para saber qué foto corresponde a cada producto al restaurar. Eso no cambia el formato de la cola.

**Alternativas:**
- *Solo la URL firmada.* Caduca a la hora y no carga sin red: incumple el requisito.
- *Regla `CacheFirst` en el service worker.* La URL firmada cambia en cada carga (`?token=`), así que la clave de caché nunca coincide sin normalizarla. Además rompe la regla de KAM-11 de no cachear datos de negocio de forma implícita. La captura explícita en Dexie es coherente con la decisión 12 de KAM-12: el dato se captura a propósito y se ve de cuándo es.
- *Guardar data-URLs en base64 dentro del snapshot.* Pesa un 33 % más y hay que reescribir todo el snapshot en cada captura.

### 3. Tarjeta con miniatura lateral, selector y *Agregar*

La tarjeta pasa de `<button>` a un contenedor no interactivo (`<article>`/`<li>`) para que tocarla no haga nada. Distribución: miniatura cuadrada a la izquierda (`size-16`) con `object-cover` y el mismo sustituto que `ItemThumbnail` (icono sobre `bg-muted`); a la derecha, el nombre en dos líneas como máximo, el precio, y debajo una fila con el selector `− n +` y *Agregar*. A 390 px la cuadrícula pasa a **una columna** (`grid-cols-1`, `sm:grid-cols-2`, `lg:grid-cols-3`): con miniatura, selector y botón, dos columnas de ~180 px no dejan objetivos táctiles de 44 px sin desbordar.

- Los botones − y + y *Agregar* miden al menos 44 × 44 px. El número tiene `aria-live="polite"` y cada control lleva `aria-label` con el nombre del producto («Aumentar cantidad de Taza azul»).
- La cantidad por tarjeta vive en un estado de la cuadrícula, `Record<itemId, number>`, no en el store del carrito. Es estado de interfaz efímero, y así «limpiar la vista» es reiniciar ese objeto. `FairScreen` lo reinicia al registrar, pasando una `key` que cambia con cada venta (el mismo patrón de remontar con `key` que usa el catálogo).
- El selector no tiene tope superior en la interfaz. `lib/fair/sale-schema.ts` ya valida la cantidad en el servidor.

### 4. Carrito: `addLine` con cantidad y `setQuantity`, sin romper la pureza

- `addLine(lines, product, newId, quantity = 1)`: suma `quantity` a la línea existente o crea una línea con esa cantidad. Con el valor por omisión, las pruebas y los llamadores actuales no cambian.
- `setLineQuantity(lines, lineId, quantity)`: fija la cantidad con un mínimo de 1. Las funciones de − y + del panel la usan. Quitar sigue siendo `removeLine`. El comentario «No existe "quitar una unidad"» de `lib/fair/cart.ts` deja de ser cierto y se actualiza.
- `cart-store.ts` expone `add(product, newId, quantity)` y `setQuantity(lineId, quantity)`.

### 5. Panel lateral `CartDrawer` que absorbe `CheckoutSheet`

`Sheet side="right"` (ya está en `components/ui/sheet.tsx`), con ancho completo en móvil (`w-full sm:max-w-md`). Estructura: encabezado con «Carrito» y unidades; lista desplazable de líneas (nombre, `precio × cantidad`, subtotal, − / + y papelera); pie fijo con el total, el monto, el `ToggleGroup` de método y *Registrar pedido* (`h-14`). `checkout-sheet.tsx` se elimina, junto con su prueba, y la lógica de `CheckoutForm` se mueve al pie del panel.

- **Monto que sigue al total mientras no se edita.** Hoy el monto se fija al abrir, con `key={total}`. En el panel el total cambia con el panel abierto, así que se guarda `amountTouched`: mientras sea `false`, el monto mostrado es el total vigente. Cuando la persona escribe, queda su valor. Al cerrar el panel, se reinicia. Esto evita el efecto que sincroniza props con estado que el código actual evita a propósito.
- **Carrito vacío con el panel abierto.** Se muestra un vacío («El carrito está vacío») y *Registrar pedido* queda deshabilitado. El panel no se cierra solo: un panel que desaparece bajo el dedo es un toque perdido.
- *Ver carrito* en `CartBar` se deshabilita con el carrito vacío. No se oculta, por la misma razón por la que hoy *Cobrar* no se oculta.
- `CartBar` deja de listar líneas: queda solo la fila de unidades, total y *Ver carrito*. Eso devuelve altura a la cuadrícula.

### 6. Mensaje de éxito propio, sin librería

Un componente `FairToast` en `features/fair/` con `role="status"` y `aria-live="polite"`. Se posiciona sobre la barra inferior (`fixed`, `pointer-events-none`, para que no tape ni capture toques), desaparece a los 2,5 s y se reemplaza si llega otra venta. `confirm()` lo muestra justo después de vaciar el carrito y cerrar el panel, **antes** de `await captureSale`, así la vuelta sigue sin depender de la red. Cuando `captureSale` devuelve `queued`, el texto cambia a «Venta guardada. Se enviará al recuperar la señal». El `role="alert"` de fallo permanente se queda como está.

**Alternativa:** instalar `sonner` (el toaster de shadcn). Se descarta para un solo mensaje, en la pantalla que más cuida su peso y su comportamiento sin red. Si otra pantalla lo necesita, se evalúa aparte.

### 7. Migración y guardas

- Archivo `supabase/migrations/20260926100000_items_show_in_fair.sql`. Se eligió así para no chocar con los `20260922*` de las sesiones hermanas. Antes de crearlo, se vuelven a revisar `.claude/worktrees/*/supabase/migrations`.
- Prueba pgTAP en `supabase/tests/` con `has_column`, `col_not_null`, `col_default_is`, que un ítem existente quede con `true` y que no se agregue ninguna fila a `activity_log` por la migración.
- `lib/export/tables.ts`: `show_in_fair` va **al final** de las columnas de `items`, porque `alter table add column` la deja última y el manifiesto compara por posición.
- `lib/activity/fields.ts`: una etiqueta legible («Mostrar en venta rápida») para que la bitácora lo describa.

## Risks / Trade-offs

- **[Riesgo] Peso en IndexedDB** con catálogos grandes. → Solo miniaturas (del orden de decenas de KB), una por producto y feria, con limpieza al renovar. Si la cuota falla, se usa el sustituto sin romper nada.
- **[Riesgo] Capturar con mala señal alarga el consumo de datos** en el puesto. → Las descargas van después de pintar, con concurrencia 4 y tiempo máximo por imagen, y se reutilizan las que ya estaban.
- **[Riesgo] Una consulta de firmado más en `/fair`** suma latencia al abrir. → Es un solo lote por bucket, igual que V10. Se mide con el presupuesto de rendimiento existente (`performance-budget`).
- **[Trade-off] Una columna en móvil** muestra menos productos por pantalla que las dos columnas de hoy. → La tarjeta es baja (~88 px) y la barra inferior pierde la lista de líneas, así que la densidad vertical se mantiene parecida. Es la contrapartida de tener objetivos de 44 px con selector.
- **[Riesgo] Cambio de interacción para quien ya usa la feria** (tocar la tarjeta ya no agrega). → Está marcado como BREAKING en la propuesta. El e2e `fair-offline.spec.ts` y las pruebas de `FairScreen` se reescriben al recorrido nuevo.
- **[Riesgo] Revocar mal los `objectURL`** deja memoria retenida en sesiones largas. → La sesión crea las URLs una vez por juego de fotos y revoca el anterior al reemplazarlo. Tiene una prueba unitaria que simula `URL.revokeObjectURL`.

## Migration Plan

1. Migración con `default true`: nada desaparece de la feria al desplegar.
2. Dexie versión 3: se aplica sola al abrir la aplicación. Los snapshots viejos no tienen `photoAttachmentId` y se tratan como «sin foto» hasta la siguiente captura con red.
3. Reversión: revertir el código basta. La columna puede quedarse (es inocua con `default true`), y la tabla `fairPhotos` de Dexie queda sin usar.
