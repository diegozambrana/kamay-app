import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useUserStore } from "@/stores/user-store";

import { QuickGrid } from "./quick-grid";

function renderGrid(role: "owner" | "assistant" = "owner") {
  useUserStore.setState({
    membership: { id: "m1", organizationId: "o1", role, displayName: null },
  });
  return render(<QuickGrid />);
}

afterEach(cleanup);

describe("QuickGrid", () => {
  it("ofrece los seis destinos al dueño", () => {
    renderGrid();

    expect(screen.getByTestId("quick-grid").children).toHaveLength(6);
    for (const label of [
      "Venta rápida",
      "Pedido",
      "Compra",
      "Gasto",
      "Consumo",
      "Tarea",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("los cuatro destinos vivos son enlaces a su formulario", () => {
    renderGrid();

    expect(screen.getByTestId("quick-destination-direct-sale")).toHaveAttribute(
      "href",
      "/fair",
    );
    expect(screen.getByTestId("quick-destination-order")).toHaveAttribute(
      "href",
      "/orders/new",
    );
    expect(screen.getByTestId("quick-destination-purchase")).toHaveAttribute(
      "href",
      "/expenses/purchases/new",
    );
    expect(screen.getByTestId("quick-destination-cost")).toHaveAttribute(
      "href",
      "/expenses/costs/new",
    );
  });

  it("venta rápida es la entrada al modo feria", () => {
    // KAM-12 construyó V6 y su salida; la ida es esta ranura y ninguna otra.
    renderGrid();

    const venta = screen.getByTestId("quick-destination-direct-sale");
    expect(venta.tagName).toBe("A");
    expect(venta).toHaveAttribute("href", "/fair");
  });

  it("los dos destinos pendientes ocupan su ranura, inertes y con su leyenda", () => {
    renderGrid();

    for (const key of ["consumption", "task"]) {
      const tile = screen.getByTestId(`quick-destination-${key}`);
      expect(tile.tagName).toBe("BUTTON");
      expect(tile).toBeDisabled();
      expect(tile).toHaveAttribute("aria-disabled");
      expect(tile).not.toHaveAttribute("href");
    }

    expect(screen.getByText("Llega con el inventario")).toBeInTheDocument();
    expect(screen.getByText("Llega con las tareas")).toBeInTheDocument();
  });

  it("al ayudante no le ofrece compra ni gasto", () => {
    renderGrid("assistant");

    expect(screen.queryByTestId("quick-destination-purchase")).toBeNull();
    expect(screen.queryByTestId("quick-destination-cost")).toBeNull();
    expect(screen.getByTestId("quick-destination-order")).toBeInTheDocument();
    expect(screen.getByTestId("quick-destination-direct-sale")).toBeInTheDocument();
  });
});
