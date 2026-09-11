import { describe, expect, it } from "vitest";

import { FakeClient } from "@/tests/factories/supabase-fake";

import { EMPTY_FILTERS } from "@/lib/activity/filters";

import { ActivityService, decodeCursor, encodeCursor } from "./activity-service";

const ORG = "11111111-1111-1111-1111-111111111111";
const LINE = "22222222-2222-2222-2222-222222222222";

const logRow = (id: number, businessLineId: string | null = LINE) => ({
  id,
  action: "status_changed",
  actor_id: "user-1",
  actor_label: null,
  changes: { status_id: "x" },
  occurred_at: "2026-02-14T10:00:00.000Z",
  table_name: "orders",
  record_id: "order-1",
  business_line_id: businessLineId,
});

describe("ActivityService.recent", () => {
  it("lee de activity_log, del más reciente al más antiguo", async () => {
    const client = new FakeClient([{ data: [], error: null }]);
    await new ActivityService(client.asSupabase()).recent(ORG);

    expect(client.tables[0]).toBe("activity_log");
    // organization_id explícito aunque RLS ya filtre (convención nº 2).
    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);
    expect(
      client.queries[0].has("order", "occurred_at", { ascending: false }),
    ).toBe(true);
    // Desempate estable: dos eventos del mismo instante no pueden bailar
    // entre recargas.
    expect(client.queries[0].has("order", "id", { ascending: false })).toBe(
      true,
    );
  });

  it("acota las filas aunque no se pida un tope", async () => {
    const client = new FakeClient([{ data: [], error: null }]);
    await new ActivityService(client.asSupabase()).recent(ORG);

    expect(client.queries[0].has("limit", 5)).toBe(true);
  });

  it("no deja que quien llama pida una lista sin techo", async () => {
    const client = new FakeClient([{ data: [], error: null }]);
    await new ActivityService(client.asSupabase()).recent(ORG, {
      limit: 100_000,
    });

    expect(client.queries[0].has("limit", 50)).toBe(true);
  });

  // Scenario: Filtrado por la línea activa
  it("el filtro de línea va a la consulta, no al resultado", async () => {
    const client = new FakeClient([{ data: [logRow(1)], error: null }]);
    await new ActivityService(client.asSupabase()).recent(ORG, {
      businessLineId: LINE,
    });

    // Recortar después de leer devolvería menos filas que el tope cuando la
    // línea activa no es la de los últimos eventos, y la lista aparecería
    // medio vacía sin que faltara nada.
    expect(client.queries[0].has("eq", "business_line_id", LINE)).toBe(true);
  });

  it("con Todas no filtra por línea", async () => {
    const client = new FakeClient([{ data: [], error: null }]);
    await new ActivityService(client.asSupabase()).recent(ORG, {
      businessLineId: null,
    });

    expect(
      client.queries[0].calls.some(
        (call) => call.method === "eq" && call.args[0] === "business_line_id",
      ),
    ).toBe(false);
  });

  it("entrega la tabla y el registro, que la redacción necesita", async () => {
    const client = new FakeClient([{ data: [logRow(9)], error: null }]);

    const [entry] = await new ActivityService(client.asSupabase()).recent(ORG);

    expect(entry).toMatchObject({
      id: 9,
      action: "status_changed",
      tableName: "orders",
      recordId: "order-1",
      businessLineId: LINE,
    });
  });

  it("el ayudante recibe una lista vacía sin ninguna comprobación de rol aquí", async () => {
    // Es lo que RLS entrega: `activity_log` solo es legible por la persona
    // dueña, así que el servicio no comprueba nada.
    const client = new FakeClient([{ data: [], error: null }]);

    const entries = await new ActivityService(client.asSupabase()).recent(ORG);

    expect(entries).toEqual([]);
  });

  it("propaga el error de la base con un mensaje entendible", async () => {
    const client = new FakeClient([{ data: null, error: { message: "boom" } }]);

    await expect(
      new ActivityService(client.asSupabase()).recent(ORG),
    ).rejects.toThrow(/bitácora/);
  });
});


const page = (ids: number[]) =>
  new FakeClient([{ data: ids.map((id) => logRow(id)), error: null }]);

