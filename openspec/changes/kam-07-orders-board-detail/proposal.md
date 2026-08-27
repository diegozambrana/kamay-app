# KAM-07 · Pedidos: tablero y detalle

## Why

Kamay ya sabe quién trabaja, con qué líneas y con qué estados, pero todavía no sabe **qué trabajo hay comprometido con clientes**. El tablero de pedidos (V3) es la pantalla donde el taller mira su día: qué está en cola, qué se está haciendo, qué se entrega mañana y qué va retrasado. Es también la primera prueba real de que los juegos de estados de KAM-05 sirven para algo — que Sublimación vea sus seis columnas y Alfarería sus tres, en la misma pantalla y sin código condicional por línea. Este cambio instala el modelo de pedidos y las dos pantallas de lectura y movimiento; el alta de pedidos llega después (KAM-08), y por ahora los datos entran por semilla.

## What Changes

- Nueva tabla `orders` según el esquema canónico (§9): `kind` (`order` / `direct_sale`), `code` visible por organización, `contact_id`, `status_id`, `sales_channel_id`, `delivery_mode` (`pickup` / `delivery`), `due_date`, `occurred_at`, `queued_at`, `notes`, `archived_at`, y la restricción `order_needs_customer` (un pedido —no una venta directa— exige cliente). Con sus tres índices.
- Nueva tabla `order_items`: `item_id`, `variant_id`, `description` libre, `quantity`, `unit_price`. **El precio vive en la línea del documento**, nunca solo en el catálogo.
- Trigger `before insert` de numeración por organización: `code = max(code)+1` dentro de la organización, con bloqueo que impide duplicados bajo inserciones simultáneas. Cada organización numera desde #1.
- Nueva vista `order_totals` con `security_invoker = true`: el total se calcula desde `order_items` y **nunca se almacena** (convención nº 4). La columna `paid` de la definición canónica llega en KAM-10, cuando exista `payments`.
- RLS de ambas tablas con el patrón del proyecto (miembros leen, escritura según rol, **sin política `DELETE`**) y trigger `audit` de `activity_log` en la misma migración.
- Servicios `OrderService` y `OrderItemService` (todo acceso a Supabase solo desde `services/`) y Server Actions para mover de estado, reordenar la cola y archivar.
- **V3 · Tablero de pedidos**: columnas resueltas dinámicamente con `resolve_statuses(org, línea, 'order')`, arrastre entre columnas con actualización optimista, vistas alternativas de lista y calendario, filtros y "ver archivados".
- **Columna en cola** (`is_queue = true`): orden por `queued_at` ascendente con número de posición visible (1, 2, 3…), no por fecha comprometida; reordenar dentro de la cola renumera al resto de forma consistente.
- **Alerta de retraso por `kind`**: un pedido vencido muestra alerta si su estado es `in_progress` (o `initial`), y **no** la muestra si es `waiting`, `final` o `cancelled`. La regla compara `kind`, jamás nombres (convención nº 5).
- **V4 · Detalle de pedido**: cliente, línea, canal, modo de entrega, líneas del pedido con su total calculado, fechas, notas, imágenes de referencia e historial leído de `activity_log`.
- Semilla de Geeko Store: pedidos de ejemplo repartidos por las líneas y sus estados, incluidos tres en cola y casos vencidos en `waiting` y en `in_progress`, para que el tablero y las pruebas tengan materia sin depender de KAM-08.

**Fuera de alcance** (copiado del backlog):
- Alta y edición de pedidos (KAM-08). En esta tarea los datos entran por semilla.
- Cobros (KAM-10), rentabilidad (KAM-20), tareas relacionadas (KAM-21).
- Ventas directas y modo feria (KAM-12).

Derivado de lo anterior, tampoco entran en este cambio: la señal de pago de la tarjeta de V3 ni el bloque de cobros y saldo de V4 (necesitan `payments`, KAM-10); el indicador de tareas relacionadas abiertas (KAM-21); el bloque de rentabilidad solo para el dueño (KAM-20).

## Capabilities

### New Capabilities

- `orders`: modelo de pedidos comprometidos con clientes — tablas `orders` y `order_items`, numeración por organización sin duplicados, total derivado en la vista `order_totals` (nunca almacenado), tablero V3 con columnas resueltas por línea, movimiento entre estados con actualización optimista y registro en bitácora, columna en cola ordenada por `queued_at` con posición visible y renumeración consistente, alerta de retraso decidida por `kind`, y detalle V4 con líneas, notas, imágenes de referencia e historial.

### Modified Capabilities

_(ninguna — `activity-log` ya obliga a auditar toda tabla nueva, `tenant-isolation` ya exige RLS sin `DELETE` y `configurable-statuses` ya define `resolve_statuses()` e `is_queue`; `orders` es el primer consumidor de esa capacidad, no la modifica)_

## Impact

- **Base de datos:** una migración nueva `YYYYMMDDHHMMSS_orders.sql` (dos tablas, índices, trigger de numeración, vista `order_totals`, trigger `audit`, RLS). No se edita ninguna migración existente. Ampliación de `supabase/seed.sql` con pedidos de Geeko Store.
- **Almacenamiento:** un bucket de Supabase Storage para las imágenes de referencia del pedido, con política por organización.
- **Código de aplicación:** `services/orders/order-service.ts` y `order-item-service.ts`; Server Actions en `actions/orders.ts`; `features/orders/` con tablero, tarjeta, vistas lista y calendario, y detalle; rutas delgadas en `app/(app)/orders/` y `app/(app)/orders/[id]/`.
- **Dependencia de arrastre:** el tablero necesita una biblioteca de arrastre accesible; la elección y su justificación quedan en `design.md`.
- **Pruebas:** unitarias (cálculo de total, lógica de alerta de retraso por `kind`, orden y renumeración de cola), pgTAP (numeración sin duplicados bajo inserciones simultáneas, RLS, ausencia de `DELETE`), e2e `order-flow.spec.ts` (recorrer un pedido por todos sus estados).
- **Grafo:** regenerar `graphify .` tras la migración (convención nº 6).
- **Dependencias:** **requiere KAM-06 (catálogo y directorio) implementada primero** — `orders.contact_id` referencia `contacts(id)` y `order_items.item_id` referencia `items(id)`, y ninguna de esas tablas existe todavía. Este cambio no puede aplicarse antes de que KAM-06 esté fusionada. KAM-05 (estados configurables) ya está archivada y disponible.
