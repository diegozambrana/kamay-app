"use client";

import { create } from "zustand";

/**
 * Los movimientos de tarjeta que aún no ha confirmado el servidor.
 *
 * La tarjeta se pinta en la columna destino antes de que llegue la respuesta,
 * y vuelve a su sitio si la acción falla (design.md D6). El store guarda una
 * ubicación en vuelo, no un dato derivado: la convención nº 4 prohíbe
 * almacenar totales y saldos, no el estado transitorio de la interfaz.
 */
type BoardState = {
  /** `orderId → statusId` mientras el servidor no responde. */
  pending: Record<string, string>;
  /** `orderId → queuedAt` para el reordenamiento optimista de la cola. */
  pendingQueue: Record<string, string>;
  move: (orderId: string, statusId: string) => void;
  reorder: (orderId: string, queuedAt: string) => void;
  /** El servidor confirmó: el dato real ya llega por revalidación. */
  settle: (orderId: string) => void;
  /** El servidor rechazó: la tarjeta vuelve a donde estaba. */
  revert: (orderId: string) => void;
};

function without<T>(source: Record<string, T>, key: string): Record<string, T> {
  return Object.fromEntries(
    Object.entries(source).filter(([current]) => current !== key),
  );
}

export const useBoardStore = create<BoardState>((set) => ({
  pending: {},
  pendingQueue: {},

  move: (orderId, statusId) =>
    set((state) => ({ pending: { ...state.pending, [orderId]: statusId } })),

  reorder: (orderId, queuedAt) =>
    set((state) => ({
      pendingQueue: { ...state.pendingQueue, [orderId]: queuedAt },
    })),

  settle: (orderId) =>
    set((state) => ({
      pending: without(state.pending, orderId),
      pendingQueue: without(state.pendingQueue, orderId),
    })),

  revert: (orderId) =>
    set((state) => ({
      pending: without(state.pending, orderId),
      pendingQueue: without(state.pendingQueue, orderId),
    })),
}));

/**
 * El estado y la llegada que debe mostrarse ahora mismo: el movimiento en
 * vuelo si lo hay, y si no, lo que dice el servidor.
 */
export function displayedPlacement(
  order: { id: string; statusId: string; queuedAt: string | null },
  pending: Record<string, string>,
  pendingQueue: Record<string, string>,
): { statusId: string; queuedAt: string | null } {
  return {
    statusId: pending[order.id] ?? order.statusId,
    queuedAt: pendingQueue[order.id] ?? order.queuedAt,
  };
}