/**
 * KAM-22 · La lectura filtrada y paginada de V23.
 *
 * Escenarios de `activity-log` § Recent activity is read through one bounded,
 * owner-only query, y de `activity-screen` § La pantalla nunca carga la
 * bitácora entera.
 */
describe("ActivityService.search", () => {
  // Scenario: La primera página está acotada
  it("pide una página acotada y una fila de más, sin contar el total", async () => {
    const client = page([]);
    await new ActivityService(client.asSupabase()).search(ORG, EMPTY_FILTERS, {
      timezone: "America/La_Paz",
    });

    expect(client.tables[0]).toBe("activity_log");
    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);
    expect(client.queries[0].has("limit", 51)).toBe(true);
    // Contar las filas que cumplen el filtro sobre cien mil eventos es un
    // recorrido completo: la pantalla no lo pide nunca.
    expect(
      client.queries[0].calls.some((call) =>
        JSON.stringify(call.args).includes("count"),
      ),
    ).toBe(false);
  });

  // Scenario: The cap cannot be lifted by paging
  it("el techo de página no se puede levantar desde fuera", async () => {
    const client = page([]);
    await new ActivityService(client.asSupabase()).search(ORG, EMPTY_FILTERS, {
      timezone: "UTC",
      limit: 100_000,
    });

    expect(client.queries[0].has("limit", 51)).toBe(true);
  });

  // Scenario: Narrowed by actor, action and date range
  it("los tres filtros van a la consulta y se combinan", async () => {
    const client = page([]);
    await new ActivityService(client.asSupabase()).search(
      ORG,
      {
        ...EMPTY_FILTERS,
        actor: "user-7",
        action: "archived",
        from: "2026-08-17",
        to: "2026-08-19",
      },
      { timezone: "America/La_Paz" },
    );

    const query = client.queries[0];
    expect(query.has("eq", "actor_id", "user-7")).toBe(true);
    expect(query.has("eq", "action", "archived")).toBe(true);
    expect(query.has("gte", "occurred_at", "2026-08-17T04:00:00.000Z")).toBe(true);
    // El corte superior es exclusivo y apunta al día siguiente, para que el
    // evento de las 23:50 del 19 entre.
    expect(query.has("lt", "occurred_at", "2026-08-20T04:00:00.000Z")).toBe(true);
  });

  it("el filtro de línea va a la consulta", async () => {
    const client = page([]);
    await new ActivityService(client.asSupabase()).search(
      ORG,
      { ...EMPTY_FILTERS, line: LINE },
      { timezone: "UTC" },
    );

    expect(client.queries[0].has("eq", "business_line_id", LINE)).toBe(true);
  });

  // Scenario: Narrowed to one record
  it("acota a un registro con el identificador ya resuelto", async () => {
    const client = page([]);
    await new ActivityService(client.asSupabase()).search(ORG, EMPTY_FILTERS, {
      timezone: "UTC",
      recordId: "order-9",
    });

    expect(client.queries[0].has("eq", "record_id", "order-9")).toBe(true);
  });

  it("sin filtros no añade ninguna condición de más", async () => {
    const client = page([]);
    await new ActivityService(client.asSupabase()).search(ORG, EMPTY_FILTERS, {
      timezone: "UTC",
    });

    const query = client.queries[0];
    expect(query.calls.filter((call) => call.method === "eq")).toHaveLength(1);
    expect(query.calls.some((call) => call.method === "or")).toBe(false);
  });

  // Scenario: A cursor continues exactly where the page ended
  it("el cursor pide lo estrictamente posterior en el orden de la lista", async () => {
    const client = page([]);
    await new ActivityService(client.asSupabase()).search(
      ORG,
      { ...EMPTY_FILTERS, cursor: "2026-02-14T10:00:00.000Z|91" },
      { timezone: "UTC" },
    );

    expect(
      client.queries[0].has(
        "or",
        "occurred_at.lt.2026-02-14T10:00:00.000Z,and(occurred_at.eq.2026-02-14T10:00:00.000Z,id.lt.91)",
      ),
    ).toBe(true);
    // Nunca por desplazamiento: sobre cien mil eventos obligaría al motor a
    // recorrer y descartar todo lo anterior.
    expect(client.queries[0].calls.some((c) => c.method === "range")).toBe(false);
  });

  it("devuelve el cursor de la página siguiente solo si hay una", async () => {
    const lleno = await new ActivityService(
      page(Array.from({ length: 51 }, (_, i) => 51 - i)).asSupabase(),
    ).search(ORG, EMPTY_FILTERS, { timezone: "UTC" });

    expect(lleno.entries).toHaveLength(50);
    expect(lleno.nextCursor).toBe("2026-02-14T10:00:00.000Z|2");

    const ultima = await new ActivityService(
      page([3, 2, 1]).asSupabase(),
    ).search(ORG, EMPTY_FILTERS, { timezone: "UTC" });

    expect(ultima.entries).toHaveLength(3);
    expect(ultima.nextCursor).toBeNull();
  });

  it("un cursor manipulado a mano devuelve la primera página, no un error", async () => {
    const client = page([]);
    await new ActivityService(client.asSupabase()).search(
      ORG,
      { ...EMPTY_FILTERS, cursor: "no-es-un-cursor" },
      { timezone: "UTC" },
    );

    expect(client.queries[0].calls.some((c) => c.method === "or")).toBe(false);
  });

  it("explica el fallo en lugar de propagar el de Supabase", async () => {
    const client = new FakeClient([
      { data: null, error: { message: "boom" } },
    ]);

    await expect(
      new ActivityService(client.asSupabase()).search(ORG, EMPTY_FILTERS, {
        timezone: "UTC",
      }),
    ).rejects.toThrow("No se pudo cargar la bitácora: boom");
  });
});

