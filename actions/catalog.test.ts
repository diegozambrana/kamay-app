import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Item, ItemKind } from "@/types";

const ORG = "11111111-1111-4111-8111-111111111111";
const USER = "55555555-5555-4555-8555-555555555555";
const ITEM = "33333333-3333-4333-8333-333333333333";
const VARIANT = "44444444-4444-4444-8444-444444444444";
const MISSING = "99999999-9999-4999-8999-999999999999";

/** Estado que las dobles leen y escriben, reiniciado en cada prueba. */
const estado = vi.hoisted(() => ({
  guardados: new Map<string, unknown>(),
  creados: [] as unknown[],
  editados: [] as unknown[],
  variantesCreadas: [] as unknown[],
  variantesEditadas: [] as unknown[],
  categorias: new Map<string, unknown>(),
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

vi.mock("@/lib/auth/session-context", () => ({
  getSessionContext: async () => ({
    supabase: {},
    userId: USER,
    organizationId: ORG,
    role: "assistant",
  }),
}));

vi.mock("@/services/catalog/item-service", () => ({
  ItemService: class {
    async findById(_org: string, id: string) {
      return estado.guardados.get(id) ?? null;
    }
    async create(_org: string, id: string, values: unknown) {
      estado.creados.push({ id, values });
    }
    async update(_org: string, id: string, values: unknown) {
      estado.editados.push({ id, values });
    }
  },
}));

vi.mock("@/services/configuration/item-category-service", () => ({
  ItemCategoryService: class {
    async findById(_org: string, id: string) {
      return estado.categorias.get(id) ?? null;
    }
  },
}));

vi.mock("@/services/catalog/item-variant-service", () => ({
  ItemVariantService: class {
    async create(_org: string, itemId: string, id: string, values: unknown) {
      estado.variantesCreadas.push({ itemId, id, values });
    }
    async update(_org: string, id: string, values: unknown) {
      estado.variantesEditadas.push({ id, values });
    }
  },
}));

const { createItem, createItemVariant, updateItem, updateItemVariant } =
  await import("./catalog");

function guardar(kind: ItemKind, overrides: Partial<Item> = {}) {
  estado.guardados.set(ITEM, {
    id: ITEM,
    organizationId: ORG,
    businessLineId: null,
    kind,
    name: "Taza para sublimación",
    description: null,
    unitId: null,
    categoryId: null,
    salePrice: null,
    minStock: null,
    archivedAt: null,
    ...overrides,
  });
}

const base = {
  id: ITEM,
  name: "Taza para sublimación",
  businessLineId: null,
  unitId: null,
};

beforeEach(() => {
  estado.guardados = new Map();
  estado.creados = [];
  estado.editados = [];
  estado.variantesCreadas = [];
  estado.variantesEditadas = [];
  estado.categorias = new Map();
});

/**
 * Escenarios del delta spec `catalog-directory`: "Los campos de un ítem
 * dependen de su tipo" y "El tipo de un ítem se fija al crearlo", del lado del
 * servidor. La interfaz ya no ofrece esos campos; esto prueba que una
 * petición que los traiga igual no los guarda.
 */
describe("createItem", () => {
  it("un insumo se crea sin precio de venta aunque la petición lo traiga", async () => {
    const result = await createItem({
      ...base,
      kind: "supply",
      salePrice: "45",
      minStock: "12",
    });

    expect(result).toBeUndefined();
    expect(estado.creados).toEqual([
      {
        id: ITEM,
        values: expect.objectContaining({
          kind: "supply",
          salePrice: null,
          minStock: 12,
        }),
      },
    ]);
  });
});

describe("updateItem", () => {
  it("un producto se guarda sin mínimo aunque la petición lo traiga", async () => {
    guardar("product", { salePrice: 45 });

    await updateItem({ ...base, kind: "product", salePrice: "45", minStock: "10" });

    expect(estado.editados).toEqual([
      {
        id: ITEM,
        values: expect.objectContaining({ salePrice: 45, minStock: null }),
      },
    ]);
  });

  it("editar no cambia el tipo: manda el guardado, no el de la petición", async () => {
    guardar("supply");

    await updateItem({ ...base, kind: "product", salePrice: "45", minStock: "8" });

    const [{ values }] = estado.editados as { values: Record<string, unknown> }[];
    // Se normaliza con «insumo», el tipo guardado: el precio no entra.
    expect(values.salePrice).toBeNull();
    expect(values.minStock).toBe(8);
  });

  it("un precio antiguo de un insumo se vacía en la siguiente edición", async () => {
    // Un insumo guardado antes de este cambio, con precio de venta.
    guardar("supply", { salePrice: 30 });

    await updateItem({ ...base, kind: "supply", salePrice: "", minStock: "" });

    const [{ values }] = estado.editados as { values: Record<string, unknown> }[];
    expect(values.salePrice).toBeNull();
  });

  it("un ítem que no existe devuelve un error y no escribe", async () => {
    const result = await updateItem({ ...base, id: MISSING, kind: "supply" });

    expect(result).toEqual({ error: expect.any(String) });
    expect(estado.editados).toHaveLength(0);
  });
});

describe("variantes", () => {
  const variant = { id: VARIANT, itemId: ITEM, name: "11oz", salePrice: "55" };

  it.each(["supply", "asset"] as const)(
    "la variante de un %s se crea y se edita sin precio de venta",
    async (kind) => {
      guardar(kind);

      await createItemVariant(variant);
      await updateItemVariant(variant);

      expect(estado.variantesCreadas).toEqual([
        {
          itemId: ITEM,
          id: VARIANT,
          values: expect.objectContaining({ salePrice: null }),
        },
      ]);
      expect(estado.variantesEditadas).toEqual([
        { id: VARIANT, values: expect.objectContaining({ salePrice: null }) },
      ]);
    },
  );

  it("la variante de un producto conserva su precio", async () => {
    guardar("product", { salePrice: 45 });

    await createItemVariant({ ...variant, name: "15oz" });
    await updateItemVariant({ ...variant, name: "15oz" });

    expect(estado.variantesCreadas).toEqual([
      expect.objectContaining({
        values: expect.objectContaining({ name: "15oz", salePrice: 55 }),
      }),
    ]);
    expect(estado.variantesEditadas).toEqual([
      expect.objectContaining({
        values: expect.objectContaining({ salePrice: 55 }),
      }),
    ]);
  });

  it("una variante de un ítem que no existe devuelve un error y no escribe", async () => {
    const result = await createItemVariant({ ...variant, itemId: MISSING });

    expect(result).toEqual({ error: expect.any(String) });
    expect(estado.variantesCreadas).toHaveLength(0);
  });
});

/**
 * Cambio `item-categories`, requisito "Un ítem se clasifica con una categoría
 * de su tipo", del lado del servidor. La sesión simulada es la de un ayudante.
 */
describe("categoría del ítem", () => {
  const SUSTRATOS = "55555555-5555-4555-8555-000000000001";
  const EMBALAJE = "55555555-5555-4555-8555-000000000002";
  const VAJILLA = "55555555-5555-4555-8555-000000000003";

  function categoria(id: string, kind: ItemKind, archivada = false) {
    estado.categorias.set(id, {
      id,
      organizationId: ORG,
      kind,
      name: id,
      archivedAt: archivada ? "2026-09-01T00:00:00Z" : null,
    });
  }

  it("el ayudante crea un insumo con una categoría de insumo vigente", async () => {
    categoria(SUSTRATOS, "supply");

    const result = await createItem({ ...base, kind: "supply", categoryId: SUSTRATOS });

    expect(result).toBeUndefined();
    expect(estado.creados).toEqual([
      { id: ITEM, values: expect.objectContaining({ categoryId: SUSTRATOS }) },
    ]);
  });

  it("sin categoría también se crea", async () => {
    const result = await createItem({ ...base, kind: "product", categoryId: null });

    expect(result).toBeUndefined();
    expect(estado.creados).toHaveLength(1);
  });

  it("una categoría archivada no se asigna a un ítem que no la tenía", async () => {
    categoria(EMBALAJE, "supply", true);
    guardar("supply", { categoryId: null });

    const result = await updateItem({ ...base, kind: "supply", categoryId: EMBALAJE });

    expect(result).toEqual({ error: expect.stringContaining("archivada") });
    expect(estado.editados).toHaveLength(0);
  });

  it("un ítem conserva su categoría archivada al editarlo sin cambiarla", async () => {
    categoria(EMBALAJE, "supply", true);
    guardar("supply", { categoryId: EMBALAJE });

    const result = await updateItem({
      ...base,
      name: "Caja de cartón grande",
      kind: "supply",
      categoryId: EMBALAJE,
    });

    expect(result).toBeUndefined();
    expect(estado.editados).toEqual([
      { id: ITEM, values: expect.objectContaining({ categoryId: EMBALAJE }) },
    ]);
  });

  it("una categoría de otro tipo se rechaza antes de llegar a la base", async () => {
    categoria(VAJILLA, "product");

    const result = await createItem({ ...base, kind: "supply", categoryId: VAJILLA });

    expect(result).toEqual({ error: expect.any(String) });
    expect(estado.creados).toHaveLength(0);
  });

  it("al editar, el tipo que manda es el guardado", async () => {
    categoria(VAJILLA, "product");
    guardar("supply");

    // La petición dice «producto», pero el ítem es un insumo.
    const result = await updateItem({ ...base, kind: "product", categoryId: VAJILLA });

    expect(result).toEqual({ error: expect.any(String) });
    expect(estado.editados).toHaveLength(0);
  });

  it("una categoría que no existe se rechaza", async () => {
    const result = await createItem({ ...base, kind: "supply", categoryId: SUSTRATOS });

    expect(result).toEqual({ error: expect.any(String) });
    expect(estado.creados).toHaveLength(0);
  });
});
