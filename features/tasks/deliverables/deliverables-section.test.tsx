import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Deliverable } from "@/lib/tasks/deliverables";

const declareDeliverable =
  vi.fn<(input: unknown) => Promise<{ error: string } | undefined>>();
const withdrawDeliverable =
  vi.fn<(input: unknown) => Promise<{ error: string } | undefined>>();

vi.mock("@/actions/tasks", () => ({
  declareDeliverable: (input: unknown) => declareDeliverable(input as never),
  withdrawDeliverable: (input: unknown) => withdrawDeliverable(input as never),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

const { DeliverablesSection } = await import("./deliverables-section");

afterEach(cleanup);

const TASK = "11111111-1111-4111-8111-111111111111";

function deliverable(
  type: Deliverable["deliverableType"],
  fulfilled = false,
): Deliverable {
  return {
    id: `d-${type}`,
    taskId: TASK,
    deliverableType: type,
    fulfilledType: fulfilled ? "items" : null,
    fulfilledId: fulfilled ? "x" : null,
    fulfilledAt: fulfilled ? "2026-09-10T10:00:00Z" : null,
  };
}

function renderSection(
  deliverables: Deliverable[] = [],
  { isOwner = true, readOnly = false } = {},
) {
  return render(
    <DeliverablesSection
      taskId={TASK}
      deliverables={deliverables}
      isOwner={isOwner}
      readOnly={readOnly}
    />,
  );
}

beforeEach(() => {
  declareDeliverable.mockReset();
  declareDeliverable.mockResolvedValue(undefined);
  withdrawDeliverable.mockReset();
  withdrawDeliverable.mockResolvedValue(undefined);
});

/**
 * KAM-21 · La sección *Entregables esperados*.
 *
 * Escenarios del delta spec `task-links-deliverables`, requisito "Una tarea
 * declara qué debe existir al terminarla": «Declarar dos entregables»,
 * «Retirar un entregable no cumplido», «Una tarea puede no declarar ninguno»,
 * «El ayudante no puede declarar un activo».
 */
describe("sección de entregables", () => {
  // «Una tarea puede no declarar ninguno»
  it("una tarea sin entregables es válida y lo dice sin alarmar", () => {
    renderSection();

    expect(screen.getByTestId("empty-deliverables")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  // «Declarar dos entregables»
  it("declara el tipo elegido", async () => {
    renderSection([deliverable("product")]);

    await userEvent.click(screen.getByLabelText("Entregable esperado"));
    await userEvent.click(screen.getByRole("option", { name: "Gastos registrados" }));
    await userEvent.click(screen.getByRole("button", { name: /Declarar/ }));

    expect(declareDeliverable).toHaveBeenCalledWith({
      taskId: TASK,
      type: "expenses",
    });
  });

  it("no vuelve a ofrecer un tipo ya declarado", async () => {
    renderSection([deliverable("product")]);

    await userEvent.click(screen.getByLabelText("Entregable esperado"));

    expect(
      screen.queryByRole("option", { name: "Nuevo producto" }),
    ).not.toBeInTheDocument();
  });

  // «El ayudante no puede declarar un activo»
  it("al ayudante no le ofrece el activo", async () => {
    renderSection([], { isOwner: false });

    await userEvent.click(screen.getByLabelText("Entregable esperado"));

    expect(screen.queryByRole("option", { name: "Nuevo activo" })).toBeNull();
    expect(screen.getByRole("option", { name: "Nuevo producto" })).toBeInTheDocument();
  });

  it("a la persona dueña sí", async () => {
    renderSection();

    await userEvent.click(screen.getByLabelText("Entregable esperado"));

    expect(screen.getByRole("option", { name: "Nuevo activo" })).toBeInTheDocument();
  });

  // «Retirar un entregable no cumplido»
  it("retira uno que aún no se cumplió", async () => {
    renderSection([deliverable("supply")]);

    await userEvent.click(
      screen.getByRole("button", { name: "Retirar Nuevo insumo" }),
    );

    expect(withdrawDeliverable).toHaveBeenCalledWith({
      taskId: TASK,
      type: "supply",
    });
  });

  it("uno ya cumplido no se puede retirar: lo creado no se deshace aquí", () => {
    renderSection([deliverable("product", true)]);

    expect(screen.getByText("Creado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Retirar/ })).toBeNull();
  });

  it("una tarea archivada no declara ni retira", () => {
    renderSection([deliverable("product")], { readOnly: true });

    expect(screen.getByText("Nuevo producto")).toBeInTheDocument();
    expect(screen.queryByLabelText("Entregable esperado")).toBeNull();
    expect(screen.queryByRole("button", { name: /Retirar/ })).toBeNull();
  });
});
