# Tareas · KAM-09 · Egresos: compras y gastos

Requisitos en `specs/expenses/spec.md`; decisiones (D1–D10) en `design.md`.
Convención nº 12: cada escenario del delta tiene al menos una prueba aquí referenciada.

## 1. Base de datos

- [x] 1.1 Crear `supabase/migrations/<timestamp>_expenses.sql` con la tabla `expenses` según el esquema canónico §8: `kind` (`purchase` / `expense`), `business_line_id` obligatorio, `contact_id`, `expense_category_id`, `order_id`, `amount`, `occurred_at`, `note`, `created_by`, `archived_at`, las restricciones `purchase_needs_supplier`, `expense_needs_category_and_amount` y `purchase_has_no_own_amount`, y sus dos índices.
- [x] 1.2 Añadir `expense_items` (`item_id` obligatorio, `variant_id`, `quantity > 0`, `unit_price >= 0`) con `organization_id` añadido (D8) y sus tres índices.
- [x] 1.3 Añadir la función `create_expense(p_expense jsonb, p_items jsonb) returns uuid`, `security invoker`, calcada de `create_order`: inserta encabezado y líneas en una transacción, respeta los `id` y `occurred_at` del cliente, rellena `organization_id` de las líneas desde el encabezado, rechaza una compra sin líneas y un gasto con líneas (D2).
- [x] 1.4 Añadir las vistas con `security_invoker = true`: `expense_totals` (`expense_id, organization_id, business_line_id, kind, occurred_at, total`, en ese orden y sin `paid`, con `coalesce(..., 0)` y excluyendo archivados) e `item_last_cost` (`distinct on (item_id)` por `occurred_at desc`, con `last_cost`, `last_purchase_at`, `last_supplier_id`, excluyendo egresos archivados) (D1, D3).
- [x] 1.5 Adjuntar `enforce_archive` reutilizando `enforce_archive_rules()` en `expenses`, y los triggers `audit` de `log_activity()` en `expenses` y `expense_items` (D9).
- [x] 1.6 Cerrar privilegios y RLS (D7): `grant select, insert, update` a `authenticated`, `revoke delete` a todos, `grant select` en las dos vistas, `revoke execute from public` y `grant execute` a `authenticated` en `create_expense`; políticas de leer/crear/editar con `is_owner(organization_id)` en `expenses` y `expense_items`; **ninguna política `DELETE`**.
- [x] 1.7 Ampliar `supabase/seed.sql` con los egresos de Geeko Store: una compra con varias líneas, "Taza para sublimación" comprada dos veces a precios y fechas distintos (la más reciente por `occurred_at` registrada antes que la otra), un gasto en General, un gasto asignado a un pedido y un egreso archivado.
- [x] 1.8 Verificar `supabase db reset` sin error y regenerar el grafo con `graphify .` (convención nº 6).

## 2. Pruebas de base de datos (pgTAP)

- [x] 2.1 `supabase/tests/expense_integrity.test.sql`: gasto sin categoría, gasto sin monto, compra sin proveedor, compra con monto propio y egreso sin línea rechazados; `id` y `occurred_at` del cliente conservados y `created_at` del servidor; cantidad no positiva y precio negativo rechazados; la compra posterior no reescribe la anterior; `create_expense` rechaza la compra sin líneas y no deja fila en `expenses` ni `expense_items` (escenarios "Intento contra la operación de guardado" y "Guardado atómico"); `expenses` no tiene columna de total, pagado, saldo ni estado de pago.
- [x] 2.2 `supabase/tests/derived_values.test.sql` (el archivo que ARCHITECTURE.md nombra): `expense_totals` devuelve 115 para 3×25 + 1×40, 80 para un gasto de 80, 0 no nulo para una compra sin líneas; coincide con la suma manual sobre la semilla; `item_last_cost` decide por `occurred_at` y no por orden de registro, no tiene fila para el nunca comprado, y salta a la compra anterior cuando la última se archiva.
- [x] 2.3 `supabase/tests/expense_access.test.sql`: el ayudante obtiene cero filas de `expenses`, `expense_items`, `expense_totals` e `item_last_cost` ("El ayudante consulta egresos", "El ayudante no obtiene costos"); el ayudante que inserta directo o vía `create_expense` recibe rechazo; miembro de otra organización sin filas; borrado rechazado en `expenses` y `expense_items`; el egreso archivado desaparece de `expense_totals` e `item_last_cost` conservando líneas e historial, y desarchivarlo lo devuelve; el gasto en la línea compartida sale de `expense_totals` con esa `business_line_id` ("Gasto en General"); un miembro de otra organización no puede leer un objeto del bucket `receipts` por su ruta ("Solo la propia organización ve el comprobante"), con el patrón de `attachments.test.sql`.
- [x] 2.4 Extender `supabase/tests/seed_geeko.test.sql` con los casos sembrados en 1.7 (escenario "Reinicio local").