describe("el cursor", () => {
  it("va y vuelve", () => {
    const cursor = encodeCursor({ occurredAt: "2026-02-14T10:00:00.000Z", id: 91 });
    expect(decodeCursor(cursor)).toEqual({
      occurredAt: "2026-02-14T10:00:00.000Z",
      id: 91,
    });
  });

  it("lo que no es un cursor no lo es", () => {
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor("")).toBeNull();
    expect(decodeCursor("|91")).toBeNull();
    expect(decodeCursor("2026-02-14T10:00:00.000Z|abc")).toBeNull();
    expect(decodeCursor("ayer|91")).toBeNull();
  });
});

/**
 * El historial de un registro.
 *
 * Hasta KAM-22 esto estaba cinco veces: `OrderService.history()`,
 * `ItemService.history()`, `ExpenseService.history()`, `TaskService.history()`
 * y `AssetService.history()`, cada una con su propia consulta y su propia
 * prueba de que leía de `activity_log` y no de una tabla propia. Las cinco se
 * retiraron: la garantía de la convención nº 7 se afirma aquí, una vez.
 *
 * No era solo duplicación. `OrderService.history()` ordenaba **sin desempate
 * por `id`**, así que dos eventos del mismo instante podían salir en un orden
 * distinto al de la bitácora general — y el requisito exige «el mismo orden».
 */
describe("ActivityService.forRecord", () => {
  it("lee la misma tabla acotada a su registro, con el mismo orden", async () => {
    const client = page([]);
    await new ActivityService(client.asSupabase()).forRecord(
      ORG,
      "tasks",
      "task-1",
    );

    // Un solo historial (convención nº 7): la misma tabla que la bitácora
    // general, no una tabla de historial de tareas.
    expect(client.tables[0]).toBe("activity_log");
    const query = client.queries[0];
    expect(query.has("eq", "organization_id", ORG)).toBe(true);
    expect(query.has("eq", "table_name", "tasks")).toBe(true);
    expect(query.has("eq", "record_id", "task-1")).toBe(true);
    expect(query.has("order", "occurred_at", { ascending: false })).toBe(true);
    expect(query.has("order", "id", { ascending: false })).toBe(true);
  });

  it("tampoco deja pedir una lista sin techo", async () => {
    const client = page([]);
    await new ActivityService(client.asSupabase()).forRecord(
      ORG,
      "orders",
      "order-1",
      100_000,
    );

    expect(client.queries[0].has("limit", 50)).toBe(true);
  });
});
