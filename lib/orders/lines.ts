import { matchesSearch } from "@/lib/search/normalize";
import type { Item, ItemVariant } from "@/types";

/**
 * El total del pedido en pantalla y el buscador de productos del formulario
 * (design.md D7).
 *
 * El total se calcula aquí solo para que el usuario lo vea mientras escribe:
 * **no viaja al servidor y no se guarda** (convención nº 4). El total real es
 * el que devuelve la vista `order_totals`, sumado desde las líneas ya
 * guardadas.
 */

/** Lo mínimo para sumar una línea. Los campos llegan como texto del formulario. */
export type LineAmounts = {
  quantity: number | string;
  unitPrice: number | string;
};

function toNumber(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** `cantidad × precio` de una línea. Un campo a medio escribir cuenta como 0. */
export function lineTotal(line: LineAmounts): number {
  return toNumber(line.quantity) * toNumber(line.unitPrice);
}

/** La suma de las líneas, que es lo que el pie del formulario muestra. */
export function orderTotal(lines: readonly LineAmounts[]): number {
  return lines.reduce((total, line) => total + lineTotal(line), 0);
}

/** Un producto del catálogo con sus variantes vigentes, listo para elegir. */
export type PickableItem = Item & { variants: ItemVariant[] };

/**
 * Los productos que el buscador puede ofrecer para un pedido de esta línea.
 *
 * Se excluye lo archivado —un ítem archivado sale de todos los buscadores
 * (spec `catalog-directory`)— y lo que pertenece a otra línea. Los
 * compartidos (`businessLineId === null`) se ofrecen siempre: esa es
 * justamente su razón de ser.
 *
 * El filtrado por texto usa `matchesSearch`, la misma normalización que
 * aplica la base, para que teclear aquí y buscar allá den lo mismo.
 */
export function pickerCandidates(
  items: readonly PickableItem[],
  businessLineId: string | null,
  term: string,
): PickableItem[] {
  return items.filter((item) => {
    if (item.archivedAt !== null) return false;
    if (
      businessLineId !== null &&
      item.businessLineId !== null &&
      item.businessLineId !== businessLineId
    ) {
      return false;
    }
    return matchesSearch(item.name, term);
  });
}

/**
 * El precio con el que nace una línea: el de la variante elegida si lo tiene,
 * si no el del producto, y 0 cuando el catálogo no fijó ninguno. Es un punto
 * de partida editable, no una atadura — lo que se guarde será lo que quede en
 * la línea.
 */
export function prefilledPrice(
  item: Pick<Item, "salePrice">,
  variant?: Pick<ItemVariant, "salePrice"> | null,
): number {
  return variant?.salePrice ?? item.salePrice ?? 0;
}
