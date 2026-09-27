import type { CartLine } from "./cart";
import { cartTotal } from "./cart";

/**
 * Partir un carrito en una venta por línea de negocio y repartir el cobro
 * (`fair-all-lines`, design.md decisión 4).
 *
 * Con «Venta rápida con todas las líneas», cada producto se registra en su
 * línea y los compartidos en la de la feria. El monto cobrado se reparte en
 * proporción al subtotal de cada venta, redondeado a centavos; la última
 * —en el orden en que aparece su línea en el carrito— absorbe la diferencia,
 * de modo que los cobros suman exactamente lo cobrado.
 *
 * Pura: sin identificadores ni horas. Quien arma los sobres pone lo demás.
 */

export type SaleGroup = {
  businessLineId: string;
  lines: CartLine[];
  subtotal: number;
  /** La parte del cobro de esta venta. `0` es una venta sin cobro. */
  amount: number;
};

function cents(value: number): number {
  return Math.round(value * 100) / 100;
}

export function splitSale(
  lines: readonly CartLine[],
  fairLineId: string,
  amount: number,
): SaleGroup[] {
  const byLine = new Map<string, CartLine[]>();
  for (const line of lines) {
    const target = line.businessLineId ?? fairLineId;
    byLine.set(target, [...(byLine.get(target) ?? []), line]);
  }

  const groups = [...byLine].map(([businessLineId, grouped]) => ({
    businessLineId,
    lines: grouped,
    subtotal: cartTotal(grouped),
  }));
  if (groups.length === 0) return [];

  const total = cents(groups.reduce((sum, group) => sum + group.subtotal, 0));
  const paid = cents(amount);

  // Sin total no hay proporción que calcular: el cobro, entero, al primero.
  if (total <= 0) {
    return groups.map((group, index) => ({ ...group, amount: index === 0 ? paid : 0 }));
  }

  let assigned = 0;
  return groups.map((group, index) => {
    const last = index === groups.length - 1;
    const share = last ? cents(paid - assigned) : cents((paid * group.subtotal) / total);
    assigned = cents(assigned + share);
    return { ...group, amount: share };
  });
}
