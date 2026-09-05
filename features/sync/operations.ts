import { registerDirectSale } from "@/actions/fair";
import { createOrder, updateOrder } from "@/actions/orders";
import { registerOperation } from "@/lib/offline";
import type { DirectSaleInput } from "@/lib/fair/sale-schema";
import type { OrderFormValues } from "@/lib/orders/schema";

/**
 * Las operaciones que la cola sabe reenviar (KAM-11).
 *
 * Se registran desde el cascarón de la aplicación, no desde el formulario: el
 * vaciado ocurre aunque nadie tenga abierta la pantalla que encoló, y una
 * operación sin registrar acabaría en la bandeja como «versión anterior» sin
 * serlo.
 *
 * Añadir un dominio es añadir aquí su par de líneas. Cambiar la forma de un
 * `payload` obliga a una clave nueva (ver `lib/offline/README.md`).
 */

export const ORDER_CREATE = "order.create";
export const ORDER_UPDATE = "order.update";
/** Venta de feria: la venta, sus líneas y su cobro en un solo sobre (KAM-12). */
export const DIRECT_SALE_CREATE = "directSale.create";

/** Lo que la bandeja enseña de un pedido encolado. Sin jerga y sin número. */
export function describeOrder(payload: unknown, verb: string): string {
  const values = payload as Partial<OrderFormValues>;
  const lines = values.items?.length ?? 0;

  return `${verb} · ${lines} ${lines === 1 ? "línea" : "líneas"}`;
}

/**
 * Lo que la bandeja enseña de una venta de feria encolada. Sin número —no lo
 * tiene hasta que la base se lo asigne— y con el importe, que es lo único por
 * lo que quien vendió puede reconocerla entre veinte.
 */
export function describeDirectSale(payload: unknown): string {
  const sale = payload as Partial<DirectSaleInput>;
  const units = sale.items?.reduce((sum, line) => sum + (line.quantity ?? 0), 0) ?? 0;
  const total =
    sale.items?.reduce((sum, line) => sum + (line.quantity ?? 0) * (line.unitPrice ?? 0), 0) ?? 0;

  return `Venta de feria · ${units} ${units === 1 ? "unidad" : "unidades"} · ${total}`;
}

export function registerOfflineOperations(): void {
  registerOperation(ORDER_CREATE, {
    send: (payload) => createOrder(payload),
    describe: (payload) => describeOrder(payload, "Pedido nuevo"),
  });

  registerOperation(ORDER_UPDATE, {
    send: (payload) => updateOrder(payload),
    describe: (payload) => describeOrder(payload, "Cambios en un pedido"),
  });

  // KAM-12. Una venta es un solo sobre: la venta, sus líneas y su cobro van
  // juntos, así que no declara `dependsOn` de nada.
  registerOperation(DIRECT_SALE_CREATE, {
    send: (payload) => registerDirectSale(payload),
    describe: describeDirectSale,
  });
}
