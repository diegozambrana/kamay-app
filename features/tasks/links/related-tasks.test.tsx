import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { RelatedTask } from "@/services/tasks/task-service";

import { RelatedTasks } from "./related-tasks";

afterEach(cleanup);

const TZ = "America/La_Paz";

function tarea(overrides: Partial<RelatedTask> = {}): RelatedTask {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Diseñar arte del pedido",
    statusName: "En curso",
    dueAt: "2026-09-20T00:00:00Z",
    closedAt: null,
    ...overrides,
  };
}

/**
 * KAM-21 · El bloque *Tareas relacionadas*.
 *
 * Escenarios del delta spec `task-links-deliverables`, requisito "Los
 * registros vinculados muestran sus tareas relacionadas": «El pedido muestra
 * sus tareas», «Desde la tarea relacionada se llega a la tarea», «Sin tareas
 * relacionadas el bloque queda vacío».
 */
describe("bloque de tareas relacionadas", () => {
  // «El pedido muestra sus tareas»
  it("lista cada tarea con su estado actual", () => {
    render(
      <RelatedTasks
        timezone={TZ}
        tasks={[
          tarea(),
          tarea({
            id: "22222222-2222-4222-8222-222222222222",
            title: "Revisar filamento",
            statusName: "En revisión",
          }),
        ]}
      />,
    );

    expect(screen.getByText("Diseñar arte del pedido")).toBeInTheDocument();
    expect(screen.getByText("Revisar filamento")).toBeInTheDocument();
    expect(screen.getByText("En curso")).toBeInTheDocument();
    expect(screen.getByText("En revisión")).toBeInTheDocument();
  });

  // «Desde la tarea relacionada se llega a la tarea»
  it("cada tarea lleva a su detalle", () => {
    render(<RelatedTasks timezone={TZ} tasks={[tarea()]} />);

    expect(
      screen.getByRole("link", { name: /Diseñar arte del pedido/ }),
    ).toHaveAttribute("href", "/tasks/11111111-1111-4111-8111-111111111111");
  });

  // «Sin tareas relacionadas el bloque queda vacío»
  it("sin tareas se rinde con su mensaje, no con un error", () => {
    render(<RelatedTasks timezone={TZ} tasks={[]} />);

    expect(screen.getByTestId("empty-related-tasks")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("una tarea sin fecha límite no inventa ninguna", () => {
    render(<RelatedTasks timezone={TZ} tasks={[tarea({ dueAt: null })]} />);

    expect(screen.queryByText(/Para el/)).not.toBeInTheDocument();
  });
});
