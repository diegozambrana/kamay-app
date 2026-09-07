import { describe, expect, it } from "vitest";

import { FakeClient } from "@/tests/factories/supabase-fake";

import { DashboardService } from "./dashboard-service";

const ORG = "11111111-1111-1111-1111-111111111111";
const LINE_A = "22222222-2222-2222-2222-222222222222";
const LINE_B = "33333333-3333-3333-3333-333333333333";
const MONTH = "2026-02-01";

const flowRow = (
  businessLineId: string,
  collected: string,
  paid: string,
) => ({ business_line_id: businessLineId, collected, paid });

describe("DashboardService.cashFlowForMonth", () => {
  it("consulta la vista por organización y mes, nunca una tabla", async () => {
    const client = new FakeClient([{ data: [], error: null }]);
    await new DashboardService(client.asSupabase()).cashFlowForMonth(
      ORG,
      MONTH,
      null,
    );

    expect(client.tables[0]).toBe("cash_flow_by_line_month");
    // organization_id explícito aunque RLS ya filtre (convención nº 2).
    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);
    expect(client.queries[0].has("eq", "month", MONTH)).toBe(true);
  });

  // Scenario: Con "Todas" se suman las líneas
  it("sin línea activa suma todas las líneas del mes", async () => {
    const client = new FakeClient([
      {
        data: [
          flowRow(LINE_A, "100.00", "10.00"),
          flowRow(LINE_B, "200.00", "20.00"),
        ],
        error: null,
      },
    ]);

    const { total } = await new DashboardService(
      client.asSupabase(),
    ).cashFlowForMonth(ORG, MONTH, null);

    expect(total).toEqual({ collected: 300, paid: 30 });
  });

  // Scenario: La línea sale del destino del movimiento — el reparto por línea
  // que la vista entrega llega intacto al comparativo.
  it("con una línea activa recorta el agregado pero conserva el desglose", async () => {
    const client = new FakeClient([
      {
        data: [
          flowRow(LINE_A, "900.00", "0.00"),
          flowRow(LINE_B, "120.00", "350.00"),
        ],
        error: null,
      },
    ]);

    const { total, byLine } = await new DashboardService(
      client.asSupabase(),
    ).cashFlowForMonth(ORG, MONTH, LINE_B);

    expect(total).toEqual({ collected: 120, paid: 350 });
    // El comparativo sigue teniendo las dos: el selector recorta el
    // indicador, no la comparación.
    expect(byLine.size).toBe(2);
    expect(byLine.get(LINE_A)).toEqual({ collected: 900, paid: 0 });
  });

  it("convierte el numeric de texto a número sin perder los centavos", async () => {
    const client = new FakeClient([
      { data: [flowRow(LINE_A, "115.35", "0.05")], error: null },
    ]);

    const { total } = await new DashboardService(
      client.asSupabase(),
    ).cashFlowForMonth(ORG, MONTH, null);

    expect(total).toEqual({ collected: 115.35, paid: 0.05 });
  });

  it("un mes sin filas da ceros, no nulos", async () => {
    const client = new FakeClient([{ data: [], error: null }]);

    const { total, byLine } = await new DashboardService(
      client.asSupabase(),
    ).cashFlowForMonth(ORG, MONTH, null);

    expect(total).toEqual({ collected: 0, paid: 0 });
    expect(byLine.size).toBe(0);
  });

  it("propaga el error de la base con un mensaje entendible", async () => {
    const client = new FakeClient([{ data: null, error: { message: "boom" } }]);

    await expect(
      new DashboardService(client.asSupabase()).cashFlowForMonth(
        ORG,
        MONTH,
        null,
      ),
    ).rejects.toThrow(/caja del mes/);
  });
});

const deliveryRow = (dueDate: string, kind: string, code: number) => ({
  id: `order-${code}`,
  code,
  business_line_id: LINE_A,
  contact_id: null,
  status_id: "status-1",
  delivery_mode: "pickup",
  due_date: dueDate,
  statuses: { kind },
});

