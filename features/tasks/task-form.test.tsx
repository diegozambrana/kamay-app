import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BusinessLine, Tag } from "@/types";

import { TaskForm, type TaskFormValues } from "./task-form";

const created = vi.fn(async (input: unknown) => ({ taskId: "nueva", input }));
const updated = vi.fn<(input: unknown) => Promise<{ error: string } | undefined>>(
  async () => undefined,
);
vi.mock("@/actions/tasks", () => ({
  createTask: (input: unknown) => created(input),
  updateTaskFields: (input: unknown) => updated(input),
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, back: vi.fn() }),
}));

const ORG = "11111111-1111-4111-8111-111111111111";
const SUBLI = "22222222-2222-4222-8222-222222222222";
const ALFA = "22222222-2222-4222-8222-222222222223";
const USER = "44444444-4444-4444-8444-444444444444";
const ORDER = "55555555-5555-4555-8555-555555555555";

function line(id: string, name: string): BusinessLine {
  return {
    id,
    organizationId: ORG,
    name,
    color: "blue",
    icon: null,
    isShared: false,
    position: 1,
    archivedAt: null,
  };
}

const lines = [line(SUBLI, "Sublimación"), line(ALFA, "Alfarería")];
const tags: Tag[] = [];
const assignees = [{ userId: USER, displayName: "Ana" }];

function renderForm(prefill?: Parameters<typeof TaskForm>[0]["prefill"]) {
  return render(
    <TaskForm
      lines={lines}
      assignees={assignees}
      tags={tags}
      currentUserId={USER}
      prefill={prefill}
    />,
  );
}

const TAREA = "66666666-6666-4666-8666-666666666666";

function editValues(overrides: Partial<TaskFormValues> = {}): TaskFormValues {
  return {
    id: TAREA,
    title: "Cortar tazas",
    businessLineId: ALFA,
    assigneeId: USER,
    dueDate: "2026-09-25",
    remindAt: null,
    tagNames: ["Hornada-07"],
    ...overrides,
  };
}

function renderEdit(task: TaskFormValues = editValues(), from: string | null = null) {
  return render(
    <TaskForm
      mode="edit"
      task={task}
      lines={lines}
      assignees={assignees}
      tags={tags}
      from={from}
    />,
  );
}

beforeEach(() => {
  created.mockClear();
  updated.mockClear();
  updated.mockResolvedValue(undefined);
  push.mockClear();
});
afterEach(cleanup);

/**
 * KAM-15 · Escenarios del delta spec `tasks` — requisitos "Formulario de alta
 * con responsable, fecha límite y etiquetas" y "Crear tarea para este pedido
 * con formulario prellenado".
 */
