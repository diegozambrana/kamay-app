import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BusinessLine, ExpenseCategory } from "@/types";

import { CostForm } from "./cost-form";

const push = vi.fn();
const refresh = vi.fn();
const createExpense = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh, back: vi.fn() }),
}));

vi.mock("@/actions/expenses", () => ({
  createExpense: (input: unknown) => createExpense(input),
  attachReceipt: vi.fn(async () => undefined),
}));

const ORG = "11111111-1111-1111-1111-111111111111";
const SUBLI = "30000000-0000-0000-0000-000000000001";
const ALFA = "30000000-0000-0000-0000-000000000003";
const GENERAL = "30000000-0000-0000-0000-000000000004";
const SERVICIOS = "50000000-0000-0000-0000-000000000002";
const TRANSPORTE = "50000000-0000-0000-0000-000000000003";
const ORDER = "a0000000-0000-0000-0000-000000000012";

function line(id: string, name: string, isShared = false): BusinessLine {
  return {
    id,
    organizationId: ORG,
    name,
    color: "zinc",
    icon: null,
    isShared,
    position: 1,
    archivedAt: null,
  };
}

function category(id: string, name: string): ExpenseCategory {
  return { id, organizationId: ORG, name, archivedAt: null };
}

const LINES = [line(SUBLI, "Sublimación"), line(ALFA, "Alfarería"), line(GENERAL, "General", true)];
const CATEGORIES = [category(SERVICIOS, "Servicios"), category(TRANSPORTE, "Transporte")];
const ORDERS = [{ id: ORDER, code: 12, label: "#12 · María Céspedes" }];

function renderForm(defaultLineId: string) {
  return render(
    <CostForm
      defaultLineId={defaultLineId}
      lines={LINES}
      categories={CATEGORIES}
      orders={ORDERS}
      today="2026-09-03"
    />,
  );
}

beforeEach(() => {
  push.mockReset();
  createExpense.mockReset();
  createExpense.mockResolvedValue({ expenseId: "b0000000-0000-0000-0000-000000000099" });
});

afterEach(cleanup);

describe("CostForm (V9)", () => {
  it("el monto tiene el foco al abrir", () => {
    renderForm(SUBLI);
    expect(screen.getByLabelText("Monto")).toHaveFocus();
  });

  it("con «Todas» activa queda General preseleccionada y se puede cambiar", async () => {
    renderForm(GENERAL);
    const user = userEvent.setup();

    expect(screen.getByTestId("line-select")).toHaveTextContent("General");

    await user.click(screen.getByTestId("line-select"));
    await user.click(screen.getByRole("option", { name: "Alfarería" }));

    expect(screen.getByTestId("line-select")).toHaveTextContent("Alfarería");
  });

  it("con Alfarería activa queda Alfarería preseleccionada", () => {
    renderForm(ALFA);
    expect(screen.getByTestId("line-select")).toHaveTextContent("Alfarería");
  });

  it("sin monto se impide señalando el monto", async () => {
    renderForm(SUBLI);
    const user = userEvent.setup();

    await user.click(screen.getByRole("radio", { name: "Servicios" }));
    await user.click(screen.getByTestId("save-cost"));

    expect(await screen.findByTestId("amount-error")).toHaveTextContent("Escribe el monto");
    expect(createExpense).not.toHaveBeenCalled();
  });

  it("sin categoría se impide señalando las categorías", async () => {
    renderForm(SUBLI);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Monto"), "120");
    await user.click(screen.getByTestId("save-cost"));

    expect(await screen.findByTestId("category-error")).toHaveTextContent(
      "Elige una categoría",
    );
    expect(createExpense).not.toHaveBeenCalled();
  });

  it("gasto mínimo: monto, un chip y guardar; vuelve a la bandeja", async () => {
    renderForm(SUBLI);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Monto"), "120");
    await user.click(screen.getByRole("radio", { name: "Servicios" }));
    await user.click(screen.getByTestId("save-cost"));

    await waitFor(() => expect(createExpense).toHaveBeenCalledTimes(1));
    expect(createExpense.mock.calls[0][0]).toMatchObject({
      businessLineId: SUBLI,
      expenseCategoryId: SERVICIOS,
      amount: 120,
      orderId: null,
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/expenses"));
  });

  it("«asignar a un pedido» está plegado y, abierto, envía el orderId", async () => {
    renderForm(SUBLI);
    const user = userEvent.setup();

    expect(screen.queryByTestId("order-select")).toBeNull();

    await user.click(screen.getByTestId("assign-order-toggle"));
    await user.click(screen.getByTestId("order-select"));
    await user.click(screen.getByRole("option", { name: "#12 · María Céspedes" }));

    await user.type(screen.getByLabelText("Monto"), "35");
    await user.click(screen.getByRole("radio", { name: "Transporte" }));
    await user.click(screen.getByTestId("save-cost"));

    await waitFor(() => expect(createExpense).toHaveBeenCalledTimes(1));
    expect(createExpense.mock.calls[0][0]).toMatchObject({ orderId: ORDER });
  });

  it("muestra el error del servidor sin salir del formulario", async () => {
    createExpense.mockResolvedValue({ error: "Solo la persona dueña registra egresos." });
    renderForm(SUBLI);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Monto"), "10");
    await user.click(screen.getByRole("radio", { name: "Servicios" }));
    await user.click(screen.getByTestId("save-cost"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Solo la persona dueña registra egresos.",
    );
    expect(push).not.toHaveBeenCalled();
  });
});
