# KAM-09 · Egresos: compras y gastos

## Why

Kamay ya registra lo que entra (pedidos, KAM-07 y KAM-08) pero todavía no sabe **qué sale de caja**. Sin egresos no hay costo de nada: ni el último precio pagado por un insumo, ni cuánto cuesta una línea, ni la rentabilidad que KAM-20 tiene que reportar. Este cambio instala el modelo de egresos y las tres pantallas que lo alimentan: la bandeja única (V7), el formulario de compra con tabla de insumos (V8) y el formulario de gasto deliberadamente corto (V9). El objetivo del backlog es concreto: que todo lo que sale de caja quede registrado **el mismo día**, con su línea de negocio, sin que registrar cueste más de lo que vale.

## What Changes

- Nueva tabla `expenses` según el esquema canónico (§8): una sola bandeja para `kind = 'purchase'` (trae ítems) y `kind = 'expense'` (no trae nada), con `business_line_id` obligatorio, `contact_id` (proveedor), `expense_category_id`, `order_id` (gasto asignado a un pedido), `amount` solo para gastos, `occurred_at` fijado por el cliente, `note` y `archived_at`. Con sus tres restricciones: `purchase_needs_supplier`, `expense_needs_category_and_amount` y `purchase_has_no_own_amount`.
- Nueva tabla `expense_items`: `item_id`, `variant_id`, `quantity > 0`, `unit_price >= 0`. **El precio vive en la línea del documento**: es lo que hace posible el último costo conocido sin reescribir la historia.
- Nueva vista `expense_totals` con `security_invoker = true`: el total de una compra **no se almacena**, se suma desde sus líneas; el de un gasto es su `amount`. Nace **sin** la columna `paid` de la definición canónica, exactamente como `order_totals` en KAM-07: `paid` depende de `payments`, y KAM-10 —ya propuesto— la añade con `create or replace view` en su propia migración.
- Nueva vista `item_last_cost` con `security_invoker = true` (§11): el último precio pagado por cada ítem, leído de `expense_items`. Es la "pista" de V8 y, más adelante, el último costo de V11 (KAM-18).
- Una función de base de datos que inserta el egreso y sus líneas **en una sola transacción**, porque sin política `DELETE` un documento a medio guardar no se puede limpiar. Mismo patrón que `create_order` de KAM-08.
- V7 `/expenses`: bandeja cronológica con fecha, tipo, proveedor o categoría, línea y monto; filtros por tipo, proveedor, categoría y periodo (la línea la da el selector global); totales del periodo; "Ver archivados"; la fila abre el detalle en un panel lateral. En móvil, tarjetas apiladas.
- V8 `/expenses/purchases/new`: proveedor con creación al vuelo (reutiliza el buscador de contactos de KAM-06), fecha, línea, tabla editable de insumos con cantidad y precio, total calculado en vivo, comprobante. Junto al precio de cada insumo comprado antes se muestra su último precio conocido **como pista, nunca autocompletado**.
- V9 `/expenses/costs/new`: monto dominante, categorías como chips, línea preseleccionada desde el selector global (General cuando está en "Todas"), fecha, nota, comprobante y una casilla plegada "asignar a un pedido". Registrar un gasto: cinco interacciones o menos.
- Detalle de egreso (panel en V7 y página `/expenses/[id]` para enlaces directos): datos, líneas, total derivado, comprobantes, historial leído de la bitácora, archivar y desarchivar.
- Comprobante fotográfico: se comprime **en el cliente** antes de subir al bucket `receipts` y la subida ocurre **después** de guardar, en segundo plano; el guardado nunca espera al archivo.
- Acceso: `/expenses` y todo lo que cuelga de ella son **solo del dueño**. La entrada no aparece en el menú del ayudante y el acceso por dirección directa lo redirige a su aterrizaje habitual. RLS de `expenses` y `expense_items` sin ninguna política para el ayudante.
- RLS con el patrón del proyecto en las dos tablas (**sin política `DELETE`**), trigger `enforce_archive_rules` en `expenses`, triggers `audit` de `activity_log` en ambas.
- Semilla de Geeko Store ampliada con compras y gastos que cubren los casos que las pruebas exigen (compra con varias líneas, gasto en General, uno archivado, un insumo comprado dos veces a precios y fechas distintos).
- Entrada "Egresos" en el menú lateral, solo para el dueño.

**Fuera de alcance** (copiado literalmente del backlog):

- Movimientos de inventario derivados de la compra (KAM-18).
- Cobros y pagos como registros propios (KAM-10).
- Facturación fiscal, retenciones, órdenes de compra, conciliación bancaria.