describe("TaskForm", () => {
  it("el responsable propuesto es quien crea la tarea", () => {
    renderForm();

    expect((screen.getByLabelText("Responsable") as HTMLSelectElement).value).toBe(
      USER,
    );
  });

  it("el responsable puede vaciarse", async () => {
    renderForm();

    const select = screen.getByLabelText("Responsable") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Sin responsable" },
    });
    screen.getByTestId("save-task").click();

    await waitFor(() =>
      expect(created).toHaveBeenCalledWith(
        expect.objectContaining({ assigneeId: null }),
      ),
    );
  });

  it("guarda título, línea, responsable y fecha", async () => {
    renderForm();

    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Diseñar arte" },
    });
    fireEvent.change(screen.getByLabelText("Fecha límite"), {
      target: { value: "2026-09-20" },
    });
    screen.getByTestId("save-task").click();

    await waitFor(() =>
      expect(created).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Diseñar arte",
          businessLineId: SUBLI,
          dueDate: "2026-09-20",
        }),
      ),
    );
  });

  it("llega prellenado desde el pedido, con vínculo y cliente como contexto", () => {
    renderForm({
      title: "Diseñar arte pedido #142",
      businessLineId: ALFA,
      dueDate: "2026-09-18",
      link: { entityType: "order", entityId: ORDER },
      linkLabel: "el pedido #142",
      customerName: "Ana Quispe",
    });

    expect((screen.getByLabelText("Título") as HTMLInputElement).value).toBe(
      "Diseñar arte pedido #142",
    );
    expect((screen.getByLabelText("Línea de negocio") as HTMLSelectElement).value).toBe(
      ALFA,
    );
    expect((screen.getByLabelText("Fecha límite") as HTMLInputElement).value).toBe(
      "2026-09-18",
    );
    expect(screen.getByText(/Ana Quispe/)).toBeInTheDocument();
  });

  it("todo lo prellenado se puede cambiar antes de guardar", async () => {
    renderForm({
      title: "Diseñar arte pedido #142",
      businessLineId: ALFA,
      dueDate: "2026-09-18",
      link: { entityType: "order", entityId: ORDER },
      linkLabel: "el pedido #142",
    });

    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Otra cosa" },
    });
    fireEvent.change(screen.getByLabelText("Línea de negocio"), {
      target: { value: SUBLI },
    });
    fireEvent.change(screen.getByLabelText("Fecha límite"), {
      target: { value: "2026-09-25" },
    });
    screen.getByTestId("save-task").click();

    await waitFor(() =>
      expect(created).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Otra cosa",
          businessLineId: SUBLI,
          dueDate: "2026-09-25",
        }),
      ),
    );
  });

  it("el vínculo se puede quitar antes de guardar", async () => {
    renderForm({
      title: "Diseñar arte pedido #142",
      businessLineId: ALFA,
      link: { entityType: "order", entityId: ORDER },
      linkLabel: "el pedido #142",
    });

    // La casilla llega marcada: el vínculo es la propuesta.
    const checkbox = screen.getByLabelText(/Vincular con el pedido #142/);
    expect((checkbox as HTMLInputElement).checked).toBe(true);

    checkbox.click();
    screen.getByTestId("save-task").click();

    await waitFor(() =>
      expect(created).toHaveBeenCalledWith(expect.objectContaining({ link: null })),
    );
  });

  it("sin venir de un pedido no se ofrece ningún vínculo", () => {
    renderForm();

    expect(screen.queryByTestId("task-link")).not.toBeInTheDocument();
  });

  it("el vínculo viaja cuando se conserva", async () => {
    renderForm({
      title: "Diseñar arte pedido #142",
      businessLineId: ALFA,
      link: { entityType: "order", entityId: ORDER },
      linkLabel: "el pedido #142",
    });

    screen.getByTestId("save-task").click();

    await waitFor(() =>
      expect(created).toHaveBeenCalledWith(
        expect.objectContaining({
          link: { entityType: "order", entityId: ORDER },
        }),
      ),
    );
  });
});

/**
 * KAM-29 · Escenarios del delta spec `task-detail` — requisito «La edición de
 * la tarea reúne sus datos en un formulario con un solo Guardar», y el de
 * migas de `navigation-breadcrumbs`.
 */
