import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { QuickAdd } from "./quick-add";

const created = vi.fn(async (input: unknown) => ({ taskId: "nueva", input }));
vi.mock("@/actions/tasks", () => ({
  createTask: (input: unknown) => created(input),
}));

const SUBLI = "22222222-2222-4222-8222-222222222222";

beforeEach(() => created.mockClear());
afterEach(cleanup);

/**
 * KAM-15 · Escenarios del delta spec `tasks` — requisito "Alta rápida de tarea
 * en tres interacciones o menos": «Crear una tarea con la línea activa», «La
 * tarea aparece en el acto», «Título vacío».
 *
 * La medición de las tres interacciones se registra en el e2e; aquí se fija
 * que el compositor no pide ningún dato más.
 */
describe("QuickAdd", () => {
  it("crea la tarea en tres interacciones: abrir, escribir, confirmar", () => {
    render(<QuickAdd businessLineId={SUBLI} onError={vi.fn()} />);

    // 1 · abrir
    fireEvent.click(screen.getByTestId("quick-add-task"));
    // 2 · escribir
    fireEvent.change(screen.getByTestId("quick-add-title"), {
      target: { value: "Revisar filamento" },
    });
    // 3 · confirmar
    fireEvent.submit(screen.getByTestId("quick-add-title").closest("form")!);

    expect(created).toHaveBeenCalledWith({
      title: "Revisar filamento",
      businessLineId: SUBLI,
    });
  });

  it("no pide ningún dato más que el título", () => {
    render(<QuickAdd businessLineId={SUBLI} onError={vi.fn()} />);
    fireEvent.click(screen.getByTestId("quick-add-task"));

    // Primero, que el compositor esté abierto: si no, las tres comprobaciones
    // de abajo pasarían por la razón equivocada.
    expect(screen.getByTestId("quick-add-title")).toBeInTheDocument();

    // Ni responsable, ni fecha, ni línea: eso es lo que lo mantiene en tres.
    expect(screen.queryByLabelText("Responsable")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Fecha límite")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Línea de negocio")).not.toBeInTheDocument();
  });

  it("un título en blanco no crea nada y avisa", () => {
    const onError = vi.fn();
    render(<QuickAdd businessLineId={SUBLI} onError={onError} />);

    fireEvent.click(screen.getByTestId("quick-add-task"));
    fireEvent.change(screen.getByTestId("quick-add-title"), {
      target: { value: "   " },
    });
    fireEvent.submit(screen.getByTestId("quick-add-title").closest("form")!);

    expect(created).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith("Escribe un título para la tarea");
  });

  it("el título se recorta antes de viajar", () => {
    render(<QuickAdd businessLineId={SUBLI} onError={vi.fn()} />);

    fireEvent.click(screen.getByTestId("quick-add-task"));
    fireEvent.change(screen.getByTestId("quick-add-title"), {
      target: { value: "  Revisar filamento  " },
    });
    fireEvent.submit(screen.getByTestId("quick-add-title").closest("form")!);

    expect(created).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Revisar filamento" }),
    );
  });

  it("sin línea que resolver, manda al formulario en vez de fingir el alta", () => {
    render(<QuickAdd businessLineId={null} onError={vi.fn()} />);

    const link = screen.getByTestId("quick-add-task");
    expect(link).toHaveAttribute("href", "/tasks/new");
  });
});
