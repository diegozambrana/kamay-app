import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { clearOperations, registerOperation } from "@/lib/offline";
import type { RecentCapture } from "@/lib/quick-capture/recent";
import { useSyncStore } from "@/stores/sync-store";
import type { SyncItem } from "@/stores/sync-store";

import { RecentToday } from "./recent-today";

const TODAY = "2026-09-06";
const TZ = "America/La_Paz";
const LINEAS = { l1: "Sublimación" };

function sincronizado(over: Partial<RecentCapture> = {}): RecentCapture {
  return {
    kind: "order",
    id: "a0000000-0000-4000-8000-000000000001",
    label: "Pedido #12",
    lineId: "l1",
    occurredAt: "2026-09-06T20:10:00.000Z",
    href: "/orders/a0000000-0000-4000-8000-000000000001",
    pending: false,
    ...over,
  };
}

function encolar(over: Partial<SyncItem["entry"]> = {}) {
  const item: SyncItem = {
    entry: {
      seq: 1,
      recordId: "b0000000-0000-4000-8000-000000000001",
      operation: "order.create",
      payload: { businessLineId: "l1" },
      organizationId: "o1",
      userId: "u1",
      dependsOn: [],
      state: "pending",
      attempts: 0,
      nextAttemptAt: 0,
      lastError: null,
      // 20:24 en La Paz: en UTC ya es el día siguiente.
      enqueuedAt: "2026-09-07T00:24:00.000Z",
      schemaVersion: 1,
      ...over,
    },
    hold: null,
  };
  useSyncStore.setState({
    items: [item],
    counts: { pending: 1, held: 0, failed: 0, total: 1 },
  });
}

function rendir(synced: RecentCapture[] = []) {
  return render(
    <RecentToday synced={synced} today={TODAY} timezone={TZ} lineNames={LINEAS} />,
  );
}

beforeEach(() => {
  useSyncStore.setState({
    items: [],
    counts: { pending: 0, held: 0, failed: 0, total: 0 },
  });
  clearOperations();
  registerOperation("order.create", {
    send: async () => ({ status: "ok" }),
    describe: () => "Pedido nuevo · 1 línea",
  });
});

afterEach(cleanup);

describe("RecentToday", () => {
  it("sin nada registrado hoy lo dice, en vez de una lista vacía", () => {
    rendir();

    expect(screen.getByTestId("recent-today-empty")).toBeInTheDocument();
  });

  it("muestra lo sincronizado con su tipo, su línea y su enlace", () => {
    rendir([sincronizado()]);

    const fila = screen.getByTestId("recent-today").querySelector("li")!;
    expect(fila).toHaveTextContent("Pedido #12");
    expect(fila).toHaveTextContent("Sublimación");
    expect(fila.querySelector("a")).toHaveAttribute(
      "href",
      "/orders/a0000000-0000-4000-8000-000000000001",
    );
    expect(screen.queryByTestId("recent-pending")).toBeNull();
  });

  it("una captura sin enviar aparece marcada y sin enlace", () => {
    // Lo que la pantalla promete: confirmar que la captura ocurrió, haya red
    // o no. Sin esto, tomar un pedido sin señal deja la lista vacía.
    encolar();
    rendir();

    expect(screen.getByTestId("recent-pending")).toHaveTextContent("Sin enviar");
    const inerte = screen.getByTestId("recent-row-inert");
    expect(inerte.querySelector("a")).toBeNull();
    expect(screen.queryByTestId("recent-today-empty")).toBeNull();
  });

  it("toma el rótulo de la cola, el mismo que enseña la bandeja", () => {
    encolar();
    rendir();

    expect(screen.getByTestId("recent-row-inert")).toHaveTextContent(
      "Pedido nuevo · 1 línea",
    );
  });

  it("lo pendiente y lo enviado conviven ordenados por hora", () => {
    encolar({ enqueuedAt: "2026-09-06T19:40:00.000Z" });
    rendir([sincronizado({ occurredAt: "2026-09-06T20:10:00.000Z" })]);

    const filas = [...screen.getByTestId("recent-today").querySelectorAll("li")];
    expect(filas).toHaveLength(2);
    expect(filas[0]).toHaveTextContent("Pedido #12");
    expect(filas[1]).toHaveTextContent("Sin enviar");
  });

  it("al sincronizarse la misma captura no se duplica", () => {
    const id = "c0000000-0000-4000-8000-000000000001";
    encolar({ recordId: id, enqueuedAt: "2026-09-06T20:10:00.000Z" });
    rendir([sincronizado({ id })]);

    expect(screen.getByTestId("recent-today").querySelectorAll("li")).toHaveLength(1);
    expect(screen.queryByTestId("recent-pending")).toBeNull();
  });

  it("una captura de otro día no entra, aunque siga en la cola", () => {
    encolar({ enqueuedAt: "2026-09-05T18:00:00.000Z" });
    rendir();

    expect(screen.getByTestId("recent-today-empty")).toBeInTheDocument();
  });
});
