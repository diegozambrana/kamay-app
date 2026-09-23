import { beforeEach, describe, expect, it, vi } from "vitest";

const ORG = "11111111-1111-4111-8111-111111111111";
/** Con la forma de los de la semilla: sin versión RFC en su sitio. */
const SEED_LINE = "10000000-0000-0000-0000-000000000001";
const SEED_CHANNEL = "20000000-0000-0000-0000-000000000002";

/** Qué se le pidió a cada servicio, reiniciado en cada prueba. */
const estado = vi.hoisted(() => ({
  llamadas: [] as { servicio: string; metodo: string; id: string }[],
  esDuenna: true,
  categorias: [] as { metodo: string; valores: unknown }[],
  atributos: [] as { metodo: string; valores: unknown }[],
  categoriaExiste: true,
  atributoGuardado: null as null | { id: string; type: string },
  fallo: null as Error | null,
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

vi.mock("@/lib/auth/session-context", () => ({
  getOwnerContext: async () =>
    estado.esDuenna ? { supabase: {}, organizationId: ORG } : null,
}));

function servicio(nombre: string) {
  return class {
    async rename(_org: string, id: string) {
      estado.llamadas.push({ servicio: nombre, metodo: "rename", id });
    }
    async archive(_org: string, id: string) {
      estado.llamadas.push({ servicio: nombre, metodo: "archive", id });
    }
    async unarchive(_org: string, id: string) {
      estado.llamadas.push({ servicio: nombre, metodo: "unarchive", id });
    }
  };
}

vi.mock("@/services/configuration/business-line-service", () => ({
  BusinessLineService: servicio("line"),
}));
vi.mock("@/services/configuration/sales-channel-service", () => ({
  SalesChannelService: servicio("channel"),
}));
vi.mock("@/services/configuration/expense-category-service", () => ({
  ExpenseCategoryService: servicio("category"),
}));
vi.mock("@/services/configuration/unit-service", () => ({
  UnitService: servicio("unit"),
}));
vi.mock("@/services/configuration/item-category-service", () => ({
  ItemCategoryService: class {
    async create(_org: string, valores: unknown) {
      if (estado.fallo) throw estado.fallo;
      estado.categorias.push({ metodo: "create", valores });
    }
    async rename(_org: string, id: string, valores: unknown) {
      if (estado.fallo) throw estado.fallo;
      estado.categorias.push({ metodo: "rename", valores: { id, ...(valores as object) } });
    }
    async findById(_org: string, id: string) {
      return estado.categoriaExiste ? { id } : null;
    }
    async archive(_org: string, id: string) {
      estado.llamadas.push({ servicio: "itemCategory", metodo: "archive", id });
    }
    async unarchive(_org: string, id: string) {
      estado.llamadas.push({ servicio: "itemCategory", metodo: "unarchive", id });
    }
  },
}));
vi.mock("@/services/configuration/item-category-attribute-service", () => ({
  ItemCategoryAttributeService: class {
    async create(_org: string, valores: unknown) {
      if (estado.fallo) throw estado.fallo;
      estado.atributos.push({ metodo: "create", valores });
    }
    async update(_org: string, id: string, valores: unknown) {
      if (estado.fallo) throw estado.fallo;
      estado.atributos.push({ metodo: "update", valores: { id, ...(valores as object) } });
    }
    async findById() {
      return estado.atributoGuardado;
    }
    async archive(_org: string, id: string) {
      estado.llamadas.push({ servicio: "itemCategoryAttribute", metodo: "archive", id });
    }
    async unarchive(_org: string, id: string) {
      estado.llamadas.push({ servicio: "itemCategoryAttribute", metodo: "unarchive", id });
    }
  },
}));

const {
  archiveConfigurationItem,
  createItemCategory,
  createItemCategoryAttribute,
  updateItemCategoryAttribute,
  unarchiveConfigurationItem,
  updateBusinessLine,
  updateItemCategory,
  updateSalesChannel,
} = await import("./configuration");

beforeEach(() => {
  estado.llamadas = [];
  estado.esDuenna = true;
  estado.categorias = [];
  estado.atributos = [];
  estado.categoriaExiste = true;
  estado.atributoGuardado = null;
  estado.fallo = null;
});

/**
 * Los registros de la semilla tienen identificadores escritos a mano, sin la
 * versión RFC en su sitio. Con `z.uuid()` editarlos o archivarlos fallaba con
 * «Invalid UUID»; solo los creados desde la aplicación (UUID v4) pasaban.
 */
describe("acciones de configuración con identificadores de la semilla", () => {
  it("editar una línea sembrada llega al servicio", async () => {
    const result = await updateBusinessLine({ id: SEED_LINE, name: "Sublimación 2", color: "blue" });

    expect(result).toBeUndefined();
    expect(estado.llamadas).toEqual([{ servicio: "line", metodo: "rename", id: SEED_LINE }]);
  });

  it("editar un canal sembrado llega al servicio", async () => {
    const result = await updateSalesChannel({ id: SEED_CHANNEL, name: "Feria UP" });

    expect(result).toBeUndefined();
    expect(estado.llamadas).toEqual([{ servicio: "channel", metodo: "rename", id: SEED_CHANNEL }]);
  });

  it("archivar y restaurar lo sembrado también llega al servicio", async () => {
    expect(await archiveConfigurationItem({ entity: "channel", id: SEED_CHANNEL })).toBeUndefined();
    expect(await unarchiveConfigurationItem({ entity: "channel", id: SEED_CHANNEL })).toBeUndefined();

    expect(estado.llamadas.map((l) => l.metodo)).toEqual(["archive", "unarchive"]);
  });

  it("un identificador que no es un UUID se rechaza en español, sin llegar al servicio", async () => {
    const result = await updateSalesChannel({ id: "no-es-un-id", name: "Feria UP" });

    expect(result).toEqual({ error: "No se pudo identificar el registro." });
    expect(estado.llamadas).toEqual([]);
  });
});

/**
 * Cambio `item-categories`: alta, edición y archivado de categorías de ítem.
 * Escenario «The kind of a category cannot change», a nivel de acción.
 */
describe("categorías de ítem", () => {
  const CATEGORY = "33333333-3333-4333-8333-333333333333";

  it("crear llega al servicio con el tipo y el nombre recortado", async () => {
    const result = await createItemCategory({ kind: "supply", name: "  Sustratos " });

    expect(result).toBeUndefined();
    expect(estado.categorias).toEqual([
      { metodo: "create", valores: { kind: "supply", name: "Sustratos" } },
    ]);
  });

  it("editar solo cambia el nombre, aunque la petición traiga un tipo", async () => {
    await updateItemCategory({
      id: CATEGORY,
      name: "Tintas",
      ...({ kind: "product" } as object),
    } as { id: string; name: string });

    expect(estado.categorias).toEqual([
      { metodo: "rename", valores: { id: CATEGORY, name: "Tintas" } },
    ]);
  });

  it("sin contexto de dueña no se llama al servicio", async () => {
    estado.esDuenna = false;

    const result = await createItemCategory({ kind: "supply", name: "Sustratos" });

    expect(result).toEqual({ error: expect.any(String) });
    expect(estado.categorias).toEqual([]);
  });

  it("un nombre repetido se explica en español", async () => {
    estado.fallo = new Error(
      'duplicate key value violates unique constraint "item_categories_name_key"',
    );

    const result = await createItemCategory({ kind: "supply", name: "sustratos" });

    expect(result).toEqual({ error: "Ya existe un registro con ese nombre." });
  });

  it("un tipo fuera del juego se rechaza sin llegar al servicio", async () => {
    const result = await createItemCategory({
      kind: "machine" as "supply",
      name: "Fuera",
    });

    expect(result).toEqual({ error: expect.any(String) });
    expect(estado.categorias).toEqual([]);
  });

  it("archivar y restaurar una categoría de ítem llegan a su servicio", async () => {
    await archiveConfigurationItem({ entity: "itemCategory", id: CATEGORY });
    await unarchiveConfigurationItem({ entity: "itemCategory", id: CATEGORY });

    expect(estado.llamadas).toEqual([
      { servicio: "itemCategory", metodo: "archive", id: CATEGORY },
      { servicio: "itemCategory", metodo: "unarchive", id: CATEGORY },
    ]);
  });
});

/**
 * Cambio `catalog-custom-attributes`: alta, edición y archivado de los
 * atributos de una categoría.
 */
describe("atributos de categoría", () => {
  const CATEGORY = "33333333-3333-4333-8333-333333333333";
  const ATTRIBUTE = "44444444-4444-4444-8444-444444444444";

  it("crear llega al servicio con la definición normalizada", async () => {
    // «Owner declares the attributes of a category», nivel de acción.
    const result = await createItemCategoryAttribute({
      categoryId: CATEGORY,
      name: " Color ",
      type: "list",
      scope: "variant",
      required: true,
      unit: "kg",
      options: ["Negro", " Rojo ", ""],
    });

    expect(result).toBeUndefined();
    expect(estado.atributos).toEqual([
      {
        metodo: "create",
        valores: {
          categoryId: CATEGORY,
          name: "Color",
          type: "list",
          scope: "variant",
          required: true,
          unit: null,
          options: ["Negro", "Rojo"],
        },
      },
    ]);
  });

  it("sin contexto de dueña no se llama al servicio", async () => {
    // «The assistant cannot define attributes», nivel de acción.
    estado.esDuenna = false;
    const result = await createItemCategoryAttribute({
      categoryId: CATEGORY,
      name: "Marca",
      type: "text",
      scope: "item",
    });

    expect(result).toEqual({ error: expect.any(String) });
    expect(estado.atributos).toEqual([]);
  });

  it("una categoría que no es de la organización se rechaza antes de escribir", async () => {
    estado.categoriaExiste = false;
    const result = await createItemCategoryAttribute({
      categoryId: CATEGORY,
      name: "Marca",
      type: "text",
      scope: "item",
    });

    expect(result).toEqual({ error: "No se encontró la categoría." });
    expect(estado.atributos).toEqual([]);
  });

  it("un nombre repetido en la categoría se explica en español", async () => {
    // «Duplicate attribute name in the same category is rejected», nivel de acción.
    estado.fallo = new Error(
      'duplicate key value violates unique constraint "item_category_attributes_name_key"',
    );
    const result = await createItemCategoryAttribute({
      categoryId: CATEGORY,
      name: "color",
      type: "text",
      scope: "item",
    });

    expect(result).toEqual({ error: "Ya existe un atributo con ese nombre en esta categoría." });
  });

  it("una lista sin opciones se rechaza sin llegar al servicio", async () => {
    const result = await createItemCategoryAttribute({
      categoryId: CATEGORY,
      name: "Acabado",
      type: "list",
      scope: "item",
      options: [],
    });

    expect(result).toEqual({ error: "Una lista necesita al menos una opción." });
    expect(estado.atributos).toEqual([]);
  });

  it("editar no pasa tipo ni alcance, y normaliza según el tipo guardado", async () => {
    // «Type and scope cannot change», nivel de acción.
    estado.atributoGuardado = { id: ATTRIBUTE, type: "number" };
    await updateItemCategoryAttribute({
      id: ATTRIBUTE,
      name: "Temperatura",
      unit: "°C",
      options: ["no corresponde"],
      required: false,
      ...({ type: "list", scope: "variant" } as object),
    } as { id: string; name: string });

    expect(estado.atributos).toEqual([
      {
        metodo: "update",
        valores: { id: ATTRIBUTE, name: "Temperatura", unit: "°C", options: [], required: false },
      },
    ]);
  });

  it("editar una lista dejándola sin opciones se rechaza", async () => {
    estado.atributoGuardado = { id: ATTRIBUTE, type: "list" };
    const result = await updateItemCategoryAttribute({ id: ATTRIBUTE, name: "Color", options: [] });

    expect(result).toEqual({ error: "Una lista necesita al menos una opción." });
    expect(estado.atributos).toEqual([]);
  });

  it("editar un atributo que no existe se rechaza", async () => {
    const result = await updateItemCategoryAttribute({ id: ATTRIBUTE, name: "Color" });
    expect(result).toEqual({ error: "No se encontró el atributo." });
  });

  it("archivar y restaurar un atributo llegan a su servicio", async () => {
    await archiveConfigurationItem({ entity: "itemCategoryAttribute", id: ATTRIBUTE });
    await unarchiveConfigurationItem({ entity: "itemCategoryAttribute", id: ATTRIBUTE });

    expect(estado.llamadas).toEqual([
      { servicio: "itemCategoryAttribute", metodo: "archive", id: ATTRIBUTE },
      { servicio: "itemCategoryAttribute", metodo: "unarchive", id: ATTRIBUTE },
    ]);
  });
});
