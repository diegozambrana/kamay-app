import { describe, expect, it } from "vitest";

import {
  DEFAULT_RETENTION_MONTHS,
  RETENTION_KEY,
  readRetentionMonths,
  retentionCutoff,
  retentionLabel,
  retentionMonthsSchema,
} from "@/lib/activity/retention";

/**
 * KAM-22 · La política de retención (design D9).
 *
 * Escenarios de `activity-retention` § La retención es una política de la
 * organización → «Sin configurar, doce meses», «Un plazo inválido se rechaza».
 */
describe("readRetentionMonths", () => {
  // Escenario: Sin configurar, doce meses
  it("sin la clave, doce meses", () => {
    expect(readRetentionMonths(null)).toBe(12);
    expect(readRetentionMonths({})).toBe(12);
    expect(readRetentionMonths({ allocation: { mode: "equal" } })).toBe(12);
    expect(DEFAULT_RETENTION_MONTHS).toBe(12);
  });

  it("con la clave, el plazo guardado", () => {
    expect(readRetentionMonths({ [RETENTION_KEY]: { months: 24 } })).toBe(24);
  });

  // Una configuración corrupta no es motivo para dejar de retener: la
  // pantalla tiene que poder decir un plazo siempre.
  it("una clave a medias o imposible cae al defecto", () => {
    expect(readRetentionMonths({ [RETENTION_KEY]: {} })).toBe(12);
    expect(readRetentionMonths({ [RETENTION_KEY]: { months: 0 } })).toBe(12);
    expect(readRetentionMonths({ [RETENTION_KEY]: { months: -3 } })).toBe(12);
    expect(readRetentionMonths({ [RETENTION_KEY]: { months: "doce" } })).toBe(12);
    expect(readRetentionMonths({ [RETENTION_KEY]: "24" })).toBe(12);
    expect(readRetentionMonths("no es un objeto")).toBe(12);
  });
});

describe("retentionMonthsSchema", () => {
  // Escenario: Un plazo inválido se rechaza
  it("rechaza el cero, que sería apagar la bitácora por la puerta de atrás", () => {
    expect(retentionMonthsSchema.safeParse(0).success).toBe(false);
  });

  it("rechaza lo negativo, lo fraccionario y lo que no es número", () => {
    expect(retentionMonthsSchema.safeParse(-1).success).toBe(false);
    expect(retentionMonthsSchema.safeParse(1.5).success).toBe(false);
    expect(retentionMonthsSchema.safeParse("12").success).toBe(false);
  });

  it("acepta desde un mes y pone un techo al cero de más al teclear", () => {
    expect(retentionMonthsSchema.safeParse(1).success).toBe(true);
    expect(retentionMonthsSchema.safeParse(120).success).toBe(true);
    expect(retentionMonthsSchema.safeParse(1200).success).toBe(false);
  });

  it("el mensaje es comprensible, no un error de esquema", () => {
    const result = retentionMonthsSchema.safeParse(0);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("al menos un mes");
    }
  });
});

describe("retentionCutoff", () => {
  // Meses y no días: «doce meses» es la misma fecha del año pasado, y la
  // diferencia importa el 29 de febrero.
  it("resta meses, no 365 días", () => {
    const cutoff = retentionCutoff(12, new Date("2026-08-19T10:00:00.000Z"));
    expect(cutoff.slice(0, 10)).toBe("2025-08-19");
  });

  it("un plazo largo cruza años sin despeinarse", () => {
    const cutoff = retentionCutoff(24, new Date("2026-03-15T00:00:00.000Z"));
    expect(cutoff.slice(0, 10)).toBe("2024-03-15");
  });
});

describe("retentionLabel", () => {
  it("concuerda el singular", () => {
    expect(retentionLabel(1)).toBe("1 mes");
    expect(retentionLabel(12)).toBe("12 meses");
  });
});
