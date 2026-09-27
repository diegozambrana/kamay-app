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
 * - «Mostrar en venta rápida» solo lo lee la cuadrícula del modo feria, que
 *   vende productos.
 */
export const ITEM_KIND_FIELDS: Record<
  ItemKind,
  { salePrice: boolean; minStock: boolean; showInFair: boolean }
> = {
  supply: { salePrice: false, minStock: true, showInFair: false },
  product: { salePrice: true, minStock: false, showInFair: true },
  asset: { salePrice: false, minStock: false, showInFair: false },
};

/**
 * Deja vacío (`null`) todo campo que no corresponde al tipo, aunque llegue con
 * valor. El resto de los valores pasa sin tocarse.
 *
 * `showInFair` es un booleano no nulo: no se «vacía». Cuando no corresponde,
 * queda activado, para que un ítem nunca nazca oculto por un valor que no le
 * toca. En un producto sin el ajuste en la carga, no se añade: la edición no
 * toca lo guardado.
 */
export function applyKindFields<
  T extends { salePrice: number | null; minStock: number | null; showInFair?: boolean },
>(kind: ItemKind, values: T): T & { showInFair?: boolean } {
  const fields = ITEM_KIND_FIELDS[kind];
  return {
    ...values,
    salePrice: fields.salePrice ? values.salePrice : null,
    minStock: fields.minStock ? values.minStock : null,
    ...(fields.showInFair ? {} : { showInFair: true }),
  };
}

/** El precio de una variante sigue la regla de su ítem. */
export function variantSalePriceFor(
  kind: ItemKind,
  salePrice: number | null,
): number | null {
  return ITEM_KIND_FIELDS[kind].salePrice ? salePrice : null;
}
