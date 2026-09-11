import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { RecordHistory } from "@/services/activity/record-history";

import { TaskHistory } from "./task-history";

afterEach(cleanup);

const TZ = "America/La_Paz";
const HREF = "/activity?type=tasks&q=t1";

function historial(
  items: RecordHistory["items"] = [],
): RecordHistory {
  return { items, activityHref: HREF };
}

function entrada(
  overrides: Partial<RecordHistory["items"][number]> = {},
): RecordHistory["items"][number] {
  return {
    id: 1,
    action: "updated",
    sentence: "Julio Terán editó la tarea",
    occurredAt: "2026-09-07T14:00:00Z",
    detail: { kind: "rows", rows: [] },
    ...overrides,
  };
}

/**
 * KAM-16 · El bloque de historial de la tarea, ya sobre el componente
 * compartido de KAM-22.
 *
 * Escenarios de `activity-screen` § El historial de un registro coincide con
 * la bitácora filtrada por ese registro → «El ayudante ve el bloque vacío, no
 * un error»; y § Toda pantalla de detalle con historial lo lee de la bitácora
 * y lleva a ella → «Del historial a la bitácora filtrada».
 */
describe("bloque de historial", () => {
  it("muestra cada cambio con su frase y su autor", () => {
    render(
      <TaskHistory
        history={historial([
          entrada({ id: 2 }),
          entrada({
            id: 1,
            action: "created",
            sentence: "Julio Terán registró la tarea",
          }),
        ])}
        timezone={TZ}
      />,
    );

    const filas = screen.getAllByTestId("history-entry");
    expect(filas).toHaveLength(2);
    expect(filas[0]).toHaveTextContent("editó la tarea");
    expect(filas[0]).toHaveTextContent("Julio Terán");
    expect(filas[1]).toHaveTextContent("registró la tarea");
  });

  // Scenario: El ayudante ve el bloque vacío, no un error
  it("el ayudante ve el bloque vacío, no un error", () => {
    // RLS reserva `activity_log` al dueño: al ayudante le llegan cero filas.
    render(<TaskHistory history={historial()} timezone={TZ} />);

    expect(screen.getByTestId("empty-history")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByTestId("history-entry")).toBeNull();
  });

  // Scenario: Del historial a la bitácora filtrada
  //
  // Hasta KAM-22 esta prueba exigía lo contrario: que la salida se nombrara
  // **sin** enlazar, porque la pantalla no existía. Ya existe.
  it("lleva a la bitácora filtrada por esta tarea", () => {
    render(<TaskHistory history={historial([entrada()])} timezone={TZ} />);

    const enlace = screen.getByTestId("activity-link");
    expect(enlace).toHaveAttribute("href", HREF);
    expect(screen.queryByTestId("activity-link-pending")).toBeNull();
  });

  it("un detalle liberado por la retención se declara, no se rinde vacío", () => {
    render(
      <TaskHistory
        history={historial([entrada({ detail: { kind: "purged" } })])}
        timezone={TZ}
      />,
    );

    screen.getByRole("button", { name: "Ver cambio" }).click();
  });
});
