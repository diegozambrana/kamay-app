import { describe, expect, it } from "vitest";

import { hasAttributableLine, recoveryOf } from "./recovery";

/**
 * Escenarios del delta spec `assets`, requisito "La fórmula de recuperación
 * vive en un solo lugar y no falla en los bordes": "Recuperación parcial", "La
 * línea todavía no genera margen", "Recuperación exacta", "Recuperación
 * superada", "Costo total cero". Y del requisito "Un activo sin línea propia
 * no muestra porcentaje", el predicado que lo decide.
 */
describe("recoveryOf", () => {
  it("recuperación parcial: la mitad del costo es la mitad de la barra", () => {
    expect(recoveryOf({ totalCost: 7000, marginSince: 3500 })).toEqual({
      ratio: 0.5,
      percent: 50,
      recovered: false,
    });
  });

  it("la línea todavía no genera margen: 0 %, nunca un porcentaje negativo", () => {
    expect(recoveryOf({ totalCost: 7000, marginSince: -800 })).toEqual({
      ratio: 0,
      percent: 0,
      recovered: false,
    });
  });

  it("un margen de cero también es 0 %, sin error", () => {
    expect(recoveryOf({ totalCost: 7000, marginSince: 0 }).percent).toBe(0);
  });

  it("recuperación exacta: el margen iguala el costo", () => {
    expect(recoveryOf({ totalCost: 7000, marginSince: 7000 })).toEqual({
      ratio: 1,
      percent: 100,
      recovered: true,
    });
  });

  it("recuperación superada: 100 %, no 200 %", () => {
    // La pregunta es si ya se pagó sola, no cuántas veces.
    expect(recoveryOf({ totalCost: 7000, marginSince: 14000 })).toEqual({
      ratio: 1,
      percent: 100,
      recovered: true,
    });
  });

  it("costo total cero: 0 %, sin división por cero y sin darlo por recuperado", () => {
    expect(recoveryOf({ totalCost: 0, marginSince: 5000 })).toEqual({
      ratio: 0,
      percent: 0,
      recovered: false,
    });
  });

  it("el mantenimiento mueve el denominador y con él la barra", () => {
    const antes = recoveryOf({ totalCost: 7000, marginSince: 7000 });
    const despues = recoveryOf({ totalCost: 7500, marginSince: 7000 });

    expect(antes.recovered).toBe(true);
    expect(despues.recovered).toBe(false);
    expect(despues.percent).toBe(93);
  });
});

describe("hasAttributableLine", () => {
  it("un activo de una línea concreta sí se puede medir", () => {
    expect(hasAttributableLine({ businessLineId: "30000000-0000-0000-0000-000000000001" })).toBe(
      true,
    );
  });

  it("un activo compartido entre líneas, no", () => {
    expect(hasAttributableLine({ businessLineId: null })).toBe(false);
  });
});
