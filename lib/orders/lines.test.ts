import { describe, expect, it } from "vitest";

import {
  lineTotal,
  orderTotal,
  pickerCandidates,
  prefilledPrice,
  type PickableItem,
} from "@/lib/orders/lines";

const SUBLIMACION = "30000000-0000-0000-0000-000000000001";
const ALFARERIA = "30000000-0000-0000-0000-000000000003";

function item(overrides: Partial<PickableItem> & { name: string }): PickableItem {
  return {
    id: `id-${overrides.name}`,
    organizationId: "org",
    businessLineId: null,
    kind: "product",
    description: null,
    unitId: null,
    category: null,
    salePrice: null,
    minStock: null,
    archivedAt: null,
    variants: [],
    ...overrides,
  };
}

describe("lineTotal y orderTotal", () => {
  it("3 × 45 son 135, y al pasar a 4 son 180", () => {
    expect(lineTotal({ quantity: 3, unitPrice: 45 })).toBe(135);
    expect(lineTotal({ quantity: 4, unitPrice: 45 })).toBe(180);
  });

  it("suma las líneas del pedido", () => {
    expect(
      orderTotal([
        { quantity: 3, unitPrice: 45 },
        { quantity: 1, unitPrice: 55 },
      ]),
    ).toBe(190);
  });

  it("un pedido sin líneas suma cero, no nulo", () => {
    expect(orderTotal([])).toBe(0);
  });

  it("acepta los valores como texto, que es como llegan del formulario", () => {
    expect(lineTotal({ quantity: "3", unitPrice: "45" })).toBe(135);
    expect(orderTotal([{ quantity: "2", unitPrice: "60" }])).toBe(120);
  });

  it("un campo a medio escribir cuenta como cero en vez de dar NaN", () => {
    expect(lineTotal({ quantity: "", unitPrice: "45" })).toBe(0);
    expect(lineTotal({ quantity: "dos", unitPrice: "45" })).toBe(0);
    expect(orderTotal([{ quantity: "", unitPrice: "" }])).toBe(0);
  });
});

describe("pickerCandidates", () => {
  const catalogo: PickableItem[] = [
    item({ name: "Taza para sublimación", businessLineId: SUBLIMACION }),
    item({ name: "Macetero de greda", businessLineId: ALFARERIA }),
    item({ name: "Caja de cartón", businessLineId: null }),
    item({
      name: "Taza descatalogada",
      businessLineId: SUBLIMACION,
      archivedAt: "2026-01-01T00:00:00Z",
    }),
  ];

  it("ofrece los de la línea y los compartidos, no los de otra línea", () => {
    const names = pickerCandidates(catalogo, SUBLIMACION, "").map((i) => i.name);
    expect(names).toEqual(["Taza para sublimación", "Caja de cartón"]);
  });

  it("no ofrece los archivados", () => {
    const names = pickerCandidates(catalogo, SUBLIMACION, "taza").map((i) => i.name);
    expect(names).toEqual(["Taza para sublimación"]);
  });

  it("sin línea activa ofrece todo lo vigente", () => {
    expect(pickerCandidates(catalogo, null, "")).toHaveLength(3);
  });

  it("busca sin tilde lo que está con tilde", () => {
    expect(pickerCandidates(catalogo, SUBLIMACION, "sublimacion")).toHaveLength(1);
  });

  it("busca con tilde y en mayúsculas", () => {
    expect(pickerCandidates(catalogo, ALFARERIA, "GREDA")).toHaveLength(1);
    expect(pickerCandidates(catalogo, ALFARERIA, "cartón")).toHaveLength(1);
  });

  it("un término sin coincidencias no devuelve nada", () => {
    expect(pickerCandidates(catalogo, SUBLIMACION, "bicicleta")).toHaveLength(0);
  });
});

describe("prefilledPrice", () => {
  it("prefiere el precio de la variante", () => {
    expect(prefilledPrice({ salePrice: 45 }, { salePrice: 55 })).toBe(55);
  });

  it("cae al del producto cuando la variante no tiene", () => {
    expect(prefilledPrice({ salePrice: 45 }, { salePrice: null })).toBe(45);
    expect(prefilledPrice({ salePrice: 45 }, null)).toBe(45);
    expect(prefilledPrice({ salePrice: 45 })).toBe(45);
  });

  it("sin ningún precio en el catálogo arranca en cero, editable", () => {
    expect(prefilledPrice({ salePrice: null })).toBe(0);
  });
});
