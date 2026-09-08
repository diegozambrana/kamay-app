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

describe("AssistantDashboard", () => {
  // Scenario: Ningún importe en pantalla
  it("no muestra ninguna cifra monetaria", () => {
    const { container } = render(
      <AssistantDashboard deliveries={deliveries} today={TODAY} pending={PENDING} />,
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
    render(<AssistantDashboard deliveries={deliveries} today={TODAY} pending={PENDING} />);

    expect(screen.queryByTestId("recent-activity")).not.toBeInTheDocument();
    expect(screen.queryByText(/movimientos/i)).not.toBeInTheDocument();
  });

  // Scenario: Sin huecos donde estaban las piezas del dueño
  it("no deja secciones vacías donde la persona dueña tiene las suyas", () => {
    render(<AssistantDashboard deliveries={deliveries} today={TODAY} pending={PENDING} />);

    expect(screen.queryByTestId("indicator-cards")).not.toBeInTheDocument();
    expect(screen.queryByTestId("line-comparison")).not.toBeInTheDocument();
    expect(screen.queryByTestId("recent-activity")).not.toBeInTheDocument();

    // Lo que queda tiene contenido: entregas, la tarjeta de pendientes —real
    // desde KAM-17— y el marcador de insumos, y ninguna está en blanco.
    expect(screen.getByTestId("upcoming-deliveries")).toHaveTextContent("#1");
    expect(screen.getByTestId("pending-tasks-card")).toHaveTextContent(
      "Pendientes",
    );
    expect(screen.getByTestId("placeholder-stock")).toHaveTextContent(
      "Insumos bajo mínimo",
    );
  });

  // Scenario: Las entregas encabezan su pantalla
  it("las entregas próximas son la pieza principal", () => {
    render(<AssistantDashboard deliveries={deliveries} today={TODAY} pending={PENDING} />);

    const root = screen.getByTestId("assistant-dashboard");
    expect(root.firstElementChild).toBe(screen.getByTestId("upcoming-deliveries"));

    // Y con más detalle que en la composición de la persona dueña: aquí es
    // la información principal, no la cuarta.
    expect(screen.getByTestId("delivery-a")).toHaveTextContent("Delivery");
    expect(screen.getByTestId("delivery-a")).toHaveTextContent("Sublimación");
  });

  it("marca lo vencido igual que la otra composición", () => {
    render(<AssistantDashboard deliveries={deliveries} today={TODAY} pending={PENDING} />);

    expect(screen.getByTestId("delivery-b")).toHaveAttribute(
      "data-overdue",
      "true",
    );
  });

  it("sin entregas sigue sin dejar huecos", () => {
    render(<AssistantDashboard deliveries={[]} today={TODAY} pending={PENDING} />);

    expect(screen.getByText(/No hay entregas comprometidas/)).toBeInTheDocument();
    expect(screen.getByTestId("pending-tasks-card")).toBeInTheDocument();
  });

  // Scenario: El ayudante cuenta lo suyo (delta spec `dashboard`)
  it("recibe sus propios conteos, ya recortados por la RLS", () => {
    render(
      <AssistantDashboard
        deliveries={deliveries}
        today={TODAY}
        pending={{ overdue: 1, today: 0, upcoming: 2 }}
      />,
    );

    expect(screen.getByTestId("pending-overdue")).toHaveTextContent("1");
    expect(screen.getByTestId("pending-upcoming")).toHaveTextContent("2");
  });
});
