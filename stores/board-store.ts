"use client";

import { create } from "zustand";

/**
 * Los movimientos de tarjeta que aún no ha confirmado el servidor.
 *
 * La tarjeta se pinta en la columna destino antes de que llegue la respuesta,
 * y vuelve a su sitio si la acción falla. El store guarda una ubicación en
 * vuelo, no un dato derivado: la convención nº 4 prohíbe almacenar totales y
 * saldos, no el estado transitorio de la interfaz.
 *
 * Es de los dos tableros —pedidos y tareas—, así que sus claves son
 * identificadores de registro sin nombre de dominio (KAM-15, design D6). La
 * cola, en cambio, solo la usan los pedidos: `pendingQueue` queda aquí porque
 * es el mismo mecanismo optimista, no porque las tareas lo necesiten.
 */
type BoardState = {
  /** `recordId → columnId` mientras el servidor no responde. */
  pending: Record<string, string>;
  /** `recordId → queuedAt` para el reordenamiento optimista de la cola. */
  pendingQueue: Record<string, string>;
  move: (recordId: string, columnId: string) => void;
  reorder: (recordId: string, queuedAt: string) => void;
  /** El servidor confirmó: el dato real ya llega por revalidación. */
  settle: (recordId: string) => void;
  /** El servidor rechazó: la tarjeta vuelve a donde estaba. */
  revert: (recordId: string) => void;
};

function without<T>(source: Record<string, T>, key: string): Record<string, T> {
  return Object.fromEntries(
    Object.entries(source).filter(([current]) => current !== key),
  );
}

export const useBoardStore = create<BoardState>((set) => ({
  pending: {},
  pendingQueue: {},

  move: (recordId, columnId) =>
    set((state) => ({ pending: { ...state.pending, [recordId]: columnId } })),

  reorder: (recordId, queuedAt) =>
    set((state) => ({
      pendingQueue: { ...state.pendingQueue, [recordId]: queuedAt },
    })),

  settle: (recordId) =>
    set((state) => ({
      pending: without(state.pending, recordId),
      pendingQueue: without(state.pendingQueue, recordId),
    })),

  revert: (recordId) =>
    set((state) => ({
      pending: without(state.pending, recordId),
      pendingQueue: without(state.pendingQueue, recordId),
    })),
}));

/**
 * La columna y la llegada que deben mostrarse ahora mismo: el movimiento en
 * vuelo si lo hay, y si no, lo que dice el servidor.
 */
export function displayedPlacement(
  record: { id: string; statusId: string; queuedAt: string | null },
  pending: Record<string, string>,
  pendingQueue: Record<string, string>,
): { statusId: string; queuedAt: string | null } {
  return {
    statusId: pending[record.id] ?? record.statusId,
    queuedAt: pendingQueue[record.id] ?? record.queuedAt,
  };
}
