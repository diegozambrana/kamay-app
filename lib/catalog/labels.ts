import type { AttributeScope, AttributeType, ItemKind } from "@/types";

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
 * Los textos de alta y edición de cada tipo. Van en un mapa y no se forman
 * concatenando «Nuevo » + singular: el día que exista un tipo femenino se
 * añade su fila sin tocar las plantillas.
 */
export const ITEM_KIND_COPY: Record<
  ItemKind,
  {
    newLabel: string;
    createLabel: string;
    editLabel: string;
    firstLabel: string;
    description: string;
  }
> = {
  supply: {
    newLabel: "Nuevo insumo",
    createLabel: "Crear insumo",
    editLabel: "Editar insumo",
    firstLabel: "Crear el primer insumo",
    description: "Lo que compras para producir.",
  },
  product: {
    newLabel: "Nuevo producto",
    createLabel: "Crear producto",
    editLabel: "Editar producto",
    firstLabel: "Crear el primer producto",
    description: "Lo que vendes.",
  },
  asset: {
    newLabel: "Nuevo activo",
    createLabel: "Crear activo",
    editLabel: "Editar activo",
    firstLabel: "Crear el primer activo",
    description: "Una máquina o herramienta del taller.",
  },
};

/**
 * Los textos de la sección «Categorías de ítem» que dependen del tipo de la
 * pestaña. Un mapa y no plantillas, por la misma razón que `ITEM_KIND_COPY`.
 */
export const ITEM_CATEGORY_COPY: Record<
  ItemKind,
  { empty: string; newTitle: string; editTitle: string; none: string }
> = {
  supply: {
    empty: "Aún no hay categorías de insumo",
    newTitle: "Nueva categoría de insumo",
    editTitle: "Editar categoría de insumo",
    none: "Aún no hay categorías de insumo.",
  },
  product: {
    empty: "Aún no hay categorías de producto",
    newTitle: "Nueva categoría de producto",
    editTitle: "Editar categoría de producto",
    none: "Aún no hay categorías de producto.",
  },
  asset: {
    empty: "Aún no hay categorías de activo",
    newTitle: "Nueva categoría de activo",
    editTitle: "Editar categoría de activo",
    none: "Aún no hay categorías de activo.",
  },
};

/** Lo que muestra el selector y el detalle cuando un ítem no tiene categoría. */
export const NO_CATEGORY_LABEL = "Sin categoría";

/**
 * La ausencia de línea no es un campo vacío: es una decisión con nombre.
 * El ítem sirve a todas las líneas.
 */
export const SHARED_LINE_LABEL = "Compartido";

// ── Atributos de categoría (catalog-custom-attributes) ─────────────────────

export const ATTRIBUTE_TYPE_LABELS: Record<AttributeType, string> = {
  text: "Texto",
  number: "Número",
  list: "Lista",
  color: "Color",
};

/** A qué se aplica: «Ítem» o «Variante», como lo dice la tabla de atributos. */
export const ATTRIBUTE_SCOPE_LABELS: Record<AttributeScope, string> = {
  item: "Ítem",
  variant: "Variante",
};

/** Lo que el selector de un atributo de lista muestra para «sin valor». */
export const NO_ATTRIBUTE_VALUE_LABEL = "Sin indicar";

/** El rótulo de una opción que ya no está en la lista pero sigue guardada. */
export const RETIRED_OPTION_SUFFIX = "(opción retirada)";

/**
 * Cómo se describe el tipo en la tabla de atributos: el número con su
 * unidad, la lista con cuántas opciones tiene.
 */
export function attributeTypeSummary(attribute: {
  type: AttributeType;
  unit: string | null;
  options: readonly string[];
}): string {
  const label = ATTRIBUTE_TYPE_LABELS[attribute.type];
  if (attribute.type === "number" && attribute.unit) return `${label} (${attribute.unit})`;
  if (attribute.type === "list") {
    const count = attribute.options.length;
    return `${label} (${count} ${count === 1 ? "opción" : "opciones"})`;
  }
  return label;
}
