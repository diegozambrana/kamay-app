import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ExpenseWithTotal } from "@/services/expenses/expense-service";

import { ExpenseDetail, type ExpenseDetailData } from "./expense-detail";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/actions/expenses", () => ({
  archiveExpense: vi.fn(async () => undefined),
  unarchiveExpense: vi.fn(async () => undefined),
}));

const linkExpenseToAsset = vi.fn(async () => undefined);
vi.mock("@/actions/assets", () => ({
  linkExpenseToAsset: (...args: unknown[]) => linkExpenseToAsset(...(args as [])),
}));

const ORG = "11111111-1111-1111-1111-111111111111";
const LINE = "30000000-0000-0000-0000-000000000001";
const EXPENSE = "22222222-2222-2222-2222-222222222222";
const PRINTER = "44444444-4444-4444-4444-444444444444";

function expense(overrides: Partial<ExpenseWithTotal> = {}): ExpenseWithTotal {
  return {
    id: EXPENSE,
    organizationId: ORG,
    businessLineId: LINE,
    kind: "expense",
    contactId: null,
    expenseCategoryId: "55555555-5555-5555-5555-555555555555",
    orderId: null,
    amount: 500,
    occurredAt: "2026-03-11T16:00:00.000Z",
    note: null,
    assetId: null,
    assetExpenseRole: null,
    archivedAt: null,
    total: 500,
    paid: 0,
    ...overrides,
  } as ExpenseWithTotal;
}

function data(overrides: Partial<ExpenseDetailData> = {}): ExpenseDetailData {
  return {
    expense: expense(),
    lines: [],
    supplier: null,
    categoryName: "Servicios",
    businessLine: null,
    order: null,
    asset: null,
    assetOptions: [{ itemId: PRINTER, name: "Impresora 3D" }],
    receipts: [],
    payments: [],
    history: [],
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/**
 * Escenarios del delta spec `expenses`, requisito "Detalle del egreso":
 * "Gasto que pertenece a un activo" y "Vincular desde el egreso".
 */
describe("ExpenseDetail · vínculo con un activo (KAM-19)", () => {
  it("un gasto vinculado muestra el activo y el papel que cumple", () => {
    render(
      <ExpenseDetail
        data={data({
          expense: expense({ assetId: PRINTER, assetExpenseRole: "maintenance" }),
          asset: { itemId: PRINTER, name: "Impresora 3D" },
        })}
        timezone="America/La_Paz"
        variant="page"
      />,
    );

    const field = screen.getByTestId("detail-asset");
    expect(field).toHaveTextContent("Impresora 3D");
    expect(field).toHaveTextContent("mantenimiento");
    expect(screen.getByRole("link", { name: "Impresora 3D" })).toHaveAttribute(
      "href",
      "/assets",
    );
  });

  it("la compra del activo se distingue del mantenimiento", () => {
    render(
      <ExpenseDetail
        data={data({
          expense: expense({
            kind: "purchase",
            assetId: PRINTER,
            assetExpenseRole: "acquisition",
          }),
          asset: { itemId: PRINTER, name: "Impresora 3D" },
        })}
        timezone="America/La_Paz"
        variant="page"
      />,
    );

    expect(screen.getByTestId("detail-asset")).toHaveTextContent("compra del activo");
    // Y no se ofrece cambiarla a mano: su importe ya es el costo declarado.
    expect(screen.queryByTestId("asset-link-select")).not.toBeInTheDocument();
  });

  it("un gasto sin vínculo ofrece elegir el activo", () => {
    render(<ExpenseDetail data={data()} timezone="America/La_Paz" variant="page" />);

    expect(screen.getByTestId("asset-link")).toBeInTheDocument();
    expect(screen.getByTestId("asset-link-select")).toBeInTheDocument();
    expect(screen.queryByTestId("detail-asset")).not.toBeInTheDocument();
  });

  it("sin activos en la organización el bloque no existe", () => {
    render(
      <ExpenseDetail
        data={data({ assetOptions: [] })}
        timezone="America/La_Paz"
        variant="page"
      />,
    );

    expect(screen.queryByTestId("asset-link")).not.toBeInTheDocument();
  });

  it("un gasto vinculado ofrece deshacer el vínculo", () => {
    render(
      <ExpenseDetail
        data={data({
          expense: expense({ assetId: PRINTER, assetExpenseRole: "maintenance" }),
          asset: { itemId: PRINTER, name: "Impresora 3D" },
        })}
        timezone="America/La_Paz"
        variant="page"
      />,
    );

    expect(screen.getByRole("button", { name: "Desvincular" })).toBeInTheDocument();
  });
});
