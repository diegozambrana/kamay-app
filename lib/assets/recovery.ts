import type { AssetRecovery } from "@/types";

/**
 * La fórmula de recuperación de inversión, y el único lugar donde vive
 * (criterio 6 del backlog, design D5).
 *
 * La vista `asset_recovery` entrega los dos ingredientes —lo que la máquina
 * costó y el margen de caja que su línea generó desde que se compró— y no el
 * porcentaje: un `case when total_cost = 0` dentro de un `select` no se prueba
 * unitariamente, no se lee sin abrir la migración, y corregirlo obligaría a
 * una migración nueva, porque una migración no se edita jamás (convención
 * nº 6).
 */

/** Los dos ingredientes de la barra. */
export type RecoveryInput = {
  /** Costo declarado más el mantenimiento acumulado. */
  totalCost: number;
  /** Margen de caja de su línea desde la fecha de adquisición. Puede ser negativo. */
  marginSince: number;
};

export type Recovery = {
  /** Proporción recuperada, siempre entre 0 y 1. */
  ratio: number;
  /** La misma proporción en porcentaje entero, para pintar y para leer. */
  percent: number;
  /** ¿El margen ya igualó o superó el costo? */
  recovered: boolean;
};

/**
 * Cuánto de la máquina se ha pagado sola.
 *
 * Los bordes no son adornos, son la mitad del requisito:
 * - margen negativo o nulo → 0 %, no un porcentaje negativo;
 * - margen por encima del costo → 100 %, no 200 %: la pregunta es si ya se
 *   pagó, no cuántas veces;
 * - costo total cero → 0 % y **no recuperado**, sin división por cero: sin
 *   inversión declarada no hay nada que recuperar, y decir que está recuperada
 *   sería inventar una respuesta a una pregunta que nadie hizo.
 */
export function recoveryOf({ totalCost, marginSince }: RecoveryInput): Recovery {
  if (totalCost <= 0) return { ratio: 0, percent: 0, recovered: false };

  const recovered = marginSince >= totalCost;
  const ratio = Math.min(1, Math.max(0, marginSince / totalCost));

  return { ratio, percent: Math.round(ratio * 100), recovered };
}

/**
 * ¿La recuperación de este activo es atribuible a una línea?
 *
 * Un ítem compartido entre líneas (`business_line_id` nulo) no tiene un margen
 * propio contra el que medirse: la línea General no genera ingresos por
 * definición, así que su barra estaría siempre en 0 % y no informaría de nada.
 * La tarjeta lo dice en palabras en vez de dibujar un cero, y el reparto entre
 * líneas es la regla configurable de V14 (KAM-20), no una invención de aquí.
 *
 * Vive junto a la fórmula para que ninguna pantalla vuelva a preguntar por
 * `businessLineId === null` y decida por su cuenta qué significa.
 */
export function hasAttributableLine(asset: Pick<AssetRecovery, "businessLineId">): boolean {
  return asset.businessLineId !== null;
}
