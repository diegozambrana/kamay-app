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

/**
 * KAM-17 · Mis pendientes.
 *
 * Escenarios del delta spec `my-tasks` — requisito "Cada quien ve sus
 * pendientes según su rol": «El ayudante ve lo suyo» y «El dueño lo ve todo»
 * se verifican de verdad contra las políticas en
 * `supabase/tests/task_access.test.sql`; lo que se comprueba aquí es que la
 * consulta **no** reimplemente ese recorte por su cuenta ni deje escapar lo
 * cerrado o lo archivado.
 */
describe("TaskService.listPending", () => {
  it("pide solo lo abierto y vigente de esa organización", async () => {
    const client = new FakeClient([{ data: [], error: null }]);

    await new TaskService(client.asSupabase()).listPending(ORG);

    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);
    expect(client.queries[0].has("is", "archived_at", null)).toBe(true);
    expect(client.queries[0].has("is", "closed_at", null)).toBe(true);
  });

  it("no filtra por línea: V20 ignora el selector a propósito", async () => {
    const client = new FakeClient([{ data: [], error: null }]);

    await new TaskService(client.asSupabase()).listPending(ORG);

    const filtered = client.queries[0].calls.filter(
      (call) => call.method === "eq" && call.args[0] === "business_line_id",
    );
    expect(filtered).toEqual([]);
  });

  it("no reimplementa el alcance del rol: eso lo hace la RLS", async () => {
    // Repetir aquí «su línea o lo asignado a él» crearía un segundo sitio
    // donde equivocarse, y una consulta directa dejaría de coincidir con la
    // pantalla.
    const client = new FakeClient([{ data: [], error: null }]);

    await new TaskService(client.asSupabase()).listPending(ORG);

    const byAssignee = client.queries[0].calls.filter(
      (call) => call.method === "eq" && call.args[0] === "assignee_id",
    );
    expect(byAssignee).toEqual([]);
  });

  it("ordena por fecha límite y deja las sin fecha al final", async () => {
    const client = new FakeClient([{ data: [], error: null }]);

    await new TaskService(client.asSupabase()).listPending(ORG);

    expect(client.queries[0].argsOf("order")).toEqual([
      "due_at",
      { ascending: true, nullsFirst: false },
    ]);
  });

  it("traduce las filas como el resto del servicio", async () => {
    const client = new FakeClient([{ data: [row], error: null }]);

    const tasks = await new TaskService(client.asSupabase()).listPending(ORG);

    expect(tasks[0].id).toBe(TASK);
    expect(tasks[0].dueAt).toBe("2026-09-20T00:00:00Z");
  });

  it("un error se propaga con un mensaje comprensible", async () => {
    const client = new FakeClient([
      { data: null, error: { message: "sin conexión" } },
    ]);

    await expect(
      new TaskService(client.asSupabase()).listPending(ORG),
    ).rejects.toThrow(/No se pudieron cargar los pendientes/);
  });
});

/**
 * KAM-21 · Vínculos resueltos, buscador único y tareas relacionadas.
 *
 * Escenarios del delta spec `task-links-deliverables`:
 * - "El vínculo refleja el estado actual del registro, nunca una copia" → «El
 *   estado del pedido cambia después de vincularlo», «El nombre del registro
 *   cambia después de vincularlo», «El ayudante no ve el vínculo a un activo».
 * - "Los registros vinculados muestran sus tareas relacionadas" → «El ayudante
 *   solo ve lo que le corresponde» (parte de consulta).
 */
const ASSET = "77777777-7777-4777-8777-777777777777";
const ITEM = "88888888-8888-4888-8888-888888888888";