## 3. Lógica pura y tipos

- [x] 3.1 Añadir a `types/index.ts` `EXPENSE_KINDS`, `Expense`, `ExpenseKind`, `ExpenseItem`, `ExpenseTotals` y `RECEIPTS_BUCKET`, en el estilo de los existentes.
- [x] 3.2 `lib/expenses/totals.ts` (D6): `purchaseTotal(lines)` y `summarize(rows)` → compras, gastos y total del conjunto.
- [x] 3.3 `lib/expenses/totals.test.ts`: total de compra desde filas (3×25 + 1×40 = 115), resumen por tipo, conjunto vacío en ceros.
- [x] 3.4 `lib/expenses/period.ts`: `currentMonthRange(today)` para el periodo por defecto en la zona horaria de la organización, con su `period.test.ts`.
- [x] 3.5 `lib/expenses/schema.ts`: esquemas Zod de gasto (monto, categoría y línea obligatorios; `orderId` opcional), compra (proveedor y al menos una línea; cantidad > 0, precio ≥ 0), adjuntar comprobante y archivar.
- [x] 3.6 `lib/expenses/schema.test.ts`: gasto sin monto, sin categoría y sin línea rechazados; compra sin proveedor y sin líneas rechazadas; gasto mínimo y compra mínima aceptados.
- [x] 3.7 `lib/expenses/errors.ts` y `errors.test.ts`: traducción de `purchase_needs_supplier`, `expense_needs_category_and_amount`, "Una compra necesita al menos una línea", archivado e `insufficient_privilege` a mensajes comprensibles.
- [x] 3.8 `lib/attachments/compress-image.ts` (D4): `compressImage(file, { maxEdge, maxBytes })` con `createImageBitmap`, canvas y `toBlob` en WebP con reserva JPEG, bajando la calidad hasta caber; `RECEIPT_INPUT_MAX_BYTES` (20 MB).
- [x] 3.9 `lib/attachments/compress-image.test.ts`: cálculo del tamaño destino por `maxEdge`, escalera de calidad hasta caber en `maxBytes` con un `toBlob` simulado, archivo que ya cabe y es pequeño se deja pasar, tipo no admitido rechazado ("Formato no admitido").

## 4. Servicios

- [x] 4.1 `services/expenses/expense-service.ts`: `list()` con filtros de línea, tipo, proveedor, categoría, periodo (`from`/`to`) e `includeArchived` (excluyendo archivados por defecto) y totales leídos de `expense_totals` en lote; `getById()` con su total; `create()` que invoca `create_expense` por `.rpc()` (D2); `setArchived()`; `history()` desde `activity_log`. Toda consulta filtra `organization_id` (convención nº 2).
- [x] 4.2 `services/expenses/expense-item-service.ts`: `listByExpense()` con nombre de ítem y variante resueltos.
- [x] 4.3 `services/expenses/item-last-cost-service.ts` (D3): `mapFor(organizationId)` → `Map<itemId, { lastCost, lastPurchaseAt, supplierName }>` en una sola consulta.
- [x] 4.4 `services/expenses/expense-service.test.ts`: el listado excluye lo archivado salvo que se pida; el total se lee de la vista y no de columnas; los filtros se traducen a la consulta esperada; `create()` envía el jsonb con encabezado y líneas.

