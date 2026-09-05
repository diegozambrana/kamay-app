# KAM-10 · Cobros y pagos

## Why

Kamay ya registra el trabajo comprometido (KAM-07) y lo que sale de caja (KAM-09), pero no registra **el dinero que efectivamente se movió**. Hoy un pedido entregado y un pedido cobrado son indistinguibles: el taller no puede responder "¿cuánto me deben?" ni "¿cuánto debo?" sin abrir un cuaderno aparte. Este cambio instala el único hecho que faltaba para cerrar el ciclo del dinero —el cobro y el pago— y deja que todo lo demás (saldo pendiente, estado de pago, por cobrar, por pagar) se **derive** de él, tal como manda el principio 2 de la especificación funcional y la convención nº 4 del proyecto.

Es además la pieza que la migración de KAM-07 dejó explícitamente pendiente: `order_totals` se creó sin su columna `paid` porque `payments` no existía, con la nota de que llegaría aquí mediante `create or replace view`.

> **Prerequisito declarado:** este cambio asume que **KAM-09 · Egresos** ya está fusionado. `payments.expense_id` referencia `expenses(id)` y la restricción `exactly_one_target` exige que esa tabla exista. Mientras KAM-09 no esté en `main`, este cambio se puede revisar pero **no se puede aplicar**.

## What Changes

- **Nueva tabla `payments`** según el esquema canónico (§ Cobros y pagos): `direction` (`in` / `out`), `order_id`, `expense_id`, `amount numeric(14,2) check (amount > 0)`, `method` (`cash` / `transfer` / `other`), `occurred_at`, `note`, `created_by`, `created_at`, `archived_at`, más sus dos índices por destino.
- **Restricción `exactly_one_target`**: un movimiento apunta a un pedido **o** a un egreso, nunca a los dos ni a ninguno. Lo garantiza la base de datos, no el formulario.
- **Restricción `direction_matches_target`**: un movimiento contra un pedido es siempre `in` (cobro) y uno contra un egreso siempre `out` (pago). No hay forma de registrar un cobro sobre un gasto.
- **`order_totals` gana `paid`** vía `create or replace view` en una migración nueva: `paid` es la suma de los `payments` no archivados del pedido. El **saldo pendiente** es `total - paid`, calculado en el momento de leer, **nunca almacenado**.
- **`expense_totals` gana `paid`** por el mismo mecanismo y con la misma regla.
- **Registro de cobro desde el detalle del pedido (V4)**: diálogo con monto, método, fecha y nota. El diálogo propone el saldo pendiente como monto por omisión, para que el caso normal —cobrar lo que falta— sea un toque.
- **Sobrepago permitido con advertencia**: un cobro mayor al saldo pendiente se avisa antes de guardar pero se acepta; el saldo queda negativo y visible. Un negocio real recibe pagos de más y necesita verlos, no perderlos.
- **Registro de pago desde el detalle del egreso (V7/V8/V9)**: el mismo diálogo, con `direction = 'out'`, solo para el dueño.
- **Anulación por movimiento inverso, nunca por borrado**: anular un cobro archiva el movimiento original (`archived_at`) y deja ambos hechos —el cobro y su anulación— en la bitácora. No hay política `DELETE` (convención nº 3).
- **Estado de pago derivado**: `pendiente` / `parcial` / `pagado` / `sobrepagado` se calcula desde `total` y `paid`. **No existe ningún campo editable de estado de pago**, ni en la tabla ni en el store.
- **Señal de pago en la tarjeta del tablero (V3)** y **bloque de cobros y saldo en el detalle (V4)**: las dos piezas que KAM-07 dejó fuera por depender de `payments`.
- **Indicadores "Por cobrar" y "Por pagar"**: vistas derivadas agregadas por organización y línea de negocio, expuestas en la cabecera del tablero de pedidos y en la de la bandeja de egresos.
- **Permisos por rol**: el ayudante SÍ registra cobros (`direction = 'in'`) y NO registra pagos (`direction = 'out'`), según la matriz de acceso del esquema. Lo decide la política RLS, no el componente.
- **Bitácora**: trigger `audit` sobre `payments` en la misma migración, como toda tabla nueva (convención nº 7).
- Semilla de Geeko Store ampliada con anticipos, pedidos saldados, un pedido sobrepagado y un cobro anulado, para que las pruebas y las pantallas tengan materia.