describe("TaskService.links", () => {
  it("resuelve el pedido contra su tabla, no contra una copia del vínculo", async () => {
    const client = new FakeClient([
      { data: [{ entity_type: "order", entity_id: ORDER }], error: null },
      {
        data: [
          {
            id: ORDER,
            code: 142,
            archived_at: null,
            status: { name: "En producción" },
          },
        ],
        error: null,
      },
    ]);

    const links = await new TaskService(client.asSupabase()).links(
      ORG,
      TASK,
      true,
    );

    // El estado sale de `orders`/`statuses` al leer: si el pedido cambia de
    // estado después de vincularlo, esto muestra el nuevo.
    expect(client.tables).toEqual(["task_links", "orders"]);
    expect(links).toEqual([
      {
        entityType: "order",
        entityId: ORDER,
        label: "Pedido #142",
        statusName: "En producción",
        archived: false,
      },
    ]);
  });

  it("no pide a task_links ninguna columna copiada del destino", async () => {
    const client = new FakeClient([{ data: [], error: null }]);

    await new TaskService(client.asSupabase()).links(ORG, TASK, true);

    // Tipo e identificador y nada más: si aquí apareciera `name` o `status`,
    // el vínculo estaría guardando una copia.
    expect(client.queries[0].argsOf("select")?.[0]).toBe(
      "entity_type, entity_id",
    );
  });

  it("solo devuelve los vínculos vigentes", async () => {
    const client = new FakeClient([{ data: [], error: null }]);

    await new TaskService(client.asSupabase()).links(ORG, TASK, true);

    expect(client.queries[0].has("is", "archived_at", null)).toBe(true);
  });

  it("toma el nombre actual del ítem, no el del momento del vínculo", async () => {
    const client = new FakeClient([
      { data: [{ entity_type: "item", entity_id: ITEM }], error: null },
      {
        data: [{ id: ITEM, name: "Taza para sublimación 11oz", archived_at: null }],
        error: null,
      },
    ]);

    const links = await new TaskService(client.asSupabase()).links(
      ORG,
      TASK,
      true,
    );

    expect(links[0].label).toBe("Taza para sublimación 11oz");
  });

  it("señala el destino archivado en vez de esconderlo", async () => {
    const client = new FakeClient([
      { data: [{ entity_type: "contact", entity_id: "c1" }], error: null },
      {
        data: [{ id: "c1", name: "Ana Quispe", archived_at: "2026-09-01T00:00:00Z" }],
        error: null,
      },
    ]);

    const links = await new TaskService(client.asSupabase()).links(
      ORG,
      TASK,
      true,
    );

    expect(links).toHaveLength(1);
    expect(links[0].archived).toBe(true);
  });

  // «El ayudante no ve el vínculo a un activo»
  it("omite el activo para quien no es dueño, sin dejar hueco", async () => {
    const client = new FakeClient([
      {
        data: [
          { entity_type: "asset", entity_id: ASSET },
          { entity_type: "order", entity_id: ORDER },
        ],
        error: null,
      },
      {
        data: [{ id: ORDER, code: 7, archived_at: null, status: { name: "En cola" } }],
        error: null,
      },
    ]);

    const links = await new TaskService(client.asSupabase()).links(
      ORG,
      TASK,
      false,
    );

    // Ni siquiera se consulta `items` por el activo: no hay nada que rotular.
    expect(client.tables).toEqual(["task_links", "orders"]);
    expect(links.map((l) => l.entityType)).toEqual(["order"]);
  });

  it("la persona dueña sí ve el activo", async () => {
    const client = new FakeClient([
      { data: [{ entity_type: "asset", entity_id: ASSET }], error: null },
      { data: [{ id: ASSET, name: "Impresora 3D", archived_at: null }], error: null },
    ]);

    const links = await new TaskService(client.asSupabase()).links(
      ORG,
      TASK,
      true,
    );

    expect(links.map((l) => l.entityType)).toEqual(["asset"]);
    expect(links[0].label).toBe("Impresora 3D");
  });

  it("una consulta por tipo, no una por vínculo", async () => {
    const client = new FakeClient([
      {
        data: [
          { entity_type: "item", entity_id: "i1" },
          { entity_type: "item", entity_id: "i2" },
          { entity_type: "item", entity_id: "i3" },
        ],
        error: null,
      },
      {
        data: [
          { id: "i1", name: "Uno", archived_at: null },
          { id: "i2", name: "Dos", archived_at: null },
          { id: "i3", name: "Tres", archived_at: null },
        ],
        error: null,
      },
    ]);

    await new TaskService(client.asSupabase()).links(ORG, TASK, true);

    expect(client.tables).toEqual(["task_links", "items"]);
  });
});

