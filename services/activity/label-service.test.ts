import { describe, expect, it } from "vitest";

import { FakeClient } from "@/tests/factories/supabase-fake";

import { LabelService, hasLabel, resolveSearch } from "./label-service";

const ORG = "11111111-1111-1111-1111-111111111111";
const STATUS = "aaaaaaaa-0000-0000-0000-000000000001";
const USER = "bbbbbbbb-0000-0000-0000-000000000001";

/**
 * KAM-22 · Los rótulos se resuelven en lote (design D4).
 *
 * Lo que se comprueba no es que traduzca —eso es trivial— sino **cuántas
 * consultas hace**: una por tabla distinta y no una por evento, porque una
 * página son cincuenta eventos y de uno en uno serían cincuenta viajes para
 * pintar una lista.
 */
describe("LabelService.forRecords", () => {
  it("una consulta por tabla distinta, no una por evento", async () => {
    const client = new FakeClient([
      { data: [{ id: "o1", code: 142 }, { id: "o2", code: 138 }], error: null },
      { data: [{ id: "t1", title: "Primera quema" }], error: null },
    ]);

    const labels = await new LabelService(client.asSupabase()).forRecords(ORG, [
      { tableName: "orders", recordId: "o1" },
      { tableName: "orders", recordId: "o2" },
      { tableName: "tasks", recordId: "t1" },
      { tableName: "orders", recordId: "o1" },
    ]);

    expect(client.tables.sort()).toEqual(["orders", "tasks"]);
    expect(labels.get("o1")).toBe("#142");
    expect(labels.get("t1")).toBe("Primera quema");
  });

  it("filtra por organización explícitamente aunque RLS ya lo haga", async () => {
    const client = new FakeClient([{ data: [], error: null }]);
    await new LabelService(client.asSupabase()).forRecords(ORG, [
      { tableName: "orders", recordId: "o1" },
    ]);

    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);
    expect(client.queries[0].has("in", "id", ["o1"])).toBe(true);
  });

  it("una tabla sin rótulo humano no se consulta siquiera", async () => {
    const client = new FakeClient([{ data: [], error: null }]);
    const labels = await new LabelService(client.asSupabase()).forRecords(ORG, [
      { tableName: "order_items", recordId: "li1" },
      { tableName: "inventory_movements", recordId: "m1" },
    ]);

    expect(client.tables).toEqual([]);
    expect(labels.size).toBe(0);
    expect(hasLabel("order_items")).toBe(false);
    expect(hasLabel("orders")).toBe(true);
  });

  // `organizations` no tiene `organization_id`: su clave **es** la
  // organización. Filtrarla por la columna genérica devolvía «column
  // organizations.organization_id does not exist», y bastaba con que una
  // página de la bitácora trajera el alta de la propia organización para que
  // la pantalla entera respondiera un 500.
  it("la organización se acota por su propia clave, no por organization_id", async () => {
    const client = new FakeClient([
      { data: [{ id: ORG, name: "Geeko Store" }], error: null },
    ]);

    const labels = await new LabelService(client.asSupabase()).forRecords(ORG, [
      { tableName: "organizations", recordId: ORG },
    ]);

    expect(client.queries[0].has("eq", "id", ORG)).toBe(true);
    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(false);
    expect(labels.get(ORG)).toBe("Geeko Store");
  });

  it("un registro que no vuelve de la consulta se cuenta sin rótulo", async () => {
    // Otra organización, o archivado y fuera del alcance: RLS no lo devuelve.
    const client = new FakeClient([{ data: [], error: null }]);
    const labels = await new LabelService(client.asSupabase()).forRecords(ORG, [
      { tableName: "orders", recordId: "ajeno" },
    ]);

    expect(labels.get("ajeno")).toBeUndefined();
  });

  it("sin eventos no consulta nada", async () => {
    const client = new FakeClient([]);
    expect((await new LabelService(client.asSupabase()).forRecords(ORG, [])).size).toBe(0);
    expect(client.tables).toEqual([]);
  });

  it("explica el fallo nombrando la tabla", async () => {
    const client = new FakeClient([{ data: null, error: { message: "boom" } }]);

    await expect(
      new LabelService(client.asSupabase()).forRecords(ORG, [
        { tableName: "orders", recordId: "o1" },
      ]),
    ).rejects.toThrow("No se pudieron cargar los rótulos de orders: boom");
  });
});

