import { beforeEach, describe, expect, it } from "vitest";

import { displayedPlacement, useBoardStore } from "@/stores/board-store";

const REGISTRO = "33333333-3333-3333-3333-333333333333";
const ORIGEN = "aaaaaaaa-0000-0000-0000-000000000001";
const DESTINO = "bbbbbbbb-0000-0000-0000-000000000002";

const registro = { id: REGISTRO, statusId: ORIGEN, queuedAt: null };

describe("board-store", () => {
  beforeEach(() => {
    useBoardStore.setState({ pending: {}, pendingQueue: {} });
  });

  it("la tarjeta se mueve antes de que responda el servidor", () => {
    useBoardStore.getState().move(REGISTRO, DESTINO);

    const { pending, pendingQueue } = useBoardStore.getState();
    expect(displayedPlacement(registro, pending, pendingQueue).statusId).toBe(DESTINO);
  });

  it("el error devuelve la tarjeta a su columna original", () => {
    useBoardStore.getState().move(REGISTRO, DESTINO);
    useBoardStore.getState().revert(REGISTRO);

    const { pending, pendingQueue } = useBoardStore.getState();
    expect(displayedPlacement(registro, pending, pendingQueue).statusId).toBe(ORIGEN);
  });

  it("al confirmar deja de mandar el movimiento en vuelo", () => {
    useBoardStore.getState().move(REGISTRO, DESTINO);
    useBoardStore.getState().settle(REGISTRO);

    const { pending, pendingQueue } = useBoardStore.getState();
    // El dato real llega por revalidación; el store ya no opina.
    expect(displayedPlacement(registro, pending, pendingQueue).statusId).toBe(ORIGEN);
  });

  it("el reordenamiento de la cola también es optimista y reversible", () => {
    const enCola = { id: REGISTRO, statusId: ORIGEN, queuedAt: "2026-08-25T10:00:00.000Z" };
    useBoardStore.getState().reorder(REGISTRO, "2026-08-23T10:00:00.000Z");

    let state = useBoardStore.getState();
    expect(
      displayedPlacement(enCola, state.pending, state.pendingQueue).queuedAt,
    ).toBe("2026-08-23T10:00:00.000Z");

    useBoardStore.getState().revert(REGISTRO);
    state = useBoardStore.getState();
    expect(
      displayedPlacement(enCola, state.pending, state.pendingQueue).queuedAt,
    ).toBe("2026-08-25T10:00:00.000Z");
  });

  it("un movimiento en vuelo no afecta a las demás tarjetas", () => {
    useBoardStore.getState().move(REGISTRO, DESTINO);

    const otra = { id: "otra", statusId: ORIGEN, queuedAt: null };
    const { pending, pendingQueue } = useBoardStore.getState();
    expect(displayedPlacement(otra, pending, pendingQueue).statusId).toBe(ORIGEN);
  });
});
