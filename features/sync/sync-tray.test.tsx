import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  OUTBOX_SCHEMA_VERSION,
  clearOperations,
  registerOperation,
  type OutboxEntry,
} from "@/lib/offline";
import { useOrganizationStore } from "@/stores/organization-store";
import { resolveItems } from "@/stores/sync-store";

import { SyncTray } from "./sync-tray";

/**
 * Escenarios de `offline-capture` — "Un fallo definitivo se muestra, nunca se
 * pierde en silencio": «Descartar pide confirmación», «Reintentar desde la
 * bandeja»; y "Un indicador persistente…": «Lo que falló se distingue de lo
 * que espera».
 */

const SESSION = { organizationId: "org-a", userId: "user-a" };

function entry(seq: number, overrides: Partial<OutboxEntry> = {}): OutboxEntry {
  return {
    seq,
    recordId: `r${seq}`,
    operation: "order.create",
    payload: { contactName: "Ana" },
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

function renderTray(entries: OutboxEntry[], handlers: {
  onRetry?: (seq: number) => void;
  onDiscard?: (seq: number) => void;
} = {}) {
  return render(
    <SyncTray
      open
      onOpenChange={() => undefined}
      items={resolveItems(entries, SESSION)}
      onRetry={handlers.onRetry ?? (() => undefined)}
      onDiscard={handlers.onDiscard ?? (() => undefined)}
    />,
  );
}

beforeEach(() => {
  useOrganizationStore.setState({
    organization: {
      id: "org-a",
      name: "Geeko",
      timezone: "America/La_Paz",
    } as never,
  });
  registerOperation("order.create", {
    send: async () => undefined,
    describe: (payload) => `Pedido para ${(payload as { contactName: string }).contactName}`,
  });
});

afterEach(() => {
  cleanup();
  clearOperations();
});

describe("la bandeja lista lo que falta sincronizar", () => {
  it("describe cada registro en lenguaje humano", () => {
    renderTray([entry(1)]);

    expect(screen.getByText("Pedido para Ana")).toBeVisible();
    expect(screen.getByText("Pendiente de sincronizar")).toBeVisible();
  });

  it("muestra la hora real del registro, no la de la sincronización", () => {
    renderTray([entry(1)]);

    // 15:40 UTC son las 11:40 en La Paz: la zona del taller, como toda hora
    // visible.
    expect(screen.getByText(/03\/09\/2026 11:40/)).toBeVisible();
  });

  it("explica por qué un registro está retenido", () => {
    renderTray([entry(1, { organizationId: "org-b" })]);

    expect(screen.getByText("En espera")).toBeVisible();
    expect(screen.getByText(/otra organización/)).toBeVisible();
  });

  it("muestra el motivo del rechazo con las palabras del servidor", () => {
    renderTray([entry(1, { state: "failed", lastError: "Elige o crea un cliente" })]);

    expect(screen.getByText("No se pudo enviar")).toBeVisible();
    expect(screen.getByText("Elige o crea un cliente")).toBeVisible();
  });

  it("dice que no queda nada cuando la cola está vacía", () => {
    renderTray([]);

    expect(screen.getByText("No queda nada por sincronizar.")).toBeVisible();
  });
});

describe("reintentar y descartar", () => {
  // Escenario: «Reintentar desde la bandeja».
  it("reintentar devuelve la entrada a la cola sin preguntar", async () => {
    const onRetry = vi.fn();
    renderTray([entry(7, { state: "failed", lastError: "Tu sesión terminó." })], { onRetry });

    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(onRetry).toHaveBeenCalledWith(7);
  });

  // Escenario: «Descartar pide confirmación».
  it("descartar pide confirmación antes de quitar nada", async () => {
    const onDiscard = vi.fn();
    renderTray([entry(7, { state: "failed", lastError: "algo" })], { onDiscard });

    await userEvent.click(screen.getByTestId("discard-entry"));

    expect(await screen.findByText("¿Descartar este registro?")).toBeVisible();
    expect(onDiscard).not.toHaveBeenCalled();

    await userEvent.click(screen.getByTestId("confirm-discard"));
    expect(onDiscard).toHaveBeenCalledWith(7);
  });

  it("cancelar la confirmación deja el registro donde estaba", async () => {
    const onDiscard = vi.fn();
    renderTray([entry(7, { state: "failed", lastError: "algo" })], { onDiscard });

    await userEvent.click(screen.getByTestId("discard-entry"));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onDiscard).not.toHaveBeenCalled();
  });

  it("no ofrece descartar lo que solo está pendiente", () => {
    renderTray([entry(1)]);

    expect(screen.queryByTestId("discard-entry")).not.toBeInTheDocument();
  });
});
