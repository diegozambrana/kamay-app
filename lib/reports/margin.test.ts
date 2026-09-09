import { describe, expect, it } from "vitest";

import { isCostCaptured, marginOf } from "./margin";

describe("marginOf", () => {
  // Escenario «Margen de un pedido con costo».
  it("un pedido de 1.000 con 400 de costo deja 600 y un 60 %", () => {
    expect(marginOf({ revenue: 1000, cost: 400 })).toEqual({
      amount: 600,
      percent: 60,
    });
  });

  // Escenario «Pedido sin costo registrado».
  it("sin costo registrado el margen es del 100 %, y por eso hay que marcarlo", () => {
    expect(marginOf({ revenue: 500, cost: 0 })).toEqual({
      amount: 500,
      percent: 100,
    });
    expect(isCostCaptured(false, 0)).toBe(false);
  });

  // Escenario «Margen negativo».
  it("un margen negativo se devuelve tal cual, sin recortarse a cero", () => {
    expect(marginOf({ revenue: 200, cost: 300 })).toEqual({
      amount: -100,
      percent: -50,
    });
  });

  // Escenario «Ingresos cero».
  it("sin ingresos el porcentaje es null, no cero ni error", () => {
    const margin = marginOf({ revenue: 0, cost: 80 });

    expect(margin.amount).toBe(-80);
    expect(margin.percent).toBeNull();
  });

  it("sin ingresos ni costo tampoco inventa un porcentaje", () => {
    expect(marginOf({ revenue: 0, cost: 0 })).toEqual({
      amount: 0,
      percent: null,
    });
  });
});

describe("isCostCaptured", () => {
  it("un pedido con egreso asignado tiene costo capturado", () => {
    expect(isCostCaptured(true, 400)).toBe(true);
  });

  it("un egreso asignado de importe cero no cuenta como costo capturado", () => {
    expect(isCostCaptured(true, 0)).toBe(false);
  });

  it("sin egreso asignado, no hay costo capturado", () => {
    expect(isCostCaptured(false, 0)).toBe(false);
  });
});
