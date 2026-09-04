import { createOrder, updateOrder } from "@/actions/orders";
import { registerOperation } from "@/lib/offline";
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

/** Lo que la bandeja enseña de un pedido encolado. Sin jerga y sin número. */
export function describeOrder(payload: unknown, verb: string): string {
  const values = payload as Partial<OrderFormValues>;
  const lines = values.items?.length ?? 0;

  return `${verb} · ${lines} ${lines === 1 ? "línea" : "líneas"}`;
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
}
