import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MyTasksScreen } from "./my-tasks-screen";
import type { PendingTask } from "./pending-row";

const completeTask = vi.fn();
const uncompleteTask = vi.fn();
const postponeTask = vi.fn();

vi.mock("@/actions/tasks", () => ({
  completeTask: (...args: unknown[]) => completeTask(...args),
  uncompleteTask: (...args: unknown[]) => uncompleteTask(...args),
  postponeTask: (...args: unknown[]) => postponeTask(...args),
}));

afterEach(cleanup);
beforeEach(() => {
  completeTask.mockReset();
  uncompleteTask.mockReset();
  postponeTask.mockReset();
});

/**
 * KAM-17 · V20 · Mis pendientes.
 *
 * Escenarios del delta spec `my-tasks` — requisitos "Cuatro grupos por fecha,
 * con contador y en orden fijo", "La pantalla de pendientes ignora
 * deliberadamente el selector de línea", "Marcar hecha deja la tarea tachada
 * en su sitio", "Posponer a mañana en un solo gesto", "Reprogramar y abrir el
 * detalle desde la fila" y "Filtrar dentro de los pendientes".
 */

const HOY = "2026-09-08";
const MANANA = "2026-09-09";

function task(overrides: Partial<PendingTask> = {}): PendingTask {
  return {
    id: "t1",
    title: "Set de 6 tazas",
    dueDate: HOY,
    statusId: "s-por-hacer",
    lineName: "Alfarería",
    lineColor: "zinc",
    ...overrides,
  };
}

function renderScreen(tasks: PendingTask[]) {
  return render(
    <MyTasksScreen tasks={tasks} today={HOY} tomorrow={MANANA} />,
  );
}

describe("MyTasksScreen · los cuatro grupos", () => {
  it("rinde los cuatro grupos en orden, con su contador", () => {
    renderScreen([
      task({ id: "v", dueDate: "2026-09-01" }),
      task({ id: "h" }),
      task({ id: "s", dueDate: "2026-09-12" }),
      task({ id: "n", dueDate: null }),
    ]);

    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual([
      "Vencidas1",
      "Hoy1",
      "Próximos 7 días1",
      "Sin fecha1",
    ]);
  });

  it("lo vencido va primero", () => {
    renderScreen([task({ id: "h" }), task({ id: "v", dueDate: "2026-09-01" })]);

    const sections = screen.getAllByRole("heading", { level: 2 });
    expect(sections[0]).toHaveTextContent("Vencidas");
  });

  it("cada tarea cae en su grupo", () => {
    renderScreen([
      task({ id: "v", dueDate: "2026-09-01" }),
      task({ id: "n", dueDate: null }),
    ]);

    expect(
      within(screen.getByTestId("group-overdue")).getByTestId("pending-v"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("group-undated")).getByTestId("pending-n"),
    ).toBeInTheDocument();
  });
});

describe("MyTasksScreen · la línea", () => {
  // Scenario: Cada tarea dice su línea
  it("cada fila indica a qué línea pertenece", () => {
    renderScreen([
      task({ id: "a", lineName: "Alfarería" }),
      task({ id: "b", lineName: "Sublimación", dueDate: null }),
    ]);

    expect(screen.getByTestId("pending-a")).toHaveTextContent("Alfarería");
    expect(screen.getByTestId("pending-b")).toHaveTextContent("Sublimación");
  });

  // Scenario: El selector no filtra aquí
  it("muestra tareas de varias líneas a la vez", () => {
    renderScreen([
      task({ id: "a", lineName: "Alfarería" }),
      task({ id: "b", lineName: "Sublimación" }),
    ]);

    expect(screen.getByTestId("pending-a")).toBeInTheDocument();
    expect(screen.getByTestId("pending-b")).toBeInTheDocument();
  });
});

describe("MyTasksScreen · marcar hecha", () => {
  // Scenario: Tachada, no desaparecida
  it("queda tachada en su sitio y el contador se ajusta", async () => {
    renderScreen([task()]);

    await userEvent.click(
      screen.getByRole("button", { name: /Marcar hecha/ }),
    );

    const row = screen.getByTestId("pending-t1");
    expect(row).toHaveAttribute("data-done", "true");
    expect(within(row).getByRole("link")).toHaveClass("line-through");
    expect(row).toBeInTheDocument();
  });

  it("el cierre pasa por la acción que mueve de estado", async () => {
    // No escribe `closed_at` a mano: `completeTask` resuelve el estado final
    // de la línea y mueve allí, igual que el arrastre del tablero.
    renderScreen([task()]);

    await userEvent.click(screen.getByRole("button", { name: /Marcar hecha/ }));

    expect(completeTask).toHaveBeenCalledWith({ taskId: "t1" });
  });

  // Scenario: Deshacer
  it("deshacer la devuelve al estado en que estaba", async () => {
    renderScreen([task({ statusId: "s-en-curso" })]);

    await userEvent.click(screen.getByRole("button", { name: /Marcar hecha/ }));
    await userEvent.click(screen.getByRole("button", { name: /Deshacer/ }));

    expect(screen.getByTestId("pending-t1")).not.toHaveAttribute("data-done");
    expect(uncompleteTask).toHaveBeenCalledWith({
      taskId: "t1",
      statusId: "s-en-curso",
    });
  });
});

