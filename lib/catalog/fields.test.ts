import { describe, expect, it } from "vitest";

import { applyKindFields, ITEM_KIND_FIELDS, variantSalePriceFor } from "./fields";

const values = {
  name: "Taza para sublimación",
  category: "Sustratos",
  salePrice: 45,
  minStock: 10,
};

describe("ITEM_KIND_FIELDS", () => {
  it("el precio de venta es solo de productos y el mínimo, solo de insumos", () => {
    expect(ITEM_KIND_FIELDS).toEqual({
      supply: { salePrice: false, minStock: true },
      product: { salePrice: true, minStock: false },
      asset: { salePrice: false, minStock: false },
    });
  });
});

describe("applyKindFields", () => {
  it("un insumo pierde el precio de venta y conserva el mínimo", () => {
    expect(applyKindFields("supply", values)).toEqual({
      ...values,
      salePrice: null,
    });
  });

  it("un producto pierde el mínimo y conserva el precio de venta", () => {
    expect(applyKindFields("product", values)).toEqual({
      ...values,
      minStock: null,
    });
  });

  it("un activo pierde los dos", () => {
    expect(applyKindFields("asset", values)).toEqual({
      ...values,
      salePrice: null,
      minStock: null,
    });
  });

  it("no toca el resto de los valores ni el objeto de entrada", () => {
    const input = { ...values };
    const result = applyKindFields("asset", input);
    expect(result.name).toBe(values.name);
    expect(result.category).toBe(values.category);
    expect(input).toEqual(values);
  });
});

describe("variantSalePriceFor", () => {
  it("la variante de un producto conserva su precio", () => {
    expect(variantSalePriceFor("product", 55)).toBe(55);
  });

  it("la variante de un insumo o de un activo queda sin precio", () => {
    expect(variantSalePriceFor("supply", 55)).toBeNull();
    expect(variantSalePriceFor("asset", 55)).toBeNull();
  });
});
