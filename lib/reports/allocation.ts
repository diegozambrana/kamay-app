/**
 * El reparto de los gastos de la línea General/Compartido entre las líneas
 * concretas (KAM-20, design D4 y D5).
 *
 * **Esta es la única implementación del reparto.** Vive en TypeScript y no en
 * SQL por dos razones: sus casos límite son muchos y baratos de probar aquí
 * —ingresos cero, una sola línea activa, línea nueva sin porcentaje, redondeo
 * que no cuadra—, y KAM-19 necesitará el mismo reparto para la recuperación
 * por línea; un módulo se importa, una expresión repetida en cinco funciones
 * SQL no.
 *
 * El reparto se aplica **en la lectura**: ningún egreso cambia de línea,
 * ninguna fila se crea. Cambiar la regla cambia todos los informes, incluidos
 * los de periodos pasados, y eso es lo buscado: un reparto congelado en filas
 * no se podría mostrar junto al resultado, solo creer.
 */

import {
  type AllocationRule,
  type AllocationSettings,
  DEFAULT_ALLOCATION_RULE,
} from "@/types";

/** Una línea tal como la devuelve `report_line_comparison`. */
export type ComparisonRow = {
  businessLineId: string;
  isShared: boolean;
  collected: number;
  paid: number;
};

export type AllocatedLine = {
  businessLineId: string;
  revenue: number;
  /** Egresos propios más la parte que le tocó de los compartidos. */
  expenses: number;
  /** Solo la parte absorbida, para poder explicarla. */
  allocated: number;
  margin: number;
};

export type AllocationResult = {
  lines: AllocatedLine[];
  /** El total repartido. Siempre igual a los egresos de la línea compartida. */
  sharedTotal: number;
  /**
   * La regla efectivamente aplicada, que puede no ser la configurada: la
   * proporcional cae a partes iguales cuando no hubo ingresos.
   */
  appliedRule: AllocationRule;
  /**
   * La leyenda ya compuesta. Va en el mismo objeto que las cifras a
   * propósito: tener las cifras es tener la leyenda, y así es difícil
   * incumplir el requisito de no mostrar una sin la otra.
   */
  legend: string;
};

/** Céntimos: se trabaja en enteros para que el redondeo sea decidible. */
function toCents(value: number): number {
  return Math.round(value * 100);
}

function fromCents(value: number): number {
  return value / 100;
}

const RULE_LABEL: Record<AllocationRule, string> = {
  revenue: "proporcional a los ingresos del periodo",
  equal: "a partes iguales",
  manual: "según los porcentajes configurados",
};

/**
 * Reparte `totalCents` según `weights` (uno por línea, en el mismo orden) y
 * cierra la diferencia de redondeo en la línea de mayor parte.
 *
 * Sin este cierre, repartir 100 entre tres daría 33,33 × 3 = 99,99 y el
 * comparativo no cuadraría con el informe de egresos —que el criterio 1 exige
 * que cuadren—. El sesgo cae siempre en el mismo sitio, que es lo que lo hace
 * verificable en vez de arbitrario.
 */
function distribute(totalCents: number, weights: number[]): number[] {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight <= 0 || weights.length === 0) {
    return weights.map(() => 0);
  }

  const shares = weights.map((w) =>
    Math.floor((totalCents * w) / totalWeight),
  );
  const assigned = shares.reduce((sum, s) => sum + s, 0);
  let remainder = totalCents - assigned;

  if (remainder !== 0) {
    // A la de mayor parte; con empate, a la primera, para que el resultado no
    // dependa del orden en que la base devolvió las filas.
    let biggest = 0;
    for (let i = 1; i < shares.length; i += 1) {
      if (shares[i] > shares[biggest]) biggest = i;
    }
    shares[biggest] += remainder;
    remainder = 0;
  }

  return shares;
}

/**
 * Aplica el reparto a las filas del comparativo.
 *
 * `rows` incluye la línea compartida: sus egresos son lo que se distribuye, y
 * **no** vuelve a aparecer como línea propia en el resultado. Contarla dos
 * veces —repartida y suelta— duplicaría el gasto en el total.
 */
export function allocateSharedExpenses(
  rows: ComparisonRow[],
  settings: AllocationSettings = { rule: DEFAULT_ALLOCATION_RULE },
): AllocationResult {
  const shared = rows.filter((r) => r.isShared);
  const targets = rows.filter((r) => !r.isShared);

  const sharedCents = shared.reduce((sum, r) => sum + toCents(r.paid), 0);
  const revenueCents = targets.map((r) => toCents(r.collected));
  const totalRevenue = revenueCents.reduce((sum, c) => sum + c, 0);

  const configured = settings.rule ?? DEFAULT_ALLOCATION_RULE;

  // La proporcional necesita ingresos; sin ellos no hay proporción que
  // aplicar. Caer a partes iguales —y decirlo— es preferible a dividir por
  // cero, a omitir el gasto o a dejarlo sin repartir, que son las tres formas
  // de que el total deje de cuadrar.
  const appliedRule: AllocationRule =
    configured === "revenue" && totalRevenue === 0 ? "equal" : configured;

  let weights: number[];
  switch (appliedRule) {
    case "revenue":
      weights = revenueCents;
      break;
    case "equal":
      weights = targets.map(() => 1);
      break;
    case "manual":
      // Una línea sin porcentaje declarado pesa 0: recibe nada, no rompe nada.
      // La pantalla de configuración es la que avisa de que le falta su parte.
      weights = targets.map((r) => settings.shares?.[r.businessLineId] ?? 0);
      break;
  }

  const sharesCents = distribute(sharedCents, weights);

  const lines: AllocatedLine[] = targets.map((row, index) => {
    const allocated = fromCents(sharesCents[index]);
    const expenses = row.paid + allocated;
    return {
      businessLineId: row.businessLineId,
      revenue: row.collected,
      expenses,
      allocated,
      margin: row.collected - expenses,
    };
  });

  return {
    lines,
    sharedTotal: fromCents(sharedCents),
    appliedRule,
    legend: composeLegend(sharedCents, configured, appliedRule, lines),
  };
}

function composeLegend(
  sharedCents: number,
  configured: AllocationRule,
  applied: AllocationRule,
  lines: AllocatedLine[],
): string {
  if (sharedCents === 0) {
    return "No hubo gastos compartidos en este periodo, así que no se repartió nada.";
  }

  const fellBack = configured !== applied;
  const head = fellBack
    ? `Los gastos de General se repartieron ${RULE_LABEL[applied]}, porque ninguna línea registró ingresos en el periodo.`
    : `Los gastos de General se repartieron ${RULE_LABEL[applied]}.`;

  const total = fromCents(sharedCents);
  const detail = lines
    .filter((line) => line.allocated !== 0)
    .map(
      (line) =>
        `${line.businessLineId}: ${((line.allocated / total) * 100).toFixed(1)} %`,
    )
    .join(" · ");

  return detail ? `${head} ${detail}` : head;
}
