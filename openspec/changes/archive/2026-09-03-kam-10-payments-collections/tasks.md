> Cada tarea de prueba nombra los escenarios del delta spec que cubre (convención nº 12: ningún escenario sin prueba referenciada). Los escenarios viven en `specs/payments/spec.md` y `specs/orders/spec.md` de este cambio.

## 0. Requisito previo

- [x] 0.1 Verificar que KAM-09 está fusionado en `main`: existen `expenses`, `expense_items` y la vista `expense_totals`. Sin eso la migración de la tarea 1 no arranca (ver `design.md` — Migration Plan, paso 1). Si no está, detener aquí y no escribir la migración.

## 1. Migración de base de datos

- [x] 1.1 Crear `supabase/migrations/<AAAAMMDDHHMMSS>_payments.sql` (archivo nuevo; no editar ninguna migración existente) con la tabla `payments` del esquema canónico: `id uuid primary key default gen_random_uuid()`, `organization_id` obligatorio, `direction` con `check (direction in ('in','out'))`, `order_id`, `expense_id`, `amount numeric(14,2) not null check (amount > 0)`, `method` con `check (method in ('cash','transfer','other'))`, `occurred_at`, `note`, `created_by`, `created_at`, `archived_at`.
- [x] 1.2 Añadir en la misma migración las restricciones `exactly_one_target` y `direction_matches_target` con la definición literal del esquema canónico, y los índices sobre `(order_id)` y `(expense_id)`.
- [x] 1.3 Adjuntar `create trigger enforce_archive before update on payments for each row execute function enforce_archive_rules()` — reutiliza la función existente de `20260826120000_catalog.sql`, no escribir una nueva (design, decisión 6).
- [x] 1.4 Adjuntar `create trigger audit after insert or update on payments for each row execute function log_activity()` en la misma migración que crea la tabla (convención nº 7).
- [x] 1.5 Redefinir `order_totals` con `create or replace view`, conservando `security_invoker = true`, el orden de columnas actual y añadiendo `paid` **al final** como suma de `payments` con `archived_at is null` (design, decisión 2).
- [x] 1.6 Redefinir `expense_totals` con `create or replace view` de la misma forma, añadiendo `paid` al final.
- [x] 1.7 Crear las vistas `receivables_by_line` y `payables_by_line` con `security_invoker = true`, agregando `greatest(total - paid, 0)` por organización y línea de negocio sobre documentos no archivados (design, decisión 7).
- [x] 1.8 Escribir `grant` / `revoke` siguiendo el patrón de `20260826200000_orders.sql`: `select, insert, update` a `authenticated`; `revoke delete` a todos; `revoke insert, update` a `anon` y `service_role`; `grant select` de las tres vistas nuevas a `authenticated, service_role`.
- [x] 1.9 Activar RLS en `payments` y escribir las políticas: lectura si `is_member`; `INSERT` con `is_member(organization_id) and (direction = 'in' or is_owner(organization_id))`; `UPDATE` solo `is_owner`. **Sin política `DELETE`** (convención nº 3, design decisiones 5 y 6).

## 2. Pruebas pgTAP de la migración

- [x] 2.1 `supabase/tests/payment_integrity.test.sql`: dominio y monto. Cubre *Modelo de movimiento de dinero* → «Movimiento válido», «Monto cero», «Monto negativo», «Método fuera del dominio», «Método ausente».
- [x] 2.2 Ampliar `payment_integrity.test.sql` con destino y dirección. Cubre *Un movimiento apunta exactamente a un destino* → «Movimiento con dos destinos», «Movimiento sin destino», «Movimiento contra un pedido», «Movimiento contra un egreso»; y *La dirección se deduce del destino* → «Cobro de pedido», «Pago de egreso», «Dirección contraria sobre un pedido», «Dirección contraria sobre un egreso».
- [x] 2.3 Ampliar `payment_integrity.test.sql` con inmutabilidad. Cubre *Un movimiento registrado no se edita* → «Intento de corregir el importe», «Intento de cambiar el destino», «Archivar sí está permitido»; y *Anular un cobro* → «La fila no se borra», «Un movimiento archivado no se edita».
- [x] 2.4 `supabase/tests/payment_totals.test.sql`: comprobar la lista y el orden de columnas de `order_totals` y `expense_totals` tras el `create or replace` (mitigación del riesgo de forma frágil, design), y el cálculo de `paid`. Cubre *El saldo pendiente se deriva* → «Pedido con anticipo», «Pedido sin cobros», «Se registra un cobro adicional», «Un cobro archivado no cuenta», «Egreso pagado en parte», «Ninguna columna almacena el derivado»; y el delta de `orders` → *El total del pedido se deriva* → «Cobrado de un pedido con anticipo», «Pedido sin cobros», «La vista sigue respetando al invocante», «Ninguna columna almacena el derivado».
- [x] 2.5 Ampliar `payment_totals.test.sql` con los indicadores. Cubre *Indicadores agregados Por cobrar y Por pagar* → «Por cobrar con varios pedidos», «Un pedido sobrepagado no resta», «Filtro por línea de negocio», «El ayudante no ve Por pagar», «Ningún pedido pendiente».
- [x] 2.6 `supabase/tests/payment_access.test.sql`: permisos por rol y aislamiento, con su propia organización (regla de pruebas del proyecto). Cubre *El ayudante cobra pero no paga* → los cinco escenarios; y *Aislamiento por organización de los movimientos* → «Movimientos de otra organización», «Crear en organización ajena», «Destino de otra organización».
- [x] 2.7 Añadir `payments` a `supabase/tests/no_delete.test.sql` y a `rls_isolation.test.sql`, junto al resto de tablas del proyecto.

