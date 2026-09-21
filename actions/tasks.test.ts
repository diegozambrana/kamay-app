import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Status, StatusKind, Task } from "@/types";

const ORG = "11111111-1111-4111-8111-111111111111";
const USER = "55555555-5555-4555-8555-555555555555";
const TASK = "22222222-2222-4222-8222-222222222222";

const LINEA_SUBLIMACION = "33333333-3333-4333-8333-333333333333";
const LINEA_ALFARERIA = "66666666-6666-4666-8666-666666666666";

const ESTADO_CURSO = "44444444-4444-4444-8444-444444444444";
const ESTADO_ESPERA = "77777777-7777-4777-8777-777777777777";
const ALFARERIA_INICIAL = "88888888-8888-4888-8888-888888888888";
const ALFARERIA_CURSO = "99999999-9999-4999-8999-999999999999";

/** Estado que las dobles leen y escriben, reiniciado en cada prueba. */
const estado = vi.hoisted(() => ({
  task: null as Task | null,
  activos: 0,
  subidas: [] as unknown[],
  guardados: [] as unknown[],
  // KAM-30 · asistencia de redacción.
  asistenteDisponible: true,
  asistenciaActivada: true,
  usoDelPeriodo: 0,
  limiteMensual: 200,
  solicitudesRegistradas: [] as { org: string; user: string }[],
  respuestaDelModelo: null as string | null,
  fallaElModelo: false,
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

/**
 * Dos líneas con juegos propios que no se corresponden por nombre: Alfarería
 * no tiene ningún estado de tipo `waiting`, que es lo que hace demostrable el
 * rechazo cuando no hay destino equivalente.
 */
function status(id: string, kind: StatusKind, position: number, name: string): Status {
  return {
    id,
    organizationId: ORG,
    businessLineId: null,
    flow: "task",
    name,
    kind,
    color: "zinc",
    position,
    isQueue: false,
    archivedAt: null,
  };
}

const SUBLIMACION = [
  status(ESTADO_CURSO, "in_progress", 2, "Impresión"),
  status(ESTADO_ESPERA, "waiting", 3, "Esperando insumo"),
];

const ALFARERIA = [
  status(ALFARERIA_INICIAL, "initial", 1, "Por modelar"),
  status(ALFARERIA_CURSO, "in_progress", 2, "Modelado"),
];

vi.mock("@/services/configuration/status-service", () => ({
  StatusService: class {
    async listAllForFlow() {
      return [...SUBLIMACION, ...ALFARERIA];
    }
    async resolve(_org: string, lineId: string) {
      return lineId === LINEA_ALFARERIA ? ALFARERIA : SUBLIMACION;
    }
  },
}));

vi.mock("@/services/notifications/emit-task-events", () => ({
  emitTaskEvents: vi.fn(async () => {}),
}));

vi.mock("@/lib/ai/resolve", () => ({
  resolveAiAssistant: () =>
    estado.asistenteDisponible
      ? {
          async proposeBodyImprovement(body: string) {
            if (estado.fallaElModelo) throw new Error("el proveedor de IA no responde");
            return { proposal: estado.respuestaDelModelo ?? `${body} (mejorado)` };
          },
        }
      : null,
}));

vi.mock("@/lib/ai/config", () => ({
  monthlyRequestLimit: () => estado.limiteMensual,
}));

vi.mock("@/services/configuration/ai-writing-assist-service", () => ({
  AiWritingAssistService: class {
    async get() {
      return { enabled: estado.asistenciaActivada };
    }
  },
}));

vi.mock("@/services/ai/usage-service", () => ({
  AiUsageService: class {
    async countCurrentPeriod() {
      return estado.usoDelPeriodo;
    }
    async recordRequest(org: string, user: string) {
      estado.solicitudesRegistradas.push({ org, user });
    }
  },
}));

const { attachToTask, proposeTaskBodyImprovement, updateTaskBody, updateTaskField, updateTaskFields } =
  await import("./tasks");

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: TASK,
    organizationId: ORG,
    businessLineId: LINEA_SUBLIMACION,
    statusId: ESTADO_CURSO,
    title: "Set de 6 tazas artesanales",
    bodyMarkdown: null,
    assigneeId: USER,
    dueAt: "2026-09-20T00:00:00Z",
    remindAt: null,
    closedAt: null,
    closedWithoutDeliverables: false,
    bodyAssistedByAi: false,
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
  estado.asistenteDisponible = true;
  estado.asistenciaActivada = true;
  estado.usoDelPeriodo = 0;
  estado.limiteMensual = 200;
  estado.solicitudesRegistradas = [];
  estado.respuestaDelModelo = null;
  estado.fallaElModelo = false;
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

describe("updateTaskField · el estado, desde el detalle", () => {
  it("guarda el estado", async () => {
    await updateTaskField({ taskId: TASK, field: "statusId", value: ESTADO_CURSO });

    expect(estado.guardados).toEqual([{ statusId: ESTADO_CURSO }]);
  });

  it("no cambia el estado de una tarea archivada", async () => {
    estado.task = task({ archivedAt: "2026-09-08T10:00:00Z" });

    const result = await updateTaskField({
      taskId: TASK,
      field: "statusId",
      value: ESTADO_CURSO,
    });

    expect(result?.error).toContain("archivada");
    expect(estado.guardados).toHaveLength(0);
  });

  it("no cambia el estado de una tarea fuera de alcance", async () => {
    estado.task = null;

    const result = await updateTaskField({
      taskId: TASK,
      field: "statusId",
      value: ESTADO_CURSO,
    });

    expect(result?.error).toContain("ya no está a tu alcance");
    expect(estado.guardados).toHaveLength(0);
  });
});

describe("updateTaskFields · el guardado de la edición", () => {
  it("rechaza el título vacío con su mensaje, no con un error de la base (El título no puede quedar vacío)", async () => {
    const result = await updateTaskFields({ taskId: TASK, title: "   " });

    expect(result?.error).toBe("El título no puede quedar vacío.");
    expect(estado.guardados).toHaveLength(0);
  });

  it("rechaza el recordatorio si la tarea no tiene fecha límite (Un recordatorio necesita fecha límite)", async () => {
    estado.task = task({ dueAt: null });

    const result = await updateTaskFields({
      taskId: TASK,
      remindAt: "2026-09-19T09:00:00.000Z",
    });

    expect(result?.error).toContain("fecha límite");
    expect(estado.guardados).toHaveLength(0);
  });

  it("rechaza el recordatorio cuando la misma edición borra la fecha límite", async () => {
    // La regla se comprueba contra el resultado, no contra la tarea guardada:
    // poner recordatorio y quitar la fecha en el mismo gesto no puede colarse.
    const result = await updateTaskFields({
      taskId: TASK,
      dueDate: null,
      remindAt: "2026-09-19T09:00:00.000Z",
    });

    expect(result?.error).toContain("fecha límite");
    expect(estado.guardados).toHaveLength(0);
  });

  it("acepta el recordatorio cuando la misma edición trae la fecha límite", async () => {
    estado.task = task({ dueAt: null });

    const result = await updateTaskFields({
      taskId: TASK,
      dueDate: "2026-09-25",
      remindAt: "2026-09-24T09:00:00.000Z",
    });

    expect(result).toBeUndefined();
    expect(estado.guardados[0]).toMatchObject({
      dueDate: "2026-09-25",
      remindAt: "2026-09-24T09:00:00.000Z",
    });
  });

  it("quitar la fecha límite se lleva el recordatorio por delante (Quitar la fecha límite quita el recordatorio)", async () => {
    estado.task = task({ remindAt: "2026-09-19T09:00:00.000Z" });

    await updateTaskFields({ taskId: TASK, dueDate: null });

    expect(estado.guardados[0]).toMatchObject({ dueDate: null, remindAt: null });
  });

  it("escribe los campos tocados y ninguno más (Un campo que no se tocó no se registra)", async () => {
    await updateTaskFields({
      taskId: TASK,
      title: "Set de 8 tazas",
      assigneeId: null,
      dueDate: "2026-09-25",
    });

    // Los campos que el formulario no tocó llegan `undefined`, y el servicio
    // no los escribe: es lo que hace que la bitácora registre esos tres.
    expect(estado.guardados[0]).toEqual({
      title: "Set de 8 tazas",
      assigneeId: null,
      dueDate: "2026-09-25",
    });
  });

  it("no edita una tarea archivada", async () => {
    estado.task = task({ archivedAt: "2026-09-08T10:00:00Z" });

    const result = await updateTaskFields({ taskId: TASK, title: "Otro título" });

    expect(result?.error).toContain("archivada");
    expect(estado.guardados).toHaveLength(0);
  });

  it("no edita una tarea fuera de alcance", async () => {
    estado.task = null;

    const result = await updateTaskFields({ taskId: TASK, title: "Otro título" });

    expect(result?.error).toContain("ya no está a tu alcance");
    expect(estado.guardados).toHaveLength(0);
  });

  describe("cambiar la línea reubica el estado", () => {
    it("escribe línea y estado en la misma operación", async () => {
      await updateTaskFields({ taskId: TASK, businessLineId: LINEA_ALFARERIA });

      expect(estado.guardados[0]).toMatchObject({
        businessLineId: LINEA_ALFARERIA,
        statusId: ALFARERIA_CURSO,
      });
    });

    it("sin estado equivalente no escribe nada (La línea nueva no tiene ese tipo)", async () => {
      estado.task = task({ statusId: ESTADO_ESPERA });

      const result = await updateTaskFields({
        taskId: TASK,
        businessLineId: LINEA_ALFARERIA,
      });

      expect(result?.error).toContain("no tiene ningún estado equivalente");
      expect(estado.guardados).toHaveLength(0);
    });

    it("la misma línea no toca el estado", async () => {
      await updateTaskFields({
        taskId: TASK,
        businessLineId: LINEA_SUBLIMACION,
        title: "Set de 8 tazas",
      });

      expect(estado.guardados[0]).not.toHaveProperty("statusId");
    });
  });
});

// KAM-30 · asistencia de redacción.
describe("updateTaskBody · la marca de asistido", () => {
  it("un guardado sin propuesta aceptada se marca como no asistido", async () => {
    await updateTaskBody({ taskId: TASK, body: "Texto editado a mano" });

    expect(estado.guardados[0]).toMatchObject({
      bodyMarkdown: "Texto editado a mano",
      bodyAssistedByAi: false,
    });
  });

  it("un guardado que declara la propuesta aceptada se marca como asistido", async () => {
    await updateTaskBody({ taskId: TASK, body: "Texto mejorado", assisted: true });

    expect(estado.guardados[0]).toMatchObject({
      bodyMarkdown: "Texto mejorado",
      bodyAssistedByAi: true,
    });
  });
});

describe("proposeTaskBodyImprovement · el servidor decide, no la interfaz", () => {
  it("devuelve la propuesta y cuenta la solicitud antes de llamar al proveedor", async () => {
    estado.respuestaDelModelo = "Descripción mejorada.";

    const result = await proposeTaskBodyImprovement({ taskId: TASK, body: "Texto apurado" });

    expect(result).toEqual({ proposal: "Descripción mejorada." });
    expect(estado.solicitudesRegistradas).toEqual([{ org: ORG, user: USER }]);
  });

  it("sin ANTHROPIC_API_KEY, rechaza sin contar ni llamar al proveedor", async () => {
    estado.asistenteDisponible = false;

    const result = await proposeTaskBodyImprovement({ taskId: TASK, body: "Texto apurado" });

    expect(result).toEqual({ error: expect.any(String) });
    expect(estado.solicitudesRegistradas).toHaveLength(0);
  });

  it("una organización sin la asistencia activada se rechaza, verificado sin pasar por la interfaz", async () => {
    estado.asistenciaActivada = false;

    const result = await proposeTaskBodyImprovement({ taskId: TASK, body: "Texto apurado" });

    expect(result).toEqual({ error: expect.any(String) });
    expect(estado.solicitudesRegistradas).toHaveLength(0);
  });

  it("al superar el límite del periodo, rechaza con un mensaje sobrio sin llamar al proveedor", async () => {
    estado.usoDelPeriodo = 200;
    estado.limiteMensual = 200;

    const result = await proposeTaskBodyImprovement({ taskId: TASK, body: "Texto apurado" });

    expect(result).toEqual({ error: expect.any(String) });
    expect(estado.solicitudesRegistradas).toHaveLength(0);
  });

  it("bajo el límite, la solicitud procede con normalidad", async () => {
    estado.usoDelPeriodo = 199;
    estado.limiteMensual = 200;

    const result = await proposeTaskBodyImprovement({ taskId: TASK, body: "Texto apurado" });

    expect(result).not.toHaveProperty("error");
  });

  it("un proveedor que falla avisa en lenguaje llano y no rompe el editor", async () => {
    estado.fallaElModelo = true;

    const result = await proposeTaskBodyImprovement({ taskId: TASK, body: "Texto apurado" });

    expect(result).toEqual({ error: expect.any(String) });
    // Se registró antes de llamar, como declara el diseño: el fallo es del
    // proveedor, no de la cuenta.
    expect(estado.solicitudesRegistradas).toHaveLength(1);
  });

  it("un cuerpo vacío no se ofrece", async () => {
    const result = await proposeTaskBodyImprovement({ taskId: TASK, body: "   " });

    expect(result).toEqual({ error: expect.any(String) });
    expect(estado.solicitudesRegistradas).toHaveLength(0);
  });

  it("no mejora una tarea archivada", async () => {
    estado.task = task({ archivedAt: "2026-09-08T10:00:00Z" });

    const result = await proposeTaskBodyImprovement({ taskId: TASK, body: "Texto apurado" });

    expect(result).toEqual({ error: expect.any(String) });
    expect(estado.solicitudesRegistradas).toHaveLength(0);
  });

  it("no mejora una tarea fuera de alcance", async () => {
    estado.task = null;

    const result = await proposeTaskBodyImprovement({ taskId: TASK, body: "Texto apurado" });

    expect(result).toEqual({ error: expect.any(String) });
    expect(estado.solicitudesRegistradas).toHaveLength(0);
  });
});
