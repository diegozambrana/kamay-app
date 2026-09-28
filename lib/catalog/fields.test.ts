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
      supply: { salePrice: false, minStock: true, showInFair: false },
      product: { salePrice: true, minStock: false, showInFair: true },
      asset: { salePrice: false, minStock: false, showInFair: false },
    });
  });
});

describe("applyKindFields", () => {
  it("un insumo pierde el precio de venta y conserva el mínimo", () => {
    expect(applyKindFields("supply", values)).toEqual({
      ...values,
      salePrice: null,
      showInFair: true,
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
      showInFair: true,
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

describe("applyKindFields · Mostrar en venta rápida", () => {
  it("un producto conserva el ajuste que trae, también desactivado", () => {
    expect(applyKindFields("product", { ...values, showInFair: false }).showInFair).toBe(false);
    expect(applyKindFields("product", { ...values, showInFair: true }).showInFair).toBe(true);
  });

  it("un producto sin ajuste en la carga lo deja sin tocar", () => {
    expect(applyKindFields("product", values)).not.toHaveProperty("showInFair");
  });

  it("El servidor ignora el ajuste en un insumo: queda activado", () => {
    expect(applyKindFields("supply", { ...values, showInFair: false }).showInFair).toBe(true);
  });

  it("un activo también queda con el ajuste activado", () => {
    expect(applyKindFields("asset", { ...values, showInFair: false }).showInFair).toBe(true);
    expect(applyKindFields("asset", values).showInFair).toBe(true);
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