**Estado de pago (pagado · pendiente · parcial): se traslada a KAM-10.** El backlog lo lista en el alcance de KAM-09, pero es un valor derivado de `payments` frente al total, y la convención nº 4 prohíbe guardarlo en una columna. La propuesta de KAM-10, ya escrita, crea `payments`, añade `paid` a `expense_totals`, deriva el estado y lo muestra en la bandeja y el detalle de egresos (sus tareas 1.6, 6.1 y 6.2), y declara explícitamente que no existirá ningún campo editable de estado de pago. Duplicarlo aquí produciría dos migraciones creando la misma tabla. Este cambio deja la bandeja y el detalle con el hueco previsto para esa insignia.

También quedan fuera, por no estar en el alcance del backlog: la edición de un egreso ya guardado (corregir es archivar y volver a registrar; ARCHITECTURE.md no define ruta `/expenses/[id]/edit`), el filtro por etiqueta de V7 (las etiquetas llegan con las tareas, KAM-15), el recuerdo del último proveedor usado, y el registro rápido móvil V16 que enlaza a V8 y V9 (KAM-13).

## Capabilities

### New Capabilities

- `expenses`: modelo de egresos (compras y gastos) con sus restricciones, el total y el último costo derivados en vistas, la bandeja V7, los formularios V8 y V9, el comprobante comprimido y subido en segundo plano, el archivado y el acceso exclusivo del dueño.

### Modified Capabilities

Ninguna. `catalog-directory` sigue exigiendo que V10 y V11 no muestren último costo (eso lo cambia KAM-18); `business-line-context` ya cubre la preselección de línea en formularios; el buscador de contactos con creación al vuelo se reutiliza tal como está.

## Impact

- **Base de datos:** una migración nueva `supabase/migrations/<timestamp>_expenses.sql` con `expenses`, `expense_items`, la función de inserción atómica, las vistas `expense_totals` e `item_last_cost`, triggers, privilegios y RLS. `supabase/seed.sql` se amplía. Pruebas pgTAP nuevas: `expense_integrity`, `expense_access` y `derived_values` (este último es el archivo que ARCHITECTURE.md ya nombra y que aún no existe). Grafo regenerado con `graphify .`.
- **Tipos y lógica pura:** `types/index.ts` (`Expense`, `ExpenseKind`, `ExpenseItem`, `ExpenseTotals`, `RECEIPTS_BUCKET`), `lib/expenses/` (esquemas Zod de gasto y compra, total de compra y resumen del periodo, periodo por defecto, errores traducidos), `lib/attachments/compress-image.ts` (compresión en el cliente con la API de canvas del navegador: **sin dependencia nueva**).
- **Servicios:** `services/expenses/` (`expense-service.ts`, `expense-item-service.ts`, `item-last-cost-service.ts`); `AttachmentService` se reutiliza con `entity_type = 'expense'` y el bucket `receipts`, que ya existe desde KAM-06.
- **Acciones:** `actions/expenses.ts` (`createExpense`, `createPurchase`, `attachReceipt`, `archiveExpense`, `unarchiveExpense`).
- **Pantallas:** `app/(app)/expenses/` (layout con guardia de dueño, `page.tsx`, `purchases/new`, `costs/new`, `[id]`), `features/expenses/` (bandeja, filtros, detalle, formulario de compra, formulario de gasto, tabla de insumos, chips de categoría, store de subida de comprobantes). `components/layout/nav-entries.ts` gana la entrada "Egresos" solo para el dueño y `lib/auth/routes.ts` añade `/expenses` a los prefijos protegidos por el middleware. `FileDropzone` se reutiliza con un límite de entrada mayor que el de subida, porque la compresión es la que garantiza los 5 MB.
- **Configuración de Next.js:** ninguna. `next.config.ts` ya fija `serverActions.bodySizeLimit` en 6 MB para las fotos del catálogo, y un comprobante comprimido nunca supera los 5 MB.
- **Dependencias:** ninguna nueva.
- **Relación con KAM-10:** ese cambio asume exactamente lo que este entrega —`expenses`, `expense_items` y `expense_totals` sin `paid`— y redefine la vista añadiendo `paid` al final. Las columnas de `expense_totals` quedan en el orden canónico para que ese `create or replace view` no falle. KAM-18 encuentra `item_last_cost` ya creada.
- **Conflicto documental que este cambio resuelve a favor de la matriz de acceso:** el mapa de navegación marca V8 y V9 como "Ambos" roles, pero la matriz de acceso del esquema (§16) deja `expenses` y `expense_items` **sin acceso** para el ayudante y el criterio 5 del backlog exige que `/expenses` lo redirija. Aquí mandan la matriz y el criterio: egresos es del dueño de extremo a extremo. Conviene corregir el mapa de navegación.
