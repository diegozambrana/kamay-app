import { describe, expect, it } from "vitest";

import { marginAt, validateCurve, type MarginAnchor } from "@/tools/print-cost-3d/margin-curve";
import { DEFAULT_MARGIN_CURVE } from "@/tools/print-cost-3d/schema";

/**
 * KAM-27 · spec `print-cost-3d` → *El margen unitario varía con el costo según
 * una curva de anclas* y *Una curva de margen nunca hace bajar el precio al
 * subir el costo*.
 */
const curve = DEFAULT_MARGIN_CURVE;
const price = (anchors: readonly MarginAnchor[], cost: number) => cost * marginAt(anchors, cost);

describe("marginAt con la curva por defecto", () => {
  it("pieza barata: por debajo de la primera ancla vale su margen", () => {
    expect(marginAt(curve, 5)).toBe(2.5);
    expect(price(curve, 5)).toBeCloseTo(12.5, 9);
  });

  it("ancla exacta", () => {
    expect(marginAt(curve, 50)).toBeCloseTo(1.75, 9);
    expect(price(curve, 50)).toBeCloseTo(87.5, 9);
  });

  it("entre dos anclas se interpola en línea recta", () => {
    expect(marginAt(curve, 30)).toBeCloseTo(2.125, 9);
    expect(price(curve, 30)).toBeCloseTo(63.75, 9);
  });

  it("el ejemplo de la dueña: 70 de costo se vende alrededor de 110", () => {
    expect(marginAt(curve, 70)).toBeCloseTo(1.57, 9);
    expect(Math.round(price(curve, 70))).toBe(110);
  });

  it("pieza cara: por encima de la última ancla vale su margen", () => {
    expect(marginAt(curve, 120)).toBe(1.5);
    expect(marginAt(curve, 80)).toBe(1.5);
  });

  it("costo cero", () => {
    expect(marginAt(curve, 0)).toBe(2.5);
  });
});

describe("marginAt con una sola ancla", () => {
  it("es un margen fijo, como en la hoja de cálculo original", () => {
    const flat = [{ cost: 10, margin: 2.5 }];
    expect(marginAt(flat, 1)).toBe(2.5);
    expect(marginAt(flat, 10)).toBe(2.5);
    expect(marginAt(flat, 500)).toBe(2.5);
  });
});

describe("validateCurve", () => {
  it("acepta la curva por defecto", () => {
    expect(validateCurve(curve)).toBeNull();
  });

  it("acepta una sola ancla", () => {
    expect(validateCurve([{ cost: 10, margin: 2.5 }])).toBeNull();
  });

  it("rechaza la lista vacía", () => {
    expect(validateCurve([])).toMatchObject({ reason: "empty" });
  });

  it("rechaza la curva que invierte los precios y dice entre qué anclas", () => {
    const problem = validateCurve([
      { cost: 10, margin: 2.5 },
      { cost: 12, margin: 1.5 },
    ]);
    expect(problem).toMatchObject({ reason: "price-drops", index: 1 });
    expect(problem?.message).toMatch(/Entre 10 y 12 el precio bajaría/);
    // Y de verdad baja: 10 × 2,5 = 25 pero 12 × 1,5 = 18.
    expect(price([{ cost: 10, margin: 2.5 }, { cost: 12, margin: 1.5 }], 12)).toBeLessThan(25);
  });

  it("rechaza un margen por debajo del costo", () => {
    expect(validateCurve([{ cost: 10, margin: 0.9 }])).toMatchObject({ reason: "margin", index: 0 });
  });

  it("rechaza costos que no crecen", () => {
    expect(
      validateCurve([
        { cost: 50, margin: 2 },
        { cost: 50, margin: 1.8 },
      ]),
    ).toMatchObject({ reason: "order", index: 1 });
    expect(
      validateCurve([
        { cost: 50, margin: 2 },
        { cost: 10, margin: 1.8 },
      ]),
    ).toMatchObject({ reason: "order", index: 1 });
  });

  it("rechaza un costo que no es positivo", () => {
    expect(validateCurve([{ cost: 0, margin: 2 }])).toMatchObject({ reason: "cost", index: 0 });
    expect(validateCurve([{ cost: Number.NaN, margin: 2 }])).toMatchObject({ reason: "cost" });
  });

  it("rechaza un margen que sube con el costo", () => {
    expect(
      validateCurve([
        { cost: 10, margin: 1.5 },
        { cost: 50, margin: 2 },
      ]),
    ).toMatchObject({ reason: "rising", index: 1 });
  });

  it("distingue la caída demasiado rápida de la que el precio aguanta", () => {
    // De (10, 2) a (20, 1): el precio vale 20 en los dos extremos, pero
    // p(c) = c·(3 − c/10) sube hasta c = 15 y baja después: no es monótona…
    expect(
      validateCurve([
        { cost: 10, margin: 2 },
        { cost: 20, margin: 1 },
      ]),
    ).toMatchObject({ reason: "price-drops" });
    // …mientras que de (10, 2) a (20, 1,5) la derivada al final es 1,5 − 20·0,05 = 0,5.
    expect(
      validateCurve([
        { cost: 10, margin: 2 },
        { cost: 20, margin: 1.5 },
      ]),
    ).toBeNull();
  });
});

/**
 * Prueba de propiedad sin dependencia nueva (design D9): un generador
 * congruencial con semilla fija, así un fallo se reproduce siempre igual.
 */
describe("propiedad: una curva aceptada nunca hace bajar el precio", () => {
  function generator(seed: number) {
    let state = seed;
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }

  function randomCurve(random: () => number): MarginAnchor[] {
    const length = 1 + Math.floor(random() * 5);
    const anchors: MarginAnchor[] = [];
    let cost = 1 + random() * 20;
    let margin = 1 + random() * 3;
    for (let i = 0; i < length; i += 1) {
      anchors.push({ cost, margin });
      cost += 0.5 + random() * 40;
      // Márgenes decrecientes, a veces con caídas bruscas que deben rechazarse.
      margin = Math.max(1, margin - random() * 1.5);
    }
    return anchors;
  }

  /** El primer par de costos vecinos donde el precio baja, o `null`. */
  function firstDrop(anchors: readonly MarginAnchor[]): [number, number] | null {
    const top = anchors[anchors.length - 1].cost * 1.5;
    const step = top / 4000;
    for (let cost = step; cost <= top; cost += step) {
      if (price(anchors, cost) < price(anchors, cost - step) - 1e-9) return [cost - step, cost];
    }
    return null;
  }

  const random = generator(27);
  const curves = Array.from({ length: 200 }, () => randomCurve(random));

  it("el generador produce curvas de los dos tipos", () => {
    const accepted = curves.filter((anchors) => validateCurve(anchors) === null).length;
    expect(accepted).toBeGreaterThan(20);
    expect(curves.length - accepted).toBeGreaterThan(20);
  });

  it("toda curva aceptada da un precio que no decrece", () => {
    for (const anchors of curves) {
      if (validateCurve(anchors) !== null) continue;
      expect(firstDrop(anchors), JSON.stringify(anchors)).toBeNull();
    }
  });

  it("toda curva rechazada por monotonía tiene de verdad un par que decrece", () => {
    for (const anchors of curves) {
      if (validateCurve(anchors)?.reason !== "price-drops") continue;
      expect(firstDrop(anchors), JSON.stringify(anchors)).not.toBeNull();
    }
  });
});