describe("TaskForm en modo edición", () => {
  it("llega con los valores actuales y sin estado ni cuerpo (El formulario llega con los valores actuales)", () => {
    renderEdit();

    expect((screen.getByLabelText("Título") as HTMLInputElement).value).toBe(
      "Cortar tazas",
    );
    expect((screen.getByLabelText("Línea de negocio") as HTMLSelectElement).value).toBe(
      ALFA,
    );
    expect((screen.getByLabelText("Responsable") as HTMLSelectElement).value).toBe(USER);
    expect((screen.getByLabelText("Fecha límite") as HTMLInputElement).value).toBe(
      "2026-09-25",
    );
    expect(screen.getByLabelText("Recordatorio")).toBeInTheDocument();

    // El estado y el cuerpo se quedan en el detalle (design D1, D8).
    expect(screen.queryByLabelText("Estado")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Descripción")).not.toBeInTheDocument();
    // Y los vínculos tampoco son cosa de esta pantalla.
    expect(screen.queryByTestId("task-link")).not.toBeInTheDocument();
  });

  it("guarda y aterriza en el detalle (Guardar lleva al detalle con los valores nuevos)", async () => {
    renderEdit();

    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Cortar 8 tazas" },
    });
    screen.getByTestId("save-task").click();

    await waitFor(() =>
      expect(updated).toHaveBeenCalledWith({
        taskId: TAREA,
        title: "Cortar 8 tazas",
      }),
    );
    expect(push).toHaveBeenCalledWith(`/tasks/${TAREA}`);
  });

  it("conserva la vista de origen al aterrizar (Guardar aterriza en el detalle sin perder el origen)", async () => {
    renderEdit(editValues(), "view=list&archived=1");

    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Cortar 8 tazas" },
    });
    screen.getByTestId("save-task").click();

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        `/tasks/${TAREA}?from=view%3Dlist%26archived%3D1`,
      ),
    );
  });

  it("solo viajan los campos tocados (Un campo que no se tocó no se registra)", async () => {
    renderEdit();

    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Cortar 8 tazas" },
    });
    fireEvent.change(screen.getByLabelText("Responsable"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Fecha límite"), {
      target: { value: "2026-10-02" },
    });
    screen.getByTestId("save-task").click();

    // Ni la línea, ni el recordatorio, ni las etiquetas: no se tocaron.
    await waitFor(() =>
      expect(updated).toHaveBeenCalledWith({
        taskId: TAREA,
        title: "Cortar 8 tazas",
        assigneeId: null,
        dueDate: "2026-10-02",
      }),
    );
  });

  it("impide guardar con el título vacío (El título no puede quedar vacío)", async () => {
    renderEdit();

    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "   " } });
    screen.getByTestId("save-task").click();

    await waitFor(() =>
      expect(screen.getByText("El título no puede quedar vacío.")).toBeInTheDocument(),
    );
    expect(updated).not.toHaveBeenCalled();
  });

  it("impide un recordatorio sin fecha límite (Un recordatorio necesita fecha límite)", async () => {
    renderEdit();

    fireEvent.change(screen.getByLabelText("Fecha límite"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Recordatorio"), {
      target: { value: "2026-09-24T09:00" },
    });
    screen.getByTestId("save-task").click();

    await waitFor(() =>
      expect(screen.getByText(/el recordatorio cuelga de ella/)).toBeInTheDocument(),
    );
    expect(updated).not.toHaveBeenCalled();
  });

  it("un fallo deja el formulario abierto con lo escrito (Un fallo deja el formulario abierto)", async () => {
    updated.mockResolvedValue({ error: "No se pudieron guardar los cambios." });
    renderEdit();

    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Cortar 8 tazas" },
    });
    screen.getByTestId("save-task").click();

    await waitFor(() =>
      expect(screen.getByTestId("task-form-error")).toBeInTheDocument(),
    );
    expect(push).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Título") as HTMLInputElement).value).toBe(
      "Cortar 8 tazas",
    );
  });

  it("salir con cambios pide confirmación (Salir con cambios pide confirmación)", async () => {
    renderEdit();

    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Cortar 8 tazas" },
    });
    screen.getByTestId("cancel-task").click();

    await waitFor(() =>
      expect(screen.getByText("¿Descartar los cambios?")).toBeInTheDocument(),
    );
    expect(push).not.toHaveBeenCalled();

    screen.getByTestId("confirm-discard").click();
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/tasks/${TAREA}`));
  });

  it("salir sin cambios no pregunta nada (Salir sin cambios no pregunta nada)", async () => {
    renderEdit();

    screen.getByTestId("cancel-task").click();

    await waitFor(() => expect(push).toHaveBeenCalledWith(`/tasks/${TAREA}`));
    expect(screen.queryByText("¿Descartar los cambios?")).not.toBeInTheDocument();
  });

  it("tras guardar la salida no pregunta (Salir tras guardar no pregunta nada)", async () => {
    renderEdit();

    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Cortar 8 tazas" },
    });
    screen.getByTestId("save-task").click();
    await waitFor(() => expect(updated).toHaveBeenCalled());

    push.mockClear();
    screen.getByTestId("cancel-task").click();

    await waitFor(() => expect(push).toHaveBeenCalledWith(`/tasks/${TAREA}`));
    expect(screen.queryByText("¿Descartar los cambios?")).not.toBeInTheDocument();
  });

  it("las migas nombran la tarea (La edición de una tarea nombra su tarea)", () => {
    renderEdit();

    const tareas = screen.getByRole("link", { name: "Tareas" });
    expect(tareas).toHaveAttribute("href", "/tasks");

    const tarea = screen.getByRole("link", { name: "Cortar tazas" });
    expect(tarea).toHaveAttribute("href", `/tasks/${TAREA}`);

    // El último tramo no es enlace y se anuncia como la página actual.
    const actual = screen.getByText("Editar");
    expect(actual).toHaveAttribute("aria-current", "page");
    expect(actual.tagName).not.toBe("A");
  });

  it("desde Mis pendientes la primera miga es Mis pendientes (Desde Mis pendientes se vuelve a Mis pendientes)", () => {
    renderEdit(editValues(), "my-tasks");

    expect(screen.getByRole("link", { name: "Mis pendientes" })).toHaveAttribute(
      "href",
      "/my-tasks",
    );
  });
});
