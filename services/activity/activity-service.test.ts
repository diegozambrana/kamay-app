import { describe, expect, it } from "vitest";

import { FakeClient } from "@/tests/factories/supabase-fake";

import { ActivityService } from "./activity-service";

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
