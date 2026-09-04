import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/payments", () => ({
  registerCollection: vi.fn(async () => undefined),
  registerPayment: vi.fn(async () => undefined),
  voidPayment: vi.fn(async () => undefined),
}));

import { voidPayment } from "@/actions/payments";
import type { Payment } from "@/types";

import { PaymentBlock } from "./payment-block";

const ORDER = "33333333-3333-3333-3333-333333333333";
const TZ = "America/La_Paz";

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "44444444-4444-4444-4444-444444444444",
    organizationId: "11111111-1111-1111-1111-111111111111",
    direction: "in",
    orderId: ORDER,
    expenseId: null,
    amount: 100,
    method: "cash",
    occurredAt: "2026-09-01T14:00:00.000Z",
    note: null,
    createdBy: null,
    archivedAt: null,
    ...overrides,
  };
}

function renderBlock(props: Partial<React.ComponentProps<typeof PaymentBlock>> = {}) {
  const user = userEvent.setup();
  render(
    <PaymentBlock
      target={{ kind: "order", orderId: ORDER }}
      total={300}
      paid={0}
      payments={[]}
      timezone={TZ}
      canVoid
      {...props}
    />,
  );
  return user;
}

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe("PaymentBlock", () => {
  it("Scenario: Bloque de cobros y saldo — lista los cobros y muestra el saldo derivado", () => {
    renderBlock({
      paid: 150,
      payments: [
        payment({ amount: 100 }),
        payment({
          id: "55555555-5555-5555-5555-555555555555",
          amount: 50,
          method: "transfer",
        }),
      ],
    });

    expect(screen.getAllByTestId("payment-entry")).toHaveLength(2);
    expect(screen.getByText("100.00")).toBeInTheDocument();
    expect(screen.getByText("50.00")).toBeInTheDocument();
    expect(screen.getByText("Efectivo")).toBeInTheDocument();
    expect(screen.getByText("Transferencia")).toBeInTheDocument();
    // 300 − 150: derivado al leer, nunca almacenado.
    expect(screen.getByTestId("payment-balance")).toHaveTextContent("150.00");
    expect(screen.getByTestId("payment-status")).toHaveAttribute(
      "data-status",
      "partial",
    );
  });

  it("Scenario: Pedido sin cobros — el saldo es el total y se ofrece Registrar cobro", () => {
    renderBlock();

    expect(screen.getByTestId("payment-balance")).toHaveTextContent("300.00");
    expect(screen.getByTestId("register-payment")).toHaveTextContent(
      "Registrar cobro",
    );
    expect(
      screen.getByText("Todavía no hay movimientos registrados."),
    ).toBeInTheDocument();
  });

  it("un saldo sobrepagado se muestra negativo, no recortado a cero", () => {
    renderBlock({ total: 200, paid: 250, payments: [payment({ amount: 250 })] });

    expect(screen.getByTestId("payment-balance")).toHaveTextContent("-50.00");
    expect(screen.getByTestId("payment-status")).toHaveAttribute(
      "data-status",
      "overpaid",
    );
  });

  it("muestra los anulados tachados y no los oculta", () => {
    renderBlock({
      paid: 0,
      payments: [payment({ archivedAt: "2026-09-02T10:00:00.000Z" })],
    });

    const entry = screen.getByTestId("payment-entry");
    expect(entry).toHaveAttribute("data-voided", "1");
    expect(screen.getByText("Anulado")).toBeInTheDocument();
    // No cuenta en el saldo: eso lo decide la vista, no esta lista.
    expect(screen.getByTestId("payment-balance")).toHaveTextContent("300.00");
  });

  it("Scenario: Anulación devuelve el saldo — de forma optimista", async () => {
    const user = renderBlock({ paid: 100, payments: [payment({ amount: 100 })] });

    expect(screen.getByTestId("payment-balance")).toHaveTextContent("200.00");

    await user.click(screen.getByTestId("void-payment"));
    await user.click(screen.getByTestId("confirm-void"));

    expect(voidPayment).toHaveBeenCalledWith({
      id: "44444444-4444-4444-4444-444444444444",
    });
    expect(await screen.findByTestId("payment-balance")).toHaveTextContent(
      "300.00",
    );
  });

  it("solo el dueño ve la acción de anular", () => {
    renderBlock({ canVoid: false, paid: 100, payments: [payment()] });

    expect(screen.queryByTestId("void-payment")).not.toBeInTheDocument();
  });

  it("un movimiento ya anulado no se puede volver a anular", () => {
    renderBlock({
      payments: [payment({ archivedAt: "2026-09-02T10:00:00.000Z" })],
    });

    expect(screen.queryByTestId("void-payment")).not.toBeInTheDocument();
  });

  it("un documento archivado está congelado: no admite movimientos nuevos", () => {
    renderBlock({ frozen: true });

    expect(screen.queryByTestId("register-payment")).not.toBeInTheDocument();
  });

  it("al ayudante no se le ofrece registrar en un egreso", () => {
    cleanup();
    render(
      <PaymentBlock
        target={{ kind: "expense", expenseId: ORDER }}
        total={500}
        paid={200}
        payments={[]}
        timezone={TZ}
        canVoid={false}
        canRegister={false}
      />,
    );

    expect(screen.queryByTestId("register-payment")).not.toBeInTheDocument();
    expect(screen.getByText("Pagos y saldo")).toBeInTheDocument();
  });
});
