/**
 * Traducción de los errores de la base a lo que lee una persona.
 *
 * Los mensajes del trigger de archivado ya vienen en español y con código
 * estable; los de restricción (`has_a_role`, unicidad) llegan en inglés desde
 * Postgres. Vive en `lib/` y no en `actions/` porque un módulo `"use server"`
 * solo puede exportar funciones asíncronas — y porque así se puede probar.
 */
export function catalogErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("Solo la persona dueña puede archivar")) {
    return "Solo la persona dueña puede archivar o desarchivar.";
  }
  if (message.includes("Un registro archivado no se puede editar")) {
    return "Este registro está archivado: desarchívalo antes de editarlo.";
  }
  if (message.includes("has_a_role")) {
    return "Un contacto tiene que ser proveedor, cliente o ambos.";
  }
  if (message.includes("item_variants_item_id_name_key")) {
    return "Ese ítem ya tiene una variante con ese nombre.";
  }
  if (message.includes("duplicate key")) {
    return "Ya existe un registro con ese nombre.";
  }
  if (message.includes("items_kind_check")) {
    return "El tipo de ítem no es válido.";
  }

  return `${fallback} Intenta de nuevo.`;
}
