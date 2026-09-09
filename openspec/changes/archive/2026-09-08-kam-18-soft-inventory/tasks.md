> Cada tarea de prueba nombra los escenarios del delta spec que cubre (convención nº 12: ningún escenario sin prueba referenciada). Los escenarios viven en `specs/inventory/spec.md`, `specs/catalog-directory/spec.md`, `specs/dashboard/spec.md` y `specs/quick-capture/spec.md` de este cambio. Las decisiones citadas (D1–D11) son las de `design.md`.

## 0. Punto de partida

- [x] 0.1 Confirmar que KAM-09 está archivada y que `create_expense`, `expense_items` con identificador de cliente e `item_last_cost` existen tal como los describe `design.md` — Context. Este cambio **no toca** ninguno de los tres.
- [x] 0.2 Confirmar que `openspec/changes/` no tiene ningún otro cambio en curso que escriba en `supabase/migrations/`, y elegir la marca de tiempo de la migración según el orden de fusión.
- [x] 0.3 Confirmar que `items.min_stock` existe desde KAM-06 y que `supabase/tests/catalog.test.sql` la exceptúa explícitamente de la comprobación de columnas derivadas. Este cambio **no añade ninguna columna a `items`**.

## 1. Migración: el documento y su derivado

- [x] 1.1 Abrir `supabase/migrations/<ts>_inventory.sql` con la cabecera del proyecto: tarea, DDL canónico de referencia (§10, §11, §16) y las decisiones que se apartan de lo obvio con su motivo (D1, D2, D3).
- [x] 1.2 Crear `inventory_movements` con el DDL canónico completo: `organization_id`, `item_id`, `variant_id`, `kind` con su `check`, `quantity` con `check (quantity <> 0)`, `source_type` con su `check`, `source_id`, `occurred_at`, `note`, `created_by`, `created_at` y la restricción `sign_matches_kind`. **Sin `archived_at`** (D3).
- [x] 1.3 Crear los tres índices canónicos: `(item_id, occurred_at desc)`, `(organization_id, occurred_at desc)` y el **único parcial** `(source_type, source_id) where source_type in ('expense_item','order_item')` (D2).
- [x] 1.4 Crear la vista `item_balances` copiando literalmente la definición del esquema §11, con `security_invoker = true`, `left join` sobre los movimientos, `coalesce(sum(...), 0)`, `min_stock` y `below_min` (D4). Sin filtro de archivado.
- [x] 1.5 Crear el trigger `after insert on expense_items` que inserta la entrada de inventario cuando el ítem de la línea es de tipo insumo, con `on conflict do nothing` sobre el índice único y `occurred_at` tomado de la fecha del hecho del egreso (D1, D2).
- [x] 1.6 Enganchar `log_activity()` a `inventory_movements`. **No** enganchar `enforce_archive_rules()`: no hay nada que archivar (D3).
- [x] 1.7 Privilegios y RLS: `grant select, insert on inventory_movements to authenticated` y nada más —**ningún `update`**—; `revoke delete` para `authenticated`, `anon` y `service_role`; políticas de `select` e `insert` con `is_member(organization_id)` y **ninguna política `DELETE` ni `UPDATE`** (D3). `grant select on item_balances to authenticated, service_role` explícito (D4).
- [x] 1.8 Ampliar `supabase/seed.sql` con los movimientos de Geeko Store que hacen falta para que el recorrido e2e y la tarjeta del panel tengan datos, incluido un insumo por debajo de su mínimo. Sin relleno retroactivo de las compras ya sembradas (design, Migration Plan 3).
- [x] 1.9 Ejecutar `supabase db reset`, comprobar que la migración aplica limpia, regenerar el grafo con `graphify update .` y versionar `graphify-out/` en el mismo commit (convención nº 6).

## 2. Pruebas pgTAP del esquema

