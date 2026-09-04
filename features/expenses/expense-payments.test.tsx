import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/payments", () => ({
  registerCollection: vi.fn(async () => undefined),
  registerPayment: vi.fn(async () => undefined),
  voidPayment: vi.fn(async () => undefined),
}));

import { registerPayment } from "@/actions/payments";
import { PaymentBlock } from "@/features/payments/payment-block";

const EXPENSE = "33333333-3333-3333-3333-333333333333";
const TZ = "America/La_Paz";

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

/**
 * El punto de entrada de pagos del detalle del egreso. Es el mismo bloque que
 * usa el pedido, con `direction = 'out'`: lo que se prueba aquí es que el
 * egreso lo monta bien y que el flujo llega a la acción correcta.
 */
describe("Detalle del egreso · pagos", () => {
  it("Scenario: Pago parcial de una compra — 200 sobre un egreso de 500", async () => {
    const user = userEvent.setup();
    render(
      <PaymentBlock
        target={{ kind: "expense", expenseId: EXPENSE }}
        total={500}
        paid={0}
        payments={[]}
        timezone={TZ}
        canVoid
      />,
    );

    expect(screen.getByTestId("register-payment")).toHaveTextContent(
      "Registrar pago",
    );

    await user.click(screen.getByTestId("register-payment"));

    const amount = await screen.findByLabelText("Monto");
    await user.clear(amount);
    await user.type(amount, "200");
    await user.click(screen.getByTestId("payment-submit"));

    expect(registerPayment).toHaveBeenCalledTimes(1);
    const [payload] = vi.mocked(registerPayment).mock.calls[0] as [
      Record<string, unknown>,
    ];
    expect(payload.expenseId).toBe(EXPENSE);
    expect(payload.amount).toBe("200");

    // El saldo por pagar pasa a 300 y el estado a parcial, de forma optimista.
    expect(await screen.findByTestId("payment-balance")).toHaveTextContent(
      "300.00",
    );
    expect(screen.getByTestId("payment-status")).toHaveAttribute(
      "data-status",
      "partial",
    );
  });

  it("propone el saldo por pagar como monto", async () => {
    const user = userEvent.setup();
    render(
      <PaymentBlock
        target={{ kind: "expense", expenseId: EXPENSE }}
        total={500}
        paid={200}
        payments={[]}
        timezone={TZ}
        canVoid
      />,
    );

    await user.click(screen.getByTestId("register-payment"));

    expect(await screen.findByLabelText("Monto")).toHaveValue(300);
  });

  it("un egreso archivado no admite pagos nuevos", () => {
    render(
      <PaymentBlock
        target={{ kind: "expense", expenseId: EXPENSE }}
        total={500}
        paid={0}
        payments={[]}
        timezone={TZ}
        canVoid
        frozen
      />,
    );

    expect(screen.queryByTestId("register-payment")).not.toBeInTheDocument();
  });
});
