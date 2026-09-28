## 0. Antes de empezar

- [x] 0.1 Archivar `fair-product-photos-visibility-cart-drawer` (`/opsx:archive`), que modifica los mismos requisitos de `fair-mode`, y volver a correr `openspec validate fair-all-lines --strict`
- [x] 0.2 Revisar `.claude/worktrees/*/supabase/migrations` y elegir un timestamp que no choque con ninguna sesión hermana

## 1. Base: varias ventas en una operación

- [x] 1.1 Escribir primero `supabase/tests/direct_sales_batch.test.sql` (pgTAP, `throws_ok` de 4 argumentos):
  - dos ventas de líneas distintas crean dos `orders` `direct_sale` con sus líneas y cobros;
  - llamar dos veces con los mismos `id` no crea nada de más;
  - si la segunda venta es de una línea sin estado final, no persiste ninguna;
  - un miembro de otra organización es rechazado;
  - escenarios «Un carrito de dos líneas crea dos ventas», «Todo o nada», «Reenvío sin duplicados».
- [x] 1.2 Crear la migración con `create_direct_sales(p_sales jsonb) returns uuid[]` (`security invoker`, recorre y llama a `create_direct_sale`) y `grant execute ... to authenticated`; aplicarla con `psql` en el puerto 54422
- [x] 1.3 `supabase test db` del archivo nuevo y de `direct_sale_*.test.sql` en verde

## 2. Configuración: la bandera

- [x] 2.1 Pruebas primero en `services/configuration/fair-settings-service.test.ts`:
  - sin clave se lee apagada;
  - `update` guarda `settings.fair.all_lines` y conserva las demás claves;
  - escenarios «Off by default» y «Other settings are preserved».
- [x] 2.2 Implementar `services/configuration/fair-settings-service.ts` (patrón de `AiWritingAssistService`) y la acción de guardado, solo para la persona dueña
- [x] 2.3 Pruebas en `features/settings/fair-all-lines-form.test.tsx`: interruptor con su explicación de a qué línea va cada venta; guardar envía el valor. Escenarios «Owner turns it on» y «The explanation is shown with the toggle»
- [x] 2.4 Crear `features/settings/fair-all-lines-form.tsx` y montarlo en `app/(app)/settings/general/page.tsx` bajo «Venta rápida»
- [x] 2.5 pgTAP en `supabase/tests/fair_settings_access.test.sql`, en el estilo de `writing_assist_settings_access.test.sql`:
  - el ayudante no puede escribir la bandera;
  - la bitácora registra el cambio;
  - escenarios «The assistant cannot change the toggle» y «Changes are logged».

## 3. Feria, servidor: alcance y orden

- [x] 3.1 Pruebas primero en `services/fair/fair-sale-service.test.ts`:
  - apagada, la consulta de hoy;
  - encendida, `business_line_id` en las líneas activas o nulo;
  - encendida, `best_selling_products` sin filtro de línea y el orden de toda la organización;
  - `businessLineName` resuelto;
  - escenarios «Con la bandera, productos de todas las líneas», «Con la bandera, nada de líneas archivadas», «Con la bandera, el orden es de toda la organización» y «Sin la bandera, nada cambia».
- [x] 3.2 Implementar el alcance en `listSellableProducts` y el campo `businessLineName` en `FairProduct`
- [x] 3.3 `FairSaleService.createMany` con prueba (llama a `create_direct_sales` con el arreglo mapeado) y la acción `registerDirectSales` en `actions/fair.ts` con su prueba: rechaza el lote entero si alguna venta es de otra organización (como `registerDirectSale`) y rechaza menos de 2 o más de 20
- [x] 3.4 `app/(fair)/fair/page.tsx` lee la bandera con `FairSettingsService` y pasa `allLines` y las líneas activas
- [x] 3.5 Prueba de integración en `tests/integration/fair-all-lines.test.ts` con `seedWorkshop`:
  - la cuadrícula con la bandera trae productos de dos líneas y no los de una línea archivada;
  - `registerDirectSales` crea dos ventas con los cobros repartidos;
  - reenviar no duplica.

## 4. Reparto del carrito

