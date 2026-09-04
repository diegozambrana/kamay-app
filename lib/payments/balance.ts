import type { PaymentStatus } from "@/types";

/**
 * Redondeo a centavos. Mismo motivo que en `lib/expenses/totals.ts`: la suma
 * de flotantes no puede mostrar 0.30000000000000004 en una pantalla de
 * dinero. `numeric(14,2)` llega desde PostgREST como texto y se convierte al
 * borde; aquí solo se protege la aritmética que hace la aplicación.
 */
function cents(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  // `Math.round` de un negativo minúsculo devuelve `-0`, que se formatea
  // como "-0" en pantalla: un pedido saldado al céntimo mostraría un saldo
  // negativo. Se normaliza aquí y no en cada consumidor.
  return rounded === 0 ? 0 : rounded;
}

function safe(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/**
 * Saldo pendiente de un documento: total menos cobrado (o pagado).
 *
 * Puede ser negativo, y eso es información, no un error: un cliente que pagó
 * de más tiene saldo a favor y el detalle lo muestra tal cual. Solo los
 * indicadores agregados recortan a cero, y lo hacen en la vista.
 *
 * Nunca se almacena (convención nº 4): se calcula al leer, aquí y en ningún
 * otro sitio.
 */
export function balance(total: number, paid: number): number {
  return cents(safe(total) - safe(paid));
}

/**
 * Estado de pago derivado de `total` y `paid`. No existe ninguna columna ni
 * control que lo fije: es una lectura, no un dato.
 *
 * Un documento sin nada que cobrar sale `paid`, no `pending`: no está
 * pendiente de cobro quien no debe nada. El caso aparece con un pedido sin
 * líneas y es el que más fácil se resuelve mal.
 */
export function paymentStatus(total: number, paid: number): PaymentStatus {
  const pending = balance(total, paid);

  if (pending < 0) return "overpaid";
  if (pending === 0) return "paid";
  if (cents(safe(paid)) === 0) return "pending";
  return "partial";
}

/** Cuánto excede un cobro al saldo pendiente. Cero si no lo excede. */
export function overpayment(pendingBalance: number, amount: number): number {
  const excess = cents(safe(amount) - safe(pendingBalance));
  return excess > 0 ? excess : 0;
}
