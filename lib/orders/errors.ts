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

  // Los mensajes propios de `create_order` y `update_order` (KAM-08). Suben
  // tal cual desde la base porque ya están escritos para una persona; aquí
  // solo se les da el punto final y se evita el "Intenta de nuevo" del
  // mensaje de reserva, que en estos casos sería un mal consejo.
  if (message.includes("Un pedido necesita al menos una línea")) {
    return "Un pedido necesita al menos una línea.";
  }
  if (message.includes("No perteneces a esa organización")) {
    return "Ese pedido no pertenece a tu organización.";
  }
  if (message.includes("Ese pedido ya no está a tu alcance")) {
    return "Ese pedido ya no está a tu alcance.";
  }
  if (message.includes("no tiene un estado inicial configurado")) {
    return "Esa línea no tiene un estado inicial configurado. Revísalo en Configuración.";
  }
  if (message.includes("order_items_quantity_check")) {
    return "La cantidad de una línea tiene que ser mayor que cero.";
  }
  if (message.includes("order_items_unit_price_check")) {
    return "El precio de una línea no puede ser negativo.";
  }

  return `${fallback} Intenta de nuevo.`;
}
