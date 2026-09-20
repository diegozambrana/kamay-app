import { describe, expect, it } from "vitest";

import { emptyRow, fromDraft, issuesByPath, toDraft, type DraftRow } from "@/features/tools/config-draft";
import { describeSchema } from "@/tools/describe-schema";
import { configSchema } from "@/tools/print-cost-3d/schema";

/** KAM-27 · design D7: el ida y vuelta entre lo guardado y lo que se ve en el formulario. */
const fields = describeSchema(configSchema);
const defaults = configSchema.parse({}) as Record<string, unknown>;

describe("toDraft", () => {
  it("los porcentajes se ven ×100, sin basura de coma flotante", () => {
    const draft = toDraft(fields, defaults);
    expect(draft.colorSurcharge).toBe("15");
    expect(draft.filamentPricePerKg).toBe("175");
    expect(draft.machineCostPerHour).toBe("2.75");
    expect(draft.rounding).toBe("unit");

    const curve = draft.marginCurve as DraftRow[];
    // 1,57 × 100 = 157,00000000000003 en coma flotante.
    expect(curve.map((row) => row.values.margin)).toEqual(["250", "175", "157", "150"]);
    expect(curve.map((row) => row.values.cost)).toEqual(["10", "50", "70", "80"]);
  });

  it("lo que falta o no es del tipo esperado queda vacío, no rompe", () => {
    const draft = toDraft(fields, { filamentPricePerKg: "caro", extras: "no es una lista" });
    expect(draft.filamentPricePerKg).toBe("");
    expect(draft.extras).toEqual([]);
    expect(draft.rounding).toBe("");
  });
});

describe("fromDraft", () => {
  it("ida y vuelta: lo guardado vuelve idéntico", () => {
    expect(fromDraft(fields, toDraft(fields, defaults))).toEqual(defaults);
  });

  it("acepta la coma decimal y convierte el porcentaje a fracción", () => {
    const draft = toDraft(fields, defaults);
    draft.machineCostPerHour = "3,5";
    draft.failureRate = "20";
    const config = fromDraft(fields, draft);
    expect(config.machineCostPerHour).toBe(3.5);
    expect(config.failureRate).toBe(0.2);
  });

  it("un número vacío o ilegible llega como NaN, y el esquema lo rechaza en su campo", () => {
    const draft = toDraft(fields, defaults);
    draft.filamentPricePerKg = "";
    const parsed = configSchema.safeParse(fromDraft(fields, draft));
    expect(parsed.success).toBe(false);
    expect(issuesByPath(parsed.error!.issues)).toHaveProperty("filamentPricePerKg");
  });

  it("las filas nuevas entran y las quitadas salen", () => {
    const draft = toDraft(fields, defaults);
    const extras = fields.find((field) => field.name === "extras");
    const row = emptyRow(extras!.type === "rows" ? extras!.columns : []);
    row.values.name = "Llavero";
    row.values.cost = "0,5";
    draft.extras = [row];
    draft.marginCurve = (draft.marginCurve as DraftRow[]).slice(0, 1);

    const config = fromDraft(fields, draft);
    expect(config.extras).toEqual([{ name: "Llavero", cost: 0.5 }]);
    expect(config.marginCurve).toEqual([{ cost: 10, margin: 2.5 }]);
  });
});

describe("issuesByPath", () => {
  it("indexa por camino y se queda con el primer mensaje", () => {
    expect(
      issuesByPath([
        { path: ["marginCurve", 1, "margin"], message: "primero" },
        { path: ["marginCurve", 1, "margin"], message: "segundo" },
        { path: ["extras", 0, "name"], message: "otro" },
      ]),
    ).toEqual({ "marginCurve.1.margin": "primero", "extras.0.name": "otro" });
  });
});
