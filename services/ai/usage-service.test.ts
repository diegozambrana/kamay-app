import { describe, expect, it } from "vitest";

import { FakeClient } from "@/tests/factories/supabase-fake";

import { AiUsageService } from "./usage-service";

const ORG = "11111111-1111-1111-1111-111111111111";
const USER = "22222222-2222-2222-2222-222222222222";

describe("AiUsageService.countCurrentPeriod", () => {
  it("sin filas para el mes en curso, cuenta cero", async () => {
    const client = new FakeClient([{ data: null, error: null }]);

    const count = await new AiUsageService(client.asSupabase()).countCurrentPeriod(ORG);

    expect(count).toBe(0);
    expect(client.tables[0]).toBe("ai_writing_assist_usage_by_period");
    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);
  });

  it("lee el conteo de la vista", async () => {
    const client = new FakeClient([{ data: { request_count: 7 }, error: null }]);

    const count = await new AiUsageService(client.asSupabase()).countCurrentPeriod(ORG);

    expect(count).toBe(7);
  });

  it("un error de lectura se propaga en español", async () => {
    const client = new FakeClient([{ data: null, error: { message: "boom" } }]);

    await expect(
      new AiUsageService(client.asSupabase()).countCurrentPeriod(ORG),
    ).rejects.toThrow("No se pudo comprobar el límite de uso");
  });
});

describe("AiUsageService.recordRequest", () => {
  it("inserta una solicitud de la organización y de la persona", async () => {
    const client = new FakeClient([{ data: null, error: null }]);

    await new AiUsageService(client.asSupabase()).recordRequest(ORG, USER);

    expect(client.tables[0]).toBe("ai_writing_assist_requests");
    expect(
      client.queries[0].has("insert", { organization_id: ORG, requested_by: USER }),
    ).toBe(true);
  });

  it("un error de escritura se propaga en español", async () => {
    const client = new FakeClient([{ data: null, error: { message: "boom" } }]);

    await expect(
      new AiUsageService(client.asSupabase()).recordRequest(ORG, USER),
    ).rejects.toThrow("No se pudo registrar la solicitud");
  });
});