- [x] 2.1 `supabase/tests/inventory_integrity.test.sql`: `kind` fuera del juego, entrada negativa, salida positiva, cantidad cero y ajuste en ambos sentidos, con `throws_ok` de cuatro argumentos. Cubre *Los movimientos de inventario son el único documento del saldo* → «Tipo de movimiento fuera del juego permitido», «Entrada con cantidad negativa», «Salida con cantidad positiva», «Movimiento de cantidad cero», «Ajuste en cualquiera de los dos sentidos».
- [x] 2.2 Ampliar `supabase/tests/no_delete.test.sql` con `inventory_movements`, y añadir en `inventory_integrity.test.sql` el intento de `update` rechazado por falta de privilegio. Cubre *Un movimiento no se edita, no se archiva y no se borra* → «Intento de editar un movimiento», «Intento de borrar un movimiento».
- [x] 2.3 `supabase/tests/inventory_idempotency.test.sql`: insertar la misma línea de compra dos veces deja un solo movimiento, e insertar a mano un segundo movimiento con el mismo `(source_type, source_id)` es rechazado. Cubre *La misma compra sincronizada dos veces deja una sola entrada* → «Compra reenviada tras una respuesta perdida», «Dos reintentos, un solo movimiento».
- [x] 2.4 Ampliar `inventory_idempotency.test.sql` con la generación automática: una compra de tres líneas de insumo produce tres entradas con sus cantidades, el saldo sube, y una línea cuyo ítem es producto no produce ninguna. Cubre *Cada línea de compra de un insumo genera exactamente una entrada* → sus tres escenarios.
- [x] 2.5 Ampliar `supabase/tests/derived_values.test.sql` con `item_balances`: saldo igual a la suma manual de entrada, consumo y ajuste; insumo sin movimientos con saldo cero; ausencia de toda columna de saldo en `items`, `item_variants` e `inventory_movements`; y la vista devolviendo solo insumos. Cubre *El saldo se deriva de los movimientos y nunca se almacena* → sus cuatro escenarios.
- [x] 2.6 Ampliar `inventory_idempotency.test.sql` con el archivado: archivar la compra deja saldo y movimientos intactos y no aparece ningún movimiento nuevo. Cubre *Archivar una compra no altera el inventario* → «Compra archivada, saldo intacto», «Ningún movimiento aparece sin autor».
- [x] 2.7 `supabase/tests/inventory_access.test.sql`: el ayudante lee y crea movimientos de su organización; A no ve movimientos ni saldos de B; un movimiento sobre un ítem de otra organización es rechazado; el ayudante obtiene cero filas de `item_last_cost`. Cubre *Aislamiento entre organizaciones del inventario* → sus tres escenarios; *El detalle del insumo muestra saldo, movimientos y evolución de precios* → «Tampoco por consulta directa»; y *Registrar un consumo cuesta tres interacciones o menos* → «El ayudante registra consumo».
- [x] 2.8 Ampliar `supabase/tests/audit_trigger.test.sql` con `inventory_movements`, y comprobar en `inventory_integrity.test.sql` que no existe ninguna tabla de historial propia del inventario. Cubre *Todo movimiento de inventario queda en la bitácora* → «El consumo queda registrado», «Una sola bitácora».

## 3. Lógica pura y servicios

- [x] 3.1 `lib/inventory/schema.ts`: esquemas Zod del consumo (`id`, `itemId`, `variantId` opcional, `quantity > 0`, `occurredAt`, `note` opcional) y del ajuste (`id`, `itemId`, `countedQuantity >= 0`, `occurredAt`, `note` opcional), con los mensajes en español y el identificador generable en el cliente (convención nº 9).
- [x] 3.2 `lib/inventory/count.ts`: cálculo de la diferencia de un conteo contra el saldo (D6), incluidos el conteo por encima, el conteo por debajo y el caso de diferencia cero, que devuelve un resultado distinguible de un error.
- [x] 3.3 `lib/inventory/movements.ts`: rotulado en español de un movimiento por su `kind` y su `source_type`, y orden descendente por fecha del hecho.
- [x] 3.4 `lib/inventory/stock.ts`: clasificación de un saldo respecto de su mínimo y orden por distancia relativa al mínimo, la regla que usan la tarjeta del panel y el distintivo del catálogo (D10, D11).
- [x] 3.5 Pruebas unitarias de 3.1–3.4 junto al código. Cubren *El ajuste por conteo no pide justificación* → «El saldo pasa al valor contado», «Conteo por encima del saldo», «Conteo que coincide con el saldo»; y *El mínimo por insumo se declara y significa algo* → «Insumo sin mínimo declarado».
- [x] 3.6 `services/inventory/movement-service.ts`: alta de consumo, alta de ajuste, lectura paginada de los movimientos de un ítem y lectura de saldos por organización y por línea. Toda consulta filtra por `organization_id` explícitamente (convención nº 2); ninguna consulta a Supabase fuera de esta capa.
- [x] 3.7 `actions/inventory.ts`: `registerConsumption` y `registerCountAdjustment` con sesión, organización, rol, validación Zod y `revalidatePath` de `/catalog/[id]` y `/dashboard`. Ambas admiten el rol ayudante (matriz §16).
- [x] 3.8 Pruebas unitarias de `services/inventory/` y `actions/inventory.ts` hasta el 90 % exigido para `lib/` y `services/`.

