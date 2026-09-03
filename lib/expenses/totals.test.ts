import { describe, expect, it } from "vitest";

import { purchaseTotal, summarize } from "./totals";

describe("purchaseTotal", () => {
  it("suma cantidad por precio de cada fila: 3 × 25 + 1 × 40 = 115", () => {
    expect(
      purchaseTotal([
        { quantity: 3, unitPrice: 25 },
        { quantity: 1, unitPrice: 40 },
      ]),
    ).toBe(115);
  });

  it("sin filas da 0", () => {
    expect(purchaseTotal([])).toBe(0);
  });

  it("redondea a centavos para no mostrar residuos de coma flotante", () => {
    expect(purchaseTotal([{ quantity: 3, unitPrice: 0.1 }])).toBe(0.3);
  });

  it("una fila a medio escribir (NaN) cuenta como 0 en vez de romper el total", () => {
    expect(
      purchaseTotal([
        { quantity: Number.NaN, unitPrice: 10 },
        { quantity: 2, unitPrice: 5 },
      ]),
    ).toBe(10);
  });
});

describe("summarize", () => {
  it("separa compras de gastos y suma el total", () => {
    expect(
      summarize([
        { kind: "purchase", total: 615 },
        { kind: "purchase", total: 152 },
        { kind: "expense", total: 120 },
        { kind: "expense", total: 35 },
      ]),
    ).toEqual({ purchases: 767, costs: 155, total: 922 });
  });

  it("un conjunto vacío da ceros, no undefined", () => {
    expect(summarize([])).toEqual({ purchases: 0, costs: 0, total: 0 });
  });

  it("redondea a centavos", () => {
    expect(
      summarize([
        { kind: "expense", total: 0.1 },
        { kind: "expense", total: 0.2 },
      ]),
    ).toEqual({ purchases: 0, costs: 0.3, total: 0.3 });
  });
});
