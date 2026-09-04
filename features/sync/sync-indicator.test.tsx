import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Header } from "@/components/layout/header";
import { SidebarProvider } from "@/components/ui/sidebar";
import { MobileContextBar } from "@/components/layout/mobile-context-bar";
import { OUTBOX_SCHEMA_VERSION, type OutboxEntry } from "@/lib/offline";
import { useSyncStore } from "@/stores/sync-store";

import { SyncIndicator } from "./sync-indicator";

/**
 * Escenarios de `offline-capture` — "Un indicador persistente muestra cuántos
 * registros faltan sincronizar": «La cuenta refleja lo pendiente», «El
 * indicador desaparece al vaciarse la cola», «Lo que falló se distingue de lo
 * que espera», «El indicador abre la bandeja».
 */

vi.mock("@/lib/offline", async () => {
  const actual = await vi.importActual<typeof import("@/lib/offline")>("@/lib/offline");
  return { ...actual, retryEntry: vi.fn(), discardEntry: vi.fn() };
});

vi.mock("@/features/business-lines/line-selector", () => ({
  LineSelector: () => null,
}));

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

describe("SyncIndicator", () => {
  it("muestra cuántos registros faltan sincronizar", () => {
    seed([entry(1), entry(2), entry(3)]);
    render(<SyncIndicator />);

    expect(screen.getByTestId("sync-count")).toHaveTextContent("3");
    expect(screen.getByTestId("sync-indicator")).toHaveAccessibleName(
      "3 registros por sincronizar",
    );
  });

  // Escenario: «El indicador desaparece al vaciarse la cola».
  it("no se muestra con la cola vacía", () => {
    seed([]);
    render(<SyncIndicator />);

    expect(screen.queryByTestId("sync-indicator")).not.toBeInTheDocument();
  });

  // Escenario: «Lo que falló se distingue de lo que espera».
  it("se presenta distinto cuando algo falló", () => {
    seed([entry(1)]);
    const { rerender } = render(<SyncIndicator />);
    const soloPendientes = screen.getByTestId("sync-indicator").className;

    seed([entry(1, { state: "failed", lastError: "Elige o crea un cliente" })]);
    rerender(<SyncIndicator />);

    const conFallo = screen.getByTestId("sync-indicator").className;
    expect(conFallo).not.toBe(soloPendientes);
    expect(conFallo).toContain("destructive");
  });

  // Escenario: «El indicador abre la bandeja».
  it("abre la bandeja al activarlo", async () => {
    seed([entry(1)]);
    render(<SyncIndicator />);

    await userEvent.click(screen.getByTestId("sync-indicator"));

    expect(await screen.findByText("Registros por sincronizar")).toBeVisible();
  });
});

describe("dónde vive el indicador", () => {
  it("aparece en la barra superior de escritorio", () => {
    seed([entry(1)]);
    render(
      <SidebarProvider>
        <Header />
      </SidebarProvider>,
    );

    expect(screen.getByTestId("sync-indicator")).toBeInTheDocument();
  });

  it("aparece en la tira de contexto móvil", () => {
    seed([entry(1)]);
    render(<MobileContextBar />);

    expect(screen.getByTestId("sync-indicator")).toBeInTheDocument();
  });
});
