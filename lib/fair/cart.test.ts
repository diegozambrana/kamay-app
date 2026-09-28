import { describe, expect, it } from "vitest";

import {
  addLine,
  cartTotal,
  cartUnits,
  clear,
  removeLine,
  setLineQuantity,
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
// `fair-product-photos-visibility-cart-drawer` · El selector de cantidad de la
// tarjeta y los − / + del panel.
describe("addLine · línea del producto", () => {
  it("la línea del carrito guarda la línea del producto, o null si es compartido", () => {
    const lines = addLine(
      addLine([], { ...taza, businessLineId: "line-alfareria" }, "line-1"),
      maceta,
      "line-2",
    );

    expect(lines[0].businessLineId).toBe("line-alfareria");
    expect(lines[1].businessLineId).toBeNull();
  });
});

describe("addLine con cantidad", () => {
  // Escenario: Agregar varias unidades de una vez
  it("agregar 3 de un producto nuevo crea una línea con 3", () => {
    const lines = addLine([], taza, "line-1", 3);

    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(3);
    expect(cartTotal(lines)).toBe(105);
  });

  it("agregar 3 de un producto que ya estaba suma a su línea", () => {
    const lines = addLine(addLine([], taza, "line-1", 2), taza, "line-2", 3);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ id: "line-1", quantity: 5 });
  });

  it("una cantidad que no es un entero positivo agrega 1", () => {
    expect(addLine([], taza, "line-1", 0)[0].quantity).toBe(1);
    expect(addLine([], taza, "line-1", Number.NaN)[0].quantity).toBe(1);
    expect(addLine([], taza, "line-1", 2.7)[0].quantity).toBe(2);
  });
});

describe("setLineQuantity", () => {
  // Escenario: Cambiar la cantidad desde el panel
  it("fija la cantidad de una línea y deja las demás", () => {
    const lines = addLine(addLine([], taza, "line-1", 2), maceta, "line-2");

    const next = setLineQuantity(lines, "line-1", 3);

    expect(next.find((line) => line.id === "line-1")?.quantity).toBe(3);
    expect(next.find((line) => line.id === "line-2")?.quantity).toBe(1);
    expect(cartTotal(next)).toBe(165);
  });

  // Escenario: La cantidad de una línea no baja de 1
  it("no baja de 1: quitar es otro control", () => {
    const lines = addLine([], taza, "line-1");

    const next = setLineQuantity(lines, "line-1", 0);

    expect(next).toHaveLength(1);
    expect(next[0].quantity).toBe(1);
  });

  it("no toca el arreglo de entrada", () => {
    const lines = addLine([], taza, "line-1");
    setLineQuantity(lines, "line-1", 4);

    expect(lines[0].quantity).toBe(1);
  });
});

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
      { id: "l1", itemId: "a", variantId: null, name: "A", quantity: 1, unitPrice: 0.1, businessLineId: null },
      { id: "l2", itemId: "b", variantId: null, name: "B", quantity: 1, unitPrice: 0.2, businessLineId: null },
    ];

    expect(cartTotal(lines)).toBe(0.3);
  });

  it("un precio con decimales por una cantidad grande sigue siendo exacto a centavos", () => {
    const lines: CartLine[] = [
      { id: "l1", itemId: "a", variantId: null, name: "A", quantity: 3, unitPrice: 33.33, businessLineId: null },
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