- [x] 4.1 `SellableProduct` y `CartLine` ganan `businessLineId`; ajustar `lib/fair/cart.test.ts` y sus usos
- [x] 4.2 Pruebas primero en `lib/fair/split-sale.test.ts`:
  - agrupa por línea destino en orden de aparición;
  - los compartidos van a la línea de la feria;
  - 150 cobrando el total: 90 y 60;
  - 150 cobrando 100: 60 y 40;
  - tres líneas de 10 cobrando 10: 3.33, 3.33 y 3.34;
  - monto 0: sin cobros;
  - un solo grupo lleva el monto entero;
  - escenarios «Un carrito de dos líneas crea dos ventas», «Los compartidos van a la línea de la feria», «Cobro parcial repartido en proporción», «El redondeo no pierde centavos», «Sin cobro» y «Un carrito de una línea crea una venta».
- [x] 4.3 Implementar `lib/fair/split-sale.ts` y `buildSaleEnvelopes` en `lib/fair/sale-envelope.ts` (misma hora, canal y método; `id` propios por venta y cobro), con pruebas del sobre — escenario «Misma hora y canal»

## 5. Cola sin conexión

- [x] 5.1 Pruebas primero:
  - `directSale.createBatch` se registra en `features/sync/operations.ts` y su `describe` dice cuántas ventas y el total;
  - `captureSales` encola **una** entrada con todas las ventas.
- [x] 5.2 Implementar la operación y `captureSales` en `features/fair/sync/capture-sale.ts`
- [x] 5.3 Prueba y cambio en `features/fair/sync/pending-sales-indicator.tsx`: una entrada de lote suma sus ventas — escenario «Un carrito de dos líneas cuenta dos ventas»

## 6. Feria, interfaz

- [x] 6.1 `lib/offline/types.ts` y `lib/fair/snapshot.ts`: `allLines` en el snapshot, y `businessLineId` y `businessLineName` en cada producto; `fair-session-store.ts` los guarda y los restaura. Con pruebas
- [x] 6.2 Pruebas en `features/fair/product-grid.test.tsx`: con `showLine`, cada tarjeta muestra su línea o «Compartido»; sin él, no
- [x] 6.3 Pruebas en `features/fair/fair-start.test.tsx`: con `allLines`, el rótulo es «Línea para los productos compartidos» y hay ayuda; sin él, igual que hoy — escenario «Con la bandera, la línea de la feria recibe los compartidos»
- [x] 6.4 Pruebas en `features/fair/fair-screen.test.tsx`:
  - con la bandera, *Agregar* en productos de dos líneas, *Ver carrito* y *Registrar pedido* llaman a `captureSales` con dos sobres correctos;
  - con una sola línea se usa `captureSale`;
  - la vista queda limpia y aparece el mensaje de éxito;
  - escenarios «Cuatro interacciones con varias líneas» y «Un carrito de una línea crea una venta».
- [x] 6.5 Implementar los cambios en `product-grid.tsx`, `fair-start.tsx` y `fair-screen.tsx`
- [x] 6.6 Correr `npm run test:unit` completo en verde

## 7. E2e

- [x] 7.1 En `tests/e2e/fair-offline.spec.ts`, bloque nuevo con la bandera encendida en una copia de Geeko:
  - la cuadrícula muestra productos de Alfarería y Sublimación con su línea;
  - registrar uno de cada una crea dos ventas en sus líneas;
  - sin red, el indicador sube en dos y al reconectar hay exactamente dos ventas.
- [x] 7.2 En `tests/e2e/settings.spec.ts`: la dueña enciende «Venta rápida con todas las líneas» y el valor persiste al recargar
- [x] 7.3 Correr ambos specs en solitario con Playwright

## 8. Cierre

- [x] 8.1 `npm run lint` y `npm run typecheck` limpios; `npm run test:integration` en verde
- [x] 8.2 Verificar en el navegador (dev en 3010) con una copia de Geeko:
  - encender la bandera;
  - abrir `/fair` y ver productos de todas las líneas con su nombre;
  - vender un carrito mixto con cobro parcial;
  - comprobar en la Bitácora las dos ventas y sus cobros.
- [x] 8.3 Actualizar `scripts/docs-capturas.mjs` si toca la feria; `graphify update .`
- [x] 8.4 `openspec validate fair-all-lines --strict` sin errores
