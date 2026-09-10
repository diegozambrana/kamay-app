import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Deliverable, TaskContext } from "@/lib/tasks/deliverables";

const closeTaskWithDeliverables =
  vi.fn<(input: unknown) => Promise<{ error: string } | undefined>>();

vi.mock("@/actions/tasks", () => ({
  closeTaskWithDeliverables: (input: unknown) =>
    closeTaskWithDeliverables(input as never),
}));

const { ClosingDialog } = await import("./closing-dialog");

afterEach(cleanup);

const TASK = "11111111-1111-4111-8111-111111111111";
const FINAL = "22222222-2222-4222-8222-222222222222";
const LINE = "33333333-3333-4333-8333-333333333333";

const context: TaskContext = {
  title: "Set de 6 tazas artesanales",
  businessLineId: LINE,
  bodyMarkdown: "Esmalte celadón",
  attachments: [{ id: "a1", fileName: "taza.jpg" }],
};

function deliverable(type: Deliverable["deliverableType"]): Deliverable {
  return {
    id: `d-${type}`,
    taskId: TASK,
    deliverableType: type,
    fulfilledType: null,
    fulfilledId: null,
    fulfilledAt: null,
  };
}

function renderDialog(
  deliverables: Deliverable[],
  handlers: { onCancel?: () => void; onClosed?: () => void } = {},
) {
  return render(
    <ClosingDialog
      open
      taskId={TASK}
      statusId={FINAL}
      task={context}
      deliverables={deliverables}
      suppliers={[{ id: "s1", name: "Distribuidora Andina" }]}
      expenseCategories={[{ id: "c1", name: "Insumos" }]}
      supplies={[{ id: "i1", name: "Arcilla" }]}
      onCancel={handlers.onCancel ?? vi.fn()}
      onClosed={handlers.onClosed ?? vi.fn()}
    />,
  );
}

beforeEach(() => {
  closeTaskWithDeliverables.mockReset();
  closeTaskWithDeliverables.mockResolvedValue(undefined);
});

/**
 * KAM-21 · V19, el asistente de cierre.
 *
 * Escenarios del delta spec `task-links-deliverables`:
 * - "El asistente ofrece un formulario prellenado por entregable" → «Dos
 *   entregables, dos formularios prellenados», «Lo prellenado se puede
 *   cambiar», «Se elige cuál incluir».
 * - "El asistente ofrece tres salidas y ninguna se penaliza" → «Cerrar sin
 *   crear nada no pide nada», «Cancelar devuelve la tarea a su estado
 *   anterior».
 */
describe("asistente de cierre", () => {
  // «Dos entregables, dos formularios prellenados»
  it("ofrece un formulario por entregable, prellenado desde la tarea", () => {
    renderDialog([deliverable("product"), deliverable("expenses")]);

    expect(screen.getByTestId("deliverable-form-product")).toBeInTheDocument();
    expect(screen.getByTestId("deliverable-form-expenses")).toBeInTheDocument();

    // Título, notas y adjuntos de la tarea, en los dos.
    const nombres = screen.getAllByDisplayValue("Set de 6 tazas artesanales");
    expect(nombres).toHaveLength(2);
    expect(screen.getAllByDisplayValue("Esmalte celadón")).toHaveLength(2);
    expect(screen.getAllByText("taza.jpg")).toHaveLength(2);
  });

  // «Lo prellenado se puede cambiar»
  it("lo prellenado se corrige antes de crear", async () => {
    renderDialog([deliverable("product")]);

    const nombre = screen.getByLabelText("Nombre");
    await userEvent.clear(nombre);
    await userEvent.type(nombre, "Taza celadón 11oz");
    await userEvent.click(
      screen.getByRole("button", { name: "Crear seleccionados y cerrar" }),
    );

    expect(closeTaskWithDeliverables).toHaveBeenCalledWith(
      expect.objectContaining({
        deliverables: [
          expect.objectContaining({
            type: "product",
            payload: expect.objectContaining({ name: "Taza celadón 11oz" }),
          }),
        ],
      }),
    );
  });

  // «Se elige cuál incluir»
  it("se crea solo lo marcado", async () => {
    renderDialog([deliverable("product"), deliverable("supplier")]);

    await userEvent.click(screen.getByLabelText("Nuevo proveedor"));
    await userEvent.click(
      screen.getByRole("button", { name: "Crear seleccionados y cerrar" }),
    );

    const enviado = closeTaskWithDeliverables.mock.calls[0]![0] as {
      deliverables: { type: string }[];
    };
    expect(enviado.deliverables.map((d) => d.type)).toEqual(["product"]);
  });

  // «Cerrar sin crear nada no pide nada»
  it("cerrar sin crear nada no crea nada ni pide justificación", async () => {
    renderDialog([deliverable("product")]);

    await userEvent.click(
      screen.getByRole("button", { name: "Cerrar sin crear nada" }),
    );

    expect(closeTaskWithDeliverables).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: TASK, statusId: FINAL, deliverables: [] }),
    );
    // Ni advertencia ni campo de justificación por el camino.
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByLabelText(/motivo|justificaci/i)).toBeNull();
  });

  // «Cancelar devuelve la tarea a su estado anterior»
  it("cancelar no envía nada", async () => {
    const onCancel = vi.fn();
    renderDialog([deliverable("product")], { onCancel });

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(closeTaskWithDeliverables).not.toHaveBeenCalled();
  });

  it("el gasto pide categoría e importe, que la tarea no sabe", () => {
    renderDialog([deliverable("expenses")]);

    expect(screen.getByLabelText("Importe")).toBeInTheDocument();
    expect(screen.getByLabelText("Categoría")).toBeInTheDocument();
  });

  it("la compra pide proveedor y qué se compró", () => {
    renderDialog([deliverable("purchase")]);

    expect(screen.getByLabelText("Proveedor")).toBeInTheDocument();
    expect(screen.getByLabelText("Insumo comprado")).toBeInTheDocument();
    expect(screen.getByLabelText("Cantidad")).toBeInTheDocument();
  });

  it("un fallo se muestra y la tarea no se da por cerrada", async () => {
    closeTaskWithDeliverables.mockResolvedValue({
      error: "No se pudo cerrar la tarea. No se creó nada; intenta de nuevo.",
    });
    const onClosed = vi.fn();
    renderDialog([deliverable("product")], { onClosed });

    await userEvent.click(
      screen.getByRole("button", { name: "Crear seleccionados y cerrar" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("No se creó nada");
    expect(onClosed).not.toHaveBeenCalled();
  });
});