## 5. Server Actions

- [x] 5.1 `actions/expenses.ts` · `createExpense`: valida con Zod, exige contexto de dueño, fija `occurred_at` desde el formulario y llama a `ExpenseService.create()`; devuelve `{ id }` para que el cliente encole el comprobante.
- [x] 5.2 `actions/expenses.ts` · `createPurchase`: lo mismo con proveedor y líneas; verifica que el proveedor sea un contacto con `is_supplier` de la organización.
- [x] 5.3 `actions/expenses.ts` · `attachReceipt(formData)`: vuelve a comprobar tipo y tamaño (≤ 5 MB) sin confiar en el cliente y sube con `AttachmentService.upload()` al bucket `receipts` con `entity_type = 'expense'`.
- [x] 5.4 `actions/expenses.ts` · `archiveExpense` y `unarchiveExpense`: piden la operación y traducen el rechazo de `enforce_archive_rules` (D9).
- [x] 5.5 Revalidar `/expenses` y `/expenses/[id]` tras cada acción.

## 6. Acceso y navegación

- [x] 6.1 `app/(app)/expenses/layout.tsx`: guardia con `getOwnerContext()` y `redirect(defaultLandingPath(...))` para el ayudante (D7).
- [x] 6.2 Añadir `/expenses` a `PROTECTED_PREFIXES` en `lib/auth/routes.ts` y cubrirlo en `routes.test.ts`.
- [x] 6.3 Añadir "Egresos" a `components/layout/nav-entries.ts` con `roles: ["owner"]` y ampliar `nav-entries.test.ts`: el dueño la ve, el ayudante no ("Menú del ayudante", "Menú del dueño").

## 7. Bandeja V7 y detalle

- [x] 7.1 `app/(app)/expenses/page.tsx`: página delgada que lee los filtros de la dirección, resuelve la línea activa por cookie, calcula el periodo por defecto con `todayInTimezone` y `currentMonthRange`, lista con `ExpenseService`, resuelve nombres de proveedores, categorías y líneas en lote, y resume totales con `summarize()` (D6).
- [x] 7.2 `features/expenses/expenses-screen.tsx`, `expense-filters.tsx`, `expense-row.tsx` y `expense-card.tsx`: lista cronológica con fecha, tipo, proveedor o categoría, línea y total; filtros en la dirección; totales del periodo; "Ver archivados" con archivados distinguidos; tarjetas apiladas en móvil; botones "Nueva compra" y "Nuevo gasto".
- [x] 7.3 `features/expenses/expense-detail.tsx`: tipo, fecha, proveedor enlazado o categoría, línea, líneas de compra, total, nota, pedido enlazado, comprobantes con URL firmada, historial de `activity_log`, archivar/desarchivar y "Adjuntar comprobante" (reintento de D4). Se renderiza en un `Sheet` desde `?selected=` y a página completa en `app/(app)/expenses/[id]/page.tsx`.
- [x] 7.4 `features/expenses/receipt-upload-store.ts` (D4): cola de subidas en vuelo por egreso, compresión, llamada a `attachReceipt`, estado `pending | failed`, aviso `beforeunload`; la fila y la tarjeta muestran el indicador "comprobante subiendo…".

## 8. Formularios V8 y V9

