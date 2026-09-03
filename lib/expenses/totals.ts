import type { ExpenseKind } from "@/types";

/** Lo que hace falta de una línea para sumarla: cantidad y precio pagado. */
export type PurchaseLineAmount = {
  quantity: number;
  unitPrice: number;
};

/** Redondeo a centavos: la suma de flotantes no puede mostrar 0.30000000004. */
function cents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Total de una compra desde sus filas. Es el mismo cálculo que hace
 * `expense_totals` en la base; aquí sirve para mostrarlo en vivo mientras se
 * escribe el formulario (V8). Nunca se guarda (convención nº 4).
 */
export function purchaseTotal(lines: readonly PurchaseLineAmount[]): number {
  return cents(
    lines.reduce((sum, line) => {
      const quantity = Number.isFinite(line.quantity) ? line.quantity : 0;
      const unitPrice = Number.isFinite(line.unitPrice) ? line.unitPrice : 0;
      return sum + quantity * unitPrice;
    }, 0),
  );
}

export type ExpenseSummary = {
  /** Suma de las compras del conjunto. */
  purchases: number;
  /** Suma de los gastos del conjunto. */
  costs: number;
  /** Compras más gastos. */
  total: number;
};

/**
 * Totales del periodo que muestra la bandeja (V7): se suman al leer sobre el
 * conjunto ya filtrado, y no viven en ninguna columna ni store (design D6).
 */
export function summarize(
  rows: readonly { kind: ExpenseKind; total: number }[],
): ExpenseSummary {
  let purchases = 0;
  let costs = 0;

  for (const row of rows) {
    const total = Number.isFinite(row.total) ? row.total : 0;
    if (row.kind === "purchase") purchases += total;
    else costs += total;
  }

  return {
    purchases: cents(purchases),
    costs: cents(costs),
    total: cents(purchases + costs),
  };
}