describe("MyTasksScreen · posponer", () => {
  // Scenario: Sin deslizar
  it("ofrece un control de posponer alcanzable sin gestos", async () => {
    renderScreen([task({ dueDate: "2026-09-01" })]);

    const button = screen.getByRole("button", { name: /Posponer/ });
    expect(button).toBeInTheDocument();

    await userEvent.click(button);
    expect(postponeTask).toHaveBeenCalledWith({
      taskId: "t1",
      dueDate: MANANA,
    });
  });

  // Scenario: Mañana es el de la organización
  it("«mañana» es el que llega del servidor, no el del navegador", async () => {
    // La pantalla no calcula la fecha: la recibe ya resuelta en la zona de la
    // organización, y por eso posponer a las 23:50 no salta dos días.
    render(
      <MyTasksScreen
        tasks={[task()]}
        today="2026-12-31"
        tomorrow="2027-01-01"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Posponer/ }));

    expect(postponeTask).toHaveBeenCalledWith({
      taskId: "t1",
      dueDate: "2027-01-01",
    });
  });
});

describe("MyTasksScreen · abrir el detalle", () => {
  // Scenario: Abrir el detalle
  it("la fila lleva al detalle de esa tarea", () => {
    renderScreen([task({ id: "abc-123" })]);

    expect(
      within(screen.getByTestId("pending-abc-123")).getByRole("link"),
    ).toHaveAttribute("href", "/tasks/abc-123");
  });
});

describe("MyTasksScreen · filtros", () => {
  // Scenario: Los contadores siguen al filtro
  it("los grupos siguen presentes y sus contadores cuentan lo filtrado", async () => {
    renderScreen([
      task({ id: "a", title: "Set de 6 tazas", dueDate: "2026-09-01" }),
      task({ id: "b", title: "Sublimar polos", dueDate: "2026-09-01" }),
    ]);

    await userEvent.type(
      screen.getByRole("searchbox", { name: /Buscar/ }),
      "tazas",
    );

    expect(screen.getByTestId("count-overdue")).toHaveTextContent("1");
    expect(screen.getByTestId("pending-a")).toBeInTheDocument();
    expect(screen.queryByTestId("pending-b")).not.toBeInTheDocument();
  });

  // Scenario: Filtro sin resultados
  it("un filtro sin resultados lo declara", async () => {
    renderScreen([task()]);

    await userEvent.type(
      screen.getByRole("searchbox", { name: /Buscar/ }),
      "nada de nada",
    );

    expect(screen.getByTestId("my-tasks-empty")).toHaveTextContent(
      "Ninguna tarea coincide",
    );
  });

  it("sin ninguna tarea lo dice de otra manera", () => {
    renderScreen([]);

    expect(screen.getByTestId("my-tasks-empty")).toHaveTextContent(
      "No tienes tareas pendientes.",
    );
  });
});

describe("MyTasksScreen · reprogramar y deslizar", () => {
  // Scenario: Reprogramar a una fecha
  it("reprogramar a una fecha elegida no abandona la pantalla", () => {
    renderScreen([task({ dueDate: "2026-09-01" })]);

    // `fireEvent.change` y no `type`: un `input[type=date]` emite un cambio
    // por cada carácter, y lo que se prueba aquí es la fecha elegida entera.
    fireEvent.change(screen.getByLabelText(/Reprogramar/), {
      target: { value: "2026-09-11" },
    });

    expect(postponeTask).toHaveBeenLastCalledWith({
      taskId: "t1",
      dueDate: "2026-09-11",
    });
    // Sigue en la misma pantalla, con su buscador.
    expect(screen.getByRole("searchbox", { name: /Buscar/ })).toBeInTheDocument();
  });

  // Scenario: Un solo gesto
  it("deslizar la fila lo bastante a la izquierda la pospone", () => {
    renderScreen([task({ dueDate: "2026-09-01" })]);
    const row = screen.getByTestId("pending-t1");

    fireEvent.touchStart(row, { touches: [{ clientX: 200 }] });
    fireEvent.touchMove(row, { touches: [{ clientX: 100 }] });
    fireEvent.touchEnd(row);

    expect(postponeTask).toHaveBeenCalledWith({
      taskId: "t1",
      dueDate: MANANA,
    });
  });

  it("un roce corto no pospone nada", () => {
    // Recorrer la lista con el pulgar no debe reprogramar tareas por error.
    renderScreen([task({ dueDate: "2026-09-01" })]);
    const row = screen.getByTestId("pending-t1");

    fireEvent.touchStart(row, { touches: [{ clientX: 200 }] });
    fireEvent.touchMove(row, { touches: [{ clientX: 180 }] });
    fireEvent.touchEnd(row);

    expect(postponeTask).not.toHaveBeenCalled();
  });

  it("deslizar hacia la derecha no hace nada", () => {
    renderScreen([task({ dueDate: "2026-09-01" })]);
    const row = screen.getByTestId("pending-t1");

    fireEvent.touchStart(row, { touches: [{ clientX: 100 }] });
    fireEvent.touchMove(row, { touches: [{ clientX: 300 }] });
    fireEvent.touchEnd(row);

    expect(postponeTask).not.toHaveBeenCalled();
  });
});