## 4. Diálogos de consumo y de ajuste

- [x] 4.1 `features/inventory/consumption-dialog.tsx`: ítem (preseleccionado cuando el punto de entrada lo conoce), cantidad y nota opcional; confirma sin cambiar de dirección. Cubre *Registrar un consumo cuesta tres interacciones o menos* → «Consumo desde el detalle del insumo», «Consumo desde la retícula de registro rápido».
- [x] 4.2 Prellenado de la nota con la referencia del pedido o de la tarea desde la que se abre, modificable, con `source_type = 'manual'` en todos los casos (D5). Cubre *Registrar un consumo cuesta tres interacciones o menos* → «Consumo desde un pedido», «Varios insumos para el mismo pedido».
- [x] 4.3 `features/inventory/count-dialog.tsx`: un solo campo obligatorio —cuánto hay—, nota opcional, diferencia calculada en el dispositivo (D6) y mensaje explícito cuando el conteo coincide con el saldo, presentado como información y no como fallo. Cubre *El ajuste por conteo no pide justificación* → «No se pide explicación», «Conteo que coincide con el saldo».
- [x] 4.4 Conectar los dos diálogos a la cola: registrar `inventory.consumption` e `inventory.adjustment` en `features/sync/operations.ts` con su `describe` en español, y llamar a `capture()` desde los diálogos en vez de a la Server Action (D7). **No abrir `lib/offline/`.**
- [x] 4.5 Pruebas unitarias de los dos diálogos y del registro de operaciones. Cubren *El consumo y el ajuste se registran sin conexión* → «Reintento sin duplicar»; y *El ajuste por conteo no pide justificación* → «El conteo queda atribuido».

## 5. V11 · Las tres secciones del detalle del ítem

- [x] 5.1 `features/inventory/balance-section.tsx`: saldo derivado, mínimo y estado respecto de él, con las acciones *Registrar consumo* y *Ajuste por conteo*. Solo para ítems de tipo insumo.
- [x] 5.2 `features/inventory/movements-section.tsx`: cantidad, origen rotulado, autor y fecha, en orden descendente y paginada desde la primera carga (design, Risks).
- [x] 5.3 `features/inventory/price-history-section.tsx`: último costo conocido y precios pagados, leídos de `item_last_cost` y de `expense_items`. El servidor **no envía la sección** cuando la consulta devuelve cero filas; ninguna condición sobre el rol en el componente (D9).
- [x] 5.4 Componer las tres secciones en `features/catalog/item-detail.tsx` y su página, retirando el comentario que las declaraba deliberadamente ausentes. Cubre *El detalle del insumo muestra saldo, movimientos y evolución de precios* → «Las tres secciones en un insumo», «El historial explica un número que no cuadra», «El ayudante no ve precios de compra», «Un producto no tiene secciones de inventario»; y `catalog-directory` → *Pantalla de detalle de ítem (V11)* → «Secciones de inventario en un insumo», «Sin secciones de inventario ni costos».
- [x] 5.5 Actualizar `features/catalog/item-detail.test.tsx` para las secciones nuevas, conservando sus escenarios vigentes. Cubre `catalog-directory` → *Pantalla de detalle de ítem (V11)* → «Variantes gestionadas desde el detalle», «Historial en el detalle», «Sin proveedores habituales ni tareas relacionadas».

## 6. Las dos alertas del mínimo

- [x] 6.1 `features/dashboard/low-stock-card.tsx`: insumos por debajo de su mínimo, ordenados por distancia relativa, con nombre, saldo, mínimo y unidad, cada uno abriendo su detalle; mensaje de lista sin contenido cuando no hay ninguno.
- [x] 6.2 Sustituir `LOW_STOCK_PLACEHOLDER` por la tarjeta real en `owner-dashboard.tsx` y en `assistant-dashboard.tsx`, en su misma ranura. KAM-17 ya retiró el marcador de pendientes, así que este era el último: **borrar `features/dashboard/placeholder-card.tsx` entero** junto con su prueba, en vez de dejar un componente sin usuarios (D10). Cubre `dashboard` → *Tarjeta de insumos bajo mínimo* → sus cinco escenarios; *El panel es la puerta de entrada de escritorio y se compone según el rol* → sus cuatro escenarios.
- [x] 6.3 Actualizar `owner-dashboard.test.tsx` y `assistant-dashboard.test.tsx`, retirar `placeholder-card.test.tsx` con su componente, y corregir el listado de piezas de `tests/e2e/assistant-permissions.spec.ts`, que hoy espera el marcador de stock.
- [x] 6.4 Distintivo de bajo mínimo en las filas de insumo de `features/catalog/catalog-screen.tsx`, leído de `below_min`, sin ninguna cifra (D11). Cubre `catalog-directory` → *Pantalla de catálogo (V10)* → «Distintivo de insumo bajo mínimo», «Insumo sin mínimo declarado», «Sin columnas de inventario ni costo».
- [x] 6.5 Actualizar `features/catalog/catalog-screen.test.tsx` conservando sus escenarios vigentes. Cubre `catalog-directory` → *Pantalla de catálogo (V10)* → «Pestañas por tipo», «Fila que abre el detalle».

