import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Task } from "@/types";

const ORG = "11111111-1111-4111-8111-111111111111";
const USER = "55555555-5555-4555-8555-555555555555";
const TASK = "22222222-2222-4222-8222-222222222222";

/** Estado que las dobles leen y escriben, reiniciado en cada prueba. */
const estado = vi.hoisted(() => ({
  task: null as Task | null,
  activos: 0,
  subidas: [] as unknown[],
  guardados: [] as unknown[],
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/auth/session-context", () => ({
  getSessionContext: async () => ({
    supabase: {},
    userId: USER,
    organizationId: ORG,
    membership: { role: "owner" },
  }),
}));

vi.mock("@/services/tasks/task-service", () => ({
  TaskService: class {
    async getById() {
      return estado.task;
    }
    async updateFields(_org: string, _id: string, fields: unknown) {
      estado.guardados.push(fields);
    }
  },
}));

vi.mock("@/services/catalog/attachment-service", () => ({
  AttachmentService: class {
    async countActive() {
      return estado.activos;
    }
    async upload(_org: string, _user: string, input: unknown) {
      estado.subidas.push(input);
    }
    async setArchived() {}
  },
}));

const { attachToTask, updateTaskField } = await import("./tasks");

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: TASK,
    organizationId: ORG,
    businessLineId: "33333333-3333-4333-8333-333333333333",
    statusId: "44444444-4444-4444-8444-444444444444",
    title: "Set de 6 tazas artesanales",
    bodyMarkdown: null,
    assigneeId: USER,
    dueAt: "2026-09-20T00:00:00Z",
    remindAt: null,
    closedAt: null,
    createdBy: USER,
    createdAt: "2026-09-07T10:00:00Z",
    archivedAt: null,
    tags: [],
    ...overrides,
  };
}

function archivo(name = "foto.jpg", size = 120_000, type = "image/jpeg"): File {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function formData(file: File, taskId: string = TASK): FormData {
  const body = new FormData();
  body.set("taskId", taskId);
  body.set("file", file);
  return body;
}

beforeEach(() => {
  estado.task = task();
  estado.activos = 0;
  estado.subidas = [];
  estado.guardados = [];
});

describe("attachToTask · el límite no depende del navegador", () => {
  it("rechaza el decimosexto aunque la pantalla no lo haya impedido", async () => {
    estado.activos = 15;

    const result = await attachToTask(formData(archivo()));

    expect(result?.error).toContain("ya tiene 15 adjuntos");
    // Y no llega a subir nada: la comprobación va antes que el objeto.
    expect(estado.subidas).toHaveLength(0);
  });

  it("acepta el decimoquinto", async () => {
    estado.activos = 14;

    expect(await attachToTask(formData(archivo()))).toBeUndefined();
    expect(estado.subidas).toHaveLength(1);
  });

  it("adjunta con entity_type task y al bucket de adjuntos", async () => {
    await attachToTask(formData(archivo()));

    expect(estado.subidas[0]).toMatchObject({
      entityType: "task",
      entityId: TASK,
      bucket: "attachments",
      fileName: "foto.jpg",
    });
  });

  it("rechaza un archivo de más de 5 MB sin contar siquiera", async () => {
    const result = await attachToTask(
      formData(archivo("ficha.pdf", 12 * 1024 * 1024, "application/pdf")),
    );

    expect(result?.error).toContain("5 MB");
    expect(estado.subidas).toHaveLength(0);
  });

  it("no adjunta a una tarea archivada", async () => {
    estado.task = task({ archivedAt: "2026-09-08T10:00:00Z" });

    const result = await attachToTask(formData(archivo()));

    expect(result?.error).toContain("archivada");
    expect(estado.subidas).toHaveLength(0);
  });

  it("no adjunta a una tarea fuera de alcance", async () => {
    estado.task = null;

    const result = await attachToTask(formData(archivo()));

    expect(result?.error).toContain("ya no está a tu alcance");
    expect(estado.subidas).toHaveLength(0);
  });
});

describe("updateTaskField", () => {
  it("rechaza el título vacío con su mensaje, no con un error de la base", async () => {
    const result = await updateTaskField({
      taskId: TASK,
      field: "title",
      value: "   ",
    });

    expect(result?.error).toBe("El título no puede quedar vacío.");
    expect(estado.guardados).toHaveLength(0);
  });

  it("rechaza el recordatorio si la tarea no tiene fecha límite", async () => {
    estado.task = task({ dueAt: null });

    const result = await updateTaskField({
      taskId: TASK,
      field: "remindAt",
      value: "2026-09-19T09:00:00.000Z",
    });

    expect(result?.error).toContain("fecha límite");
    expect(estado.guardados).toHaveLength(0);
  });

  it("quitar la fecha límite se lleva el recordatorio por delante", async () => {
    estado.task = task({ remindAt: "2026-09-19T09:00:00.000Z" });

    await updateTaskField({ taskId: TASK, field: "dueDate", value: null });

    // Dejarlo colgando rompería `reminder_needs_due_date` en la siguiente
    // escritura, que es un error que nadie sabría explicar.
    expect(estado.guardados[0]).toEqual({ dueDate: null, remindAt: null });
  });

  it("guarda un solo campo por llamada", async () => {
    await updateTaskField({ taskId: TASK, field: "title", value: "Set de 8 tazas" });

    expect(estado.guardados).toEqual([{ title: "Set de 8 tazas" }]);
  });

  it("no edita una tarea archivada", async () => {
    estado.task = task({ archivedAt: "2026-09-08T10:00:00Z" });

    const result = await updateTaskField({
      taskId: TASK,
      field: "title",
      value: "Otro título",
    });

    expect(result?.error).toContain("archivada");
    expect(estado.guardados).toHaveLength(0);
  });
});