describe("TaskService.unlink", () => {
  it("archiva la fila en vez de borrarla", async () => {
    const client = new FakeClient([{ data: null, error: null }]);

    await new TaskService(client.asSupabase()).unlink(ORG, TASK, "order", ORDER);

    const update = client.queries[0].argsOf("update")?.[0] as Record<string, unknown>;
    expect(update).toHaveProperty("archived_at");
    expect(client.queries[0].calls.map((c) => c.method)).not.toContain("delete");
  });
});

describe("TaskService.searchLinkTargets", () => {
  it("un término vacío no consulta nada", async () => {
    const client = new FakeClient([]);

    expect(
      await new TaskService(client.asSupabase()).searchLinkTargets(ORG, "  ", true),
    ).toEqual([]);
    expect(client.tables).toEqual([]);
  });

  it("no ofrece activos a quien no es dueño", async () => {
    const client = new FakeClient([
      { data: [], error: null },
      { data: [], error: null },
      {
        data: [
          { id: ASSET, name: "Impresora 3D", kind: "asset" },
          { id: ITEM, name: "Impresión de prueba", kind: "product" },
        ],
        error: null,
      },
      { data: [], error: null },
    ]);

    const found = await new TaskService(client.asSupabase()).searchLinkTargets(
      ORG,
      "impres",
      false,
    );

    expect(found.map((f) => f.entityType)).toEqual(["item"]);
  });

  it("ofrece el activo como activo a la persona dueña", async () => {
    const client = new FakeClient([
      { data: [], error: null },
      { data: [], error: null },
      { data: [{ id: ASSET, name: "Impresora 3D", kind: "asset" }], error: null },
      { data: [], error: null },
    ]);

    const found = await new TaskService(client.asSupabase()).searchLinkTargets(
      ORG,
      "impres",
      true,
    );

    expect(found).toEqual([
      { entityType: "asset", entityId: ASSET, label: "Impresora 3D", hint: "Activo" },
    ]);
  });

  it("no ofrece registros archivados", async () => {
    const client = new FakeClient([]);

    await new TaskService(client.asSupabase()).searchLinkTargets(ORG, "taza", true);

    for (const query of client.queries) {
      expect(query.has("is", "archived_at", null)).toBe(true);
    }
  });
});

describe("TaskService.relatedTasks", () => {
  it("una sola consulta, y el filtro de rol lo hace RLS", async () => {
    const client = new FakeClient([
      {
        data: [
          {
            task: {
              id: TASK,
              title: "Diseñar arte",
              due_at: "2026-09-20T00:00:00Z",
              closed_at: null,
              archived_at: null,
              status: { name: "En curso" },
            },
          },
        ],
        error: null,
      },
    ]);

    const tasks = await new TaskService(client.asSupabase()).relatedTasks(
      ORG,
      "order",
      ORDER,
    );

    expect(client.tables).toEqual(["task_links"]);
    expect(tasks).toEqual([
      {
        id: TASK,
        title: "Diseñar arte",
        statusName: "En curso",
        dueAt: "2026-09-20T00:00:00Z",
        closedAt: null,
      },
    ]);
  });

  // «El ayudante solo ve lo que le corresponde»: RLS devuelve la fila del
  // vínculo sin su tarea cuando esa tarea no está a su alcance.
  it("descarta el vínculo cuya tarea no está a la vista", async () => {
    const client = new FakeClient([
      { data: [{ task: null }], error: null },
    ]);

    expect(
      await new TaskService(client.asSupabase()).relatedTasks(ORG, "item", ITEM),
    ).toEqual([]);
  });

  it("no lista tareas archivadas", async () => {
    const client = new FakeClient([
      {
        data: [
          {
            task: {
              id: TASK,
              title: "Vieja",
              due_at: null,
              closed_at: null,
              archived_at: "2026-08-01T00:00:00Z",
              status: null,
            },
          },
        ],
        error: null,
      },
    ]);

    expect(
      await new TaskService(client.asSupabase()).relatedTasks(ORG, "item", ITEM),
    ).toEqual([]);
  });
});
