import type { SupabaseClient } from "@supabase/supabase-js";

import { type ComparisonRow } from "@/lib/reports/allocation";
import { ALL_LINES, type ReportScope } from "@/types";

/**
 * Las cinco lecturas de V14 (KAM-20).
 *
 * Cada una llama a su función de la base y **ninguna suma en JavaScript lo que
 * la función ya suma**: la agregación de doce meses no cabe en el presupuesto
 * de 3 s si viaja fila a fila, y la fórmula acabaría escrita dos veces.
 *
 * Todas reciben el mismo `ReportScope`, resuelto una sola vez en la página
 * (design D1). Ninguna acepta un rango propio, que es lo que hace imposible
 * que dos informes de la misma pantalla queden sobre periodos distintos.
 *
 * El recorte al dueño no se comprueba aquí: vive dentro de cada función de la
 * base (design D3), de modo que un ayudante obtiene cero filas aunque llegue
 * por otro camino que este servicio.
 */

export type ProfitabilityRow = {
  orderId: string;
  businessLineId: string;
  occurredAt: string;
  revenue: number;
  materialCost: number;
  hasCost: boolean;
};

export type ExpenseBreakdownRow = {
  expenseCategoryId: string | null;
  businessLineId: string;
  kind: "purchase" | "expense";
  total: number;
};

export type ProductRankingRow = {
  itemId: string;
  unitsSold: number;
  revenue: number;
  attributedCost: number;
  topChannelId: string | null;
};

export type LowStockRow = {
  itemId: string;
  balance: number;
  minStock: number;
  missing: number;
  lastCost: number | null;
  lastSupplierId: string | null;
};

/** `ALL_LINES` viaja a la base como `null`: ausencia de filtro, no un valor. */
function lineParam(line: ReportScope["line"]): string | null {
  return line === ALL_LINES ? null : line;
}

function rangeParams(scope: ReportScope) {
  return {
    p_organization_id: scope.organizationId,
    p_from: scope.fromInstant,
    p_to: scope.toInstant,
  };
}

export class ReportService {
  constructor(private readonly supabase: SupabaseClient) {}

  private async call<T>(name: string, params: unknown): Promise<T[]> {
    const { data, error } = await this.supabase.rpc(name, params);

    if (error) {
      throw new Error(`No se pudo cargar el informe: ${error.message}`);
    }

    return (data ?? []) as T[];
  }

  async profitability(scope: ReportScope): Promise<ProfitabilityRow[]> {
    const rows = await this.call<{
      order_id: string;
      business_line_id: string;
      occurred_at: string;
      revenue: number;
      material_cost: number;
      has_cost: boolean;
    }>("report_profitability", {
      ...rangeParams(scope),
      p_business_line_id: lineParam(scope.line),
    });

    return rows.map((row) => ({
      orderId: row.order_id,
      businessLineId: row.business_line_id,
      occurredAt: row.occurred_at,
      revenue: Number(row.revenue),
      materialCost: Number(row.material_cost),
      hasCost: row.has_cost,
    }));
  }

  async expenseBreakdown(scope: ReportScope): Promise<ExpenseBreakdownRow[]> {
    const rows = await this.call<{
      expense_category_id: string | null;
      business_line_id: string;
      kind: "purchase" | "expense";
      total: number;
    }>("report_expense_breakdown", {
      ...rangeParams(scope),
      p_business_line_id: lineParam(scope.line),
    });

    return rows.map((row) => ({
      expenseCategoryId: row.expense_category_id,
      businessLineId: row.business_line_id,
      kind: row.kind,
      total: Number(row.total),
    }));
  }

  async productRanking(scope: ReportScope): Promise<ProductRankingRow[]> {
    const rows = await this.call<{
      item_id: string;
      units_sold: number;
      revenue: number;
      attributed_cost: number;
      top_channel_id: string | null;
    }>("report_product_ranking", {
      ...rangeParams(scope),
      p_business_line_id: lineParam(scope.line),
    });

    return rows.map((row) => ({
      itemId: row.item_id,
      unitsSold: Number(row.units_sold),
      revenue: Number(row.revenue),
      attributedCost: Number(row.attributed_cost),
      topChannelId: row.top_channel_id,
    }));
  }

  /**
   * Sin periodo, y es deliberado: "estoy por quedarme sin esto" es una
   * pregunta sobre hoy. Recibe el `scope` igual para no tener una lectura con
   * una firma distinta a las demás, pero solo usa su línea.
   */
  async lowStock(scope: ReportScope): Promise<LowStockRow[]> {
    const rows = await this.call<{
      item_id: string;
      balance: number;
      min_stock: number;
      missing: number;
      last_cost: number | null;
      last_supplier_id: string | null;
    }>("report_low_stock", {
      p_organization_id: scope.organizationId,
      p_business_line_id: lineParam(scope.line),
    });

    return rows.map((row) => ({
      itemId: row.item_id,
      balance: Number(row.balance),
      minStock: Number(row.min_stock),
      missing: Number(row.missing),
      lastCost: row.last_cost === null ? null : Number(row.last_cost),
      lastSupplierId: row.last_supplier_id,
    }));
  }

  /**
   * El comparativo **ignora la línea del scope** por diseño (mapa §Selector de
   * línea): su valor está en ver todas juntas. No es un olvido, y la pantalla
   * lo dice junto al informe para que no se lea como un fallo.
   *
   * Devuelve las filas sin repartir; el reparto lo aplica
   * `lib/reports/allocation.ts` con la regla de la organización (design D4).
   */
  async lineComparison(scope: ReportScope): Promise<ComparisonRow[]> {
    const rows = await this.call<{
      business_line_id: string;
      is_shared: boolean;
      collected: number;
      paid: number;
    }>("report_line_comparison", rangeParams(scope));

    return rows.map((row) => ({
      businessLineId: row.business_line_id,
      isShared: row.is_shared,
      collected: Number(row.collected),
      paid: Number(row.paid),
    }));
  }
}
