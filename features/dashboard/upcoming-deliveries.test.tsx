import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { StatusKind } from "@/types";

import { UpcomingDeliveries, type DeliveryItem } from "./upcoming-deliveries";

const TODAY = "2026-02-14";
const LINE = "22222222-2222-2222-2222-222222222222";

function delivery(
  id: string,
  code: number,
  dueDate: string,
  statusKind: StatusKind,
): DeliveryItem {
  return {
    id,
    code,
    businessLineId: LINE,
    contactId: "contact-1",
    statusId: "status-1",
    deliveryMode: "pickup",
    dueDate,
    statusKind,
    contactName: "Marcela",
    lineColor: "blue",
    lineName: "Sublimación",
  };
}

afterEach(cleanup);

describe("UpcomingDeliveries", () => {
  // Scenario: Lo vencido encabeza y se destaca
  it("pone primero lo vencido y lo marca", () => {
    render(
      <UpcomingDeliveries
        deliveries={[
          delivery("a", 1, "2026-02-18", "in_progress"),
          delivery("b", 2, "2026-02-12", "in_progress"),
        ]}
        today={TODAY}
      />,
    );

    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("#2");

    expect(screen.getByTestId("delivery-b")).toHaveAttribute(
      "data-overdue",
      "true",
    );
    expect(screen.getByTestId("delivery-a")).not.toHaveAttribute("data-overdue");
  });

  // Scenario: Vencido pero en espera no alarma
  it("un pedido vencido en espera aparece, pero sin marca de vencido", () => {
    render(
      <UpcomingDeliveries
        deliveries={[delivery("c", 3, "2026-02-10", "waiting")]}
        today={TODAY}
      />,
    );

    // Sigue siendo una entrega comprometida: no se esconde.
    expect(screen.getByTestId("delivery-c")).toBeInTheDocument();
    expect(screen.getByTestId("delivery-c")).not.toHaveAttribute("data-overdue");
    expect(screen.queryByText("Vencido")).not.toBeInTheDocument();
  });

  // Scenario: Terminado no aparece — el recorte lo hace la consulta, pero si
  // un pedido terminado llegara igual, tampoco se destacaría como vencido.
  it("un pedido con fecha pasada ya terminado o cancelado no se marca", () => {
    render(
      <UpcomingDeliveries
        deliveries={[
          delivery("d", 4, "2026-02-01", "final"),
          delivery("e", 5, "2026-02-02", "cancelled"),
        ]}
        today={TODAY}
      />,
    );

    expect(screen.getByTestId("delivery-d")).not.toHaveAttribute("data-overdue");
    expect(screen.getByTestId("delivery-e")).not.toHaveAttribute("data-overdue");
  });

  // Scenario: Lo vencido y pendiente no se olvida por antiguo
  it("un compromiso vencido hace meses sigue encabezando la lista", () => {
    render(
      <UpcomingDeliveries
        deliveries={[
          delivery("reciente", 11, "2026-02-16", "in_progress"),
          delivery("atascado", 12, "2025-11-14", "in_progress"),
        ]}
        today={TODAY}
      />,
    );

    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("#12");
    expect(screen.getByTestId("delivery-atascado")).toHaveAttribute(
      "data-overdue",
      "true",
    );
  });

  it("la decisión de retraso se toma por el tipo del estado, nunca por su nombre", () => {
    // Mismo día vencido, dos tipos distintos: solo uno alarma.
    render(
      <UpcomingDeliveries
        deliveries={[
          delivery("f", 6, "2026-02-10", "initial"),
          delivery("g", 7, "2026-02-10", "waiting"),
        ]}
        today={TODAY}
      />,
    );

    expect(screen.getByTestId("delivery-f")).toHaveAttribute(
      "data-overdue",
      "true",
    );
    expect(screen.getByTestId("delivery-g")).not.toHaveAttribute("data-overdue");
  });

  // Scenario: La entrada lleva a su pedido
  it("cada entrada enlaza al detalle de su pedido", () => {
    render(
      <UpcomingDeliveries
        deliveries={[delivery("h", 8, "2026-02-16", "in_progress")]}
        today={TODAY}
      />,
    );

    expect(screen.getByTestId("delivery-h")).toHaveAttribute(
      "href",
      "/orders/h",
    );
  });

  it("no muestra ningún importe en ninguna de sus dos composiciones", () => {
    const items = [delivery("i", 9, "2026-02-16", "in_progress")];

    const { rerender, container } = render(
      <UpcomingDeliveries deliveries={items} today={TODAY} />,
    );
    expect(container.textContent).not.toMatch(/\d+\.\d{2}/);

    rerender(<UpcomingDeliveries deliveries={items} today={TODAY} emphasis />);
    expect(container.textContent).not.toMatch(/\d+\.\d{2}/);
  });

  it("sin entregas dice que no hay, en vez de dejar un hueco", () => {
    render(<UpcomingDeliveries deliveries={[]} today={TODAY} />);

    expect(screen.getByText(/No hay entregas comprometidas/)).toBeInTheDocument();
  });

  it("la composición destacada añade modo de entrega y línea", () => {
    render(
      <UpcomingDeliveries
        deliveries={[delivery("j", 10, "2026-02-16", "in_progress")]}
        today={TODAY}
        emphasis
      />,
    );

    // Modo de entrega y línea viven en la misma tira de contexto.
    expect(screen.getByTestId("delivery-j")).toHaveTextContent("Recojo");
    expect(screen.getByTestId("delivery-j")).toHaveTextContent("Sublimación");
  });
});
