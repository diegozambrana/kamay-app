import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/payments", () => ({
  registerCollection: vi.fn(async () => undefined),
  registerPayment: vi.fn(async () => undefined),
}));

import { registerCollection, registerPayment } from "@/actions/payments";

import { PaymentDialog } from "./payment-dialog";

const ORDER = "33333333-3333-3333-3333-333333333333";
const EXPENSE = "44444444-4444-4444-4444-444444444444";

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

function renderDialog(pendingBalance: number, onRegistered = vi.fn()) {
  const user = userEvent.setup();
  render(
    <PaymentDialog
      target={{ kind: "order", orderId: ORDER }}
      pendingBalance={pendingBalance}
      open
      onOpenChange={vi.fn()}
      onRegistered={onRegistered}
    />,
  );
  return user;
}

describe("PaymentDialog", () => {
  it("propone el saldo pendiente como monto: cobrar lo que falta es un toque", () => {
    renderDialog(200);

    expect(screen.getByLabelText("Monto")).toHaveValue(200);
    expect(screen.getByTestId("dialog-pending")).toHaveTextContent("200.00");
  });

  it("Scenario: Cobro del saldo completo — se confirma sin cambiar el monto", async () => {
    const user = renderDialog(200);

    await user.click(screen.getByTestId("payment-submit"));

    expect(registerCollection).toHaveBeenCalledTimes(1);
    const [payload] = vi.mocked(registerCollection).mock.calls[0] as [
      Record<string, unknown>,
    ];
    expect(payload.amount).toBe("200.00");
    expect(payload.orderId).toBe(ORDER);
  });

  it("Scenario: Anticipo parcial — se registra un cobro menor que el total", async () => {
    const onRegistered = vi.fn();
    const user = renderDialog(300, onRegistered);

    const amount = screen.getByLabelText("Monto");
    await user.clear(amount);
    await user.type(amount, "100");
    await user.click(screen.getByTestId("payment-submit"));

    const [payload] = vi.mocked(registerCollection).mock.calls[0] as [
      Record<string, unknown>,
    ];
    expect(payload.amount).toBe("100");
    // El saldo se ajusta de forma optimista, sin esperar al servidor.
    expect(onRegistered).toHaveBeenCalledWith(100);
  });

  it("Scenario: Monto vacío o no positivo — el servidor lo impide y se muestra", async () => {
    vi.mocked(registerCollection).mockResolvedValueOnce({
      error: "Escribe un monto mayor que cero",
    });
    const onRegistered = vi.fn();
    const user = renderDialog(200, onRegistered);

    await user.clear(screen.getByLabelText("Monto"));
    await user.click(screen.getByTestId("payment-submit"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Escribe un monto mayor que cero",
    );
    // No se registró nada: el saldo no se movió.
    expect(onRegistered).not.toHaveBeenCalled();
  });

  it("Scenario: Advertencia antes de confirmar — 250 sobre un saldo de 200", async () => {
    const user = renderDialog(200);

    const amount = screen.getByLabelText("Monto");
    await user.clear(amount);
    await user.type(amount, "250");

    const warning = await screen.findByTestId("overpayment-warning");
    expect(warning).toHaveTextContent("50.00");
  });

  it("no advierte cuando el cobro cabe en el saldo", async () => {
    const user = renderDialog(200);

    const amount = screen.getByLabelText("Monto");
    await user.clear(amount);
    await user.type(amount, "150");

    expect(screen.queryByTestId("overpayment-warning")).not.toBeInTheDocument();
  });

  it("Scenario: Sobrepago confirmado — se permite y el importe no se recorta", async () => {
    const onRegistered = vi.fn();
    const user = renderDialog(200, onRegistered);

    const amount = screen.getByLabelText("Monto");
    await user.clear(amount);
    await user.type(amount, "250");
    await user.click(screen.getByTestId("payment-submit"));

    const [payload] = vi.mocked(registerCollection).mock.calls[0] as [
      Record<string, unknown>,
    ];
    // Scenario: El importe no se recorta — se envía 250, no el saldo anterior.
    expect(payload.amount).toBe("250");
    expect(onRegistered).toHaveBeenCalledWith(250);
  });

  it("un saldo ya negativo no propone monto", () => {
    renderDialog(-50);

    expect(screen.getByLabelText("Monto")).toHaveValue(null);
  });

  it("Scenario: No hay control para fijarlo — no ofrece estado de pago", () => {
    renderDialog(200);

    expect(screen.queryByLabelText(/estado de pago/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Pagado")).not.toBeInTheDocument();
  });

  it("contra un egreso llama a registrar pago, no a registrar cobro", async () => {
    const user = userEvent.setup();
    render(
      <PaymentDialog
        target={{ kind: "expense", expenseId: EXPENSE }}
        pendingBalance={300}
        open
        onOpenChange={vi.fn()}
      />,
    );

    await user.click(screen.getByTestId("payment-submit"));

    expect(registerPayment).toHaveBeenCalledTimes(1);
    expect(registerCollection).not.toHaveBeenCalled();
  });
});
