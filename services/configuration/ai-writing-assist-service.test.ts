import { describe, expect, it } from "vitest";

import { FakeClient } from "@/tests/factories/supabase-fake";

import { AiWritingAssistService } from "./ai-writing-assist-service";

const ORG = "11111111-1111-1111-1111-111111111111";

describe("AiWritingAssistService.get", () => {
  it("una organización sin llave declarada la lee apagada", async () => {
    const client = new FakeClient([{ data: { settings: {} }, error: null }]);

    const settings = await new AiWritingAssistService(client.asSupabase()).get(ORG);

    expect(settings).toEqual({ enabled: false });
    expect(client.tables[0]).toBe("organizations");
    expect(client.queries[0].has("eq", "id", ORG)).toBe(true);
  });

  it("lee el interruptor guardado", async () => {
    const client = new FakeClient([
      { data: { settings: { ai_writing_assist: { enabled: true } } }, error: null },
    ]);

    const settings = await new AiWritingAssistService(client.asSupabase()).get(ORG);

    expect(settings).toEqual({ enabled: true });
  });

  it("una configuración corrupta no deja la pantalla sin ofrecer la sección", async () => {
    const client = new FakeClient([
      { data: { settings: { ai_writing_assist: { enabled: "sí" } } }, error: null },
    ]);

    const settings = await new AiWritingAssistService(client.asSupabase()).get(ORG);

    expect(settings).toEqual({ enabled: false });
  });
});

describe("AiWritingAssistService.save", () => {
  it("guarda el interruptor dentro de settings", async () => {
    const client = new FakeClient([
      { data: { settings: {} }, error: null },
      { data: null, error: null },
    ]);

    await new AiWritingAssistService(client.asSupabase()).save(ORG, { enabled: true });

    const update = client.queries[1].argsOf("update")?.[0] as {
      settings: Record<string, unknown>;
    };
    expect(update.settings.ai_writing_assist).toEqual({ enabled: true });
    expect(client.queries[1].has("eq", "id", ORG)).toBe(true);
  });

  // El `jsonb` es compartido con la regla de reparto y la retención: relee y
  // esparce en vez de reemplazar, o el guardado de al lado desaparecería.
  it("fusiona en settings en vez de reemplazarlo", async () => {
    const client = new FakeClient([
      {
        data: { settings: { allocation: { rule: "equal" }, retention: { days: 90 } } },
        error: null,
      },
      { data: null, error: null },
    ]);

    await new AiWritingAssistService(client.asSupabase()).save(ORG, { enabled: true });

    const update = client.queries[1].argsOf("update")?.[0] as {
      settings: Record<string, unknown>;
    };
    expect(update.settings.allocation).toEqual({ rule: "equal" });
    expect(update.settings.retention).toEqual({ days: 90 });
    expect(update.settings.ai_writing_assist).toEqual({ enabled: true });
  });

  it("rechaza un valor que no es booleano, sin escribir nada", async () => {
    const client = new FakeClient([{ data: { settings: {} }, error: null }]);

    await expect(
      new AiWritingAssistService(client.asSupabase()).save(ORG, {
        // @ts-expect-error: es justamente lo que la validación debe rechazar.
        enabled: "sí",
      }),
    ).rejects.toThrow();

    expect(client.queries).toHaveLength(0);
  });
});
