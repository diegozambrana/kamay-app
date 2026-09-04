import { beforeEach, describe, expect, it } from "vitest";

import { OUTBOX_SCHEMA_VERSION, type OutboxEntry } from "@/lib/offline";

import { countItems, resolveItems, useSyncStore } from "./sync-store";

/**
 * Escenarios de `offline-capture` — "Un indicador persistente muestra cuántos
 * registros faltan sincronizar": «La cuenta refleja lo pendiente», «El
 * indicador desaparece al vaciarse la cola», «Lo que falló se distingue de lo
 * que espera»; y "La cola pertenece a una organización y a una sesión" →
 * «Cambiar de organización no reencamina lo pendiente».
 */

const SESSION = { organizationId: "org-a", userId: "user-a" };

function entry(seq: number, overrides: Partial<OutboxEntry> = {}): OutboxEntry {
  return {
    seq,
    recordId: `r${seq}`,
    operation: "order.create",
    payload: {},
    organizationId: "org-a",
    userId: "user-a",
    dependsOn: [],
    state: "pending",
    attempts: 0,
    nextAttemptAt: 0,
    lastError: null,
    enqueuedAt: "2026-09-03T15:40:00.000Z",
    schemaVersion: OUTBOX_SCHEMA_VERSION,
    ...overrides,
  };
}

beforeEach(() => {
  useSyncStore.setState({ items: [], counts: { pending: 0, held: 0, failed: 0, total: 0 }, session: null });
});

describe("la cuenta refleja la tabla", () => {
  it("cuenta lo pendiente", () => {
    useSyncStore.getState().setSession(SESSION);
    useSyncStore.getState().setEntries([entry(1), entry(2), entry(3)]);

    expect(useSyncStore.getState().counts).toEqual({
      pending: 3,
      held: 0,
      failed: 0,
      total: 3,
    });
  });

  // Escenario: «El indicador desaparece al vaciarse la cola».
  it("llega a cero cuando la cola se vacía", () => {
    useSyncStore.getState().setSession(SESSION);
    useSyncStore.getState().setEntries([entry(1)]);
    useSyncStore.getState().setEntries([]);

    expect(useSyncStore.getState().counts.total).toBe(0);
  });

  // Escenario: «Lo que falló se distingue de lo que espera».
  it("separa lo fallido de lo pendiente y de lo retenido", () => {
    useSyncStore.getState().setSession(SESSION);
    useSyncStore.getState().setEntries([
      entry(1),
      entry(2, { state: "failed", lastError: "Elige o crea un cliente" }),
      entry(3, { organizationId: "org-b" }),
    ]);

    expect(useSyncStore.getState().counts).toEqual({
      pending: 1,
      held: 1,
      failed: 1,
      total: 3,
    });
  });
});

describe("cambiar de organización recalcula la retención sin tocar la base", () => {
  it("mueve una entrada de pendiente a retenida", () => {
    useSyncStore.getState().setSession(SESSION);
    useSyncStore.getState().setEntries([entry(1)]);
    expect(useSyncStore.getState().counts.pending).toBe(1);

    useSyncStore.getState().setSession({ organizationId: "org-b", userId: "user-a" });

    expect(useSyncStore.getState().counts).toMatchObject({ pending: 0, held: 1 });
    expect(useSyncStore.getState().items[0].hold).toBe("organization");
  });

  it("sin sesión, nada puede salir", () => {
    useSyncStore.getState().setEntries([entry(1)]);

    expect(useSyncStore.getState().counts).toMatchObject({ pending: 0, held: 1 });
  });
});

describe("resolveItems", () => {
  it("retiene al dependiente de una entrada fallida", () => {
    const items = resolveItems(
      [entry(1, { recordId: "padre", state: "failed" }), entry(2, { dependsOn: ["padre"] })],
      SESSION,
    );

    expect(items[1].hold).toBe("dependency");
  });

  it("no marca retención sobre la propia entrada fallida", () => {
    const items = resolveItems([entry(1, { state: "failed", organizationId: "org-b" })], SESSION);

    expect(items[0].hold).toBeNull();
    expect(countItems(items)).toMatchObject({ failed: 1, held: 0 });
  });
});
