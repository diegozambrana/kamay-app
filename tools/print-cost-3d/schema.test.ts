import { describe, expect, it } from "vitest";

import { DEFAULT_MARGIN_CURVE, configSchema, readConfig } from "@/tools/print-cost-3d/schema";

/** KAM-27 · spec `print-cost-3d` → *Parámetros del taller*. */
describe("configSchema", () => {
  it("recién activada: sin nada guardado, valen los valores por defecto", () => {
    expect(readConfig({})).toEqual({
      filamentPricePerKg: 175,
      machineCostPerHour: 2.75,
      colorSurcharge: 0.15,
      assemblyCost: 0.5,
      extras: [],
      failureRate: 0,
      marginCurve: DEFAULT_MARGIN_CURVE,
      wholesaleRatio: 0.8,
      dozenDiscount: 0.05,
      rounding: "unit",
    });
    expect(readConfig(null)).toEqual(readConfig({}));
  });

  it("parámetros guardados sin un campo nuevo: el que falta toma su valor por defecto", () => {
    const stored = { filamentPricePerKg: 190, extras: [{ name: "Llavero", cost: 0.5 }] };
    const config = readConfig(stored);
    expect(config?.filamentPricePerKg).toBe(190);
    expect(config?.failureRate).toBe(0);
    expect(config?.extras).toEqual([{ name: "Llavero", cost: 0.5 }]);
  });

  it("parámetros inservibles: una curva inválida no se completa, se rechaza", () => {
    expect(
      readConfig({
        marginCurve: [
          { cost: 10, margin: 2.5 },
          { cost: 12, margin: 1.5 },
        ],
      }),
    ).toBeNull();
  });

  it("el error de la curva apunta al ancla y dice entre cuáles ocurre", () => {
    const parsed = configSchema.safeParse({
      marginCurve: [
        { cost: 10, margin: 2.5 },
        { cost: 12, margin: 1.5 },
      ],
    });
    expect(parsed.error?.issues[0]).toMatchObject({ path: ["marginCurve", 1, "margin"] });
    expect(parsed.error?.issues[0].message).toMatch(/Entre 10 y 12/);
  });

  it("un ancla fuera de orden marca su costo", () => {
    const parsed = configSchema.safeParse({
      marginCurve: [
        { cost: 50, margin: 2 },
        { cost: 10, margin: 1.5 },
      ],
    });
    expect(parsed.error?.issues[0]).toMatchObject({ path: ["marginCurve", 1, "cost"] });
  });

  it("un margen de 90 % no se guarda", () => {
    expect(configSchema.safeParse({ marginCurve: [{ cost: 10, margin: 0.9 }] }).success).toBe(false);
  });

  it("dos insumos con el mismo nombre no se guardan", () => {
    const parsed = configSchema.safeParse({
      extras: [
        { name: "Llavero", cost: 0.5 },
        { name: "llavero", cost: 1 },
      ],
    });
    expect(parsed.error?.issues[0]).toMatchObject({ path: ["extras", 1, "name"] });
  });

  it("tarifas negativas, insumo sin nombre y porcentajes fuera de rango se rechazan", () => {
    expect(configSchema.safeParse({ filamentPricePerKg: -1 }).success).toBe(false);
    expect(configSchema.safeParse({ extras: [{ name: "  ", cost: 1 }] }).success).toBe(false);
    expect(configSchema.safeParse({ failureRate: 1.5 }).success).toBe(false);
    expect(configSchema.safeParse({ wholesaleRatio: 0 }).success).toBe(false);
    expect(configSchema.safeParse({ wholesaleRatio: 1.2 }).success).toBe(false);
    expect(configSchema.safeParse({ dozenDiscount: 1 }).success).toBe(false);
    expect(configSchema.safeParse({ rounding: "up" }).success).toBe(false);
  });
});
