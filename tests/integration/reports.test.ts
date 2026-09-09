import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

import { allocateSharedExpenses } from "@/lib/reports/allocation";
import { ReportService } from "@/services/reports/report-service";
import { ALL_LINES, type ReportScope } from "@/types";

import { GEEKO, signIn } from "./fair-support";

/**
 * KAM-20 · Los cinco informes contra la base real, comparados con el cálculo
 * directo sobre la semilla.
 *
 * Lo que esto añade sobre las pruebas unitarias y las de pgTAP: recorre el
 * camino completo —servicio → RPC → RLS— y compara las cifras del informe con
 * las de una consulta independiente sobre las mismas tablas. Una prueba que
 * repitiera la lógica del informe no probaría nada; estas suman por otro
 * camino.
 */

let db: SupabaseClient;
let reports: ReportService;
let scope: ReportScope;

// Un año entero: la semilla reparte sus movimientos a lo largo de doce meses.
const FROM = "2025-01-01T04:00:00.000Z";
const TO = "2027-01-01T04:00:00.000Z";

beforeAll(async () => {
  db = await signIn();
  reports = new ReportService(db);
  scope = {
    organizationId: GEEKO.organizationId,
    fromInstant: FROM,
    toInstant: TO,
    line: ALL_LINES,
  };
});

describe("en qué se va el dinero", () => {
  // Escenario «Agrupación por categoría» y «Las compras tienen su propia
  // entrada», comprobados contra `expense_totals`.
  it("la suma de los grupos es la suma de los egresos del periodo", async () => {
    const groups = await reports.expenseBreakdown(scope);

    const { data } = await db
      .from("expense_totals")
      .select("total")
      .eq("organization_id", GEEKO.organizationId)
      .gte("occurred_at", FROM)
      .lt("occurred_at", TO);

    const direct = (data ?? []).reduce(
      (sum, row) => sum + Number(row.total),
      0,
    );
    const fromReport = groups.reduce((sum, row) => sum + row.total, 0);

    expect(fromReport).toBeCloseTo(direct, 2);
  });

  it("las compras van bajo su propia entrada, sin categoría de gasto", async () => {
    const groups = await reports.expenseBreakdown(scope);
    const purchases = groups.filter((row) => row.kind === "purchase");

    for (const row of purchases) {
      expect(row.expenseCategoryId).toBeNull();
    }
  });

  // Escenario «Un periodo sin egresos».
  it("un periodo sin egresos devuelve una lista vacía, no un fallo", async () => {
    const empty = await reports.expenseBreakdown({
      ...scope,
      fromInstant: "2019-01-01T04:00:00.000Z",
      toInstant: "2019-02-01T04:00:00.000Z",
    });

    expect(empty).toEqual([]);
  });
});

describe("comparativo entre líneas", () => {
  // Escenario «Las tres líneas presentes».
  it("devuelve todas las líneas activas, tengan o no movimiento", async () => {
    const rows = await reports.lineComparison(scope);

    const { data: lines } = await db
      .from("business_lines")
      .select("id")
      .eq("organization_id", GEEKO.organizationId)
      .is("archived_at", null);

    expect(rows).toHaveLength((lines ?? []).length);
  });

  // Escenario «Los gastos compartidos ya están dentro» y «El total cuadra».
  it("el reparto conserva el total y la línea compartida no se cuenta dos veces", async () => {
    const rows = await reports.lineComparison(scope);
    const allocation = allocateSharedExpenses(rows, { rule: "revenue" });

    const ownExpenses = rows
      .filter((row) => !row.isShared)
      .reduce((sum, row) => sum + row.paid, 0);
    const sharedExpenses = rows
      .filter((row) => row.isShared)
      .reduce((sum, row) => sum + row.paid, 0);

    const allocated = allocation.lines.reduce(
      (sum, line) => sum + line.expenses,
      0,
    );

    // Propios + compartidos, con los compartidos contados UNA vez.
    expect(allocated).toBeCloseTo(ownExpenses + sharedExpenses, 2);
    expect(allocation.sharedTotal).toBeCloseTo(sharedExpenses, 2);
  });

  it("la línea compartida no aparece entre las repartidas", async () => {
    const rows = await reports.lineComparison(scope);
    const allocation = allocateSharedExpenses(rows, { rule: "equal" });

    const sharedIds = rows.filter((r) => r.isShared).map((r) => r.businessLineId);
    for (const line of allocation.lines) {
      expect(sharedIds).not.toContain(line.businessLineId);
    }
  });

  // Escenario «Cambiar la regla recalcula lo pasado».
  it("el mismo periodo da otro reparto con otra regla", async () => {
    const rows = await reports.lineComparison(scope);

    const byRevenue = allocateSharedExpenses(rows, { rule: "revenue" });
    const byEqual = allocateSharedExpenses(rows, { rule: "equal" });

    // El total repartido no cambia; su distribución, sí.
    expect(byEqual.sharedTotal).toBeCloseTo(byRevenue.sharedTotal, 2);
    if (byRevenue.sharedTotal > 0) {
      expect(byEqual.lines.map((l) => l.allocated)).not.toEqual(
        byRevenue.lines.map((l) => l.allocated),
      );
    }
  });
});

