import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AssetExpense } from "@/services/assets/asset-service";

import { AssetDetailPanel, type AssetDetailView } from "./asset-detail-panel";

const relatedTasksFor = vi.fn(async () => [
  {
    id: "t1",
    title: "Cambiar boquilla de la impresora",
    statusName: "Por hacer",
    dueAt: null,
    closedAt: null,
  },
]);

vi.mock("@/actions/tasks", () => ({
  relatedTasksFor: (...args: unknown[]) => relatedTasksFor(...(args as [])),
}));

vi.mock("@/actions/assets", () => ({
  linkExpenseToAsset: vi.fn(async () => undefined),
  saveAssetDetails: vi.fn(async () => undefined),
}));

const ORG = "11111111-1111-1111-1111-111111111111";
const TRES_D = "33333333-3333-3333-3333-333333333333";
const PRINTER = "44444444-4444-4444-4444-444444444444";

function expense(overrides: Partial<AssetExpense> & { id: string }): AssetExpense {
  return {
    organizationId: ORG,
    businessLineId: TRES_D,
    kind: "expense",
    contactId: null,
    expenseCategoryId: null,
    orderId: null,
    amount: 500,
    occurredAt: "2026-03-11T16:00:00.000Z",
    note: "Cambio de boquilla",
    assetId: PRINTER,
    assetExpenseRole: "maintenance",
    archivedAt: null,
    total: 500,
    ...overrides,
  };
}

const detail: AssetDetailView = {
  asset: {
    itemId: PRINTER,
    organizationId: ORG,
    businessLineId: TRES_D,
    name: "Impresora 3D",
    acquiredOn: "2026-03-01",
    acquisitionCost: 7000,
    maintenanceCost: 620,
    totalCost: 7620,
    lineMarginSince: 3810,
  },
  supplierId: null,
  supplierName: "Proveedor 3D",
  notes: null,
  expenses: [
    expense({ id: "e1" }),
    expense({ id: "e2", total: 120, amount: 120, note: "Filtro" }),
    expense({
      id: "e3",
      assetExpenseRole: "acquisition",
      kind: "purchase",
      total: 7000,
      amount: null,
      note: null,
      occurredAt: "2026-03-01T16:00:00.000Z",
    }),
  ],
  // Desde KAM-22 el bloque es el compartido: recibe los eventos ya redactados
  // por `loadRecordHistory()`, con la misma frase que la bitácora general.
  history: {
    activityHref: "/activity?type=asset_details&q=90000000-0000-0000-0000-000000000021",
    items: [
      {
        id: 2,
        action: "updated",
        sentence: "Diego editó el activo",
        occurredAt: "2026-03-12T16:00:00.000Z",
        detail: { kind: "rows" as const, rows: [] },
      },
      {
        id: 1,
        action: "created",
        sentence: "Diego registró el activo",
        occurredAt: "2026-03-01T16:00:00.000Z",
        detail: { kind: "rows" as const, rows: [] },
      },
    ],
  },
  suppliers: [],
};

afterEach(cleanup);

/**
 * Escenarios del delta spec `assets`, requisito "Detalle del activo en panel":
 * "Detalle con sus gastos", "Del gasto a su egreso", "Historial del activo".
 */
