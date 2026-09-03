/**
 * Traducción de los errores de la base a lo que lee una persona.
 *
 * Vive en `lib/` y no en `actions/` porque un módulo `"use server"` solo
 * puede exportar funciones asíncronas — y porque así se puede probar.
 */
export function expenseErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("Solo la persona dueña puede archivar")) {
    return "Solo la persona dueña puede archivar o desarchivar.";
  }
  if (message.includes("Un registro archivado no se puede editar")) {
    return "Este egreso está archivado: desarchívalo antes de tocarlo.";
  }
  if (message.includes("Solo la persona dueña registra egresos")) {
    return "Solo la persona dueña registra egresos.";
  }
  if (message.includes("purchase_needs_supplier")) {
    return "Una compra necesita un proveedor.";
  }
  if (message.includes("expense_needs_category_and_amount")) {
    return "Un gasto necesita monto y categoría.";
  }
  if (message.includes("purchase_has_no_own_amount")) {
    return "El total de una compra se calcula desde sus insumos.";
  }
  // Los mensajes propios de `create_expense` suben tal cual desde la base
  // porque ya están escritos para una persona; aquí solo se les da el punto
  // final y se evita el "Intenta de nuevo" del mensaje de reserva.
  if (message.includes("Una compra necesita al menos una línea")) {
    return "Una compra necesita al menos un insumo.";
  }
  if (message.includes("Un gasto no lleva líneas")) {
    return "Un gasto no lleva insumos.";
  }
  if (message.includes("expense_items_quantity_check")) {
    return "La cantidad de un insumo tiene que ser mayor que cero.";
  }
  if (message.includes("expense_items_unit_price_check")) {
    return "El precio de un insumo no puede ser negativo.";
  }
  if (message.includes("row-level security") || message.includes("permission denied")) {
    return "No tienes permiso para hacer eso.";
  }

  return `${fallback} Intenta de nuevo.`;
}
