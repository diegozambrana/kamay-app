# Venta rápida con foto, catálogo de feria elegido y carrito en panel lateral

> Origen: pedido de la persona usuaria del 2026-09-26: «en la vista `/fair` necesito que se muestre la imagen del producto. También quiero controlar qué productos se pueden mostrar en fair, por lo que desde editar producto se puede indicar si se muestra o no». Tras explorar, añadió: miniatura lateral en la tarjeta; no agregar al tocar la tarjeta sino con un botón *Agregar* y cantidad elegible; abajo *Ver carrito*, que abre un panel a la derecha con el detalle y *Registrar pedido*; al registrar, mensaje de éxito y vista limpia.

## Why

La venta rápida (V6) muestra hoy solo nombre y precio, aunque su requisito ya pide foto: en un puesto con muchos productos parecidos, reconocer por la imagen es más rápido que leer. Además, cualquier producto con precio aparece en la feria, y quien vende no tiene forma de sacar de la cuadrícula lo que no llevó al puesto sin archivarlo (lo que lo borraría también de pedidos y listados). Por último, el toque directo sobre la tarjeta agrega unidades por error, y la barra inferior con la lista del carrito comprime la cuadrícula justo donde se toca.

## What Changes

- **Foto en la tarjeta de la feria, como miniatura lateral.** Cada producto muestra la foto vigente del catálogo (la más reciente) a la izquierda y el nombre y el precio a la derecha. Sin foto, un sustituto que mantiene la tarjeta alineada.
- **Las fotos funcionan sin señal.** Al capturar el catálogo de la feria con conexión, se guardan también las miniaturas en el dispositivo. Abrir la feria sin red, u horas después, muestra las mismas imágenes; si una no se pudo guardar, aparece el sustituto y la venta no se bloquea.
- **Nuevo ajuste por producto: «Mostrar en venta rápida».** Se edita desde el formulario de alta y edición de productos (no aparece en insumos ni activos) y se ve en el detalle del producto. Por omisión está activado, así que al desplegar ningún producto desaparece de la feria. Un producto con el ajuste desactivado no aparece en la cuadrícula, pero sigue en el catálogo, en pedidos y en reportes.
- **BREAKING (interacción): tocar la tarjeta ya no agrega.** Cada tarjeta tiene un selector de cantidad (− / número / +, empieza en 1) y un botón *Agregar* que suma esa cantidad al carrito y devuelve el selector a 1.
- **La barra inferior pasa a ser *Ver carrito*.** Muestra unidades y total y abre un panel lateral derecho. La lista de líneas deja de ocupar la barra.
- **El panel del carrito reúne detalle y cobro.** Muestra cada línea con su cantidad editable (− / +) y un botón para quitarla, el total, el monto a cobrar (propone el total y se puede editar), el método de pago y *Registrar pedido*. Desaparece la hoja inferior *Cobrar*.
- **Registrar muestra éxito y limpia la vista.** El panel se cierra, el carrito queda vacío, los selectores de cantidad vuelven a 1 y aparece un mensaje breve de éxito que no bloquea la venta siguiente. Si la venta quedó en cola por falta de señal, el mensaje lo dice.
- **El recorrido mínimo sigue siendo de cuatro interacciones**: *Agregar*, *Agregar*, *Ver carrito*, *Registrar pedido*.

### Fuera de alcance

- Visibilidad en feria por **variante**: el ajuste es del producto entero. La feria sigue sin elegir variantes.
- Elegir **cliente** al registrar: el requisito actual lo menciona como opcional, pero hoy no está implementado y este cambio no lo añade.
- El ayudante de IA no gana la capacidad de cambiar el ajuste «Mostrar en venta rápida».
- Un filtro o una columna del ajuste en el listado del catálogo (V10).
- Descuentos, impuestos y cobro en varios métodos: siguen fuera, como en KAM-12.
- Cambiar el nombre visible «pedido»/«venta»: el botón dice *Registrar pedido* como se pidió; lo que se registra sigue siendo una venta directa (`direct_sale`).

## Capabilities

### New Capabilities

_Ninguna._

### Modified Capabilities

- `fair-mode`: la cuadrícula filtra por el ajuste «Mostrar en venta rápida» y define la tarjeta con miniatura lateral, selector de cantidad y *Agregar*; el carrito y el cobro pasan a un panel lateral con *Ver carrito* y *Registrar pedido*; la vuelta tras registrar incluye un mensaje de éxito y la vista limpia; la captura sin conexión incluye las miniaturas.
- `catalog-directory`: `items` gana la columna `show_in_fair`; los campos por tipo incluyen «Mostrar en venta rápida» solo en productos, con su regla de servidor.

## Impact

- **Base de datos**: migración nueva que añade `items.show_in_fair boolean not null default true`, con su prueba pgTAP. Guardas afectadas: `lib/activity/fields.ts` y `lib/activity/describe.ts` (campo auditado), `lib/export/tables.ts` (columna al final del manifiesto de `items`).
- **Catálogo**: `services/catalog/item-service.ts`, `actions/catalog.ts` (esquema Zod y regla por tipo), `features/catalog/item-form-dialog.tsx` (interruptor) e `item-detail.tsx` (estado visible).
- **Feria, servidor**: `services/fair/fair-sale-service.ts` filtra por `show_in_fair` y devuelve la URL firmada de la miniatura; `app/(fair)/fair/page.tsx` sin cambio de forma.
- **Feria, sin conexión**: `lib/offline/types.ts` y `lib/offline/db.ts` (versión 3 de Dexie para las miniaturas), `lib/fair/snapshot.ts`, `features/fair/fair-session-store.ts`.
- **Feria, interfaz**: `features/fair/product-grid.tsx` (tarjeta nueva), `cart-bar.tsx` (*Ver carrito*), un panel nuevo que sustituye a `checkout-sheet.tsx`, `fair-screen.tsx`, `lib/fair/cart.ts` y `cart-store.ts` (agregar N unidades y fijar cantidad).
- **Pruebas**: unitarias de feria y catálogo, pgTAP de la columna, integración de `FairSaleService`, y el e2e `tests/e2e/fair-offline.spec.ts` adaptado al recorrido nuevo.
- Sin cambios en `create_direct_sale` ni en el formato de la cola: la venta que se encola es la misma.
