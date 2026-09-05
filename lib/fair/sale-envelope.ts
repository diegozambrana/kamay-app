import type { CartLine } from "./cart";
import { cartTotal } from "./cart";
import type { DirectSaleInput } from "./sale-schema";
import type { PaymentMethod } from "@/types";

/**
 * El sobre encolable de una venta de feria (KAM-12, design decisión 2).
 *
 * Una venta es **un solo sobre**: la venta, sus líneas y su cobro viajan
 * juntos y se escriben en una sola transacción. Si el cobro se enviara aparte,
 * la cola tendría que garantizar orden y atomicidad entre dos elementos, y el
 * primer fallo de red dejaría ventas sin cobro que nadie va a reconciliar en
 * un puesto de feria.
 *
 * Dos cosas las fija el cliente y no el servidor (convención nº 9):
 *   · el `id` de la venta, de cada línea y del cobro, que es lo que hace
 *     idempotente el reenvío — la cola reintenta con el mismo sobre;
 *   · `occurredAt`, la hora real del hecho: una venta de las 15:40 sin señal,
 *     sincronizada a las 21:00, conserva las 15:40.
 */

export type BuildSaleEnvelopeInput = {
  organizationId: string;
  businessLineId: string;
  salesChannelId: string | null;
  contactId: string | null;
  lines: readonly CartLine[];
  /** Lo cobrado. `0` registra la venta sin cobro. */
  amount: number;
  method: PaymentMethod;
  notes?: string | null;
  /** Se inyectan para que la función sea pura y la prueba pueda fijarlos. */
  saleId: string;
  paymentId: string;
  occurredAt: string;
};

export function buildSaleEnvelope(input: BuildSaleEnvelopeInput): DirectSaleInput {
  return {
    id: input.saleId,
    organizationId: input.organizationId,
    businessLineId: input.businessLineId,
    contactId: input.contactId,
    salesChannelId: input.salesChannelId,
    // La misma hora para la venta y para su cobro: se cobró al venderla.
    occurredAt: input.occurredAt,
    notes: input.notes ?? null,
    items: input.lines.map((line) => ({
      // El `id` que ya tenía la línea del carrito, no uno nuevo: reenviar el
      // sobre no puede crear líneas distintas.
      id: line.id,
      itemId: line.itemId,
      variantId: line.variantId,
      description: null,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    })),
    // Cobrar cero no es un hecho, es la ausencia de uno: no se registra un
    // movimiento de dinero que no ocurrió.
    payment:
      input.amount > 0
        ? { id: input.paymentId, amount: input.amount, method: input.method }
        : null,
  };
}

/** El monto que la hoja de cobro propone: el total del carrito, entero. */
export function proposedAmount(lines: readonly CartLine[]): number {
  return cartTotal(lines);
}
