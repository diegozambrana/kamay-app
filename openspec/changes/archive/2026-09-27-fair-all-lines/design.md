## Context

Parte del estado que deja `fair-product-photos-visibility-cart-drawer`: la tarjeta tiene selector y *Agregar*, el carrito vive en un panel y *Registrar pedido* llama a `register(amount, method)` en `FairScreen`. Esa función arma **un** sobre con `buildSaleEnvelope` y lo encola con `captureSale` (operación `directSale.create`, plazo cero).

Hechos que condicionan el diseño:

- `orders.business_line_id` es `not null`, y `create_direct_sale(p_sale, p_items, p_payment)` exige línea. Es `security invoker`, idempotente por `id` y atómica: una venta con sus líneas y su cobro.
- Nada en la base impide que una venta de la línea A lleve un producto de la línea B. La coherencia la decide la aplicación.
- `organizations.settings` (`jsonb`) ya guarda ajustes por organización. `AiWritingAssistService` es el patrón a seguir: se lee con `get`, se escribe con `update` fusionando las demás claves, la escritura es solo de la persona dueña (RLS de `organizations`) y la interfaz está en Configuración › General.
- `FairSaleService.listSellableProducts` filtra por `business_line_id = línea or null`. Suma en memoria las filas de `best_selling_products` filtradas por línea.
- El snapshot de la feria es uno por `organización:línea`, y la cola guarda sobres con `operation` + `payload`.

## Goals / Non-Goals

**Goals:**
- Que la bandera apagada deje el comportamiento **idéntico** al actual: mismo sobre, misma operación de la cola, misma consulta.
- Que un registro con varias líneas sea atómico e idempotente de punta a punta, con red y sin ella, con **una sola** entrada en la cola.
- Que el reparto del carrito y del cobro sea una función pura, probada sin montar nada.

**Non-Goals:**
- Cambiar `create_direct_sale` ni el formato de una entrada de la cola.
- Tocar cómo se leen las ventas directas fuera de la feria.

## Decisions

### 1. La bandera: `settings.fair = { all_lines: boolean }`

Se guarda como una clave anidada, por si la feria gana más ajustes de organización, con el mismo servicio y el mismo formulario que la asistencia de redacción (`FairSettingsService.get/update`, `FairAllLinesForm`). Sin la clave, se lee como apagada. `/fair` la lee en el servidor y se la pasa a `FairScreen`. La persona dueña la cambia en Configuración › General, bajo un encabezado «Venta rápida».

**Alternativa:** una columna `organizations.fair_all_lines`. Se descarta porque `settings` ya existe exactamente para esto y evita una migración y sus guardas (manifiesto de exportación, campos de la bitácora).

### 2. El alcance de la cuadrícula se decide en el servidor

`listSellableProducts(org, line, { allLines, activeLineIds })`:
- **Apagada:** la consulta actual, sin cambios.
- **Encendida:** `.or(business_line_id.in.(<activas>),business_line_id.is.null)`. Los ids de las líneas activas llegan de `BusinessLineService.listActive`, que la página ya llama. Así las líneas archivadas quedan fuera sin un join.
- **Orden:** el mismo `best_selling_products`, pero **sin** filtro de línea. El servicio ya suma las filas por producto, así que sumarlas todas da el total de la organización. No hace falta una vista nueva.
- `FairProduct` gana `businessLineName: string | null`, resuelto con la lista de líneas que ya se tiene. La tarjeta lo muestra solo si la pantalla recibe `showLine` (bandera encendida).

**Alternativa:** una vista `best_selling_products_org`. Se descarta porque sumar en memoria es lo que ya se hace y el volumen es el catálogo vendible de una organización.

### 3. Cada línea del carrito sabe a qué línea de negocio va

`SellableProduct` y `CartLine` ganan `businessLineId: string | null`, el del producto al agregarlo. `sameProduct` no cambia. El destino de cada línea del carrito se resuelve al registrar: `line.businessLineId ?? feriaLineId`. Así una línea compartida cae en la línea de la feria y el carrito no depende de la bandera.

### 4. Reparto puro: `splitSale` en `lib/fair/split-sale.ts`

```
splitSale(lines, fairLineId, amount) → [{ businessLineId, lines, subtotal, payment }]
```
- **Agrupar:** por línea destino, en el orden de primera aparición en el carrito. El orden hace que el redondeo sea determinista y que la «última venta» del spec esté bien definida.
- **Cobro:** `round2(amount * subtotal / total)` para cada grupo menos el último, que recibe `amount − suma`. Si `total = 0` (no debería pasar, porque sin precio no se vende), todo el monto va al primero.
- **Cobro cero:** un grupo con cobro 0 no lleva cobro (`payment: null`), igual que hoy con monto 0.
- **Con un solo grupo:** devuelve un único elemento con el monto entero, y `FairScreen` usa el camino de hoy sin cambios.

