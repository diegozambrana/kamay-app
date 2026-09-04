import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PaymentStatusBadge } from "./payment-status-badge";

afterEach(cleanup);

describe("PaymentStatusBadge", () => {
  it("Scenario: Pedido sin cobros — sin cobrar", () => {
    render(<PaymentStatusBadge total={300} paid={0} />);

    expect(screen.getByTestId("payment-status")).toHaveAttribute(
      "data-status",
      "pending",
    );
    expect(screen.getByText("Sin cobrar")).toBeInTheDocument();
  });

  it("Scenario: Pedido con anticipo — anticipo", () => {
    render(<PaymentStatusBadge total={300} paid={100} />);

    expect(screen.getByTestId("payment-status")).toHaveAttribute(
      "data-status",
      "partial",
    );
  });

  it("Scenario: Pedido saldado — pagado", () => {
    render(<PaymentStatusBadge total={300} paid={300} />);

    expect(screen.getByTestId("payment-status")).toHaveAttribute(
      "data-status",
      "paid",
    );
  });

  it("Scenario: Pedido de total cero — pagado, no pendiente", () => {
    render(<PaymentStatusBadge total={0} paid={0} />);

    expect(screen.getByTestId("payment-status")).toHaveAttribute(
      "data-status",
      "paid",
    );
  });

  it("marca el sobrepago con su propia señal", () => {
    render(<PaymentStatusBadge total={200} paid={250} />);

    expect(screen.getByTestId("payment-status")).toHaveAttribute(
      "data-status",
      "overpaid",
    );
  });

  it("Scenario: No hay control para fijarlo — la insignia no es interactiva", () => {
    const { container } = render(<PaymentStatusBadge total={300} paid={100} />);

    expect(container.querySelector("input, select, button")).toBeNull();
  });
});
