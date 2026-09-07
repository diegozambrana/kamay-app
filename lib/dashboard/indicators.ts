import type { BusinessLine, LineColor } from "@/types";

/**
 * Las derivadas puras del panel. Nada de esto toca Supabase ni React: son las
 * cuentas que la vista no hace y que ninguna columna guarda (convención nº 4).
 */

/** Lo cobrado y lo pagado de un mes, ya sea de una línea o de todas. */
export type CashFlow = {
  /** Cobrado: movimientos de dirección `in` del mes. */
  collected: number;
  /** Pagado: movimientos de dirección `out` del mes. */
  paid: number;
};

/** Una fila del comparativo: la línea y su caja del mes. */
export type LineCashFlow = CashFlow & {
  businessLineId: string;
  name: string;
  color: LineColor;
};

export const NO_CASH_FLOW: CashFlow = { collected: 0, paid: 0 };

/**
 * El margen del mes. Puede ser negativo y se muestra tal cual: un mes en el
 * que se compró un horno resta, y esconderlo en un cero sería mentir sobre lo
 * único que el panel existe para contar.
 */
export function marginOf({ collected, paid }: CashFlow): number {
  return collected - paid;
}

/** La suma de varias líneas, que es lo que muestra "Todas". */
export function totalOf(flows: readonly CashFlow[]): CashFlow {
  return flows.reduce<CashFlow>(
    (acc, flow) => ({
      collected: acc.collected + flow.collected,
      paid: acc.paid + flow.paid,
    }),
    NO_CASH_FLOW,
  );
}

/**
 * El comparativo: una fila por línea activa, en el orden en que la
 * organización las declaró.
 *
 * Una línea sin movimiento en el mes aparece con ceros y no desaparece. La
 * vista no devuelve fila para ella —generar la serie de meses dentro de la
 * vista sería mucha maquinaria para esto— así que el cero lo pone aquí quien
 * consume. Y tiene que ponerlo: una línea que se esfuma del comparativo el
 * mes que no vendió nada es justo la que hay que mirar.
 */
export function comparisonRows(
  lines: readonly BusinessLine[],
  flowsByLine: ReadonlyMap<string, CashFlow>,
): LineCashFlow[] {
  return lines.map((line) => ({
    businessLineId: line.id,
    name: line.name,
    color: line.color,
    ...(flowsByLine.get(line.id) ?? NO_CASH_FLOW),
  }));
}

/**
 * La proporción de una barra respecto de la mayor cifra del comparativo, en
 * tanto por ciento.
 *
 * La escala la fija el mayor valor absoluto de todo el comparativo, no el de
 * cada fila: barras con escalas distintas no se pueden comparar entre sí, que
 * es lo único que un comparativo hace. Con todo en cero, todas miden cero
 * —ninguna barra llena y ninguna división por cero—.
 */
export function barPercent(value: number, scale: number): number {
  if (scale <= 0) return 0;
  return Math.min(100, Math.round((Math.abs(value) / scale) * 100));
}

/** La escala del comparativo: el mayor cobrado o pagado de todas sus filas. */
export function comparisonScale(rows: readonly CashFlow[]): number {
  return rows.reduce(
    (max, row) => Math.max(max, Math.abs(row.collected), Math.abs(row.paid)),
    0,
  );
}