## 3. Reglas puras y pruebas unitarias

- [x] 3.1 Crear `lib/payments/balance.ts` con `balance(total, paid)` y `paymentStatus(total, paid)` devolviendo `pending | partial | paid | overpaid`, operando sin coma flotante acumulada (design, decisiones 3 y 8).
- [x] 3.2 `lib/payments/balance.test.ts`. Cubre *El estado de pago se deriva, no se edita* → «Pedido sin cobros», «Pedido con anticipo», «Pedido saldado», «Pedido de total cero»; y *El sobrepago se advierte pero se permite* → el saldo negativo de «Sobrepago confirmado».
- [x] 3.3 Añadir al mismo archivo los casos con decimales (por ejemplo total `0.30` cobrado en `0.10 + 0.20`) que delatan un redondeo de coma flotante, según la mitigación del design.
- [x] 3.4 Crear `lib/payments/payment-schema.ts` (Zod) con monto positivo, método del dominio y fecha, y su prueba `payment-schema.test.ts`. Cubre *Registrar un cobro desde el detalle del pedido* → «Monto vacío o no positivo».

## 4. Servicio y acciones de servidor

- [x] 4.1 Crear `services/payments/payment-service.ts` con el `SupabaseClient` inyectado (todo acceso a Supabase solo desde `services/`): listar movimientos de un documento, crear, archivar, y leer los indicadores.
- [x] 4.2 `services/payments/payment-service.test.ts` con cliente simulado, cubriendo forma de consulta, filtro por `organization_id` explícito (aunque RLS ya filtre) y exclusión de archivados. Cobertura mínima 90 % en `services/`.
- [x] 4.3 Crear `actions/payments.ts` con `"use server"`: `registerCollection`, `registerPayment` y `voidPayment`, cada una validando sesión, organización, rol y Zod, y llamando a `revalidatePath` de las rutas afectadas.
- [x] 4.4 Comprobar en `registerPayment` que el rol es dueño antes de llegar a la base, para dar un mensaje claro; dejar constancia en el código de que la garantía real es la política RLS, no esta comprobación (design, decisión 5).

## 5. Interfaz: cobros en pedidos

- [x] 5.1 Crear `features/payments/payment-dialog.tsx`: diálogo con monto, método, fecha y nota, con el saldo pendiente como monto por omisión. Un solo nivel de profundidad, nunca otra pantalla (mapa de navegación).
- [x] 5.2 Añadir al diálogo la advertencia de sobrepago con el excedente calculado, que informa pero no bloquea la confirmación.
- [x] 5.3 Crear `features/payments/payment-status-badge.tsx`, alimentado por `paymentStatus()` de la tarea 3.1, con los textos visibles en español (convención nº 8).
- [x] 5.4 Crear `features/payments/payment-list.tsx`: lista de movimientos con importe, método, fecha y acción de anular visible solo para el dueño.
- [x] 5.5 Modificar `features/orders/order-detail.tsx` para incluir el bloque de cobros y saldo con la acción *Registrar cobro*.
- [x] 5.6 Modificar `features/orders/order-card.tsx` para mostrar la señal de pago derivada, sin ningún control que permita fijarla.
- [x] 5.7 Actualizar el servicio y las consultas del tablero para traer `paid` junto con `total`, de modo que la señal de pago no cueste una consulta por tarjeta.
- [x] 5.8 Aplicar actualización optimista solo al saldo y a la insignia; refrescar la lista de movimientos con la respuesta real (design, decisión 8).
- [x] 5.9 Pruebas de componente: `features/payments/payment-dialog.test.tsx` y `payment-status-badge.test.tsx`. Cubren *Registrar un cobro desde el detalle del pedido* → «Cobro del saldo completo», «Anticipo parcial», «Monto vacío o no positivo»; *El sobrepago se advierte pero se permite* → «Advertencia antes de confirmar», «Sobrepago confirmado», «El importe no se recorta»; y *El estado de pago se deriva* → «No hay control para fijarlo».
- [x] 5.10 Ampliar `features/orders/order-card.test.tsx`. Cubre el delta de `orders` → *Tarjeta del tablero* → «Señal de pago de un pedido con anticipo», «Señal de pago de un pedido saldado», «La señal de pago no depende del estado del pedido», y comprobar que los escenarios previos («Pedido con modo de entrega», «Datos opcionales ausentes», «Abrir el detalle») siguen pasando.
- [x] 5.11 Prueba de `order-detail`. Cubre el delta de `orders` → *Detalle del pedido* → «Bloque de cobros y saldo», «Pedido sin cobros», y comprobar que «Pedido completo», «Historial», «Cambio de estado desde el detalle» e «Imagen de referencia» siguen pasando.

