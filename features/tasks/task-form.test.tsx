import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BusinessLine, Tag } from "@/types";

import { TaskForm } from "./task-form";

const created = vi.fn(async (input: unknown) => ({ taskId: "nueva", input }));
vi.mock("@/actions/tasks", () => ({
  createTask: (input: unknown) => created(input),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
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

beforeEach(() => created.mockClear());
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

  it("el responsable puede vaciarse", () => {
    renderForm();

    const select = screen.getByLabelText("Responsable") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Sin responsable" },
    });
    screen.getByTestId("save-task").click();

    expect(created).toHaveBeenCalledWith(
      expect.objectContaining({ assigneeId: null }),
    );
  });

  it("guarda título, línea, responsable y fecha", () => {
    renderForm();

    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Diseñar arte" },
    });
    fireEvent.change(screen.getByLabelText("Fecha límite"), {
      target: { value: "2026-09-20" },
    });
    screen.getByTestId("save-task").click();

    expect(created).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Diseñar arte",
        businessLineId: SUBLI,
        dueDate: "2026-09-20",
      }),
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

  it("todo lo prellenado se puede cambiar antes de guardar", () => {
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

    expect(created).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Otra cosa",
        businessLineId: SUBLI,
        dueDate: "2026-09-25",
      }),
    );
  });

  it("el vínculo se puede quitar antes de guardar", () => {
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

    expect(created).toHaveBeenCalledWith(expect.objectContaining({ link: null }));
  });

  it("sin venir de un pedido no se ofrece ningún vínculo", () => {
    renderForm();

    expect(screen.queryByTestId("task-link")).not.toBeInTheDocument();
  });

  it("el vínculo viaja cuando se conserva", () => {
    renderForm({
      title: "Diseñar arte pedido #142",
      businessLineId: ALFA,
      link: { entityType: "order", entityId: ORDER },
      linkLabel: "el pedido #142",
    });

    screen.getByTestId("save-task").click();

    expect(created).toHaveBeenCalledWith(
      expect.objectContaining({
        link: { entityType: "order", entityId: ORDER },
      }),
    );
  });
});
