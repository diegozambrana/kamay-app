import type { ItemKind } from "@/types";

/**
 * Qué campos usa cada tipo de ítem. Es la única fuente: la leen el
 * formulario, el listado, el detalle, las variantes y la validación del
 * servidor, para que ninguno pueda discrepar de los demás.
 *
 * Solo figuran los campos que varían. Nombre, línea, unidad, categoría,
 * descripción y foto son de los tres tipos.
 *
 * - El precio de venta solo lo leen los pedidos y el modo feria, que venden
 *   productos: un insumo no se vende y un activo tampoco.
 * - El mínimo solo lo lee `item_balances`, definida sobre `kind = 'supply'`.
 */
export const ITEM_KIND_FIELDS: Record<
  ItemKind,
  { salePrice: boolean; minStock: boolean }
> = {
  supply: { salePrice: false, minStock: true },
  product: { salePrice: true, minStock: false },
  asset: { salePrice: false, minStock: false },
};

/**
 * Deja vacío (`null`) todo campo que no corresponde al tipo, aunque llegue con
 * valor. El resto de los valores pasa sin tocarse.
 */
export function applyKindFields<
  T extends { salePrice: number | null; minStock: number | null },
>(kind: ItemKind, values: T): T {
  const fields = ITEM_KIND_FIELDS[kind];
  return {
    ...values,
    salePrice: fields.salePrice ? values.salePrice : null,
    minStock: fields.minStock ? values.minStock : null,
  };
}

/** El precio de una variante sigue la regla de su ítem. */
export function variantSalePriceFor(
  kind: ItemKind,
  salePrice: number | null,
): number | null {
  return ITEM_KIND_FIELDS[kind].salePrice ? salePrice : null;
}
