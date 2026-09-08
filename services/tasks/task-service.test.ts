import { describe, expect, it } from "vitest";

import { FakeClient } from "@/tests/factories/supabase-fake";

import { TaskService } from "./task-service";

const ORG = "11111111-1111-4111-8111-111111111111";
const TASK = "22222222-2222-4222-8222-222222222222";
const LINE = "33333333-3333-4333-8333-333333333333";
const USER = "44444444-4444-4444-8444-444444444444";
const ORDER = "55555555-5555-4555-8555-555555555555";

const row = {
  id: TASK,
  organization_id: ORG,
  business_line_id: LINE,
  status_id: "66666666-6666-4666-8666-666666666666",
  title: "Diseñar arte",
  body_markdown: "- [ ] Boceto\n- [ ] Aprobación",
  assignee_id: USER,
  due_at: "2026-09-20T00:00:00Z",
  remind_at: null,
  closed_at: null,
  created_by: USER,
  created_at: "2026-09-07T10:00:00Z",
  archived_at: null,
  task_tags: [{ tag: { id: "t1", organization_id: ORG, name: "hornada-07" } }],
};

describe("TaskService", () => {
  it("lee las tareas del tablero y las traduce con sus etiquetas", async () => {
    const client = new FakeClient([{ data: [row], error: null }]);

    const tasks = await new TaskService(client.asSupabase()).listForBoard(ORG);

    expect(tasks[0].title).toBe("Diseñar arte");
    expect(tasks[0].tags).toEqual([
      { id: "t1", organizationId: ORG, name: "hornada-07" },
    ]);
  });

  it("toda consulta lleva la organización explícita (convención nº 2)", async () => {
    const client = new FakeClient([{ data: [row], error: null }]);

    await new TaskService(client.asSupabase()).listForBoard(ORG);

    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);
  });

  it("oculta lo archivado salvo que se pida", async () => {
    const client = new FakeClient([{ data: [row], error: null }]);
    await new TaskService(client.asSupabase()).listForBoard(ORG);
    expect(client.queries[0].has("is", "archived_at", null)).toBe(true);

    const withArchived = new FakeClient([{ data: [row], error: null }]);
    await new TaskService(withArchived.asSupabase()).listForBoard(ORG, {
      includeArchived: true,
    });
    expect(withArchived.queries[0].has("is", "archived_at", null)).toBe(false);
  });

  it("filtra por responsable y por estado en la consulta", async () => {
    const client = new FakeClient([{ data: [row], error: null }]);

    await new TaskService(client.asSupabase()).listForBoard(ORG, {
      assigneeId: USER,
      statusId: "66666666-6666-4666-8666-666666666666",
    });

    expect(client.queries[0].has("eq", "assignee_id", USER)).toBe(true);
    expect(
      client.queries[0].has("eq", "status_id", "66666666-6666-4666-8666-666666666666"),
    ).toBe(true);
  });

  it("filtra por etiqueta en memoria, para no recortar las demás etiquetas", async () => {
    const otra = { ...row, id: "otra", task_tags: [] };
    const client = new FakeClient([{ data: [row, otra], error: null }]);

    const tasks = await new TaskService(client.asSupabase()).listForBoard(ORG, {
      tagId: "t1",
    });

    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe(TASK);
    // La etiqueta no viajó como filtro anidado a PostgREST.
    expect(client.queries[0].has("eq", "tag_id", "t1")).toBe(false);
  });

  it("el alta no manda estado: lo resuelve la base", async () => {
    const client = new FakeClient([{ data: { id: TASK }, error: null }]);

    await new TaskService(client.asSupabase()).create(
      ORG,
      { title: "Nueva", businessLineId: LINE },
      USER,
    );

    const inserted = client.queries[0].argsOf("insert")?.[0] as Record<string, unknown>;
    expect(inserted).not.toHaveProperty("status_id");
    expect(inserted.business_line_id).toBe(LINE);
  });

  it("el responsable por omisión es quien crea la tarea", async () => {
    const client = new FakeClient([{ data: { id: TASK }, error: null }]);

    await new TaskService(client.asSupabase()).create(
      ORG,
      { title: "Nueva", businessLineId: LINE },
      USER,
    );

    const inserted = client.queries[0].argsOf("insert")?.[0] as Record<string, unknown>;
    expect(inserted.assignee_id).toBe(USER);
  });

  it("el vínculo se escribe junto con la tarea, no después", async () => {
    const client = new FakeClient([
      { data: { id: TASK }, error: null },
      { data: null, error: null },
    ]);

    await new TaskService(client.asSupabase()).create(
      ORG,
      {
        title: "Diseñar arte",
        businessLineId: LINE,
        link: { entityType: "order", entityId: ORDER },
      },
      USER,
    );

    expect(client.tables).toEqual(["tasks", "task_links"]);
    expect(client.queries[1].argsOf("insert")?.[0]).toMatchObject({
      task_id: TASK,
      entity_type: "order",
      entity_id: ORDER,
      organization_id: ORG,
    });
  });

  it("mover una tarea solo cambia su estado: nada más cuelga del movimiento", async () => {
    const client = new FakeClient([{ data: null, error: null }]);

    await new TaskService(client.asSupabase()).moveToStatus(ORG, TASK, "nuevo");

    // Una sola tabla tocada, y no es `orders` (convención nº 10).
    expect(client.tables).toEqual(["tasks"]);
    expect(client.queries[0].argsOf("update")?.[0]).toMatchObject({
      status_id: "nuevo",
    });
  });

  it("mover no escribe closed_at: lo lleva el trigger", async () => {
    const client = new FakeClient([{ data: null, error: null }]);

    await new TaskService(client.asSupabase()).moveToStatus(ORG, TASK, "final");

    expect(client.queries[0].argsOf("update")?.[0]).not.toHaveProperty("closed_at");
  });

  it("archivar no borra", async () => {
    const client = new FakeClient([{ data: null, error: null }]);

    await new TaskService(client.asSupabase()).archive(ORG, TASK);

    expect(client.queries[0].argsOf("update")?.[0]).toMatchObject({
      archived_at: expect.any(String),
    });
    expect(client.queries[0].calls.some((c) => c.method === "delete")).toBe(false);
  });

  it("un fallo de lectura se cuenta con su motivo", async () => {
    const client = new FakeClient([
      { data: null, error: { message: "permission denied" } },
    ]);

    await expect(
      new TaskService(client.asSupabase()).listForBoard(ORG),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("TaskService · lectura y edición", () => {
  it("getById traduce la tarea con sus etiquetas", async () => {
    const client = new FakeClient([{ data: row, error: null }]);

    const task = await new TaskService(client.asSupabase()).getById(ORG, TASK);

    expect(task?.id).toBe(TASK);
    expect(task?.tags).toHaveLength(1);
    expect(client.queries[0].has("eq", "id", TASK)).toBe(true);
    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);
  });

  it("getById devuelve null cuando la tarea no existe o no se ve", async () => {
    const client = new FakeClient([{ data: null, error: null }]);

    const task = await new TaskService(client.asSupabase()).getById(ORG, TASK);

    expect(task).toBeNull();
  });

  it("getById cuenta el fallo con su motivo", async () => {
    const client = new FakeClient([
      { data: null, error: { message: "permission denied" } },
    ]);

    await expect(
      new TaskService(client.asSupabase()).getById(ORG, TASK),
    ).rejects.toThrow(/permission denied/);
  });

  it("una tarea sin etiquetas se traduce con la lista vacía", async () => {
    const client = new FakeClient([
      { data: [{ ...row, task_tags: null }], error: null },
    ]);

    const tasks = await new TaskService(client.asSupabase()).listForBoard(ORG);

    expect(tasks[0].tags).toEqual([]);
  });

  it("la búsqueda por título viaja como filtro", async () => {
    const client = new FakeClient([{ data: [row], error: null }]);

    await new TaskService(client.asSupabase()).listForBoard(ORG, {
      search: "arte",
    });

    expect(client.queries[0].has("ilike", "title", "%arte%")).toBe(true);
  });

  it("updateFields solo manda lo que se le pasa", async () => {
    const client = new FakeClient([{ data: null, error: null }]);

    await new TaskService(client.asSupabase()).updateFields(ORG, TASK, {
      assigneeId: USER,
    });

    const patch = client.queries[0].argsOf("update")?.[0] as Record<string, unknown>;
    expect(patch.assignee_id).toBe(USER);
    // El título no se toca si no se pidió: un `undefined` borraría el que hay.
    expect(patch).not.toHaveProperty("title");
    expect(patch).not.toHaveProperty("due_at");
  });

  it("updateFields distingue «sin fecha» de «no la cambies»", async () => {
    const client = new FakeClient([{ data: null, error: null }]);

    await new TaskService(client.asSupabase()).updateFields(ORG, TASK, {
      dueDate: null,
    });

    const patch = client.queries[0].argsOf("update")?.[0] as Record<string, unknown>;
    expect(patch.due_at).toBeNull();
  });

  it("updateFields convierte la fecha a instante", async () => {
    const client = new FakeClient([{ data: null, error: null }]);

    await new TaskService(client.asSupabase()).updateFields(ORG, TASK, {
      dueDate: "2026-09-20",
    });

    const patch = client.queries[0].argsOf("update")?.[0] as Record<string, unknown>;
    expect(patch.due_at).toBe("2026-09-20T00:00:00Z");
  });

  it("un fallo al guardar se cuenta con su motivo", async () => {
    const client = new FakeClient([
      { data: null, error: { message: "archivada" } },
    ]);

    await expect(
      new TaskService(client.asSupabase()).updateFields(ORG, TASK, { title: "x" }),
    ).rejects.toThrow(/archivada/);
  });

  it("mover a un estado rechazado se cuenta con su motivo", async () => {
    const client = new FakeClient([
      { data: null, error: { message: "row-level security" } },
    ]);

    await expect(
      new TaskService(client.asSupabase()).moveToStatus(ORG, TASK, "x"),
    ).rejects.toThrow(/row-level security/);
  });

  it("archivar sin permiso se cuenta con su motivo", async () => {
    const client = new FakeClient([
      { data: null, error: { message: "Solo la persona dueña puede archivar" } },
    ]);

    await expect(
      new TaskService(client.asSupabase()).archive(ORG, TASK),
    ).rejects.toThrow(/dueña/);
  });
});

describe("TaskService · etiquetas y vínculos", () => {
  it("setTags solo inserta las que faltan", async () => {
    const client = new FakeClient([
      { data: [{ tag_id: "t1" }], error: null },
      { data: null, error: null },
    ]);

    await new TaskService(client.asSupabase()).setTags(ORG, TASK, ["t1", "t2"]);

    expect(client.queries[1].argsOf("insert")?.[0]).toEqual([
      { task_id: TASK, tag_id: "t2", organization_id: ORG },
    ]);
  });

  it("setTags no toca la base cuando ya están todas", async () => {
    const client = new FakeClient([{ data: [{ tag_id: "t1" }], error: null }]);

    await new TaskService(client.asSupabase()).setTags(ORG, TASK, ["t1"]);

    expect(client.queries).toHaveLength(1);
  });

  it("setTags cuenta el fallo de lectura y el de escritura", async () => {
    const read = new FakeClient([
      { data: null, error: { message: "no se pudo leer" } },
    ]);
    await expect(
      new TaskService(read.asSupabase()).setTags(ORG, TASK, ["t1"]),
    ).rejects.toThrow(/no se pudo leer/);

    const write = new FakeClient([
      { data: [], error: null },
      { data: null, error: { message: "no se pudo escribir" } },
    ]);
    await expect(
      new TaskService(write.asSupabase()).setTags(ORG, TASK, ["t1"]),
    ).rejects.toThrow(/no se pudo escribir/);
  });

  it("un vínculo a un registro inexistente se cuenta con su motivo", async () => {
    const client = new FakeClient([
      { data: null, error: { message: "El registro vinculado no existe" } },
    ]);

    await expect(
      new TaskService(client.asSupabase()).link(ORG, TASK, "order", ORDER),
    ).rejects.toThrow(/no existe/);
  });

  it("las etiquetas del alta se aplican en la misma operación", async () => {
    const client = new FakeClient([
      { data: { id: TASK }, error: null },
      { data: [], error: null },
      { data: null, error: null },
    ]);

    await new TaskService(client.asSupabase()).create(
      ORG,
      { title: "Con etiqueta", businessLineId: LINE },
      USER,
      ["t1"],
    );

    expect(client.tables).toEqual(["tasks", "task_tags", "task_tags"]);
  });

  it("un alta rechazada se cuenta con su motivo", async () => {
    const client = new FakeClient([
      { data: null, error: { message: "task_needs_title" } },
    ]);

    await expect(
      new TaskService(client.asSupabase()).create(
        ORG,
        { title: "x", businessLineId: LINE },
        USER,
      ),
    ).rejects.toThrow(/task_needs_title/);
  });

  it("el equipo asignable sale de las membresías vigentes", async () => {
    const client = new FakeClient([
      { data: [{ user_id: USER, display_name: "Ana" }], error: null },
    ]);

    const people = await new TaskService(client.asSupabase()).assignees(ORG);

    expect(people).toEqual([{ userId: USER, displayName: "Ana" }]);
    expect(client.queries[0].has("is", "archived_at", null)).toBe(true);
  });

  it("un fallo al cargar el equipo se cuenta con su motivo", async () => {
    const client = new FakeClient([
      { data: null, error: { message: "sin acceso" } },
    ]);

    await expect(
      new TaskService(client.asSupabase()).assignees(ORG),
    ).rejects.toThrow(/sin acceso/);
  });
});

describe("TaskService.history", () => {
  const entrada = {
    id: 7,
    action: "update",
    actor_id: USER,
    actor_label: "Julio Terán",
    changes: { title: ["Diseñar arte", "Diseñar arte pedido #142"] },
    occurred_at: "2026-09-07T11:00:00Z",
  };

  it("lee de activity_log y de ninguna otra fuente", async () => {
    const client = new FakeClient([{ data: [entrada], error: null }]);

    await new TaskService(client.asSupabase()).history(ORG, TASK);

    // El requisito es que no exista una segunda tabla de historial
    // (convención nº 7): se comprueba por dónde pregunta el servicio.
    expect(client.tables).toEqual(["activity_log"]);

    const query = client.queries[0];
    expect(query.has("eq", "organization_id", ORG)).toBe(true);
    expect(query.has("eq", "table_name", "tasks")).toBe(true);
    expect(query.has("eq", "record_id", TASK)).toBe(true);
  });

  it("devuelve lo más reciente primero y acotado", async () => {
    const client = new FakeClient([{ data: [entrada], error: null }]);

    await new TaskService(client.asSupabase()).history(ORG, TASK);

    const query = client.queries[0];
    expect(query.has("order", "occurred_at", { ascending: false })).toBe(true);
    expect(query.has("limit", 50)).toBe(true);
  });

  it("traduce la entrada con su autor y su momento", async () => {
    const client = new FakeClient([{ data: [entrada], error: null }]);

    const historial = await new TaskService(client.asSupabase()).history(ORG, TASK);

    expect(historial).toEqual([
      {
        id: 7,
        action: "update",
        actorId: USER,
        actorLabel: "Julio Terán",
        changes: { title: ["Diseñar arte", "Diseñar arte pedido #142"] },
        occurredAt: "2026-09-07T11:00:00Z",
      },
    ]);
  });

  it("para quien no puede leer la bitácora devuelve vacío, no un error", async () => {
    // RLS reserva `activity_log` al dueño: el ayudante recibe cero filas.
    const client = new FakeClient([{ data: [], error: null }]);

    expect(await new TaskService(client.asSupabase()).history(ORG, TASK)).toEqual([]);
  });

  it("un fallo de lectura se cuenta con su motivo", async () => {
    const client = new FakeClient([
      { data: null, error: { message: "sin conexión" } },
    ]);

    await expect(
      new TaskService(client.asSupabase()).history(ORG, TASK),
    ).rejects.toThrow(/No se pudo cargar el historial/);
  });
});
