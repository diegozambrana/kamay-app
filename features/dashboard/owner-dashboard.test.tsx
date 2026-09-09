import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { LineCashFlow } from "@/lib/dashboard/indicators";
import type { StatusKind } from "@/types";

import { OwnerDashboard, type OwnerDashboardProps } from "./owner-dashboard";
import type { ActivityItem } from "./recent-activity";
import type { DeliveryItem } from "./upcoming-deliveries";

const SUBLIMACION = "22222222-2222-2222-2222-222222222222";
const ALFARERIA = "33333333-3333-3333-3333-333333333333";

const comparison: LineCashFlow[] = [
  {
    businessLineId: SUBLIMACION,
    name: "Sublimación",
    color: "blue",
    collected: 900,
    paid: 350,
  },
  {
    businessLineId: ALFARERIA,
    name: "Alfarería",
    color: "orange",
    collected: 0,
    paid: 0,
  },
];

const deliveries: DeliveryItem[] = [
  {
    id: "order-1",
    code: 142,
    businessLineId: SUBLIMACION,
    contactId: "contact-1",
    statusId: "status-1",
    deliveryMode: "pickup",
    dueDate: "2026-02-16",
    statusKind: "in_progress" as StatusKind,
    contactName: "Marcela",
    lineColor: "blue",
    lineName: "Sublimación",
  },
];

const activity: ActivityItem[] = [
  {
    id: 1,
    action: "status_changed",
    tableName: "orders",
    actorName: "Diego",
    actorLabel: null,
    recordLabel: "#142",
    occurredAt: "2026-02-14T14:00:00.000Z",
    href: "/orders/order-1",
  },
];

/** Conteos de pendientes sin nada urgente: esta prueba mira otras cosas. */
const PENDING = { overdue: 0, today: 0, upcoming: 0 };

/** Un insumo bajo mínimo, para que la tarjeta tenga algo real que enseñar. */
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

function renderOwner(overrides: Partial<OwnerDashboardProps> = {}) {
  return render(
    <OwnerDashboard
      flow={{ collected: 900, paid: 350 }}
      receivable={125}
      comparison={comparison}
      deliveries={deliveries}
      activity={activity}
      pending={PENDING}
      lowStock={LOW_STOCK}
      activeLineId={null}
      monthLabel="febrero de 2026"
      today="2026-02-14"
      timezone="America/La_Paz"
      {...overrides}
    />,
  );
}

afterEach(cleanup);