describe("DashboardService.upcomingDeliveries", () => {
  // Scenario: Ventana de siete días
  it("pide solo lo que vence dentro del horizonte", async () => {
    const client = new FakeClient([{ data: [], error: null }]);
    await new DashboardService(client.asSupabase()).upcomingDeliveries(
      ORG,
      null,
      "2026-02-21",
    );

    expect(client.queries[0].has("lte", "due_date", "2026-02-21")).toBe(true);
    expect(client.queries[0].has("order", "due_date", { ascending: true })).toBe(
      true,
    );
  });

  // Scenario: Sin fecha comprometida no entra
  it("excluye en la consulta los pedidos sin fecha comprometida", async () => {
    const client = new FakeClient([{ data: [], error: null }]);
    await new DashboardService(client.asSupabase()).upcomingDeliveries(
      ORG,
      null,
      "2026-02-21",
    );

    expect(client.queries[0].has("not", "due_date", "is", null)).toBe(true);
  });

  it("excluye lo archivado y las ventas directas", async () => {
    const client = new FakeClient([{ data: [], error: null }]);
    await new DashboardService(client.asSupabase()).upcomingDeliveries(
      ORG,
      null,
      "2026-02-21",
    );

    expect(client.queries[0].has("is", "archived_at", null)).toBe(true);
    // El tablero tiene la misma invariante: una venta de feria no recorre
    // ningún ciclo de entrega.
    expect(client.queries[0].has("eq", "kind", "order")).toBe(true);
  });

  // Scenario: Terminado no aparece
  it("solo pide los estados en los que la entrega sigue pendiente", async () => {
    const client = new FakeClient([{ data: [], error: null }]);
    await new DashboardService(client.asSupabase()).upcomingDeliveries(
      ORG,
      null,
      "2026-02-21",
    );

    // El recorte va en la consulta y por `kind`, nunca por nombre: sin él, un
    // año de pedidos entregados desplaza de la lista a los pendientes.
    expect(
      client.queries[0].has("in", "statuses.kind", [
        "initial",
        "in_progress",
        "waiting",
      ]),
    ).toBe(true);
  });

  // Scenario: Lo vencido y pendiente no se olvida por antiguo
  it("no pone tope hacia atrás: un compromiso atascado sigue entrando", async () => {
    const client = new FakeClient([{ data: [], error: null }]);
    await new DashboardService(client.asSupabase()).upcomingDeliveries(
      ORG,
      null,
      "2026-02-21",
    );

    expect(
      client.queries[0].calls.some(
        (call) => call.method === "gte" && call.args[0] === "due_date",
      ),
    ).toBe(false);
  });

  it("filtra por la línea activa cuando la hay, y no cuando es Todas", async () => {
    const withLine = new FakeClient([{ data: [], error: null }]);
    await new DashboardService(withLine.asSupabase()).upcomingDeliveries(
      ORG,
      LINE_A,
      "2026-02-21",
    );
    expect(withLine.queries[0].has("eq", "business_line_id", LINE_A)).toBe(true);

    const allLines = new FakeClient([{ data: [], error: null }]);
    await new DashboardService(allLines.asSupabase()).upcomingDeliveries(
      ORG,
      null,
      "2026-02-21",
    );
    expect(
      allLines.queries[0].calls.some(
        (call) => call.method === "eq" && call.args[0] === "business_line_id",
      ),
    ).toBe(false);
  });

  it("trae el kind del estado sin decidir nada con él", async () => {
    const client = new FakeClient([
      {
        data: [
          deliveryRow("2026-02-10", "waiting", 1),
          deliveryRow("2026-02-18", "in_progress", 2),
        ],
        error: null,
      },
    ]);

    const deliveries = await new DashboardService(
      client.asSupabase(),
    ).upcomingDeliveries(ORG, null, "2026-02-21");

    // El servicio entrega el tipo tal cual; quién está retrasado lo dice
    // `isOverdue` (design D7), no esta consulta.
    expect(deliveries.map((d) => d.statusKind)).toEqual([
      "waiting",
      "in_progress",
    ]);
  });

  it("un estado ilegible no rompe la lista", async () => {
    const client = new FakeClient([
      {
        data: [{ ...deliveryRow("2026-02-10", "in_progress", 1), statuses: null }],
        error: null,
      },
    ]);

    const [delivery] = await new DashboardService(
      client.asSupabase(),
    ).upcomingDeliveries(ORG, null, "2026-02-21");

    expect(delivery.statusKind).toBe("in_progress");
  });

  it("propaga el error de la base con un mensaje entendible", async () => {
    const client = new FakeClient([{ data: null, error: { message: "boom" } }]);

    await expect(
      new DashboardService(client.asSupabase()).upcomingDeliveries(
        ORG,
        null,
        "2026-02-21",
      ),
    ).rejects.toThrow(/entregas próximas/);
  });
});
