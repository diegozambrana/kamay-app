/**
 * Traducción de los errores de la base a lo que lee una persona.
 *
 * Vive en `lib/` y no en `actions/` porque un módulo `"use server"` solo
 * puede exportar funciones asíncronas — y porque así se puede probar.
 */
export function orderErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("Solo la persona dueña puede archivar")) {
    return "Solo la persona dueña puede archivar o desarchivar.";
  }
  if (message.includes("Un registro archivado no se puede editar")) {
    return "Este pedido está archivado: desarchívalo antes de editarlo.";
  }
  if (message.includes("order_needs_customer")) {
    return "Un pedido necesita un cliente.";
  }
  if (message.includes("orders_delivery_mode_check")) {
    return "El modo de entrega no es válido.";
  }

  return `${fallback} Intenta de nuevo.`;
}
