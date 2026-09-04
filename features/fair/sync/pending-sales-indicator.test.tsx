import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DIRECT_SALE_CREATE, ORDER_CREATE } from "@/features/sync/operations";
import { OUTBOX_SCHEMA_VERSION, type OutboxEntry } from "@/lib/offline";
import { useSyncStore } from "@/stores/sync-store";

import { PendingSalesIndicator } from "./pending-sales-indicator";

vi.mock("@/lib/offline", async () => {
  const actual = await vi.importActual<typeof import("@/lib/offline")>("@/lib/offline");
  return { ...actual, retryEntry: vi.fn(), discardEntry: vi.fn() };
});

const SESSION = { organizationId: "org-a", userId: "user-a" };

function entry(seq: number, overrides: Partial<OutboxEntry> = {}): OutboxEntry {
  return {
    seq,
    recordId: `r${seq}`,
    operation: DIRECT_SALE_CREATE,
    payload: { items: [{ quantity: 1, unitPrice: 35 }] },
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

function seed(entries: OutboxEntry[]) {
  useSyncStore.getState().setSession(SESSION);
  useSyncStore.getState().setEntries(entries);
}

afterEach(cleanup);

beforeEach(() => {
  useSyncStore.setState({
    items: [],
    counts: { pending: 0, held: 0, failed: 0, total: 0 },
    session: null,
  });
});

describe("PendingSalesIndicator", () => {
  // Escenario: Sube al vender sin conexión
  it("cuenta las ventas encoladas", () => {
    seed([entry(1), entry(2), entry(3)]);
    render(<PendingSalesIndicator />);

    expect(screen.getByTestId("fair-pending-count")).toHaveTextContent("3");
  });

  // Escenario: Llega a cero al sincronizar · Sin pendientes
  it("desaparece cuando no queda ninguna venta pendiente", () => {
    seed([]);
    render(<PendingSalesIndicator />);

    expect(screen.queryByTestId("fair-pending-sales")).not.toBeInTheDocument();
  });

  // Escenario: Solo cuenta ventas
  it("no cuenta los pedidos encolados desde otra pantalla", () => {
    seed([
      entry(1),
      entry(2),
      entry(3, { operation: ORDER_CREATE, payload: { items: [] } }),
    ]);
    render(<PendingSalesIndicator />);

    expect(screen.getByTestId("fair-pending-count")).toHaveTextContent("2");
  });

  it("con solo pedidos pendientes no aparece: no es asunto del puesto", () => {
    seed([entry(1, { operation: ORDER_CREATE, payload: { items: [] } })]);
    render(<PendingSalesIndicator />);

    expect(screen.queryByTestId("fair-pending-sales")).not.toBeInTheDocument();
  });

  // Escenario: Fallo permanente visible
  it("distingue lo que falló de lo que simplemente espera", () => {
    seed([entry(1), entry(2, { state: "failed", lastError: "Rechazado" })]);
    render(<PendingSalesIndicator />);

    expect(screen.getByTestId("fair-pending-sales").className).toContain("text-destructive");
  });

  it("sin fallos no reclama atención", () => {
    seed([entry(1)]);
    render(<PendingSalesIndicator />);

    expect(screen.getByTestId("fair-pending-sales").className).not.toContain("text-destructive");
  });

  // Escenario: Reintentar y descartar desde la feria
  it("abre la bandeja con las ventas, sin salir del modo feria", async () => {
    seed([entry(1, { state: "failed", lastError: "Rechazado" })]);
    render(<PendingSalesIndicator />);

    await userEvent.click(screen.getByTestId("fair-pending-sales"));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("anuncia cuántas ventas faltan de forma accesible", () => {
    seed([entry(1), entry(2)]);
    render(<PendingSalesIndicator />);

    expect(
      screen.getByRole("button", { name: "2 ventas por sincronizar" }),
    ).toBeInTheDocument();
  });
});
