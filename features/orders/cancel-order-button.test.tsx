import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Status, StatusKind } from "@/types";

vi.mock("@/actions/orders", () => ({
  moveOrderToStatus: vi.fn(async () => undefined),
}));

import { moveOrderToStatus } from "@/actions/orders";

import { CancelOrderButton } from "./cancel-order-button";

const ORDER = "33333333-3333-3333-3333-333333333333";

function status(name: string, kind: StatusKind, id: string): Status {
  return {
    id,
    organizationId: "org",
    businessLineId: "line",
    flow: "order",
    name,
    kind,
    color: "zinc",
    position: 1,
    isQueue: false,
    archivedAt: null,
  };
}

const REGISTRADO = status("Registrado", "initial", "s-1");
const CANCELADO = status("Cancelado", "cancelled", "s-9");

function renderButton(
  statuses: Status[] = [REGISTRADO, CANCELADO],
  currentKind: StatusKind = "initial",
) {
  render(
    <CancelOrderButton
      orderId={ORDER}
      statuses={statuses}
      currentKind={currentKind}
    />,
  );
  return userEvent.setup();
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("CancelOrderButton", () => {
  it("ofrece la acción cuando el juego tiene un estado de cancelación", () => {
    renderButton();

    expect(screen.getByTestId("cancel-order")).toBeInTheDocument();
  });

  it("confirmar mueve el pedido a ese estado", async () => {
    const user = renderButton();

    await user.click(screen.getByTestId("cancel-order"));
    await user.click(screen.getByTestId("confirm-cancel-order"));

    expect(moveOrderToStatus).toHaveBeenCalledWith({
      orderId: ORDER,
      statusId: CANCELADO.id,
    });
  });

  it("la confirmación nombra el estado de destino", async () => {
    const user = renderButton();

    await user.click(screen.getByTestId("cancel-order"));

    expect(screen.getByText(/Pasará a «Cancelado»/)).toBeInTheDocument();
    // Cancelar no archiva: el pedido sigue en el tablero.
    expect(screen.getByText(/seguirá visible en el tablero/)).toBeInTheDocument();
  });

  it("rechazar la confirmación no cambia nada", async () => {
    const user = renderButton();

    await user.click(screen.getByTestId("cancel-order"));
    await user.click(screen.getByRole("button", { name: "Volver" }));

    expect(moveOrderToStatus).not.toHaveBeenCalled();
  });

  it("no se ofrece si el juego de la línea no tiene estado de cancelación", () => {
    renderButton([REGISTRADO]);

    expect(screen.queryByTestId("cancel-order")).toBeNull();
  });

  it("no se ofrece si el pedido ya está cancelado", () => {
    renderButton([REGISTRADO, CANCELADO], "cancelled");

    expect(screen.queryByTestId("cancel-order")).toBeNull();
  });

  /** Convención nº 5: el destino se busca por `kind`, jamás por nombre. */
  it("renombrar el estado no cambia el destino", async () => {
    const renombrado = { ...CANCELADO, name: "Anulado por la clienta" };
    const user = renderButton([REGISTRADO, renombrado]);

    await user.click(screen.getByTestId("cancel-order"));
    expect(screen.getByText(/Pasará a «Anulado por la clienta»/)).toBeInTheDocument();

    await user.click(screen.getByTestId("confirm-cancel-order"));

    expect(moveOrderToStatus).toHaveBeenCalledWith({
      orderId: ORDER,
      statusId: CANCELADO.id,
    });
  });

  it("muestra el error del servidor sin cerrar el diálogo", async () => {
    vi.mocked(moveOrderToStatus).mockResolvedValueOnce({
      error: "Ese estado no pertenece al flujo de esta línea.",
    });
    const user = renderButton();

    await user.click(screen.getByTestId("cancel-order"));
    await user.click(screen.getByTestId("confirm-cancel-order"));

    expect(
      screen.getByText("Ese estado no pertenece al flujo de esta línea."),
    ).toBeInTheDocument();
  });
});
