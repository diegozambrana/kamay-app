# Venta rápida con los productos de todas las líneas

> Origen: pedido de la persona usuaria del 2026-09-26: «por ahora quisiera que todas las líneas se muestren en fair», controlado con una bandera en Configuración. Eligió registrar cada producto en su propia línea (opción B), los compartidos en la línea elegida al abrir la feria, reparto proporcional del cobro parcial y orden por más vendidos de toda la organización.
>
> **Depende de `fair-product-photos-visibility-cart-drawer`**, que modifica los mismos requisitos de `fair-mode` y todavía no está archivado. Este cambio parte del texto de ese delta. Hay que archivar aquel antes que este.

## Why

Un puesto de feria vende productos de varias líneas: tazas de Sublimación junto a macetas de Alfarería. Hoy el modo feria muestra una sola línea (y las compartidas), así que quien atiende tiene que salir y volver a entrar para cobrar un producto de otra línea, o se queda sin poder venderlo. Registrar todo en la línea de la feria resolvería la cuadrícula, pero atribuiría ingresos a la línea equivocada y falsearía el panel, los reportes y el reparto de gastos.

## What Changes

- **Nueva bandera de organización: «Venta rápida con todas las líneas».** Vive en Configuración › General, solo la edita la persona dueña y está **apagada por omisión**. Apagada, el modo feria funciona exactamente como hoy.
- **Encendida, la cuadrícula muestra los productos de todas las líneas activas y los compartidos.** Siguen aplicando los mismos filtros de siempre: producto, sin archivar, con precio y con «Mostrar en venta rápida». Se ordenan por lo más vendido en toda la organización en los últimos 90 días, y cada tarjeta muestra el nombre de su línea (los compartidos dicen «Compartido»).
- **El paso de inicio sigue pidiendo una línea.** Con la bandera, esa línea deja de filtrar la cuadrícula y pasa a ser la línea donde se registran los productos **compartidos**. El canal se sigue eligiendo igual.
- **Registrar un carrito que mezcla líneas crea una venta directa por línea.** Cada producto se registra en su línea, y los compartidos en la línea de la feria. Un carrito de una sola línea sigue creando una sola venta.
- **El cobro se reparte en proporción a lo que suma cada línea.** Se redondea a centavos, la última venta absorbe la diferencia y todas usan el mismo método de pago. Cobrando el total, cada venta queda pagada por su subtotal; con monto 0, ninguna recibe cobro.
- **Registrar sigue siendo una sola operación**, también sin conexión: todas las ventas de un carrito se guardan juntas o no se guarda ninguna. Viajan en un único sobre de la cola, y reenviarlo no duplica nada.
- El recorrido mínimo sigue siendo de cuatro interacciones, y la vuelta a la cuadrícula no espera al servidor.

### Fuera de alcance

- Un modo feria sin línea de inicio. Los productos compartidos necesitan una línea donde registrarse, y la persona eligió la de la feria.
- Una bandera por usuario o por dispositivo: la bandera es de la organización.
- Mostrar productos de líneas **archivadas**. Una línea archivada no recibe trabajo nuevo, así que tampoco ventas.
- Cambiar cómo se muestran las ventas directas en otras pantallas. Cada venta generada es una venta directa ordinaria con su propio número.
- Una vista de historial de ventas de feria (pedida aparte, sin decidir).

## Capabilities

### New Capabilities

_Ninguna._

### Modified Capabilities

- `fair-mode`:
  - la cuadrícula se amplía a todas las líneas cuando la bandera está encendida, con otro orden y la línea en cada tarjeta;
  - la línea elegida al abrir cambia de papel;
  - requisito nuevo: el registro de un carrito con varias líneas, con el reparto del cobro y la atomicidad, también sin conexión.
- `org-configuration`: requisito nuevo para la bandera en Configuración › General, apagada por omisión, editable solo por la persona dueña.

## Impact

- **Base de datos**:
  - migración nueva con la función `create_direct_sales(p_sales jsonb)`, que registra varias ventas en una transacción reutilizando `create_direct_sale`;
  - su prueba pgTAP.
  - El orden de toda la organización no necesita vista nueva: se suman en memoria las filas de `best_selling_products` de todas las líneas.
  - La bandera va en `organizations.settings` y no necesita columna.
- **Configuración**: servicio y formulario de la bandera, en el mismo patrón que la asistencia de redacción (`services/configuration/*`, `features/settings/*`, `app/(app)/settings/general/page.tsx`).
- **Feria, servidor**: `FairSaleService.listSellableProducts` (alcance y orden), `FairProduct` gana `businessLineName`, y `app/(fair)/fair/page.tsx` lee la bandera. Una acción nueva `registerDirectSales` en `actions/fair.ts`.
- **Feria, cliente**:
  - `lib/fair/`: función pura que parte el carrito por línea y reparte el cobro;
  - `lib/fair/sale-envelope.ts`;
  - una operación nueva de la cola, `directSale.createBatch`, en `features/sync/operations.ts`;
  - el indicador de pendientes la cuenta;
  - `fair-screen.tsx`, `fair-start.tsx` (texto de la línea con la bandera) y `product-grid.tsx` (nombre de la línea).
- **Offline**: el formato de una entrada de la cola no cambia (`OUTBOX_SCHEMA_VERSION` igual); se añade un tipo de operación. El snapshot guarda el alcance con el que se capturó.
- **Pruebas**: unitarias del reparto y de la pantalla, integración contra la base real (varias ventas atómicas e idempotentes) y un e2e con la bandera encendida, con red y sin ella.
