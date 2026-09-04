import { create } from "zustand";

import { holdReason } from "@/lib/offline";
import { failedRecordIdsOf } from "@/lib/offline";
import type { HoldReason, OutboxEntry, SessionIdentity } from "@/lib/offline";

/**
 * Lo que el indicador y la bandeja muestran (KAM-11, design.md decisión 11).
 *
 * La única fuente es la tabla: el store refleja lo que hay en Dexie, no lleva
 * un contador propio que incrementar y decrementar. Un contador se desincroniza
 * a la primera pestaña duplicada o al primer recargado a mitad de vaciado, y
 * entonces el indicador —cuya única función es que la persona confíe en que
 * nada se perdió— pasa a decir justo lo contrario.
 */

/** Una entrada, ya resuelta su retención para poder presentarla. */
export type SyncItem = {
  entry: OutboxEntry;
  hold: HoldReason | null;
};

export type SyncCounts = {
  /** Lo que saldrá solo en cuanto haya red. */
  pending: number;
  /** Lo que no puede salir ahora: otra organización, otra persona, dependencia. */
  held: number;
  /** Lo que fue rechazado y espera una decisión de la persona. */
  failed: number;
  /** Lo que falta sincronizar, que es lo que el indicador enseña. */
  total: number;
};

export function resolveItems(
  entries: readonly OutboxEntry[],
  session: SessionIdentity | null,
): SyncItem[] {
  const failedRecordIds = failedRecordIdsOf(entries);

  return entries.map((entry) => ({
    entry,
    hold: entry.state === "failed" ? null : holdReason(entry, session, failedRecordIds),
  }));
}

export function countItems(items: readonly SyncItem[]): SyncCounts {
  const failed = items.filter((item) => item.entry.state === "failed").length;
  const held = items.filter((item) => item.entry.state !== "failed" && item.hold !== null).length;

  return {
    failed,
    held,
    pending: items.length - failed - held,
    total: items.length,
  };
}

type SyncState = {
  items: SyncItem[];
  counts: SyncCounts;
  session: SessionIdentity | null;
  setEntries: (entries: readonly OutboxEntry[]) => void;
  setSession: (session: SessionIdentity | null) => void;
};

const EMPTY: SyncCounts = { pending: 0, held: 0, failed: 0, total: 0 };

export const useSyncStore = create<SyncState>()((set, get) => ({
  items: [],
  counts: EMPTY,
  session: null,
  setEntries: (entries) => {
    const items = resolveItems(entries, get().session);
    set({ items, counts: countItems(items) });
  },
  setSession: (session) => {
    // La retención se recalcula: cambiar de organización tiene que mover
    // entradas entre "pendiente" y "retenida" sin tocar la base.
    const items = resolveItems(
      get().items.map((item) => item.entry),
      session,
    );
    set({ session, items, counts: countItems(items) });
  },
}));
