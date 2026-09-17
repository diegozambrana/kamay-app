import { describe, expect, it } from "vitest";

import {
  lineTotal,
  orderTotal,
  pickerCandidates,
  pickerOptions,
  prefilledPrice,
  type PickableItem,
} from "@/lib/orders/lines";
import { matchesSearch } from "@/lib/search/normalize";
import type { ItemVariant } from "@/types";

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
    categoryId: null,
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

function variant(
  name: string,
  overrides: Partial<ItemVariant> = {},
): ItemVariant {
  return {
    id: `v-${name}`,
    organizationId: "org",
    itemId: "item",
    name,
    attributes: {},
    salePrice: null,
    archivedAt: null,
    ...overrides,
  };
}

describe("pickerOptions", () => {
  const catalogo: PickableItem[] = [
    item({ name: "Taza para sublimación", businessLineId: SUBLIMACION, salePrice: 45 }),
    item({ name: "Macetero de greda", businessLineId: ALFARERIA, salePrice: 30 }),
    item({ name: "Caja de cartón", businessLineId: null }),
    item({
      name: "Taza descatalogada",
      businessLineId: SUBLIMACION,
      archivedAt: "2026-01-01T00:00:00Z",
    }),
    item({
      name: "Polera",
      businessLineId: SUBLIMACION,
      salePrice: 80,
      variants: [
        variant("Talla S", { salePrice: 70 }),
        variant("Talla M"),
        variant("Talla XL", { archivedAt: "2026-01-01T00:00:00Z" }),
      ],
    }),
  ];

  const keys = (line: string | null) =>
    pickerOptions(catalogo, line).map((option) => option.key);

  it("Productos fuera de alcance no se ofrecen: ni archivados ni de otra línea, sí compartidos", () => {
    expect(keys(SUBLIMACION)).toEqual([
      "id-Taza para sublimación:",
      "id-Caja de cartón:",
      "id-Polera:v-Talla S",
      "id-Polera:v-Talla M",
    ]);
    expect(keys(ALFARERIA)).toEqual(["id-Macetero de greda:", "id-Caja de cartón:"]);
  });

  it("Producto con variantes: una opción por variante vigente y ninguna sin variante", () => {
    const polera = pickerOptions(catalogo, SUBLIMACION).filter(
      (option) => option.item.name === "Polera",
    );

    expect(polera.map((option) => option.variant?.name)).toEqual(["Talla S", "Talla M"]);
    // La variante con precio manda; sin él, cae al del producto.
    expect(polera.map((option) => option.price)).toEqual([70, 80]);
    expect(polera.map((option) => option.referencePrice)).toEqual([70, 80]);
  });

  it("Elegir un producto prellena el precio desde el referencial", () => {
    const [taza] = pickerOptions(catalogo, SUBLIMACION);
    expect(taza.price).toBe(45);
    expect(taza.referencePrice).toBe(45);
  });

  it("Producto sin precio referencial: nace en cero y no muestra precio", () => {
    const caja = pickerOptions(catalogo, SUBLIMACION).find(
      (option) => option.item.name === "Caja de cartón",
    );
    expect(caja?.price).toBe(0);
    expect(caja?.referencePrice).toBeNull();
  });

  it("El texto de búsqueda incluye producto y variante, para filtrar sin acentos", () => {
    const texts = pickerOptions(catalogo, SUBLIMACION).map((option) => option.searchText);
    expect(texts.filter((text) => matchesSearch(text, "sublimacion"))).toEqual([
      "Taza para sublimación",
    ]);
    expect(texts.filter((text) => matchesSearch(text, "polera talla s"))).toEqual([
      "Polera Talla S",
    ]);
  });
});
