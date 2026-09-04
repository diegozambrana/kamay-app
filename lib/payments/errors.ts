/**
 * Traducción de los errores de la base a lo que lee una persona.
 *
 * Vive en `lib/` y no en `actions/` porque un módulo `"use server"` solo
 * puede exportar funciones asíncronas — y porque así se puede probar.
 */
export function paymentErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("Un movimiento de dinero no se edita")) {
    return "Un movimiento de dinero no se edita: anúlalo y registra otro.";
  }
  if (message.includes("Solo la persona dueña puede archivar")) {
    return "Solo la persona dueña puede anular un movimiento.";
  }
  if (message.includes("Un registro archivado no se puede editar")) {
    return "Este movimiento ya está anulado.";
  }
  if (message.includes("exactly_one_target")) {
    return "Un movimiento apunta a un pedido o a un egreso, nunca a los dos.";
  }
  if (message.includes("direction_matches_target")) {
    return "Un cobro va contra un pedido y un pago contra un egreso.";
  }
  if (message.includes("payments_amount_check")) {
    return "El monto tiene que ser mayor que cero.";
  }
  if (message.includes("payments_method_check")) {
    return "Elige una forma de pago válida.";
  }
  if (
    message.includes("payments_order_same_organization") ||
    message.includes("payments_expense_same_organization")
  ) {
    return "Ese documento no es de esta organización.";
  }
  if (message.includes("row-level security") || message.includes("permission denied")) {
    return "No tienes permiso para hacer eso.";
  }

  return `${fallback} Intenta de nuevo.`;
}