## 7. El último destino de la retícula

- [x] 7.1 Extender `QuickDestination` para que un destino pueda resolverse como diálogo y no solo como dirección, y ajustar `isAvailable` para ambas formas (D8). Retirar `availableFrom` del destino *Consumo* conservando el campo en el tipo.
- [x] 7.2 Rendir el diálogo de consumo desde la retícula de `/quick` y desde el menú *+ Registrar*, sin cambiar de dirección. Cubre `quick-capture` → *La pantalla de registro rápido ofrece seis destinos* → «Destinos disponibles hoy», «Destinos aún no construidos», «El destino que es diálogo no cambia de pantalla».
- [x] 7.3 Actualizar `lib/quick-capture/destinations.test.ts`, `features/quick-capture/quick-grid.test.tsx` y `register-button.test.tsx`. Cubre `quick-capture` → «Los seis destinos están presentes», «La retícula cabe en un teléfono».
- [x] 7.4 Incluir el consumo en «Registrado hoy», tanto sincronizado como pendiente en la cola, que es lo que el requisito vigente de `quick-capture` ya exige para toda operación cubierta por la captura sin conexión.

## 8. Pruebas de extremo a extremo

- [x] 8.1 `tests/e2e/inventory.spec.ts`: compra → consumo → ajuste, verificando el saldo tras cada paso contra la suma manual, y registrando la medición de interacciones del consumo. Cubre *Registrar un consumo cuesta tres interacciones o menos* → «Consumo desde el detalle del insumo»; *El ajuste por conteo no pide justificación* → «El saldo pasa al valor contado», «Conteo por encima del saldo»; y *El saldo se deriva de los movimientos y nunca se almacena* → «El saldo coincide con la suma manual».
- [x] 8.2 Ampliar el mismo archivo con el mínimo: cruzarlo enciende la tarjeta del panel y el distintivo del catálogo, y una compra posterior las apaga; el selector de línea recorta la tarjeta; activar un insumo de la tarjeta abre su detalle. Cubre *El mínimo por insumo se declara y significa algo* → «Cruzar el mínimo enciende las dos alertas», «Volver por encima del mínimo apaga la alerta», «La alerta respeta la línea activa», «De la alerta al insumo».
- [x] 8.3 Ampliar `tests/e2e/offline-capture.spec.ts` con el consumo sin red: queda encolado, la interfaz lo confirma sin error, conserva su hora al sincronizar y no se duplica. Cubre *El consumo y el ajuste se registran sin conexión* → «Consumo sin red», «La hora es la del taller».
- [x] 8.4 Ampliar `tests/e2e/archive-restore.spec.ts` —o `inventory.spec.ts`, donde encaje mejor— con la corrección de un consumo duplicado mediante un ajuste, comprobando que el consumo erróneo sigue visible. Cubre *Un movimiento no se edita, no se archiva y no se borra* → «Corregir es registrar de nuevo».

## 9. Cierre

- [x] 9.1 Ejecutar la secuencia completa de CI en local: `lint → typecheck → test:unit → supabase start → test:integration → build → test:e2e`. El e2e completo tarda unos 18 minutos: reservarle su tiempo en vez de cortarlo.
- [x] 9.2 Comprobar la cobertura mínima del 90 % en `lib/inventory/` y `services/inventory/`.
- [x] 9.3 Regenerar el grafo con `graphify update .` y versionar `graphify-out/`.
- [x] 9.4 `openspec validate kam-18-soft-inventory --type change --strict` en verde, y repasar que ningún escenario de los cuatro delta specs se ha quedado sin prueba referenciada en este archivo.