## 6. Interfaz: pagos en egresos e indicadores

- [x] 6.1 Añadir el punto de entrada *Registrar pago* al detalle de egreso de KAM-09, reutilizando `payment-dialog.tsx` con `direction = 'out'`. No renderizarlo para el ayudante (design, riesgo de la bandeja vacía).
- [x] 6.2 Mostrar en la bandeja de egresos el estado de pago derivado de cada egreso, con el mismo componente de insignia.
- [x] 6.3 Prueba de componente del punto de entrada de pagos. Cubre *Registrar un pago desde el detalle del egreso* → «Pago parcial de una compra».
- [x] 6.4 Crear `features/payments/outstanding-summary.tsx` y montarlo en la cabecera del tablero de pedidos (Por cobrar) y en la de la bandeja de egresos (Por pagar), sumando en la aplicación las filas por línea cuando la línea activa es «Todas».
- [x] 6.5 Prueba de `outstanding-summary`: total por línea, total agregado y el caso de cero, sin recalcular el recorte a cero que ya hace la vista.

## 7. Semilla y verificación de extremo a extremo

- [x] 7.1 Ampliar `supabase/seed.sql` de Geeko Store con: un pedido con anticipo parcial, uno saldado, uno sobrepagado, uno con un cobro anulado y un egreso pagado en parte.
- [x] 7.2 Ampliar `supabase/tests/seed_geeko.test.sql` para comprobar que esos cinco casos existen y que sus saldos derivados son los esperados.
- [x] 7.3 Crear `tests/e2e/order-payments.spec.ts`: registrar un anticipo, ver el saldo, registrar el cobro final, ver el estado `pagado`, y anular un cobro comprobando que el saldo vuelve. Cubre *Registrar un cobro* → «El cobro queda en la bitácora»; y *Anular un cobro* → «Anulación devuelve el saldo», «Ambos hechos quedan registrados», y *Un movimiento registrado no se edita* → «Corrección por la vía prevista».
- [x] 7.4 Ampliar `tests/e2e/order-board.spec.ts` para comprobar la señal de pago en la tarjeta y el indicador Por cobrar en la cabecera.

## 8. Cierre

- [x] 8.1 `supabase db reset` y `supabase test db` en local, sin errores.
- [x] 8.2 Regenerar el grafo con `graphify .` tras el cambio de esquema (convención nº 6) y versionar `graphify-out/`.
- [ ] 8.3 Ejecutar la secuencia completa: `lint → typecheck → test:unit → test:integration → build → test:e2e`. **Pendiente de una pasada limpia:** `lint`, `typecheck`, `test:unit` (621), `test:integration` (444 pgTAP) y `build` pasan; `test:e2e` no se ha podido demostrar en verde de una sola pasada en esta máquina (ver nota abajo).
- [x] 8.4 Comprobar la cobertura mínima del 90 % en `lib/payments/` y `services/payments/`.
- [x] 8.5 Revisar que ningún archivo fuera de `services/` consulta Supabase y que `"use server"` solo aparece en `actions/` (convención nº 1).

---

## Nota sobre la tarea 8.3 (e2e)

Las cuatro pruebas e2e de este cambio —las dos de `order-payments.spec.ts` y el
bloque nuevo de `order-board.spec.ts`— pasan de forma consistente. Lo que no se
ha logrado es una pasada limpia de **toda** la suite e2e en esta máquina, por
dos causas ajenas a KAM-10:

1. **`order-edit.spec.ts:117` («el ayudante edita la nota y la cantidad») falla
   igual sin este cambio.** Comprobado guardando el trabajo en un `stash`,
   reiniciando la base y ejecutando la prueba sobre el código anterior: falla
   exactamente igual, en `crearPedido`, con «No se pudo guardar el pedido».
   Es un fallo previo, no una regresión de este cambio.

2. **Los reinicios repetidos disparan el limitador de intentos de GoTrue.** A
   partir de cierto número de `supabase db reset` + suite completa, los
   `login` empiezan a devolver «Correo o contraseña incorrectos» y arrastran
   pruebas de cualquier archivo, distintas en cada pasada. Se confirmó leyendo
   el snapshot de error de Playwright, y reiniciando
   `supabase_auth_kamay-app` las pruebas vuelven a pasar.

La mejor pasada obtenida tras reiniciar el contenedor de auth fue **94 pasadas
y 1 fallo**, siendo ese único fallo el del punto 1.

Antes de dar por cerrada esta tarea conviene ejecutar la suite en CI —donde
cada corrida arranca con contenedores limpios— y tratar el punto 1 como lo que
es: un fallo previo que merece su propia corrección.