describe("OwnerDashboard", () => {
  // Scenario: La persona dueña recibe la composición completa
  it("rinde las seis piezas del panel", () => {
    renderOwner();

    expect(screen.getByTestId("indicator-cards")).toBeInTheDocument();
    expect(screen.getByTestId("line-comparison")).toBeInTheDocument();
    expect(screen.getByTestId("upcoming-deliveries")).toBeInTheDocument();
    expect(screen.getByTestId("recent-activity")).toBeInTheDocument();
    // Las dos dejaron de ser marcadores: pendientes con KAM-17, insumos bajo
    // mínimo con KAM-18. El panel ya no tiene ninguno.
    expect(screen.getByTestId("pending-tasks-card")).toBeInTheDocument();
    expect(screen.getByTestId("low-stock-card")).toBeInTheDocument();
  });

  it("muestra las cuatro cifras: ingresos, egresos, margen y por cobrar", () => {
    renderOwner();

    expect(screen.getByTestId("indicator-income-amount")).toHaveTextContent(
      "900.00",
    );
    expect(screen.getByTestId("indicator-expenses-amount")).toHaveTextContent(
      "350.00",
    );
    // Margen: 900 − 350.
    expect(screen.getByTestId("indicator-margin-amount")).toHaveTextContent(
      "550.00",
    );
    expect(screen.getByTestId("indicator-receivable-amount")).toHaveTextContent(
      "125.00",
    );
  });

  it("un margen negativo se muestra tal cual", () => {
    renderOwner({ flow: { collected: 200, paid: 800 } });

    expect(screen.getByTestId("indicator-margin-amount")).toHaveTextContent(
      "-600.00",
    );
  });

  it("dice de qué periodo habla cada cifra", () => {
    renderOwner();

    // Las tres de caja son del mes; Por cobrar es un saldo vivo.
    expect(screen.getByTestId("indicator-income")).toHaveTextContent(
      "Cobrado en febrero de 2026",
    );
    expect(screen.getByTestId("indicator-receivable")).toHaveTextContent(
      "Saldo pendiente de todos los pedidos",
    );
  });

  // Scenario: Del movimiento a la bitácora — mientras V23 no exista, el panel
  // lo declara en vez de enlazar a una ruta que no está.
  it("declara los destinos que todavía no existen en vez de enlazar a la nada", () => {
    renderOwner();

    expect(screen.getByText(/La bitácora completa llega/)).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Ver la bitácora" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /informe comparativo/ }),
    ).not.toBeInTheDocument();
  });

  // Scenario: Del indicador a reportes — el enlace aparece cuando el destino
  // existe, sin tocar la composición.
  it("los indicadores enlazan a reportes en cuanto esa pantalla exista", () => {
    cleanup();
    render(
      <OwnerDashboard
        flow={{ collected: 900, paid: 350 }}
        receivable={125}
        comparison={comparison}
        deliveries={deliveries}
        activity={activity}
        pending={PENDING}
        lowStock={LOW_STOCK}
        activeLineId={null}
        monthLabel="febrero de 2026"
        today="2026-02-14"
        timezone="America/La_Paz"
      />,
    );

    // Hoy no hay destino y no hay enlace en las tarjetas.
    expect(
      screen.getByTestId("indicator-income").querySelector("a"),
    ).toBeNull();
  });

  it("del movimiento de bitácora se va al registro afectado", () => {
    renderOwner();

    expect(screen.getByTestId("activity-1")).toHaveTextContent(
      "Diego cambió el estado del pedido #142",
    );
    expect(
      screen.getByRole("link", { name: /cambió el estado del pedido/ }),
    ).toHaveAttribute("href", "/orders/order-1");
  });

  it("de la entrega próxima se va a su pedido", () => {
    renderOwner();

    expect(screen.getByTestId("delivery-order-1")).toHaveAttribute(
      "href",
      "/orders/order-1",
    );
  });

  // Scenario: Ningún marcador de posición sobrevive (delta spec `dashboard`)
  it("ninguna pieza del panel es ya un marcador", () => {
    const { container } = renderOwner();

    expect(container.querySelector("[data-placeholder]")).toBeNull();
    expect(container.textContent).not.toMatch(/aún no está disponible/i);
  });

  // Scenario: Los insumos por debajo del mínimo aparecen
  it("la tarjeta de insumos muestra saldo y mínimo, y lleva al detalle", () => {
    renderOwner();

    const card = screen.getByTestId("low-stock-card");
    expect(card).toHaveTextContent("Papel de transferencia");
    expect(card).toHaveTextContent("2");
    expect(card).toHaveTextContent("100");
    expect(screen.getByRole("link", { name: "Papel de transferencia" })).toHaveAttribute(
      "href",
      "/catalog/item-1",
    );
  });

  // Scenario: Nada por debajo del mínimo
  it("sin insumos bajo mínimo lo dice, sin cifras ni tarjeta en blanco", () => {
    renderOwner({ lowStock: [] });

    const card = screen.getByTestId("low-stock-card");
    expect(card).toHaveTextContent(/Ningún insumo está por debajo/);
    expect(screen.queryByTestId("low-stock-list")).toBeNull();
  });

  // Scenario: Pendientes ya no es marcador (delta spec `dashboard`)
  it("la tarjeta de pendientes sí muestra sus conteos", () => {
    renderOwner({ pending: { overdue: 2, today: 1, upcoming: 3 } });

    expect(screen.getByTestId("pending-overdue")).toHaveTextContent("2");
    expect(screen.getByTestId("pending-tasks-card")).not.toHaveAttribute(
      "data-placeholder",
    );
  });
});