### 5. Una operación nueva de la cola y una función de base que agrupa

- **Sobre:** `buildSaleEnvelopes(input)` produce un `DirectSaleInput` por grupo. Cada uno lleva su `saleId` y su `paymentId` (UUID del cliente), los `id` de línea del carrito, y comparte `occurredAt`, canal y método.
- **Con un solo sobre:** `captureSale` con `directSale.create`, como hoy.
- **Con varios:** `captureSales` encola **una** entrada `directSale.createBatch` con `{ sales: DirectSaleInput[] }`. `OUTBOX_SCHEMA_VERSION` no cambia, porque es un tipo de operación más, no otro formato de entrada. La operación se registra en `features/sync/operations.ts` con `send: registerDirectSales` y `describe` («Venta de feria · 2 ventas · 150»).
- **Acción:** `registerDirectSales` en `actions/fair.ts` valida con `z.array(directSaleSchema).min(2).max(20)`, rechaza el lote entero si alguna venta es de otra organización que la de la sesión (igual que `registerDirectSale`) y llama a `FairSaleService.createMany`.
- **Base:** la migración `…_create_direct_sales.sql` añade `create_direct_sales(p_sales jsonb) returns uuid[]`, `security invoker`, que recorre el arreglo y llama a `create_direct_sale` por cada venta. Una llamada a una función es una transacción: si una venta falla, la excepción deshace las anteriores. La idempotencia sale gratis, porque cada `create_direct_sale` ya devuelve la venta existente si su `id` ya está. `grant execute ... to authenticated`.

**Alternativas:**
- *Encolar N entradas `directSale.create`.* Reutiliza todo, pero pierde el «todo o nada»: con red a medias podrían salir unas ventas y otras no, y quien vende ve un registro a medias en el indicador. Se descarta porque la persona eligió B precisamente para que los números queden bien.
- *Un único `create_direct_sale` con líneas de varias líneas de negocio.* Contradice la decisión B.

### 6. El indicador cuenta ventas, no entradas

`PendingSalesIndicator` suma `1` por cada `directSale.create` y `payload.sales.length` por cada `directSale.createBatch`. Reintentar o descartar desde el indicador actúa sobre la entrada entera: un registro de dos líneas se reintenta o se descarta junto, que es lo coherente con que sea atómico.

### 7. El snapshot guarda el alcance

`FairSnapshot` gana `allLines: boolean`, y cada producto guarda `businessLineId` y `businessLineName`. Se captura con el alcance vigente. Si la dueña cambia la bandera, la próxima apertura con red vuelve a capturar (ya pasa hoy). Sin red se usa lo capturado, y la antigüedad visible lo deja claro. El `id` del snapshot sigue siendo `organización:línea de la feria`.

### 8. El paso de inicio con la bandera

`FairStart` recibe `allLines`. Encendida, el rótulo de la línea pasa a «Línea para los productos compartidos», con la ayuda «Cada producto se registra en su propia línea». Con la línea activa en «Todas», sigue exigiendo elegir una.

## Risks / Trade-offs

- **[Riesgo] Una línea sin estado final** hace fallar `create_direct_sale`, y con `createBatch` hace fallar el registro entero. → Es el comportamiento correcto: todo o nada. El fallo llega al indicador como permanente, con reintentar o descartar, igual que hoy con una venta. Se prueba con pgTAP.
- **[Riesgo] Sobres encolados por una versión anterior** sin `businessLineId` en las líneas del carrito. → El carrito no se persiste (es efímero) y los sobres ya encolados son `directSale.create`, que no cambian.
- **[Trade-off] Un registro son varios pedidos con números distintos.** Es lo que pide la decisión B. El mensaje de éxito no enumera números, igual que hoy.
- **[Riesgo] Cuadrícula más larga** con todas las líneas. → El orden por más vendidos de la organización mantiene arriba lo que más sale. Si hiciera falta, un filtro por línea dentro de la feria sería otro cambio.
- **[Riesgo] Carrera entre cambiar la bandera y una feria abierta.** → La pantalla trabaja con lo que capturó al abrir. El cambio aplica en la próxima apertura con red, y no altera ventas ya registradas.

## Migration Plan

1. **Migración:** solo añade una función y el permiso de ejecutarla. No toca datos.
2. **Bandera apagada por omisión:** ninguna organización cambia de comportamiento al desplegar.
3. **Reversión:** apagar la bandera deja todo como hoy sin desplegar nada. Revertir el código deja `create_direct_sales` sin uso, y es inocua.
