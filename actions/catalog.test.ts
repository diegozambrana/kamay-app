import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Item, ItemCategoryAttribute, ItemKind, ItemVariant } from "@/types";

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
  atributos: [] as ItemCategoryAttribute[],
  variantesGuardadas: new Map<string, ItemVariant>(),
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

vi.mock("@/services/configuration/item-category-attribute-service", () => ({
  ItemCategoryAttributeService: class {
    async listForCategory(_org: string, categoryId: string) {
      return estado.atributos.filter(
        (attribute) => attribute.categoryId === categoryId && attribute.archivedAt === null,
      );
    }
  },
}));

vi.mock("@/services/catalog/item-variant-service", () => ({
  ItemVariantService: class {
    async findById(_org: string, id: string) {
      return estado.variantesGuardadas.get(id) ?? null;
    }
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
    attributes: {},
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
  estado.atributos = [];
  estado.variantesGuardadas = new Map();
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

/**
 * Cambio `catalog-custom-attributes`: la acción valida los atributos contra la
 * definición de la categoría, del lado del servidor, y combina con lo guardado.
 */
describe("atributos de catálogo", () => {
  const FILAMENTO = "66666666-6666-4666-8666-666666666666";
  const SUSTRATOS = "77777777-7777-4777-8777-777777777777";

  function atributo(
    overrides: Partial<ItemCategoryAttribute> & Pick<ItemCategoryAttribute, "id" | "name">,
  ): ItemCategoryAttribute {
    return {
      organizationId: ORG,
      categoryId: FILAMENTO,
      type: "text",
      unit: null,
      options: [],
      required: false,
      scope: "item",
      position: 1,
      archivedAt: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    estado.categorias.set(FILAMENTO, { id: FILAMENTO, kind: "supply", archivedAt: null });
    estado.categorias.set(SUSTRATOS, { id: SUSTRATOS, kind: "supply", archivedAt: null });
    estado.atributos = [
      atributo({ id: "marca", name: "Marca", type: "list", options: ["Sunlu", "eSun"], position: 1 }),
      atributo({ id: "tmin", name: "Temperatura mínima", type: "number", unit: "°C", position: 2 }),
      atributo({ id: "vel", name: "Velocidad recomendada", type: "number", position: 4, archivedAt: "2026-09-21T00:00:00Z" }),
      atributo({
        id: "color",
        name: "Color",
        type: "list",
        options: ["Negro", "Rojo"],
        required: true,
        scope: "variant",
        position: 5,
      }),
    ];
  });

  function filamento(attributes: Record<string, unknown> = {}) {
    guardar("supply", { categoryId: FILAMENTO, attributes });
  }

  function variante(attributes: Record<string, unknown>) {
    estado.variantesGuardadas.set(VARIANT, {
      id: VARIANT,
      organizationId: ORG,
      itemId: ITEM,
      name: "Negro",
      attributes,
      salePrice: null,
      archivedAt: null,
    });
  }

  it("un color se guarda normalizado y un hex mal escrito se rechaza", async () => {
    // «Un hex mal escrito se rechaza», nivel de acción.
    estado.atributos.push(
      atributo({ id: "tono", name: "Color de rollo", type: "color", scope: "variant", position: 6 }),
    );
    filamento();
    const malo = await createItemVariant({
      id: VARIANT,
      itemId: ITEM,
      name: "Rojo",
      attributes: { color: "Rojo", tono: "rojizo" },
    });
    const bueno = await createItemVariant({
      id: VARIANT,
      itemId: ITEM,
      name: "Rojo",
      attributes: { color: "Rojo", tono: "c62828" },
    });

    expect(malo).toEqual({ error: "«Color de rollo» tiene que ser un color en hex, como #1A1A1A." });
    expect(bueno).toBeUndefined();
    expect(estado.variantesCreadas).toEqual([
      {
        itemId: ITEM,
        id: VARIANT,
        values: expect.objectContaining({ attributes: { color: "Rojo", tono: "#C62828" } }),
      },
    ]);
  });

  it("el servidor rechaza una variante sin su atributo obligatorio", async () => {
    // «El servidor también rechaza el obligatorio vacío».
    filamento();
    const result = await createItemVariant({ id: VARIANT, itemId: ITEM, name: "Negro", attributes: {} });

    expect(result).toEqual({ error: "«Color» es obligatorio." });
    expect(estado.variantesCreadas).toEqual([]);
  });

  it("un número mal escrito y una opción fuera de la lista se rechazan sin escribir", async () => {
    // «Un valor no numérico se rechaza» y «Una opción que no está en la lista
    // se rechaza», nivel de acción.
    filamento();
    const numero = await createItem({
      ...base,
      kind: "supply",
      categoryId: FILAMENTO,
      attributes: { tmin: "caliente" },
    });
    const opcion = await createItemVariant({
      id: VARIANT,
      itemId: ITEM,
      name: "Verde",
      attributes: { color: "Verde" },
    });

    expect(numero).toEqual({ error: "«Temperatura mínima» tiene que ser un número." });
    expect(opcion).toEqual({ error: "«Verde» no es una opción de «Color»." });
    expect(estado.creados).toEqual([]);
    expect(estado.variantesCreadas).toEqual([]);
  });

  it("una opción retirada se conserva si no se toca, y no se asigna de nuevo", async () => {
    // «Una opción retirada se conserva si no se toca» y «Una opción retirada
    // no se asigna de nuevo», nivel de acción.
    filamento();
    variante({ color: "Azul" });
    const conserva = await updateItemVariant({
      id: VARIANT,
      itemId: ITEM,
      name: "Azul oscuro",
      attributes: { color: "Azul" },
    });
    variante({ color: "Negro" });
    const reasigna = await updateItemVariant({
      id: VARIANT,
      itemId: ITEM,
      name: "Negro",
      attributes: { color: "Azul" },
    });

    expect(conserva).toBeUndefined();
    expect(reasigna).toEqual({ error: "«Azul» no es una opción de «Color»." });
    expect(estado.variantesEditadas).toEqual([
      { id: VARIANT, values: expect.objectContaining({ attributes: { color: "Azul" } }) },
    ]);
  });

  it("editar conserva el valor de un atributo archivado", async () => {
    // «Un atributo retirado conserva y muestra su valor», nivel de acción.
    filamento({ vel: 60, tmin: 180 });
    await updateItem({
      ...base,
      kind: "supply",
      categoryId: FILAMENTO,
      attributes: { marca: "Sunlu", tmin: "190" },
    });

    expect(estado.editados).toEqual([
      {
        id: ITEM,
        values: expect.objectContaining({ attributes: { vel: 60, tmin: 190, marca: "Sunlu" } }),
      },
    ]);
  });

  it("cambiar de categoría conserva los valores de la anterior", async () => {
    // «Los valores de la categoría anterior se conservan», nivel de acción.
    filamento({ marca: "Sunlu", tmin: 190 });
    await updateItem({ ...base, kind: "supply", categoryId: SUSTRATOS, attributes: {} });

    expect(estado.editados).toEqual([
      {
        id: ITEM,
        values: expect.objectContaining({
          categoryId: SUSTRATOS,
          attributes: { marca: "Sunlu", tmin: 190 },
        }),
      },
    ]);
  });

  it("un ítem sin categoría ignora la carga de atributos", async () => {
    await createItem({ ...base, kind: "supply", categoryId: null, attributes: { marca: "Sunlu" } });

    expect(estado.creados).toEqual([
      { id: ITEM, values: expect.objectContaining({ attributes: {} }) },
    ]);
  });

  it("sin atributos en la petición, editar no los toca", async () => {
    filamento({ marca: "Sunlu" });
    await updateItem({ ...base, kind: "supply", categoryId: FILAMENTO });

    expect(estado.editados).toEqual([
      { id: ITEM, values: expect.objectContaining({ attributes: undefined }) },
    ]);
  });

  it("el ayudante llena la marca de un filamento y el color de su variante", async () => {
    // «El ayudante llena los atributos», nivel de acción (la sesión simulada
    // es de ayudante).
    await createItem({
      ...base,
      kind: "supply",
      categoryId: FILAMENTO,
      attributes: { marca: "Sunlu", tmin: "200" },
    });
    filamento({ marca: "Sunlu", tmin: 200 });
    await createItemVariant({ id: VARIANT, itemId: ITEM, name: "Negro", attributes: { color: "Negro" } });

    expect(estado.creados).toEqual([
      { id: ITEM, values: expect.objectContaining({ attributes: { marca: "Sunlu", tmin: 200 } }) },
    ]);
    expect(estado.variantesCreadas).toEqual([
      { itemId: ITEM, id: VARIANT, values: expect.objectContaining({ attributes: { color: "Negro" } }) },
    ]);
  });

  it("editar una variante que es de otro ítem se rechaza", async () => {
    filamento();
    estado.variantesGuardadas.set(VARIANT, {
      id: VARIANT,
      organizationId: ORG,
      itemId: MISSING,
      name: "Ajena",
      attributes: {},
      salePrice: null,
      archivedAt: null,
    });
    const result = await updateItemVariant({
      id: VARIANT,
      itemId: ITEM,
      name: "Ajena",
      attributes: { color: "Negro" },
    });

    expect(result).toEqual({ error: expect.any(String) });
    expect(estado.variantesEditadas).toEqual([]);
  });
});
