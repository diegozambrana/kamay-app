import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { StatusKind } from "@/types";

import { AssistantDashboard } from "./assistant-dashboard";
import type { DeliveryItem } from "./upcoming-deliveries";

const TODAY = "2026-02-14";

function delivery(
  id: string,
  code: number,
  dueDate: string,
  statusKind: StatusKind = "in_progress",
): DeliveryItem {
  return {
    id,
    code,
    businessLineId: "line-1",
    contactId: "contact-1",
    statusId: "status-1",
    deliveryMode: "delivery",
    dueDate,
    statusKind,
    contactName: "Marcela",
    lineColor: "blue",
    lineName: "Sublimación",
  };
}

const deliveries = [
  delivery("a", 1, "2026-02-16"),
  delivery("b", 2, "2026-02-12"),
];

afterEach(cleanup);

/** Conteos de pendientes sin nada urgente: esta prueba mira otras cosas. */
const PENDING = { overdue: 0, today: 0, upcoming: 0 };

/** Un insumo bajo mínimo: la tarjeta la ven los dos roles, no lleva importes. */
const LOW_STOCK = [
  {
    itemId: "item-1",
    organizationId: "org-1",
    balance: 2,
    minStock: 100,
    belowMin: true,
    name: "Papel de transferencia",
    unitCode: "u",
  },
];

describe("AssistantDashboard", () => {
  // Scenario: Ningún importe en pantalla
  it("no muestra ninguna cifra monetaria", () => {
    const { container } = render(
      <AssistantDashboard deliveries={deliveries} today={TODAY} pending={PENDING} lowStock={LOW_STOCK} />,
    );

    // Ni importes con decimales ni etiquetas de dinero: la composición no
    // recibe una sola cifra, así que no hay forma de que aparezca una.
    expect(container.textContent).not.toMatch(/\d+\.\d{2}/);
    expect(container.textContent).not.toMatch(
      /Ingresos|Egresos|Margen|Por cobrar/,
    );
  });

  // Scenario: El ayudante no tiene esta pieza (últimos movimientos)
  it("no tiene la pieza de bitácora, ni siquiera vacía", () => {
    render(<AssistantDashboard deliveries={deliveries} today={TODAY} pending={PENDING} lowStock={LOW_STOCK} />);

    expect(screen.queryByTestId("recent-activity")).not.toBeInTheDocument();
    expect(screen.queryByText(/movimientos/i)).not.toBeInTheDocument();
  });

  // Scenario: Sin huecos donde estaban las piezas del dueño
  it("no deja secciones vacías donde la persona dueña tiene las suyas", () => {
    render(<AssistantDashboard deliveries={deliveries} today={TODAY} pending={PENDING} lowStock={LOW_STOCK} />);

    expect(screen.queryByTestId("indicator-cards")).not.toBeInTheDocument();
    expect(screen.queryByTestId("line-comparison")).not.toBeInTheDocument();
    expect(screen.queryByTestId("recent-activity")).not.toBeInTheDocument();

    // Lo que queda tiene contenido: entregas, la tarjeta de pendientes —real
    // desde KAM-17— y la de insumos bajo mínimo —real desde KAM-18—. Ya no
    // queda ningún marcador en el panel.
    expect(screen.getByTestId("upcoming-deliveries")).toHaveTextContent("#1");
    expect(screen.getByTestId("pending-tasks-card")).toHaveTextContent(
      "Pendientes",
    );
    expect(screen.getByTestId("low-stock-card")).toHaveTextContent(
      "Papel de transferencia",
    );
  });

  // Scenario: Las entregas encabezan su pantalla
  it("las entregas próximas son la pieza principal", () => {
    render(<AssistantDashboard deliveries={deliveries} today={TODAY} pending={PENDING} lowStock={LOW_STOCK} />);

    const root = screen.getByTestId("assistant-dashboard");
    expect(root.firstElementChild).toBe(screen.getByTestId("upcoming-deliveries"));

    // Y con más detalle que en la composición de la persona dueña: aquí es
    // la información principal, no la cuarta.
    expect(screen.getByTestId("delivery-a")).toHaveTextContent("Delivery");
    expect(screen.getByTestId("delivery-a")).toHaveTextContent("Sublimación");
  });

  it("marca lo vencido igual que la otra composición", () => {
    render(<AssistantDashboard deliveries={deliveries} today={TODAY} pending={PENDING} lowStock={LOW_STOCK} />);

    expect(screen.getByTestId("delivery-b")).toHaveAttribute(
      "data-overdue",
      "true",
    );
  });

  it("sin entregas sigue sin dejar huecos", () => {
    render(<AssistantDashboard deliveries={[]} today={TODAY} pending={PENDING} lowStock={LOW_STOCK} />);

    expect(screen.getByText(/No hay entregas comprometidas/)).toBeInTheDocument();
    expect(screen.getByTestId("pending-tasks-card")).toBeInTheDocument();
  });

  // Scenario: El ayudante cuenta lo suyo (delta spec `dashboard`)
  it("recibe sus propios conteos, ya recortados por la RLS", () => {
    render(
      <AssistantDashboard
        deliveries={deliveries}
        today={TODAY}
        pending={{ overdue: 1, today: 0, upcoming: 2 }} lowStock={LOW_STOCK} />,
    );

    expect(screen.getByTestId("pending-overdue")).toHaveTextContent("1");
    expect(screen.getByTestId("pending-upcoming")).toHaveTextContent("2");
  });
});
