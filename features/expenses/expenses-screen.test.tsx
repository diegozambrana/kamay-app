import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { summarize } from "@/lib/expenses/totals";

import { ExpensesScreen, type ExpenseRowView } from "./expenses-screen";
import { useReceiptUploadStore } from "./receipt-upload-store";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams("kind=purchase"),
}));

vi.mock("@/actions/expenses", () => ({
  archiveExpense: vi.fn(async () => undefined),
  unarchiveExpense: vi.fn(async () => undefined),
  attachReceipt: vi.fn(async () => undefined),
}));

const ORG = "11111111-1111-1111-1111-111111111111";
const SUBLI = "30000000-0000-0000-0000-000000000001";

function row(overrides: Partial<ExpenseRowView> & { id: string }): ExpenseRowView {
  return {
    organizationId: ORG,
    businessLineId: SUBLI,
    kind: "purchase",
    contactId: null,
    expenseCategoryId: null,
    orderId: null,
    amount: null,
    paid: 0,
    occurredAt: "2026-09-02T14:00:00.000Z",
    note: null,
    archivedAt: null,
    total: 0,
    lineName: "Sublimación",
    lineColor: "blue",
    counterpartyName: "Distribuidora Andina",
    ...overrides,
  };
}

const ROWS: ExpenseRowView[] = [
  row({ id: "b1", total: 615 }),
  row({ id: "b2", total: 152, lineName: "Alfarería", lineColor: "orange" }),
  row({ id: "b3", kind: "expense", total: 120, counterpartyName: "Servicios" }),
  row({
    id: "b4",
    total: 158,
    archivedAt: "2026-08-01T00:00:00.000Z",
    counterpartyName: "Distribuidora Andina",
  }),
];

const FILTERS = {
  kind: null,
  contactId: "",
  expenseCategoryId: "",
  from: "2026-09-01",
  to: "2026-09-30",
  includeArchived: true,
};

function renderScreen(rows = ROWS) {
  return render(
    <ExpensesScreen
      rows={rows}
      summary={summarize(rows.filter((r) => r.archivedAt === null))}
      suppliers={[]}
      categories={[]}
      filters={FILTERS}
      activeLineId={SUBLI}
      payables={[]}
      selected={null}
      timezone="America/La_Paz"
    />,
  );
}

/** jsdom no tiene viewport: se decide a mano qué contesta `matchMedia`. */
function setMobile(isMobile: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: isMobile,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

beforeEach(() => {
  push.mockReset();
  setMobile(false);
  useReceiptUploadStore.setState({ uploads: {} });
});

afterEach(cleanup);

describe("ExpensesScreen (V7)", () => {
  it("los totales del periodo son la suma del conjunto vigente, por tipo", () => {
    renderScreen();

    expect(screen.getByTestId("summary-purchases")).toHaveTextContent("767.00");
    expect(screen.getByTestId("summary-costs")).toHaveTextContent("120.00");
    expect(screen.getByTestId("summary-total")).toHaveTextContent("887.00");
  });

  it("cada fila muestra fecha, tipo, proveedor o categoría, línea y monto", () => {
    renderScreen();
    const rows = screen.getAllByTestId("expense-row");
    expect(rows).toHaveLength(4);

    expect(within(rows[0]).getByText("02/09/2026")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Compra")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Distribuidora Andina")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Sublimación")).toBeInTheDocument();
    expect(within(rows[0]).getByTestId("row-total")).toHaveTextContent("615.00");

    expect(within(rows[2]).getByText("Gasto")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Servicios")).toBeInTheDocument();
  });

  it("un egreso archivado se distingue de los vigentes", () => {
    renderScreen();
    const archived = screen.getAllByTestId("expense-row")[3];
    expect(archived).toHaveAttribute("data-archived", "true");
    expect(within(archived).getByText("Archivado")).toBeInTheDocument();
  });

  it("el filtro por tipo escribe la dirección conservando los demás", async () => {
    renderScreen();
    const user = userEvent.setup();

    await user.click(screen.getByRole("radio", { name: "Gastos" }));

    expect(push).toHaveBeenCalledWith("/expenses?kind=expense");
  });

  it("la fila abre el detalle en el panel: `selected` en la dirección", async () => {
    renderScreen();
    const user = userEvent.setup();

    await user.click(screen.getAllByTestId("expense-row")[0]);

    expect(push).toHaveBeenCalledWith("/expenses?kind=purchase&selected=b1");
  });

  it("en ancho móvil se rinden tarjetas apiladas en vez de la tabla", () => {
    setMobile(true);
    renderScreen();

    expect(screen.queryByTestId("expense-table")).toBeNull();
    expect(screen.getAllByTestId("expense-card")).toHaveLength(4);
    expect(within(screen.getAllByTestId("expense-card")[0]).getByTestId("row-total")).toHaveTextContent(
      "615.00",
    );
  });

  it("la fila con un comprobante en vuelo muestra el indicador", () => {
    useReceiptUploadStore.setState({
      uploads: { b1: { status: "pending", fileName: "recibo.jpg", error: null } },
    });
    renderScreen();

    const rows = screen.getAllByTestId("expense-row");
    expect(within(rows[0]).getByTestId("receipt-pending")).toHaveTextContent(
      "Comprobante subiendo…",
    );
    expect(within(rows[1]).queryByTestId("receipt-pending")).toBeNull();
  });

  it("sin egresos en el periodo lo dice en vez de dejar la tabla vacía", () => {
    renderScreen([]);
    expect(screen.getByText("No hay egresos en este periodo.")).toBeInTheDocument();
  });
});
