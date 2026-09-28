import { describe, expect, it } from "vitest";

import { FakeClient } from "@/tests/factories/supabase-fake";

import { FairSettingsService } from "./fair-settings-service";

/**
 * `fair-all-lines` · La bandera «Venta rápida con todas las líneas» en
 * `organizations.settings`. Escenarios del delta `org-configuration`: «Off by
 * default» y «Other settings are preserved».
 */

const ORG = "11111111-1111-1111-1111-111111111111";

describe("FairSettingsService.get", () => {
  it("Off by default: una organización sin la llave la lee apagada", async () => {
    const client = new FakeClient([{ data: { settings: {} }, error: null }]);

    const settings = await new FairSettingsService(client.asSupabase()).get(ORG);

    expect(settings).toEqual({ allLines: false });
    expect(client.tables[0]).toBe("organizations");
    expect(client.queries[0].has("eq", "id", ORG)).toBe(true);
  });

  it("lee la bandera guardada", async () => {
    const client = new FakeClient([
      { data: { settings: { fair: { all_lines: true } } }, error: null },
    ]);

    expect(await new FairSettingsService(client.asSupabase()).get(ORG)).toEqual({
      allLines: true,
    });
  });

  it("una forma que no se reconoce se lee apagada, sin fallar", async () => {
    const client = new FakeClient([
      { data: { settings: { fair: { all_lines: "sí" } } }, error: null },
    ]);

    expect(await new FairSettingsService(client.asSupabase()).get(ORG)).toEqual({
      allLines: false,
    });
  });
});

describe("FairSettingsService.save", () => {
  it("guarda la bandera dentro de settings.fair", async () => {
    const client = new FakeClient([
      { data: { settings: {} }, error: null },
      { data: null, error: null },
    ]);

    await new FairSettingsService(client.asSupabase()).save(ORG, { allLines: true });

    const update = client.queries[1].argsOf("update")?.[0] as {
      settings: Record<string, unknown>;
    };
    expect(update.settings.fair).toEqual({ all_lines: true });
    expect(client.queries[1].has("eq", "id", ORG)).toBe(true);
  });

  it("Other settings are preserved: fusiona en settings en vez de reemplazarlo", async () => {
    const client = new FakeClient([
      {
        data: {
          settings: {
            allocation: { rule: "equal" },
            retention: { days: 90 },
            ai_writing_assist: { enabled: true },
            fair: { all_lines: false, otra: 1 },
          },
        },
        error: null,
      },
      { data: null, error: null },
    ]);

    await new FairSettingsService(client.asSupabase()).save(ORG, { allLines: true });

    const update = client.queries[1].argsOf("update")?.[0] as {
      settings: Record<string, unknown>;
    };
    expect(update.settings.allocation).toEqual({ rule: "equal" });
    expect(update.settings.retention).toEqual({ days: 90 });
    expect(update.settings.ai_writing_assist).toEqual({ enabled: true });
    expect(update.settings.fair).toEqual({ all_lines: true, otra: 1 });
  });
});
