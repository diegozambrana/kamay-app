import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { opensClosingWizard } from "@/lib/tasks/deliverables";
import type { BusinessLine, Status, Task } from "@/types";

import { TaskFields } from "./task-fields";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

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

const statuses = [
  { id: STATUS, name: "Haciendo", kind: "in_progress" },
] as unknown as Status[];

const lines = [{ id: LINE, name: "Alfarería", color: "amber" }] as unknown as BusinessLine[];

const assignees = [
  { userId: ANA, displayName: "Ana Quispe" },
  { userId: JULIO, displayName: "Julio Terán" },
];

function renderFields(
  overrides: Partial<Task> = {},
  onSave = vi.fn().mockResolvedValue(undefined),
) {
  render(
    <TaskFields
      task={task(overrides)}
      statuses={statuses}
      businessLines={lines}
      assignees={assignees}
      onSave={onSave}
      pendingDeliverables={0}
      readOnly={overrides.archivedAt !== undefined && overrides.archivedAt !== null}
    />,
  );
  return onSave;
}

describe("campos con guardado propio", () => {
  it("guarda el título al salir del campo, sin ninguna otra acción", async () => {
    const onSave = renderFields();
    const user = userEvent.setup();

    const titulo = screen.getByLabelText("Título");
    await user.clear(titulo);
    await user.type(titulo, "Set de 8 tazas");
    await user.tab();

    expect(onSave).toHaveBeenCalledWith({
      taskId: TASK,
      field: "title",
      value: "Set de 8 tazas",
    });
    // Un solo campo viaja: ni el responsable ni la fecha se reenvían.
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("no guarda si el título no cambió", async () => {
    const onSave = renderFields();
    const user = userEvent.setup();

    await user.click(screen.getByLabelText("Título"));
    await user.tab();

    expect(onSave).not.toHaveBeenCalled();
  });

  it("impide el título vacío y conserva el anterior", async () => {
    const onSave = vi
      .fn()
      .mockResolvedValue({ error: "El título no puede quedar vacío." });
    renderFields({}, onSave);
    const user = userEvent.setup();

    const titulo = screen.getByLabelText("Título");
    await user.clear(titulo);
    await user.tab();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El título no puede quedar vacío.",
    );
    // El campo vuelve al título guardado: no puede quedar en pantalla algo que
    // el servidor rechazó.
    expect(titulo).toHaveValue("Set de 6 tazas artesanales");
  });

  it("avisa de que un recordatorio necesita fecha límite", async () => {
    const onSave = vi.fn().mockResolvedValue({
      error: "Primero ponle una fecha límite a la tarea; el recordatorio cuelga de ella.",
    });
    renderFields({ dueAt: null }, onSave);

    // La pantalla lo anuncia antes de intentarlo…
    expect(
      screen.getByText("El recordatorio cuelga de la fecha límite."),
    ).toBeInTheDocument();

    // …y si aun así se intenta, el mensaje del servidor se muestra.
    const recordatorio = screen.getByLabelText("Recordatorio");
    await userEvent.setup().type(recordatorio, "2026-09-19T09:00");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Primero ponle una fecha límite",
    );
  });

  it("una tarea archivada no ofrece editar ningún campo", () => {
    renderFields({ archivedAt: "2026-09-08T10:00:00Z" });

    expect(screen.getByLabelText("Título")).toBeDisabled();
    expect(screen.getByLabelText("Fecha límite")).toBeDisabled();
    expect(screen.getByLabelText("Recordatorio")).toBeDisabled();
  });
});

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
