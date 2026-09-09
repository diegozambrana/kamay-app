import { describe, expect, it } from "vitest";

import { FakeClient } from "@/tests/factories/supabase-fake";

import { AllocationRuleService } from "./allocation-rule-service";

const ORG = "11111111-1111-1111-1111-111111111111";
const SUB = "22222222-2222-2222-2222-222222222222";
const ALF = "33333333-3333-3333-3333-333333333333";

describe("AllocationRuleService.get", () => {
  // Escenario «Valor por defecto de una organización nueva».
  it("una organización sin regla declarada usa la proporcional a ingresos", async () => {
    const client = new FakeClient([{ data: { settings: {} }, error: null }]);

    const rule = await new AllocationRuleService(client.asSupabase()).get(ORG);

    expect(rule).toEqual({ rule: "revenue" });
    expect(client.tables[0]).toBe("organizations");
    expect(client.queries[0].has("eq", "id", ORG)).toBe(true);
  });

  it("lee la regla guardada", async () => {
    const client = new FakeClient([
      {
        data: {
          settings: {
            allocation: { rule: "manual", shares: { [SUB]: 60, [ALF]: 40 } },
          },
        },
        error: null,
      },
    ]);

    const rule = await new AllocationRuleService(client.asSupabase()).get(ORG);

    expect(rule).toEqual({ rule: "manual", shares: { [SUB]: 60, [ALF]: 40 } });
  });

  it("una configuración corrupta no deja la pantalla sin informes", async () => {
    const client = new FakeClient([
      { data: { settings: { allocation: { rule: "por-antiguedad" } } }, error: null },
    ]);

    const rule = await new AllocationRuleService(client.asSupabase()).get(ORG);

    expect(rule).toEqual({ rule: "revenue" });
  });
});

describe("AllocationRuleService.save", () => {
  // Escenario «Owner switches the allocation rule».
  it("guarda la regla dentro de settings", async () => {
    const client = new FakeClient([
      { data: { settings: {} }, error: null },
      { data: null, error: null },
    ]);

    await new AllocationRuleService(client.asSupabase()).save(ORG, {
      rule: "equal",
    });

    const update = client.queries[1].argsOf("update")?.[0] as {
      settings: Record<string, unknown>;
    };
    expect(update.settings.allocation).toEqual({ rule: "equal" });
    expect(client.queries[1].has("eq", "id", ORG)).toBe(true);
  });

  // El `jsonb` es compartido con la retención de la bitácora y las
  // preferencias de aviso: reemplazarlo entero borraría lo de al lado.
  it("fusiona en settings en vez de reemplazarlo", async () => {
    const client = new FakeClient([
      {
        data: { settings: { retention: { days: 90 }, notifications: { daily: true } } },
        error: null,
      },
      { data: null, error: null },
    ]);

    await new AllocationRuleService(client.asSupabase()).save(ORG, {
      rule: "revenue",
    });

    const update = client.queries[1].argsOf("update")?.[0] as {
      settings: Record<string, unknown>;
    };
    expect(update.settings.retention).toEqual({ days: 90 });
    expect(update.settings.notifications).toEqual({ daily: true });
    expect(update.settings.allocation).toEqual({ rule: "revenue" });
  });

  // Escenarios «Los porcentajes no suman 100» y «Manual percentages must add up».
  it("rechaza porcentajes que no suman 100 sin escribir nada", async () => {
    const client = new FakeClient([
      { data: { settings: {} }, error: null },
      { data: null, error: null },
    ]);

    await expect(
      new AllocationRuleService(client.asSupabase()).save(ORG, {
        rule: "manual",
        shares: { [SUB]: 50, [ALF]: 30 },
      }),
    ).rejects.toThrow();

    // Ni siquiera llegó a leer: la validación corta antes de tocar la base.
    expect(client.queries).toHaveLength(0);
  });

  // Escenario «Una regla desconocida se rechaza».
  it("rechaza una regla desconocida sin escribir nada", async () => {
    const client = new FakeClient([{ data: { settings: {} }, error: null }]);

    await expect(
      new AllocationRuleService(client.asSupabase()).save(ORG, {
        // @ts-expect-error: es justamente lo que la validación debe rechazar.
        rule: "por-antiguedad",
      }),
    ).rejects.toThrow();

    expect(client.queries).toHaveLength(0);
  });
});
