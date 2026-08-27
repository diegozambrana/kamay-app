import type { ItemKind } from "@/types";

/** Cómo se nombran los tipos de ítem en la interfaz (mapa de navegación V10). */
export const ITEM_KIND_LABELS: Record<ItemKind, string> = {
  supply: "Insumos",
  product: "Productos",
  asset: "Activos",
};

export const ITEM_KIND_SINGULAR: Record<ItemKind, string> = {
  supply: "Insumo",
  product: "Producto",
  asset: "Activo",
};

/**
 * La ausencia de línea no es un campo vacío: es una decisión con nombre.
 * El ítem sirve a todas las líneas.
 */
export const SHARED_LINE_LABEL = "Compartido";
