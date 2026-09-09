import { registerDirectSale } from "@/actions/fair";
import { registerConsumption, registerCountAdjustment } from "@/actions/inventory";
import { createOrder, updateOrder } from "@/actions/orders";
import { registerOperation } from "@/lib/offline";
import type { DirectSaleInput } from "@/lib/fair/sale-schema";
import type { ConsumptionValues, CountValues } from "@/lib/inventory/schema";
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
/** Consumo de inventario (KAM-18). Un movimiento es siempre un sobre completo. */
export const INVENTORY_CONSUMPTION = "inventory.consumption";
/** Ajuste por conteo físico (KAM-18). */
export const INVENTORY_ADJUSTMENT = "inventory.adjustment";

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

/**
 * Lo que la bandeja enseña de un consumo encolado. Sin el nombre del insumo:
 * el sobre lleva su identificador, no su nombre, y la bandeja no consulta.
 */
export function describeConsumption(payload: unknown): string {
  const values = payload as Partial<ConsumptionValues>;
  const quantity = values.quantity ?? 0;
  return values.note
    ? `Consumo de ${quantity} · ${values.note}`
    : `Consumo de ${quantity}`;
}

/** Lo que la bandeja enseña de un ajuste encolado, con su signo. */
export function describeAdjustment(payload: unknown): string {
  const values = payload as Partial<CountValues>;
  const difference = values.difference ?? 0;
  const signed = difference > 0 ? `+${difference}` : String(difference);
  return `Ajuste por conteo · ${signed}`;
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

  // KAM-18. Un movimiento de inventario tampoco declara `dependsOn`: no espera
  // a ningún padre, porque el insumo ya existe cuando se consume.
  registerOperation(INVENTORY_CONSUMPTION, {
    send: (payload) => registerConsumption(payload),
    describe: describeConsumption,
  });

  registerOperation(INVENTORY_ADJUSTMENT, {
    send: (payload) => registerCountAdjustment(payload),
    describe: describeAdjustment,
  });
}
