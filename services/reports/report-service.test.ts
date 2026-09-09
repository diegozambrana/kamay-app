import { describe, expect, it } from "vitest";

import { FakeClient } from "@/tests/factories/supabase-fake";
import { ALL_LINES, type ReportScope } from "@/types";

import { ReportService } from "./report-service";

const ORG = "11111111-1111-1111-1111-111111111111";
const SUB = "22222222-2222-2222-2222-222222222222";

const scope = (line: ReportScope["line"] = ALL_LINES): ReportScope => ({
  organizationId: ORG,
  fromInstant: "2026-03-01T04:00:00.000Z",
  toInstant: "2026-04-01T04:00:00.000Z",
  line,
});

describe("el filtro de línea llega a la consulta", () => {
  // Escenario «Cuatro informes se filtran». Lo que se comprueba es que el
  // filtro viaja a la base, no que se aplique después en memoria: filtrar en
  // memoria daría el mismo resultado visible y rompería el presupuesto.
  it.each([
    ["profitability", "report_profitability"],
    ["expenseBreakdown", "report_expense_breakdown"],
    ["productRanking", "report_product_ranking"],
    ["lowStock", "report_low_stock"],
  ] as const)("%s pasa la línea a %s", async (method, fn) => {
    const client = new FakeClient([{ data: [], error: null }]);
    await new ReportService(client.asSupabase())[method](scope(SUB));

    expect(client.rpcCalls[0].name).toBe(fn);
    expect(client.rpcCalls[0].params).toMatchObject({
      p_organization_id: ORG,
      p_business_line_id: SUB,
    });
  });

  it('"Todas" viaja como ausencia de filtro, no como el literal "all"', async () => {
    const client = new FakeClient([{ data: [], error: null }]);
    await new ReportService(client.asSupabase()).productRanking(scope());

    expect(client.rpcCalls[0].params).toMatchObject({
      p_business_line_id: null,
    });
  });

  // Escenario «El comparativo no se filtra».
  it("el comparativo no recibe línea, ni siquiera con una elegida", async () => {
    const client = new FakeClient([{ data: [], error: null }]);
    await new ReportService(client.asSupabase()).lineComparison(scope(SUB));

    expect(client.rpcCalls[0].name).toBe("report_line_comparison");
    expect(client.rpcCalls[0].params).not.toHaveProperty("p_business_line_id");
  });
});

describe("el periodo es el mismo para todas las lecturas", () => {
  it("las cuatro con rango reciben exactamente los mismos límites", async () => {
    const client = new FakeClient([
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
    ]);
    const service = new ReportService(client.asSupabase());
    const s = scope();

    await service.profitability(s);
    await service.expenseBreakdown(s);
    await service.productRanking(s);
    await service.lineComparison(s);

    for (const call of client.rpcCalls) {
      expect(call.params).toMatchObject({
        p_from: s.fromInstant,
        p_to: s.toInstant,
      });
    }
  });

  // El de insumos es el único sin rango: es el saldo de hoy.
  it("insumos por acabarse no recibe rango", async () => {
    const client = new FakeClient([{ data: [], error: null }]);
    await new ReportService(client.asSupabase()).lowStock(scope());

    expect(client.rpcCalls[0].params).not.toHaveProperty("p_from");
    expect(client.rpcCalls[0].params).not.toHaveProperty("p_to");
  });
});

describe("las cifras llegan como números", () => {
  it("convierte los numeric de Postgres, que viajan como texto", async () => {
    const client = new FakeClient([
      {
        data: [
          {
            item_id: "item-1",
            units_sold: "5",
            revenue: "900.00",
            attributed_cost: "180.00",
            top_channel_id: null,
          },
        ],
        error: null,
      },
    ]);

    const [row] = await new ReportService(client.asSupabase()).productRanking(
      scope(),
    );

    expect(row.unitsSold).toBe(5);
    expect(row.revenue).toBe(900);
    expect(row.attributedCost).toBe(180);
  });

  it("un informe vacío es una lista vacía, no un fallo", async () => {
    const client = new FakeClient([{ data: null, error: null }]);
    const rows = await new ReportService(client.asSupabase()).expenseBreakdown(
      scope(),
    );

    expect(rows).toEqual([]);
  });

  it("un error de la base se propaga con mensaje entendible", async () => {
    const client = new FakeClient([
      { data: null, error: { message: "permission denied" } },
    ]);

    await expect(
      new ReportService(client.asSupabase()).profitability(scope()),
    ).rejects.toThrow(/No se pudo cargar el informe/);
  });
});
