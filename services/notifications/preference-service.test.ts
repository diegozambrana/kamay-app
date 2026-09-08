import { describe, expect, it } from "vitest";

import { DEFAULT_PREFERENCES } from "@/lib/notifications/defaults";
import { FakeClient } from "@/tests/factories/supabase-fake";

import { PreferenceService } from "./preference-service";

const ORG = "11111111-1111-4111-8111-111111111111";
const ANA = "44444444-4444-4444-8444-444444444444";
const BRUNO = "55555555-5555-4555-8555-555555555555";

describe("PreferenceService.forUser", () => {
  it("sin fila guardada devuelve los valores por omisión", async () => {
    // El caso normal, no un error: nadie siembra estas filas al invitar.
    const client = new FakeClient([{ data: null, error: null }]);

    const preferences = await new PreferenceService(
      client.asSupabase(),
    ).forUser(ORG, ANA);

    expect(preferences).toEqual(DEFAULT_PREFERENCES);
  });

  it("con fila guardada devuelve lo guardado", async () => {
    const client = new FakeClient([
      {
        data: {
          user_id: ANA,
          due_summary: true,
          task_assigned: false,
          task_review: true,
          task_overdue: true,
          task_stalled: true,
          stock_below_min: true,
          daily_summary_hour: 18,
          email_enabled: false,
        },
        error: null,
      },
    ]);

    const preferences = await new PreferenceService(
      client.asSupabase(),
    ).forUser(ORG, ANA);

    expect(preferences.task_assigned).toBe(false);
    expect(preferences.dailySummaryHour).toBe(18);
    expect(preferences.emailEnabled).toBe(false);
  });

  it("pide solo las de esa persona en esa organización", async () => {
    const client = new FakeClient([{ data: null, error: null }]);

    await new PreferenceService(client.asSupabase()).forUser(ORG, ANA);

    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);
    expect(client.queries[0].has("eq", "user_id", ANA)).toBe(true);
  });
});

describe("PreferenceService.forOrganization", () => {
  it("incluye a quien no tiene fila, con los valores por omisión", async () => {
    // Quien nunca abrió la sección también recibe avisos: dejarlo fuera del
    // mapa lo dejaría sin resumen para siempre.
    const client = new FakeClient([
      {
        data: [
          {
            user_id: ANA,
            due_summary: false,
            task_assigned: true,
            task_review: true,
            task_overdue: true,
            task_stalled: true,
            stock_below_min: true,
            daily_summary_hour: 9,
            email_enabled: true,
          },
        ],
        error: null,
      },
    ]);

    const preferences = await new PreferenceService(
      client.asSupabase(),
    ).forOrganization(ORG, [ANA, BRUNO]);

    expect(preferences.get(ANA)?.due_summary).toBe(false);
    expect(preferences.get(ANA)?.dailySummaryHour).toBe(9);
    expect(preferences.get(BRUNO)).toEqual(DEFAULT_PREFERENCES);
  });

  it("sin ninguna fila devuelve la omisión para todos", async () => {
    const client = new FakeClient([{ data: [], error: null }]);

    const preferences = await new PreferenceService(
      client.asSupabase(),
    ).forOrganization(ORG, [ANA, BRUNO]);

    expect(preferences.size).toBe(2);
    expect(preferences.get(ANA)).toEqual(DEFAULT_PREFERENCES);
  });
});

describe("PreferenceService.save", () => {
  it("guarda con upsert sobre la pareja organización y persona", async () => {
    const client = new FakeClient([{ data: null, error: null }]);

    await new PreferenceService(client.asSupabase()).save(ORG, ANA, {
      ...DEFAULT_PREFERENCES,
      task_stalled: false,
      dailySummaryHour: 20,
    });

    const [payload, options] = client.queries[0].argsOf("upsert") as [
      Record<string, unknown>,
      { onConflict: string },
    ];
    expect(payload.organization_id).toBe(ORG);
    expect(payload.user_id).toBe(ANA);
    expect(payload.task_stalled).toBe(false);
    expect(payload.daily_summary_hour).toBe(20);
    expect(payload.updated_at).toBeTruthy();
    expect(options.onConflict).toBe("organization_id,user_id");
  });

  it("un error al guardar se propaga con un mensaje comprensible", async () => {
    const client = new FakeClient([
      { data: null, error: { message: "permiso denegado" } },
    ]);

    await expect(
      new PreferenceService(client.asSupabase()).save(
        ORG,
        ANA,
        DEFAULT_PREFERENCES,
      ),
    ).rejects.toThrow(/No se pudieron guardar las preferencias/);
  });
});
