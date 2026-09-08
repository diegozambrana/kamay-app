import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { ActivityEntry } from "@/types";

import { TaskHistory } from "./task-history";

afterEach(cleanup);

const TZ = "America/La_Paz";

function entrada(overrides: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    id: 1,
    action: "updated",
    actorId: "55555555-5555-4555-8555-555555555555",
    actorLabel: "Julio Terán",
    changes: null,
    occurredAt: "2026-09-07T14:00:00Z",
    ...overrides,
  };
}

describe("bloque de historial", () => {
  it("muestra cada cambio con su autor", () => {
    render(
      <TaskHistory
        history={[entrada({ id: 2 }), entrada({ id: 1, action: "created" })]}
        timezone={TZ}
      />,
    );

    const filas = screen.getAllByTestId("history-entry");
    expect(filas).toHaveLength(2);
    expect(filas[0]).toHaveTextContent("Editada");
    expect(filas[0]).toHaveTextContent("Julio Terán");
    expect(filas[1]).toHaveTextContent("Registrada");
  });

  it("el ayudante ve el bloque vacío, no un error", () => {
    // RLS reserva `activity_log` al dueño: al ayudante le llegan cero filas.
    // El bloque tiene que decirlo con su mensaje de lista sin contenido.
    render(<TaskHistory history={[]} timezone={TZ} />);

    expect(screen.getByTestId("empty-history")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByTestId("history-entry")).toBeNull();
  });

  it("declara la salida a la bitácora sin ofrecer un enlace roto", () => {
    render(<TaskHistory history={[entrada()]} timezone={TZ} />);

    const pendiente = screen.getByTestId("activity-link-pending");
    expect(pendiente).toBeInTheDocument();
    // Todavía no existe la pantalla: se nombra, no se enlaza.
    expect(pendiente.querySelector("a")).toBeNull();
  });
});