describe("LabelService.forDetails", () => {
  it("resuelve las referencias del detalle y las personas por separado", async () => {
    const client = new FakeClient([
      { data: [{ id: STATUS, name: "En cola" }], error: null },
      { data: [{ user_id: USER, display_name: "Marcela" }], error: null },
    ]);

    const names = await new LabelService(client.asSupabase()).forDetails(ORG, [
      {
        tableName: "orders",
        changes: {
          status_id: { antes: null, despues: STATUS },
          created_by: USER,
        },
      },
    ]);

    expect(client.tables.sort()).toEqual(["memberships", "statuses"]);
    expect(names.get(STATUS)).toBe("En cola");
    expect(names.get(USER)).toBe("Marcela");
  });

  it("las personas se piden por su identificador de usuario", async () => {
    const client = new FakeClient([{ data: [], error: null }]);
    await new LabelService(client.asSupabase()).people(ORG, [USER]);

    expect(client.tables[0]).toBe("memberships");
    expect(client.queries[0].has("in", "user_id", [USER])).toBe(true);
    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);
  });

  it("un detalle purgado no pide resolver nada", async () => {
    const client = new FakeClient([]);
    const names = await new LabelService(client.asSupabase()).forDetails(ORG, [
      { tableName: "orders", changes: null },
    ]);

    expect(names.size).toBe(0);
    expect(client.tables).toEqual([]);
  });
});

/**
 * KAM-22 · La búsqueda por identificador del registro.
 *
 * Escenarios de `activity-screen` § La búsqueda encuentra los eventos de un
 * registro por su identificador → «Buscar por el número del pedido», «Buscar
 * por identificador interno», «Una búsqueda sin correspondencia».
 */
describe("resolveSearch", () => {
  const UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

  it("sin búsqueda no acota nada y no consulta", async () => {
    const client = new FakeClient([]);

    expect(await resolveSearch(client.asSupabase(), ORG, "")).toBeUndefined();
    expect(await resolveSearch(client.asSupabase(), ORG, "   ")).toBeUndefined();
    expect(client.tables).toEqual([]);
  });

  // Scenario: Buscar por identificador interno
  it("un identificador interno se usa tal cual, sin consultar", async () => {
    const client = new FakeClient([]);

    expect(await resolveSearch(client.asSupabase(), ORG, UUID)).toBe(UUID);
    expect(await resolveSearch(client.asSupabase(), ORG, ` ${UUID.toUpperCase()} `))
      .toBe(UUID.toUpperCase());
    expect(client.tables).toEqual([]);
  });

  // Scenario: Buscar por el número del pedido
  it("un número se resuelve al pedido que lo lleva", async () => {
    const client = new FakeClient([{ data: { id: "order-9" }, error: null }]);

    expect(await resolveSearch(client.asSupabase(), ORG, "142")).toBe("order-9");
    expect(client.tables[0]).toBe("orders");
    expect(client.queries[0].has("eq", "code", 142)).toBe(true);
    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);
  });

  it("acepta la almohadilla con la que el pedido se muestra", async () => {
    const client = new FakeClient([{ data: { id: "order-9" }, error: null }]);

    expect(await resolveSearch(client.asSupabase(), ORG, "#142")).toBe("order-9");
    expect(client.queries[0].has("eq", "code", 142)).toBe(true);
  });

  // Scenario: Una búsqueda sin correspondencia
  //
  // `null` y no un error: es una dirección que pide algo que no existe, y lo
  // correcto es el estado «ningún resultado».
  it("un número que no es de ningún pedido no corresponde a nada", async () => {
    const client = new FakeClient([{ data: null, error: null }]);

    expect(await resolveSearch(client.asSupabase(), ORG, "999999")).toBeNull();
  });

  it("un texto que no es ni número ni identificador tampoco", async () => {
    const client = new FakeClient([]);

    expect(await resolveSearch(client.asSupabase(), ORG, "taza mágica")).toBeNull();
    // No se busca dentro de `changes`: el coste dependería del contenido del
    // jsonb y pondría el criterio de los 2 segundos a merced del dato.
    expect(client.tables).toEqual([]);
  });

  it("un número imposible no llega a consultar", async () => {
    const client = new FakeClient([]);

    expect(await resolveSearch(client.asSupabase(), ORG, "0")).toBeNull();
    expect(await resolveSearch(client.asSupabase(), ORG, "-5")).toBeNull();
    expect(await resolveSearch(client.asSupabase(), ORG, "1.5")).toBeNull();
    expect(client.tables).toEqual([]);
  });

  it("explica el fallo en vez de propagar el de Supabase", async () => {
    const client = new FakeClient([{ data: null, error: { message: "boom" } }]);

    await expect(
      resolveSearch(client.asSupabase(), ORG, "142"),
    ).rejects.toThrow("No se pudo resolver la búsqueda: boom");
  });
});
