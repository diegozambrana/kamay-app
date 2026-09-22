import type { ItemVariant } from "@/types";

/**
 * ¿Puede un movimiento de salida o de ajuste llevar esta variante?
 * (`catalog-custom-attributes`, design D7.)
 *
 * - Un ítem con variantes vigentes exige elegir una: un consumo sin variante
 *   bajaría un saldo que ningún color tiene, y el saldo por variante dejaría
 *   de decir la verdad. Es la misma regla que la compra ya aplica.
 * - La única excepción es el conteo de la fila «Sin variante»
 *   (`allowUnassigned`), que pone en su valor real lo que se movió sin
 *   variante antes de que el ítem las tuviera.
 * - La variante tiene que ser del ítem y estar vigente. La base también exige
 *   que sea del ítem; lo de vigente solo puede decidirse aquí.
 *
 * Devuelve el mensaje de error, o `null` si se puede.
 */
export function movementVariantProblem(
  variants: readonly ItemVariant[],
  variantId: string | null,
  options: { allowUnassigned?: boolean } = {},
): string | null {
  if (variantId === null) {
    const hasActive = variants.some((variant) => variant.archivedAt === null);
    if (hasActive && !options.allowUnassigned) {
      return "Elige la variante: este insumo tiene variantes.";
    }
    return null;
  }

  const variant = variants.find((candidate) => candidate.id === variantId);
  if (!variant) return "Esa variante no es de este insumo.";
  if (variant.archivedAt !== null) return "Esa variante está archivada. Elige otra.";
  return null;
}