**Fuera de alcance** (copiado del backlog):
- Cobros en línea o pasarelas de pago.
- Recordatorios automáticos de cobro.
- Conciliación bancaria.

Derivado de lo anterior, tampoco entran: las tarjetas de dinero del panel principal V2 (llegan en KAM-14 y **consumirán** las vistas que este cambio crea); el cobro en modo feria (KAM-12); la cola de sincronización sin conexión de `payments` (KAM-11, que ya contempla el orden padre → hijo); el bloque de rentabilidad y los reportes de flujo (KAM-20).

**Supuesto registrado:** el backlog pide los indicadores "Por cobrar" y "Por pagar" sin decir dónde viven, y su ubicación natural —V2— todavía no existe. Este cambio los crea como **vistas derivadas** y los muestra en las cabeceras de V3 y V7; KAM-14 los reutiliza sin recalcular nada.

## Capabilities

### New Capabilities

- `payments`: movimientos reales de dinero — tabla `payments` con destino único y dirección forzados por la base de datos, registro de cobros contra pedidos y de pagos contra egresos, saldo pendiente y estado de pago derivados y nunca almacenados, sobrepago permitido con advertencia y saldo negativo visible, anulación mediante movimiento inverso con ambos hechos en la bitácora, indicadores agregados "Por cobrar" y "Por pagar", y separación por rol entre cobrar (ayudante y dueño) y pagar (solo dueño).

### Modified Capabilities

- `orders`: la vista `order_totals` deja de exponer solo `total` y pasa a exponer también `paid`, con el saldo pendiente derivado de ambos; la tarjeta del tablero incorpora la señal de pago que quedó pendiente en KAM-07; el detalle del pedido incorpora el bloque de cobros y saldo con la acción *Registrar cobro*.

## Impact

- **Base de datos:** una migración nueva `YYYYMMDDHHMMSS_payments.sql` (tabla `payments`, sus dos restricciones, dos índices, `create or replace view order_totals` y `expense_totals` con `paid`, vistas de indicadores, trigger `audit`, trigger `enforce_archive`, RLS por rol **sin política `DELETE`**). No se edita ninguna migración existente (convención nº 6). Ampliación de `supabase/seed.sql`.
- **Vistas afectadas:** `order_totals` (creada en `20260826200000_orders.sql`) y `expense_totals` (creada por KAM-09) se redefinen con `create or replace view`, conservando `security_invoker = true` y su `grant select`.
- **Código de aplicación:** `services/payments/payment-service.ts`; Server Actions en `actions/payments.ts` (registrar cobro, registrar pago, anular); `features/payments/` con el diálogo de registro, la insignia de estado de pago y el bloque de saldo; modificaciones en `features/orders/order-card.tsx` y `features/orders/order-detail.tsx`; punto de entrada equivalente en la pantalla de egresos de KAM-09.
- **Dependencias nuevas:** ninguna. Se reutilizan shadcn `dialog`, `alert-dialog`, `badge` y `field`, ya presentes.
- **Pruebas:** unitarias (cálculo de saldo, estado de pago derivado, casos límite de sobrepago y de cobro anulado); pgTAP (`exactly_one_target`, `direction_matches_target`, `amount > 0`, ausencia de `DELETE`, aislamiento por organización, y el permiso por rol: el ayudante inserta `direction = 'in'` y es rechazado en `direction = 'out'`); e2e `order-payments.spec.ts` (anticipo, saldo, cobro final y anulación sobre un pedido completo).
- **Grafo:** regenerar `graphify .` tras la migración (convención nº 6).
- **Riesgo de bloqueo:** KAM-09 no está fusionado. Sin `expenses`, la migración de este cambio falla al crear la referencia `payments.expense_id`. Es un bloqueo de orden de fusión, no de diseño.
