import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BusinessLine, Status, Task } from "@/types";

import { TaskDetail } from "./task-detail";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }),
}));

const updateTaskBody = vi.fn<(input: unknown) => Promise<undefined>>(
  async () => undefined,
);
const toggleTaskChecklistItem = vi.fn<(input: unknown) => Promise<undefined>>(
  async () => undefined,
);
vi.mock("@/actions/tasks", () => ({
  detachFromTask: vi.fn(async () => undefined),
  toggleTaskChecklistItem: (input: unknown) => toggleTaskChecklistItem(input),
  updateTaskBody: (input: unknown) => updateTaskBody(input),
  updateTaskField: vi.fn(async () => undefined),
}));

/**
 * Los hijos pesados se sustituyen por testigos: lo que esta prueba verifica es
 * la **composición** —que KAM-29 no se llevó del detalle lo que se hace
 * mientras se trabaja—, no su comportamiento interno, que ya cubren
 * `markdown-editor.test.tsx`, `checklist-preview.test.tsx`,
 * `attachment-panel.test.tsx` y los de vínculos y entregables.
 */
vi.mock("@/features/tasks/editor/markdown-editor", () => ({
  MarkdownEditor: ({
    onSave,
    onToggleChecklistItem,
  }: {
    onSave: (body: string) => unknown;
    onToggleChecklistItem: (index: number, checked: boolean) => unknown;
  }) => (
    <div data-testid="markdown-editor">
      <button onClick={() => onSave("cuerpo nuevo")}>guardar cuerpo</button>
      <button onClick={() => onToggleChecklistItem(2, true)}>marcar casilla</button>
    </div>
  ),
}));

vi.mock("@/features/tasks/attachments/attachment-panel", () => ({
  AttachmentPanel: () => <div data-testid="attachment-panel" />,
}));

vi.mock("@/features/tasks/links/task-links", () => ({
  TaskLinks: () => <div data-testid="task-links" />,
}));

vi.mock("@/features/tasks/deliverables/deliverables-section", () => ({
  DeliverablesSection: () => <div data-testid="deliverables-section" />,
}));

vi.mock("@/features/tasks/deliverables/closing-dialog", () => ({
  ClosingDialog: () => <div data-testid="closing-dialog" />,
}));

vi.mock("./task-history", () => ({
  TaskHistory: () => <div data-testid="task-history" />,
}));

const TASK = "22222222-2222-4222-8222-222222222222";
const LINE = "33333333-3333-4333-8333-333333333333";
const STATUS = "44444444-4444-4444-8444-444444444444";

const statuses = [
  { id: STATUS, name: "Haciendo", kind: "in_progress", color: "blue" },
] as unknown as Status[];

const lines = [
  { id: LINE, name: "Alfarería", color: "amber" },
] as unknown as BusinessLine[];

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: TASK,
    organizationId: "11111111-1111-4111-8111-111111111111",
    businessLineId: LINE,
    statusId: STATUS,
    title: "Set de 6 tazas artesanales",
    bodyMarkdown: "- [ ] Tornear\n- [ ] Hornear",
    assigneeId: null,
    dueAt: null,
    remindAt: null,
    closedAt: null,
    closedWithoutDeliverables: false,
    createdBy: null,
    createdAt: "2026-09-07T10:00:00Z",
    archivedAt: null,
    tags: [],
    ...overrides,
  };
}

function renderDetail(from: string | null = null, overrides: Partial<Task> = {}) {
  render(
    <TaskDetail
      task={task(overrides)}
      statuses={statuses}
      businessLines={lines}
      assignees={[]}
      attachments={[]}
      links={[]}
      deliverables={[]}
      isOwner
      suppliers={[]}
      expenseCategories={[]}
      supplies={[]}
      closingStatusId={null}
      history={{ entries: [], visible: true } as never}
      timezone="America/La_Paz"
      from={from}
    />,
  );
}

beforeEach(() => {
  push.mockClear();
  updateTaskBody.mockClear();
  toggleTaskChecklistItem.mockClear();
});
afterEach(cleanup);

/**
 * KAM-29 · Escenarios del delta spec `task-detail`, requisito «El detalle
 * presenta los datos de la tarea y los cambia en una pantalla aparte»: lo que
 * se hace mientras se trabaja **no** se mudó al formulario.
 */
describe("lo que se queda en el detalle", () => {
  it("el cuerpo se escribe aquí (El cuerpo se escribe en el detalle)", () => {
    renderDetail();

    expect(screen.getByTestId("markdown-editor")).toBeInTheDocument();

    screen.getByText("guardar cuerpo").click();

    expect(updateTaskBody).toHaveBeenCalledWith({
      taskId: TASK,
      body: "cuerpo nuevo",
    });
  });

  it("marcar una casilla no exige editar (Marcar una casilla no exige editar)", () => {
    renderDetail();

    screen.getByText("marcar casilla").click();

    expect(toggleTaskChecklistItem).toHaveBeenCalledWith({
      taskId: TASK,
      index: 2,
      checked: true,
    });
    // Y nadie navegó a la pantalla de edición para conseguirlo.
    expect(push).not.toHaveBeenCalled();
  });

  it("adjuntos, vínculos y entregables siguen aquí (Adjuntos, vínculos y entregables siguen en el detalle)", () => {
    renderDetail();

    expect(screen.getByTestId("attachment-panel")).toBeInTheDocument();
    expect(screen.getByTestId("task-links")).toBeInTheDocument();
    expect(screen.getByTestId("deliverables-section")).toBeInTheDocument();
    expect(screen.getByTestId("task-history")).toBeInTheDocument();
  });

  it("la primera miga nombra el tablero y conserva sus filtros", () => {
    renderDetail("view=calendar&q=tazas");

    expect(screen.getByRole("link", { name: "Tareas" })).toHaveAttribute(
      "href",
      "/tasks?view=calendar&q=tazas",
    );
  });

  it("desde Mis pendientes la primera miga es Mis pendientes (Desde Mis pendientes se vuelve a Mis pendientes)", () => {
    renderDetail("my-tasks");

    expect(screen.getByRole("link", { name: "Mis pendientes" })).toHaveAttribute(
      "href",
      "/my-tasks",
    );
  });
});
