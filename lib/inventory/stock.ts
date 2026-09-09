import type { ItemBalance } from "@/types";

/**
 * Cuándo un insumo está bajo mínimo y en qué orden urge.
 *
 * `belowMin` lo calcula la vista `item_balances`, no este módulo: la tarjeta
 * del panel, el distintivo del catálogo y la sección de saldo de V11 leen la
 * misma bandera y no pueden discrepar (design D4). Lo que vive aquí es el
 * **orden**, que la base no tiene por qué saber.
 */

/**
 * Cuánto falta para el mínimo, en proporción al propio mínimo.
 *
 * Relativa y no absoluta a propósito: un insumo con 2 de 10 está peor que uno
 * con 40 de 50, aunque le falten 8 unidades frente a 10. Quien decide qué
 * comprar necesita ese orden, no el de la resta.
 *
 * Devuelve 0 para lo que no está bajo mínimo, de modo que ordenar de mayor a
 * menor deja siempre lo urgente arriba.
 */
export function shortfallRatio(balance: ItemBalance): number {
  if (!balance.belowMin || balance.minStock === null) return 0;

  // Un mínimo de cero no puede dividir. Solo se llega aquí con saldo negativo
  // —el sistema debe entradas que nadie registró—, y eso es lo más urgente que
  // hay: se ordena por la deuda absoluta, por encima de cualquier proporción.
  if (balance.minStock <= 0) return Number.POSITIVE_INFINITY;

  return (balance.minStock - balance.balance) / balance.minStock;
}

/**
 * Los insumos bajo mínimo, del más urgente al menos. Empate deshecho por
 * `itemId` para que el orden sea estable entre cargas.
 */
export function sortByUrgency(balances: ItemBalance[]): ItemBalance[] {
  return [...balances]
    .filter((balance) => balance.belowMin)
    .sort((a, b) => {
      const difference = shortfallRatio(b) - shortfallRatio(a);
      if (difference !== 0) return difference;
      return a.itemId.localeCompare(b.itemId);
    });
}

/** Lo que hace falta saber de un ítem para recortar sus saldos. */
export type ScopeItem = {
  businessLineId: string | null;
  archivedAt: string | null;
};

/**
 * Recorta los saldos a los insumos vigentes del alcance pedido.
 *
 * Vive aquí y no en la consulta porque `item_balances` es una vista agregada
 * y PostgREST no sabe unirla con `items`. Hacerlo en memoria no cuesta nada
 * —el catálogo de un taller son decenas de insumos (§Volumen esperado)— y a
 * cambio la regla queda probada sin base de datos.
 *
 * Una línea concreta incluye **siempre** los ítems compartidos
 * (`businessLineId` nulo): lo transversal es de todos por definición, igual
 * que en el resto del sistema. `businessLineId` nulo como argumento significa
 * "todas las líneas", que es lo que dice el selector global en «Todas».
 *
 * Un saldo cuyo ítem no está en el mapa se descarta: sin poder comprobar su
 * línea ni su archivado, mostrarlo sería adivinar.
 */
export function scopedToLine(
  balances: readonly ItemBalance[],
  items: ReadonlyMap<string, ScopeItem>,
  businessLineId: string | null,
): ItemBalance[] {
  return balances.filter((balance) => {
    const item = items.get(balance.itemId);
    if (!item || item.archivedAt !== null) return false;
    if (businessLineId === null) return true;
    return item.businessLineId === businessLineId || item.businessLineId === null;
  });
}
