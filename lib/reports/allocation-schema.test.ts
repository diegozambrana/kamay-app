import { describe, expect, it } from "vitest";

import {
  allocationSettingsSchema,
  readAllocationSettings,
} from "./allocation-schema";

describe("allocationSettingsSchema", () => {
  // Escenario «Una regla desconocida se rechaza».
  it("rechaza una regla que no es una de las tres", () => {
    const result = allocationSettingsSchema.safeParse({ rule: "por-antiguedad" });
    expect(result.success).toBe(false);
  });

  it("acepta las tres reglas conocidas", () => {
    expect(allocationSettingsSchema.safeParse({ rule: "revenue" }).success).toBe(true);
    expect(allocationSettingsSchema.safeParse({ rule: "equal" }).success).toBe(true);
    expect(
      allocationSettingsSchema.safeParse({
        rule: "manual",
        shares: { a: 50, b: 50 },
      }).success,
    ).toBe(true);
  });

  // Escenarios «Los porcentajes no suman 100» y «Manual percentages must add up».
  it("rechaza porcentajes que no suman 100 y dice cuánto falta", () => {
    const result = allocationSettingsSchema.safeParse({
      rule: "manual",
      shares: { a: 50, b: 30, c: 10 },
    });

    expect(result.success).toBe(false);
    const message = result.success ? "" : result.error.issues[0].message;
    expect(message).toContain("90");
    expect(message).toContain("10");
  });

  it("rechaza un porcentaje negativo", () => {
    const result = allocationSettingsSchema.safeParse({
      rule: "manual",
      shares: { a: 120, b: -20 },
    });
    expect(result.success).toBe(false);
  });

  it("tolera el céntimo de 33,33 × 3", () => {
    const result = allocationSettingsSchema.safeParse({
      rule: "manual",
      shares: { a: 33.33, b: 33.33, c: 33.34 },
    });
    expect(result.success).toBe(true);
  });

  it("el reparto manual sin porcentajes no pasa", () => {
    expect(allocationSettingsSchema.safeParse({ rule: "manual" }).success).toBe(
      false,
    );
  });
});

describe("readAllocationSettings", () => {
  // Escenario «Valor por defecto de una organización nueva».
  it("un settings vacío devuelve la regla por defecto", () => {
    expect(readAllocationSettings({})).toEqual({ rule: "revenue" });
    expect(readAllocationSettings(null)).toEqual({ rule: "revenue" });
  });

  it("una configuración corrupta no deja la pantalla sin informes", () => {
    expect(readAllocationSettings({ allocation: { rule: "inventada" } })).toEqual(
      { rule: "revenue" },
    );
  });

  it("lee la regla guardada", () => {
    expect(
      readAllocationSettings({
        allocation: { rule: "manual", shares: { a: 60, b: 40 } },
      }),
    ).toEqual({ rule: "manual", shares: { a: 60, b: 40 } });
  });
});
