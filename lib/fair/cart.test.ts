import { describe, expect, it } from "vitest";

import {
  addLine,
  cartTotal,
  cartUnits,
  clear,
  removeLine,
  type CartLine,
  type SellableProduct,
} from "./cart";

const taza: SellableProduct = { id: "item-taza", name: "Taza de barro", salePrice: 35 };
const maceta: SellableProduct = { id: "item-maceta", name: "Maceta", salePrice: 60 };

describe("addLine", () => {
  it("agrega un producto nuevo como línea de cantidad 1", () => {
    const lines = addLine([], taza, "line-1");

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ id: "line-1", itemId: "item-taza", quantity: 1, unitPrice: 35 });
  });

  // Escenario: Tocar dos veces el mismo producto
  it("tocar dos veces el mismo producto deja UNA línea con cantidad 2", () => {
    const lines = addLine(addLine([], taza, "line-1"), taza, "line-2");

    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(2);
    expect(cartTotal(lines)).toBe(70);
  });

  it("distingue variantes del mismo producto", () => {
    const grande: SellableProduct = { ...taza, variantId: "v-grande" };
    const lines = addLine(addLine([], taza, "line-1"), grande, "line-2");

    expect(lines).toHaveLength(2);
  });

  it("mantiene el orden en que se tocaron los productos", () => {
    const lines = addLine(addLine([], taza, "line-1"), maceta, "line-2");

    expect(lines.map((line) => line.itemId)).toEqual(["item-taza", "item-maceta"]);
  });
});

// Escenario: Quitar una línea
describe("removeLine", () => {
  it("quita la línea y recalcula el total", () => {
    const lines = addLine(addLine([], taza, "line-1"), maceta, "line-2");
    const quedan = removeLine(lines, "line-1");

    expect(quedan).toHaveLength(1);
    expect(cartTotal(quedan)).toBe(60);
  });

  it("quitar una línea inexistente no altera el carrito", () => {
    const lines = addLine([], taza, "line-1");

    expect(removeLine(lines, "line-9")).toEqual(lines);
  });
});

describe("clear", () => {
  it("vacía el carrito", () => {
    expect(clear()).toEqual([]);
  });
});

// Escenario: El total sigue al carrito · Monto propuesto (parte de cálculo)
describe("cartTotal y cartUnits", () => {
  it("el carrito vacío suma cero, no nulo", () => {
    expect(cartTotal([])).toBe(0);
    expect(cartUnits([])).toBe(0);
  });

  it("suma cantidad por precio de cada línea", () => {
    const lines = addLine(addLine(addLine([], taza, "l1"), taza, "l2"), maceta, "l3");

    // 2 × 35 + 1 × 60 = 130
    expect(cartTotal(lines)).toBe(130);
    expect(cartUnits(lines)).toBe(3);
  });

  // El redondeo a centavos: sin él, esto daría 0.30000000000000004 y el monto
  // propuesto en la hoja de cobro mostraría un número imposible de teclear.
  it("no arrastra el error de la coma flotante", () => {
    const lines: CartLine[] = [
      { id: "l1", itemId: "a", variantId: null, name: "A", quantity: 1, unitPrice: 0.1 },
      { id: "l2", itemId: "b", variantId: null, name: "B", quantity: 1, unitPrice: 0.2 },
    ];

    expect(cartTotal(lines)).toBe(0.3);
  });

  it("un precio con decimales por una cantidad grande sigue siendo exacto a centavos", () => {
    const lines: CartLine[] = [
      { id: "l1", itemId: "a", variantId: null, name: "A", quantity: 3, unitPrice: 33.33 },
    ];

    expect(cartTotal(lines)).toBe(99.99);
  });

  it("ignora cantidades y precios no numéricos en vez de propagar NaN", () => {
    const lines = [
      { id: "l1", itemId: "a", variantId: null, name: "A", quantity: Number.NaN, unitPrice: 10 },
    ] as CartLine[];

    expect(cartTotal(lines)).toBe(0);
    expect(cartUnits(lines)).toBe(0);
  });
});
