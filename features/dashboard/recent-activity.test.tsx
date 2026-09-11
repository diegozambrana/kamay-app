import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { RecentActivity, type ActivityItem } from "./recent-activity";

const TZ = "America/La_Paz";

function item(id: number, overrides: Partial<ActivityItem> = {}): ActivityItem {
  return {
    id,
    action: "status_changed",
    tableName: "orders",
    actorName: "Diego",
    actorLabel: null,
    recordLabel: `#${id}`,
    occurredAt: "2026-02-14T14:00:00.000Z",
    href: `/orders/order-${id}`,
    ...overrides,
  };
}

afterEach(cleanup);

describe("RecentActivity", () => {
  // Scenario: Los cinco más recientes
  it("muestra los eventos que recibe, en el orden en que llegan", () => {
    render(
      <RecentActivity
        items={[item(5), item(4), item(3), item(2), item(1)]}
        timezone={TZ}
      />,
    );

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(5);
    expect(items[0]).toHaveTextContent("#5");
    expect(items[4]).toHaveTextContent("#1");
  });

  // Scenario: En lenguaje natural
  it("cada evento se lee como una frase, sin jerga", () => {
    render(<RecentActivity items={[item(142)]} timezone={TZ} />);

    expect(
      screen.getByText("Diego cambió el estado del pedido #142"),
    ).toBeInTheDocument();
  });

  it("ningún nombre de tabla ni de columna llega a la pantalla", () => {
    const { container } = render(
      <RecentActivity
        items={[item(1, { tableName: "order_items", action: "updated" })]}
        timezone={TZ}
      />,
    );

    expect(container.textContent).not.toContain("order_items");
    expect(container.textContent).not.toContain("status_changed");
  });

  it("la hora se escribe en la zona de la organización", () => {
    render(<RecentActivity items={[item(1)]} timezone={TZ} />);

    // 14:00 UTC son las 10:00 en La Paz.
    expect(screen.getByText("14/02/2026 10:00")).toBeInTheDocument();
  });

  it("un evento cuyo registro ya no es alcanzable se cuenta igual, sin enlace", () => {
    render(<RecentActivity items={[item(1, { href: null })]} timezone={TZ} />);

    // El único enlace que queda es el de la bitácora, en la cabecera: el
    // evento se cuenta, pero no lleva a ninguna parte.
    const enlaces = screen.getAllByRole("link");
    expect(enlaces).toHaveLength(1);
    expect(enlaces[0]).toHaveAccessibleName("Ver la bitácora");
    expect(screen.getByText(/cambió el estado del pedido/)).toBeInTheDocument();
  });

  // Hasta KAM-22 esta prueba exigía lo contrario: que la salida se nombrara
  // sin enlazar, porque V23 no existía. Ya existe.
  it("enlaza la bitácora completa", () => {
    render(<RecentActivity items={[item(1)]} timezone={TZ} />);

    expect(
      screen.getByRole("link", { name: "Ver la bitácora" }),
    ).toHaveAttribute("href", "/activity");
    expect(screen.queryByText(/La bitácora completa llega/)).toBeNull();
  });

  it("sin eventos lo dice, en vez de dejar un hueco", () => {
    render(<RecentActivity items={[]} timezone={TZ} />);

    expect(screen.getByText(/Todavía no hay movimientos/)).toBeInTheDocument();
  });
});
