import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { opensClosingWizard } from "@/lib/tasks/deliverables";
import type { BusinessLine, Status, Task } from "@/types";

import { TaskFields } from "./task-fields";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }),
}));

beforeEach(() => push.mockClear());
afterEach(cleanup);

const TASK = "22222222-2222-4222-8222-222222222222";
const LINE = "33333333-3333-4333-8333-333333333333";
const STATUS = "44444444-4444-4444-8444-444444444444";
const ANA = "55555555-5555-4555-8555-555555555555";
const JULIO = "66666666-6666-4666-8666-666666666666";

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: TASK,
    organizationId: "11111111-1111-4111-8111-111111111111",
    businessLineId: LINE,
    statusId: STATUS,
    title: "Set de 6 tazas artesanales",
    bodyMarkdown: null,
    assigneeId: ANA,
    dueAt: "2026-09-20T00:00:00Z",
    remindAt: null,
    closedAt: null,
    closedWithoutDeliverables: false,
    createdBy: ANA,
    createdAt: "2026-09-07T10:00:00Z",
    archivedAt: null,
    tags: [],
    ...overrides,
  };
}

const ENTREGADO = "77777777-7777-4777-8777-777777777777";

const statuses = [
  { id: STATUS, name: "Haciendo", kind: "in_progress", color: "blue" },
  { id: ENTREGADO, name: "Entregado", kind: "final", color: "green" },
] as unknown as Status[];

const lines = [{ id: LINE, name: "Alfarería", color: "amber" }] as unknown as BusinessLine[];

const assignees = [
  { userId: ANA, displayName: "Ana Quispe" },
  { userId: JULIO, displayName: "Julio Terán" },
];

function renderFields(
  overrides: Partial<Task> = {},
  onSave = vi.fn().mockResolvedValue(undefined),
  extra: { pendingDeliverables?: number; from?: string | null } = {},
) {
  render(
    <TaskFields
      task={task(overrides)}
      statuses={statuses}
      businessLines={lines}
      assignees={assignees}
      onSave={onSave}
      pendingDeliverables={extra.pendingDeliverables ?? 0}
      from={extra.from ?? null}
      timezone="America/La_Paz"
      readOnly={overrides.archivedAt !== undefined && overrides.archivedAt !== null}
    />,
  );
  return onSave;
}

/**
 * KAM-21 · La segunda entrada al asistente de cierre.
 *
 * Escenario del delta spec `task-links-deliverables`, requisito "Entrar en un
 * estado final con entregables pendientes abre el asistente" → «Cambiar el
 * estado desde el detalle abre el asistente».
 *
 * La decisión es la misma función que usa el tablero (`opensClosingWizard`,
 * design D7); aquí se fija que el detalle la consulta con el tipo del estado
 * destino y no con su nombre.
 */
describe("cambiar a un estado final desde el detalle", () => {
  it("con entregables pendientes abre el asistente, y sin ellos no", () => {
    // *Entregado* es `final` en esta organización; *Terminado* es `in_progress`.
    expect(opensClosingWizard("final", 1)).toBe(true);
    expect(opensClosingWizard("final", 0)).toBe(false);
    expect(opensClosingWizard("in_progress", 1)).toBe(false);
  });
});

/**
 * KAM-29 · Escenarios del delta spec `task-detail`, requisito «El detalle
 * presenta los datos de la tarea y los cambia en una pantalla aparte».
 */
describe("la cabecera se lee, no se edita", () => {
  it("rinde los datos como texto y sin controles (La cabecera se lee, no se edita)", () => {
    renderFields({ remindAt: "2026-09-19T13:00:00Z" });

    expect(screen.getByText("Set de 6 tazas artesanales")).toBeInTheDocument();
    expect(screen.getByText("Alfarería")).toBeInTheDocument();
    expect(screen.getByText("Ana Quispe")).toBeInTheDocument();
    expect(screen.getByText("20/09/2026")).toBeInTheDocument();

    // Ni un solo campo de texto: lo que antes era un formulario ahora se lee.
    expect(screen.queryByLabelText("Título")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Línea")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Responsable")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Fecha límite")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Recordatorio")).not.toBeInTheDocument();
  });

  it("muestra las etiquetas (Las etiquetas se ven en el detalle)", () => {
    renderFields({
      tags: [
        { id: "t1", organizationId: "org", name: "Hornada-07" },
        { id: "t2", organizationId: "org", name: "Urgente" },
      ],
    });

    expect(screen.getByText("Hornada-07")).toBeInTheDocument();
    expect(screen.getByText("Urgente")).toBeInTheDocument();
  });

  it("dice lo que falta en vez de dejarlo en blanco (Un dato ausente se dice)", () => {
    renderFields({ assigneeId: null, dueAt: null, remindAt: null, tags: [] });

    expect(screen.getByText("Sin responsable")).toBeInTheDocument();
    expect(screen.getByText("Sin fecha límite")).toBeInTheDocument();
    expect(screen.getByText("Sin recordatorio")).toBeInTheDocument();
    expect(screen.getByText("Sin etiquetas")).toBeInTheDocument();
  });

  it("ofrece Editar hacia la pantalla de edición (Editar lleva al formulario)", () => {
    renderFields();

    expect(screen.getByTestId("edit-task")).toHaveAttribute(
      "href",
      `/tasks/${TASK}/edit`,
    );
  });

  it("Editar conserva la vista de origen", () => {
    renderFields({}, vi.fn().mockResolvedValue(undefined), { from: "view=list" });

    expect(screen.getByTestId("edit-task")).toHaveAttribute(
      "href",
      `/tasks/${TASK}/edit?from=view%3Dlist`,
    );
  });

  it("una tarea archivada no ofrece Editar (Una tarea archivada no se edita)", () => {
    renderFields({ archivedAt: "2026-09-08T10:00:00Z" });

    expect(screen.queryByTestId("edit-task")).not.toBeInTheDocument();
  });

  it("el estado sigue cambiándose aquí mismo (El estado se cambia sin salir del detalle)", async () => {
    const onSave = renderFields();
    const user = userEvent.setup();

    await user.click(screen.getByLabelText("Estado"));
    await user.click(await screen.findByRole("option", { name: "Entregado" }));

    expect(onSave).toHaveBeenCalledWith({
      taskId: TASK,
      field: "statusId",
      value: ENTREGADO,
    });
    expect(push).not.toHaveBeenCalled();
  });

  it("con entregables pendientes abre el asistente (Cerrar con entregables pendientes sigue abriendo el asistente)", async () => {
    const onSave = renderFields({}, vi.fn().mockResolvedValue(undefined), {
      pendingDeliverables: 1,
    });
    const user = userEvent.setup();

    await user.click(screen.getByLabelText("Estado"));
    await user.click(await screen.findByRole("option", { name: "Entregado" }));

    // No guarda en silencio: lleva a la dirección que abre V19.
    expect(onSave).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith(`/tasks/${TASK}?close=${ENTREGADO}`);
  });
});
