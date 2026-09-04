import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { OrderCard, type OrderCardData } from "./order-card";

const TODAY = "2026-08-26";

function card(overrides: Partial<OrderCardData> = {}): OrderCardData {
  return {
    id: "33333333-3333-3333-3333-333333333333",
    code: 142,
    contactName: "María Céspedes",
    dueDate: "2026-09-05",
    deliveryMode: "pickup",
    lineColor: "blue",
    statusKind: "in_progress",
    total: 190,
    paid: 0,
    itemsSummary: "3 × Taza personalizada",
    archivedAt: null,
    ...overrides,
  };
}

afterEach(cleanup);

describe("OrderCard", () => {
  it("muestra el número, el cliente y el total", () => {
    render(<OrderCard order={card()} today={TODAY} />);

    expect(screen.getByText("#142")).toBeInTheDocument();
    expect(screen.getByText("María Céspedes")).toBeInTheDocument();
    expect(screen.getByText("190.00")).toBeInTheDocument();
  });

  it("distingue delivery de recojo", () => {
    const { unmount } = render(
      <OrderCard order={card({ deliveryMode: "delivery" })} today={TODAY} />,
    );
    expect(screen.getByTestId("delivery-mode")).toHaveAttribute(
      "data-mode",
      "delivery",
    );
    expect(screen.getByText("Delivery")).toBeInTheDocument();
    unmount();

    render(<OrderCard order={card({ deliveryMode: "pickup" })} today={TODAY} />);
    expect(screen.getByTestId("delivery-mode")).toHaveAttribute(
      "data-mode",
      "pickup",
    );
    expect(screen.getByText("Recojo")).toBeInTheDocument();
  });

  it("se rinde sin fecha ni modo de entrega y sin cliente", () => {
    render(
      <OrderCard
        order={card({ dueDate: null, deliveryMode: null, contactName: null })}
        today={TODAY}
      />,
    );

    expect(screen.getByText("#142")).toBeInTheDocument();
    expect(screen.getByText("Sin cliente")).toBeInTheDocument();
    expect(screen.queryByTestId("delivery-mode")).not.toBeInTheDocument();
  });

  it("alerta si está vencido y en proceso", () => {
    render(
      <OrderCard
        order={card({ dueDate: "2026-08-20", statusKind: "in_progress" })}
        today={TODAY}
      />,
    );

    expect(screen.getByTestId("overdue-alert")).toBeInTheDocument();
  });

  it("no alerta si está vencido pero en espera", () => {
    render(
      <OrderCard
        order={card({ dueDate: "2026-08-20", statusKind: "waiting" })}
        today={TODAY}
      />,
    );

    expect(screen.queryByTestId("overdue-alert")).not.toBeInTheDocument();
  });

  it("no alerta si está vencido pero terminado o cancelado", () => {
    const { unmount } = render(
      <OrderCard
        order={card({ dueDate: "2026-08-20", statusKind: "final" })}
        today={TODAY}
      />,
    );
    expect(screen.queryByTestId("overdue-alert")).not.toBeInTheDocument();
    unmount();

    render(
      <OrderCard
        order={card({ dueDate: "2026-08-20", statusKind: "cancelled" })}
        today={TODAY}
      />,
    );
    expect(screen.queryByTestId("overdue-alert")).not.toBeInTheDocument();
  });

  it("muestra la posición solo cuando se le da una", () => {
    const { unmount } = render(
      <OrderCard order={card()} today={TODAY} position={2} />,
    );
    expect(screen.getByTestId("queue-position")).toHaveTextContent("2");
    unmount();

    render(<OrderCard order={card()} today={TODAY} />);
    expect(screen.queryByTestId("queue-position")).not.toBeInTheDocument();
  });

  it("señala el pedido archivado", () => {
    render(
      <OrderCard
        order={card({ archivedAt: "2026-08-01T00:00:00Z" })}
        today={TODAY}
      />,
    );

    expect(screen.getByText("Archivado")).toBeInTheDocument();
  });

  it("enlaza al detalle del pedido", () => {
    render(<OrderCard order={card()} today={TODAY} />);

    expect(screen.getByTestId("order-card")).toHaveAttribute(
      "href",
      "/orders/33333333-3333-3333-3333-333333333333",
    );
  });
});

describe("OrderCard · señal de pago", () => {
  it("Scenario: Señal de pago de un pedido con anticipo", () => {
    render(<OrderCard order={card({ total: 190, paid: 40 })} today={TODAY} />);

    expect(screen.getByTestId("payment-status")).toHaveAttribute(
      "data-status",
      "partial",
    );
  });

  it("Scenario: Señal de pago de un pedido saldado", () => {
    render(<OrderCard order={card({ total: 190, paid: 190 })} today={TODAY} />);

    expect(screen.getByTestId("payment-status")).toHaveAttribute(
      "data-status",
      "paid",
    );
  });

  it("Scenario: La señal de pago no depende del estado del pedido", () => {
    // Entregado y cobrado son hechos distintos (modelo 6.1): un pedido en un
    // estado `final` sin cobros sigue estando sin cobrar.
    render(
      <OrderCard
        order={card({ statusKind: "final", total: 190, paid: 0 })}
        today={TODAY}
      />,
    );

    expect(screen.getByTestId("payment-status")).toHaveAttribute(
      "data-status",
      "pending",
    );
  });

  it("no ofrece ningún control para fijarla", () => {
    const { container } = render(
      <OrderCard order={card({ total: 190, paid: 40 })} today={TODAY} />,
    );

    expect(container.querySelector("input, select, button")).toBeNull();
  });
});
