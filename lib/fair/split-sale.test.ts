import { describe, expect, it } from "vitest";

import type { CartLine } from "./cart";
import { splitSale } from "./split-sale";

/**
 * `fair-all-lines` · Partir un carrito en una venta por línea y repartir el
 * cobro. Escenarios del delta `fair-mode`, requisito «Con todas las líneas,
 * cada producto se registra en su línea».
 */

const FERIA = "line-alfareria";
const SUB = "line-sublimacion";
const TERCERA = "line-ceramica";

const linea = (over: Partial<CartLine>): CartLine => ({
  id: crypto.randomUUID(),
  itemId: "item",
  variantId: null,
  name: "Producto",
  quantity: 1,
  unitPrice: 10,
  businessLineId: FERIA,
  ...over,
});

describe("splitSale", () => {
  // Escenario: Un carrito de dos líneas crea dos ventas
  it("2 tazas de Sublimación a 45 y 1 maceta de Alfarería a 60, cobrando 150: 90 y 60", () => {
    const tazas = linea({ name: "Taza", quantity: 2, unitPrice: 45, businessLineId: SUB });
    const maceta = linea({ name: "Maceta", unitPrice: 60, businessLineId: FERIA });

    const groups = splitSale([tazas, maceta], FERIA, 150);

    expect(groups).toEqual([
      { businessLineId: SUB, lines: [tazas], subtotal: 90, amount: 90 },
      { businessLineId: FERIA, lines: [maceta], subtotal: 60, amount: 60 },
    ]);
  });

  // Escenario: Un carrito de una línea crea una venta
  it("un carrito de una sola línea es un solo grupo con el monto entero", () => {
    const a = linea({ businessLineId: SUB, unitPrice: 45 });
    const b = linea({ businessLineId: SUB, unitPrice: 30 });

    expect(splitSale([a, b], FERIA, 50)).toEqual([
      { businessLineId: SUB, lines: [a, b], subtotal: 75, amount: 50 },
    ]);
  });

  // Escenario: Los compartidos van a la línea de la feria
  it("los compartidos van a la línea de la feria y se juntan con sus productos", () => {
    const taza = linea({ businessLineId: SUB, unitPrice: 45 });
    const bolsa = linea({ businessLineId: null, unitPrice: 5 });
    const maceta = linea({ businessLineId: FERIA, unitPrice: 60 });

    const groups = splitSale([taza, bolsa, maceta], FERIA, 110);

    expect(groups.map((group) => group.businessLineId)).toEqual([SUB, FERIA]);
    expect(groups[1].lines).toEqual([bolsa, maceta]);
    expect(groups[1].subtotal).toBe(65);
  });

  it("agrupa en el orden en que aparece cada línea en el carrito", () => {
    const groups = splitSale(
      [
        linea({ businessLineId: FERIA }),
        linea({ businessLineId: SUB }),
        linea({ businessLineId: FERIA }),
      ],
      FERIA,
      30,
    );

    expect(groups.map((group) => group.businessLineId)).toEqual([FERIA, SUB]);
  });

  // Escenario: Cobro parcial repartido en proporción
  it("150 cobrando 100: 60 y 40", () => {
    const groups = splitSale(
      [
        linea({ quantity: 2, unitPrice: 45, businessLineId: SUB }),
        linea({ unitPrice: 60, businessLineId: FERIA }),
      ],
      FERIA,
      100,
    );

    expect(groups.map((group) => group.amount)).toEqual([60, 40]);
  });

  // Escenario: El redondeo no pierde centavos
  it("tres líneas de 10 cobrando 10: 3.33, 3.33 y 3.34", () => {
    const groups = splitSale(
      [
        linea({ businessLineId: FERIA }),
        linea({ businessLineId: SUB }),
        linea({ businessLineId: TERCERA }),
      ],
      FERIA,
      10,
    );

    expect(groups.map((group) => group.amount)).toEqual([3.33, 3.33, 3.34]);
    expect(groups.reduce((sum, group) => sum + group.amount, 0)).toBeCloseTo(10, 10);
  });

  // Escenario: Sin cobro
  it("monto 0: ningún grupo recibe cobro", () => {
    const groups = splitSale(
      [linea({ businessLineId: FERIA }), linea({ businessLineId: SUB })],
      FERIA,
      0,
    );

    expect(groups.map((group) => group.amount)).toEqual([0, 0]);
  });

  it("un total en cero no divide por cero: el monto va al primero", () => {
    const groups = splitSale(
      [linea({ unitPrice: 0, businessLineId: FERIA }), linea({ unitPrice: 0, businessLineId: SUB })],
      FERIA,
      5,
    );

    expect(groups.map((group) => group.amount)).toEqual([5, 0]);
  });

  it("un carrito vacío no produce ventas", () => {
    expect(splitSale([], FERIA, 0)).toEqual([]);
  });
});
