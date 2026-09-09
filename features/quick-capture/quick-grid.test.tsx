import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  // Escenario "Destinos aún no construidos": desde KAM-18 no queda ninguno.
  it("ningún destino queda inerte ni lleva leyenda de no disponible", () => {
    renderGrid();

    for (const key of [
      "direct-sale",
      "order",
      "purchase",
      "cost",
      "consumption",
      "task",
    ]) {
      expect(screen.getByTestId(`quick-destination-${key}`)).not.toBeDisabled();
    }
    expect(screen.queryByText(/Llega con/)).not.toBeInTheDocument();
  });

  // Escenario "El destino que es diálogo no cambia de pantalla": Consumo es un
  // botón sin `href`, y abre su diálogo sobre la propia pantalla (mapa §5).
  it("Consumo abre su diálogo sin navegar a ninguna parte", async () => {
    renderGrid();

    const tile = screen.getByTestId("quick-destination-consumption");
    expect(tile.tagName).toBe("BUTTON");
    expect(tile).not.toBeDisabled();
    expect(tile).not.toHaveAttribute("href");

    await userEvent.click(tile);

    expect(screen.getByTestId("consumption-form")).toBeInTheDocument();
  });

  it("el destino Tarea abre el alta de tarea", () => {
    renderGrid();

    const tile = screen.getByTestId("quick-destination-task");
    expect(tile).toHaveAttribute("href", "/tasks/new");
    expect(tile).not.toBeDisabled();
  });

  it("al ayudante no le ofrece compra ni gasto", () => {
    renderGrid("assistant");

    expect(screen.queryByTestId("quick-destination-purchase")).toBeNull();
    expect(screen.queryByTestId("quick-destination-cost")).toBeNull();
    expect(screen.getByTestId("quick-destination-order")).toBeInTheDocument();
    expect(screen.getByTestId("quick-destination-direct-sale")).toBeInTheDocument();
  });
});