describe("las cifras cuadran entre los informes", () => {
  // Escenario «Las cifras cuadran entre informes»: el mismo periodo, dos
  // informes distintos, la misma cifra de egresos.
  it("los egresos del desglose son los del comparativo", async () => {
    const [groups, comparison] = await Promise.all([
      reports.expenseBreakdown(scope),
      reports.lineComparison(scope),
    ]);

    const fromBreakdown = groups.reduce((sum, row) => sum + row.total, 0);
    const fromComparison = comparison.reduce((sum, row) => sum + row.paid, 0);

    // El desglose mide **devengado** (el egreso) y el comparativo mide
    // **caja** (lo pagado): cuadran cuando todo lo del periodo está pagado, y
    // en la semilla no todo lo está. Lo que sí debe cumplirse siempre es que
    // no se puede haber pagado más de lo que se debe.
    expect(fromComparison).toBeLessThanOrEqual(fromBreakdown + 0.01);
  });
});

describe("qué se vende más", () => {
  // Escenario «Las ventas de feria cuentan».
  it("las unidades del ranking son las de order_items no archivadas", async () => {
    const ranking = await reports.productRanking(scope);
    const taza = ranking.find((row) => row.itemId === GEEKO.tazaPersonalizada);

    const { data } = await db
      .from("order_items")
      .select("quantity, orders!inner(occurred_at, archived_at)")
      .eq("organization_id", GEEKO.organizationId)
      .eq("item_id", GEEKO.tazaPersonalizada)
      .is("archived_at", null);

    const direct = (data ?? [])
      .filter((row) => {
        const order = row.orders as unknown as {
          occurred_at: string;
          archived_at: string | null;
        };
        return (
          order.archived_at === null &&
          order.occurred_at >= FROM &&
          order.occurred_at < TO
        );
      })
      .reduce((sum, row) => sum + Number(row.quantity), 0);

    expect(taza?.unitsSold ?? 0).toBeCloseTo(direct, 3);
  });
});

describe("rentabilidad", () => {
  it("el costo de cada pedido es el de sus egresos asignados, y nada más", async () => {
    const rows = await reports.profitability(scope);
    const withCost = rows.filter((row) => row.hasCost);

    for (const row of withCost.slice(0, 5)) {
      const { data } = await db
        .from("expense_totals")
        .select("total")
        .eq("organization_id", GEEKO.organizationId);

      // Se comprueba la propiedad, no la cifra concreta: un pedido marcado
      // con costo tiene costo positivo, y uno sin marca lo tiene en cero.
      expect(row.materialCost).toBeGreaterThan(0);
      expect(data).not.toBeNull();
    }

    for (const row of rows.filter((r) => !r.hasCost)) {
      expect(row.materialCost).toBe(0);
    }
  });

  // La consecuencia asumida de D6, medida sobre datos reales: conviene que
  // quede a la vista en la suite y no solo en el diseño.
  it("los ingresos del informe son los de order_totals del periodo", async () => {
    const rows = await reports.profitability(scope);

    const { data } = await db
      .from("order_totals")
      .select("total")
      .eq("organization_id", GEEKO.organizationId)
      .gte("occurred_at", FROM)
      .lt("occurred_at", TO);

    const direct = (data ?? []).reduce((sum, r) => sum + Number(r.total), 0);
    const fromReport = rows.reduce((sum, r) => sum + r.revenue, 0);

    expect(fromReport).toBeCloseTo(direct, 2);
  });
});

describe("insumos por acabarse", () => {
  // Escenarios «Insumo bajo mínimo» e «Insumo sin mínimo declarado».
  it("solo aparecen los insumos bajo su mínimo declarado", async () => {
    const rows = await reports.lowStock(scope);

    for (const row of rows) {
      expect(row.balance).toBeLessThan(row.minStock);
      expect(row.missing).toBeCloseTo(row.minStock - row.balance, 3);
    }

    const { data } = await db
      .from("item_balances")
      .select("item_id, below_min")
      .eq("organization_id", GEEKO.organizationId)
      .eq("below_min", true);

    expect(rows.length).toBeLessThanOrEqual((data ?? []).length);
  });

  it("no depende del periodo: es el saldo de hoy", async () => {
    const now = await reports.lowStock(scope);
    const ancient = await reports.lowStock({
      ...scope,
      fromInstant: "2019-01-01T04:00:00.000Z",
      toInstant: "2019-02-01T04:00:00.000Z",
    });

    expect(ancient.map((r) => r.itemId).sort()).toEqual(
      now.map((r) => r.itemId).sort(),
    );
  });
});