- [x] 8.1 `app/(app)/expenses/purchases/new/page.tsx`: carga proveedores, insumos (`kind = 'supply'`, de la línea activa y compartidos; todos con "Todas"), el mapa de `item_last_cost`, líneas vigentes y la línea activa; delega en el formulario.
- [x] 8.2 `features/expenses/purchase-form.tsx` y `purchase-lines-table.tsx`: `ContactCombobox` con `role="supplier"` y creación al vuelo, fecha con hoy por defecto, línea preseleccionada, filas con insumo, variante, cantidad y precio, quitar fila, total en vivo con `purchaseTotal()`, y la pista "Último: <precio> · <fecha> · <proveedor>" junto al precio sin autocompletarlo (D3); validación previa que señala proveedor o tabla vacía.
- [x] 8.3 `app/(app)/expenses/costs/new/page.tsx` y `features/expenses/cost-form.tsx` (D5): monto dominante con foco e `inputMode="decimal"`, `category-chips.tsx` con las categorías vigentes, línea preseleccionada (compartida con "Todas"), fecha hoy, nota, "Asignar a un pedido" plegado con los pedidos vigentes, validación previa que señala monto, categoría o línea.
- [x] 8.4 `features/expenses/receipt-field.tsx`: `FileDropzone` con `IMAGE_ACCEPT` y `maxSizeBytes` de 20 MB; tras guardar, el formulario encola el archivo en el store y vuelve a la bandeja sin esperar (D4).
- [x] 8.5 Al guardar, ambos formularios vuelven a la bandeja con el egreso nuevo visible y su indicador de comprobante si lo hay.

## 9. Pruebas de interfaz y de extremo a extremo

- [x] 9.1 `features/expenses/purchase-lines-table.test.tsx`: insumo comprado antes muestra la pista y el precio sigue vacío; insumo nuevo sin pista; escribir 9.50 conserva la pista en 12; el total sigue a las filas al cambiar 2 por 5; quitar una fila recalcula.
- [x] 9.2 `features/expenses/cost-form.test.tsx`: el monto tiene el foco al abrir; con "Todas" queda General preseleccionada y se puede cambiar; con Alfarería activa queda Alfarería; sin monto y sin categoría se impide con el mensaje que señala el campo; "asignar a un pedido" envía `orderId`.
- [x] 9.3 `features/expenses/purchase-form.test.tsx`: sin proveedor se impide señalando el campo; sin líneas se impide señalando la tabla ("Intento desde el formulario"); proveedor creado al vuelo queda seleccionado y las filas se conservan.
- [x] 9.4 `features/expenses/expenses-screen.test.tsx`: los totales coinciden con la suma del conjunto filtrado; el filtro por tipo y por proveedor reduce filas y totales; archivados ocultos salvo con el filtro y distinguidos al mostrarlos; en ancho móvil se rinden tarjetas; la fila con subida en vuelo muestra el indicador.
- [x] 9.5 `features/expenses/receipt-upload-store.test.ts`: el egreso queda registrado y visible antes de que la subida termine ("El guardado no espera"); una subida fallida queda en `failed` con aviso y se puede reintentar ("La subida falla").
- [x] 9.6 `tests/e2e/expenses.spec.ts` · gasto: desde la bandeja, con un contador explícito de interacciones, registrar un gasto mínimo en cinco o menos y verlo en la bandeja; con Sublimación activa un gasto de General no aparece ni suma, y con "Todas" sí ("Filtrado por una línea concreta", "Filtrado por 'Todas'").
- [x] 9.7 `tests/e2e/expenses.spec.ts` · compra: proveedor creado al vuelo, dos insumos, total igual a la suma; abrir el detalle desde la fila y por `/expenses/<id>`; el historial muestra el alta; archivar, comprobar que desaparece, "Ver archivados" y desarchivar.
- [x] 9.8 `tests/e2e/expenses.spec.ts` · comprobante: generar en la prueba una imagen de más de 8 MB (sin binario en el repositorio), adjuntarla a un gasto, comprobar que la fila aparece antes de que la subida termine y que el adjunto registrado pesa 5 MB o menos ("Foto de 8 MB"); un archivo no admitido se rechaza con el mensaje de formatos.
- [x] 9.9 `tests/e2e/expenses.spec.ts` · ayudante: su menú no tiene "Egresos" y al abrir `/expenses` y `/expenses/costs/new` por dirección directa termina en su aterrizaje habitual ("Ayudante por dirección directa").

## 10. Cierre

- [x] 10.1 `openspec validate kam-09-expenses-purchases-costs --strict` sin errores y cada escenario del delta con su prueba referenciada arriba.
- [x] 10.2 Ejecutar la secuencia completa: `lint → typecheck → test:unit → test:integration → build → test:e2e`.