describe("AssetDetailPanel", () => {
  it("muestra los gastos de mantenimiento con su importe y el costo desglosado", () => {
    render(<AssetDetailPanel detail={detail} timezone="America/La_Paz" onClose={vi.fn()} />);

    const maintenance = screen
      .getAllByTestId("asset-expense")
      .filter((node) => within(node).queryByText("500.00") || within(node).queryByText("120.00"));
    expect(maintenance).toHaveLength(2);

    const breakdown = within(screen.getByTestId("cost-breakdown"));
    expect(breakdown.getByText("7000.00")).toBeInTheDocument();
    expect(breakdown.getByText("620.00")).toBeInTheDocument();
    expect(screen.getByTestId("detail-total-cost")).toHaveTextContent("7620.00");
  });

  it("cada gasto lleva al detalle de su egreso", () => {
    render(<AssetDetailPanel detail={detail} timezone="America/La_Paz" onClose={vi.fn()} />);

    const links = screen.getAllByRole("link", { name: /Filtro|boquilla|01\/03\/2026/ });
    expect(links.some((link) => link.getAttribute("href") === "/expenses/e1")).toBe(true);
    expect(links.some((link) => link.getAttribute("href") === "/expenses/e3")).toBe(true);
  });

  it("la adquisición se distingue del mantenimiento", () => {
    render(<AssetDetailPanel detail={detail} timezone="America/La_Paz" onClose={vi.fn()} />);

    const acquisition = screen
      .getAllByTestId("asset-expense")
      .find((node) => within(node).getByRole("link").getAttribute("data-role") === "acquisition");
    expect(acquisition).toBeDefined();
  });

  it("sin egreso de adquisición vinculado lo dice, porque ese pago sigue restando", () => {
    render(
      <AssetDetailPanel
        detail={{
          ...detail,
          expenses: detail.expenses.filter((item) => item.assetExpenseRole === "maintenance"),
        }}
        timezone="America/La_Paz"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId("no-acquisition")).toHaveTextContent(
      /sigue restando del margen de la línea/i,
    );
  });

  it("el historial sale de la bitácora, en orden cronológico", () => {
    render(<AssetDetailPanel detail={detail} timezone="America/La_Paz" onClose={vi.fn()} />);

    const entries = screen.getAllByTestId("history-entry");
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveAttribute("data-action", "updated");
    expect(entries[1]).toHaveAttribute("data-action", "created");
  });

  // KAM-22 · Escenario de `activity-screen` § Toda pantalla de detalle con
  // historial lo lee de la bitácora y lleva a ella → «El activo se suma a la
  // redacción común».
  it("dice lo mismo que la bitácora y lleva a ella filtrada por este activo", () => {
    render(<AssetDetailPanel detail={detail} timezone="America/La_Paz" onClose={vi.fn()} />);

    const entries = screen.getAllByTestId("history-entry");
    expect(entries[0]).toHaveTextContent("Diego editó el activo");
    expect(entries[1]).toHaveTextContent("Diego registró el activo");

    expect(screen.getByTestId("activity-link")).toHaveAttribute(
      "href",
      "/activity?type=asset_details&q=90000000-0000-0000-0000-000000000021",
    );
  });
});

/**
 * KAM-21 · El bloque *Tareas relacionadas* en el panel de V12.
 *
 * Escenarios del delta spec `assets`, requisito "Detalle del activo en panel":
 * «Tareas relacionadas del activo», «Activo sin tareas relacionadas»; y del
 * delta `task-links-deliverables` → «El panel del activo muestra sus tareas».
 *
 * La pantalla ya es solo del dueño (KAM-19), así que aquí no hay ningún filtro
 * de rol que probar: el que importa —el ayudante no ve el vínculo a un activo—
 * vive en `TaskService.links` y se prueba allí.
 */
describe("tareas relacionadas del activo", () => {
  it("lista las tareas que apuntan al activo", async () => {
    render(
      <AssetDetailPanel detail={detail} timezone="America/La_Paz" onClose={vi.fn()} />,
    );

    expect(
      await screen.findByText("Cambiar boquilla de la impresora"),
    ).toBeInTheDocument();
    expect(relatedTasksFor).toHaveBeenCalledWith("asset", PRINTER);
  });

  it("un activo que ninguna tarea referencia rinde el bloque vacío", async () => {
    relatedTasksFor.mockResolvedValueOnce([]);
    render(
      <AssetDetailPanel detail={detail} timezone="America/La_Paz" onClose={vi.fn()} />,
    );

    expect(await screen.findByTestId("empty-related-tasks")).toBeInTheDocument();
  });
});
