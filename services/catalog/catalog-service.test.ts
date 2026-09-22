import { describe, expect, it } from "vitest";

import { FakeClient } from "@/tests/factories/supabase-fake";

import { ContactService } from "./contact-service";
import { ItemService } from "./item-service";
import { ItemVariantService } from "./item-variant-service";

const ORG = "11111111-1111-1111-1111-111111111111";
const LINE = "22222222-2222-2222-2222-222222222222";
const ITEM = "33333333-3333-3333-3333-333333333333";

const itemRow = {
  id: ITEM,
  organization_id: ORG,
  business_line_id: LINE,
  kind: "supply",
  name: "Taza para sublimación",
  description: null,
  unit_id: null,
  category_id: null,
  // PostgREST entrega `numeric` como texto: no se pierde precisión.
  sale_price: "45.50",
  min_stock: "12",
  archived_at: null,
};

const contactRow = {
  id: "44444444-4444-4444-4444-444444444444",
  organization_id: ORG,
  name: "Distribuidora Andina",
  phone: null,
  email: null,
  address: null,
  is_supplier: true,
  is_customer: false,
  notes: null,
  archived_at: null,
};

describe("ItemService", () => {
  it("filtra por organización y esconde lo archivado por defecto", async () => {
    const client = new FakeClient([{ data: [itemRow], error: null }]);
    await new ItemService(client.asSupabase()).list(ORG);

    const query = client.queries[0];
    expect(client.tables[0]).toBe("items");
    // organization_id explícito aunque RLS ya filtre (convención nº 2).
    expect(query.has("eq", "organization_id", ORG)).toBe(true);
    expect(query.has("is", "archived_at", null)).toBe(true);
  });

  it("con «ver archivados» no aplica el filtro de archivados", async () => {
    const client = new FakeClient([{ data: [itemRow], error: null }]);
    await new ItemService(client.asSupabase()).list(ORG, {
      includeArchived: true,
    });

    expect(client.queries[0].has("is", "archived_at", null)).toBe(false);
  });

  it("busca con el término normalizado contra el nombre normalizado", async () => {
    const client = new FakeClient([{ data: [itemRow], error: null }]);
    await new ItemService(client.asSupabase()).list(ORG, {
      search: "  SUBLIMACIÓN ",
    });

    expect(client.queries[0].has("like", "search_name", "%sublimacion%")).toBe(
      true,
    );
  });

  it("un término en blanco no añade filtro de búsqueda", async () => {
    const client = new FakeClient([{ data: [itemRow], error: null }]);
    await new ItemService(client.asSupabase()).list(ORG, { search: "   " });

    expect(client.queries[0].argsOf("like")).toBeUndefined();
  });

  it("«compartido» pide los ítems sin línea, no los de una línea", async () => {
    const client = new FakeClient([{ data: [itemRow], error: null }]);
    await new ItemService(client.asSupabase()).list(ORG, {
      businessLineId: "shared",
    });

    expect(client.queries[0].has("is", "business_line_id", null)).toBe(true);
  });

  it("convierte los numeric de texto a número", async () => {
    const client = new FakeClient([{ data: [itemRow], error: null }]);
    const [item] = await new ItemService(client.asSupabase()).list(ORG);

    expect(item).toMatchObject({
      salePrice: 45.5,
      minStock: 12,
      businessLineId: LINE,
      kind: "supply",
    });
  });

  it("archivar y desarchivar viajan como el cambio de archived_at", async () => {
    const client = new FakeClient([{ data: null, error: null }]);
    await new ItemService(client.asSupabase()).setArchived(ORG, ITEM, false);

    const query = client.queries[0];
    expect(query.has("update", { archived_at: null })).toBe(true);
    expect(query.has("eq", "organization_id", ORG)).toBe(true);
  });

  // «Filtrar por categoría» y «Filtrar los ítems sin categoría», a nivel de
  // servicio.
  it("una categoría filtra por su id; «none», los que no tienen", async () => {
    const CATEGORY = "44444444-4444-4444-4444-444444444444";
    const client = new FakeClient([
      { data: [itemRow], error: null },
      { data: [itemRow], error: null },
      { data: [itemRow], error: null },
    ]);
    const service = new ItemService(client.asSupabase());

    await service.list(ORG, { categoryId: CATEGORY });
    await service.list(ORG, { categoryId: "none" });
    await service.list(ORG, { categoryId: null });

    expect(client.queries[0].has("eq", "category_id", CATEGORY)).toBe(true);
    expect(client.queries[1].has("is", "category_id", null)).toBe(true);
    expect(client.queries[2].argsOf("eq")?.[0]).toBe("organization_id");
    expect(client.queries[2].calls.some((call) => call.args[0] === "category_id")).toBe(
      false,
    );
  });

  it("crear y editar escriben la categoría", async () => {
    const CATEGORY = "44444444-4444-4444-4444-444444444444";
    const values = {
      name: "Taza para sublimación",
      kind: "supply" as const,
      businessLineId: LINE,
      unitId: null,
      categoryId: CATEGORY,
      description: null,
      salePrice: null,
      minStock: 12,
    };
    const client = new FakeClient([
      { data: itemRow, error: null },
      { data: itemRow, error: null },
    ]);
    const service = new ItemService(client.asSupabase());

    await service.create(ORG, ITEM, values);
    await service.update(ORG, ITEM, values);

    expect(
      (client.queries[0].argsOf("insert")?.[0] as Record<string, unknown>).category_id,
    ).toBe(CATEGORY);
    expect(
      (client.queries[1].argsOf("update")?.[0] as Record<string, unknown>).category_id,
    ).toBe(CATEGORY);
  });

  // «Filtrar por un atributo de lista», nivel de servicio.
  it("cada atributo elegido filtra por contención sobre los atributos del ítem", async () => {
    const client = new FakeClient([{ data: [itemRow], error: null }]);
    await new ItemService(client.asSupabase()).list(ORG, {
      attributes: { "attr-marca": "Sunlu", "attr-material": "PLA" },
    });

    expect(client.queries[0].has("contains", "attributes", { "attr-marca": "Sunlu" })).toBe(true);
    expect(client.queries[0].has("contains", "attributes", { "attr-material": "PLA" })).toBe(true);
  });

  it("sin atributos elegidos no filtra por atributos", async () => {
    const client = new FakeClient([{ data: [itemRow], error: null }]);
    await new ItemService(client.asSupabase()).list(ORG, {});
    expect(client.queries[0].argsOf("contains")).toBeUndefined();
  });

  it("crear escribe los atributos, y editar solo si llegan", async () => {
    const values = {
      name: "PLA Sunlu",
      kind: "supply" as const,
      businessLineId: LINE,
      unitId: null,
      categoryId: null,
      description: null,
      salePrice: null,
      minStock: null,
    };
    const client = new FakeClient([
      { data: itemRow, error: null },
      { data: itemRow, error: null },
      { data: itemRow, error: null },
      { data: itemRow, error: null },
    ]);
    const service = new ItemService(client.asSupabase());

    await service.create(ORG, ITEM, { ...values, attributes: { marca: "Sunlu" } });
    await service.create(ORG, ITEM, values);
    await service.update(ORG, ITEM, { ...values, attributes: { marca: "eSun" } });
    await service.update(ORG, ITEM, values);

    const written = (i: number, method: string) =>
      client.queries[i].argsOf(method)?.[0] as Record<string, unknown>;
    expect(written(0, "insert").attributes).toEqual({ marca: "Sunlu" });
    expect(written(1, "insert").attributes).toEqual({});
    expect(written(2, "update").attributes).toEqual({ marca: "eSun" });
    expect(written(3, "update")).not.toHaveProperty("attributes");
  });

  it("entrega los atributos guardados, o un objeto vacío", async () => {
    const client = new FakeClient([
      { data: { ...itemRow, attributes: { marca: "Sunlu" } }, error: null },
      { data: { ...itemRow, attributes: null }, error: null },
    ]);
    const service = new ItemService(client.asSupabase());
    expect((await service.findById(ORG, ITEM))?.attributes).toEqual({ marca: "Sunlu" });
    expect((await service.findById(ORG, ITEM))?.attributes).toEqual({});
  });

  // «Editar no cambia el tipo», a nivel de servicio.
  it("editar no escribe el tipo: se fija al crear", async () => {
    const client = new FakeClient([{ data: itemRow, error: null }]);
    await new ItemService(client.asSupabase()).update(ORG, ITEM, {
      name: "Taza para sublimación",
      businessLineId: LINE,
      unitId: null,
      categoryId: null,
      description: null,
      salePrice: null,
      minStock: 12,
    });

    const updated = client.queries[0].argsOf("update")?.[0] as Record<
      string,
      unknown
    >;
    expect(updated).not.toHaveProperty("kind");
    expect(updated.min_stock).toBe(12);
    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);
  });
});

describe("ItemVariantService", () => {
  it("lista las variantes vigentes de un ítem de la organización", async () => {
    const client = new FakeClient([{ data: [], error: null }]);
    await new ItemVariantService(client.asSupabase()).listForItem(ORG, ITEM);

    const query = client.queries[0];
    expect(client.tables[0]).toBe("item_variants");
    expect(query.has("eq", "organization_id", ORG)).toBe(true);
    expect(query.has("eq", "item_id", ITEM)).toBe(true);
    expect(query.has("is", "archived_at", null)).toBe(true);
  });

  it("crea con el identificador que llega del cliente (convención nº 9)", async () => {
    const client = new FakeClient([
      {
        data: {
          id: "55555555-5555-5555-5555-555555555555",
          organization_id: ORG,
          item_id: ITEM,
          name: "11oz",
          attributes: {},
          sale_price: null,
          archived_at: null,
        },
        error: null,
      },
    ]);

    await new ItemVariantService(client.asSupabase()).create(
      ORG,
      ITEM,
      "55555555-5555-5555-5555-555555555555",
      { name: "11oz", salePrice: null },
    );

    const inserted = client.queries[0].argsOf("insert")?.[0] as Record<
      string,
      unknown
    >;
    expect(inserted.id).toBe("55555555-5555-5555-5555-555555555555");
    expect(inserted.organization_id).toBe(ORG);
    expect(inserted.attributes).toEqual({});
  });

  it("escribe los atributos de la variante al crear y al editar, si llegan", async () => {
    const variantRow = {
      id: "55555555-5555-5555-5555-555555555555",
      organization_id: ORG,
      item_id: ITEM,
      name: "Negro",
      attributes: {},
      sale_price: null,
      archived_at: null,
    };
    const client = new FakeClient([
      { data: variantRow, error: null },
      { data: variantRow, error: null },
      { data: variantRow, error: null },
    ]);
    const service = new ItemVariantService(client.asSupabase());

    await service.create(ORG, ITEM, variantRow.id, {
      name: "Negro",
      salePrice: null,
      attributes: { color: "Negro" },
    });
    await service.update(ORG, variantRow.id, {
      name: "Negro",
      salePrice: null,
      attributes: { color: "Negro" },
    });
    await service.update(ORG, variantRow.id, { name: "Negro mate", salePrice: null });

    const written = (i: number, method: string) =>
      client.queries[i].argsOf(method)?.[0] as Record<string, unknown>;
    expect(written(0, "insert").attributes).toEqual({ color: "Negro" });
    expect(written(1, "update").attributes).toEqual({ color: "Negro" });
    expect(written(2, "update")).not.toHaveProperty("attributes");
  });

  it("busca una variante por id dentro de la organización", async () => {
    const client = new FakeClient([{ data: null, error: null }]);
    const found = await new ItemVariantService(client.asSupabase()).findById(ORG, ITEM);
    expect(found).toBeNull();
    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);
    expect(client.queries[0].has("eq", "id", ITEM)).toBe(true);
  });
});

describe("ContactService", () => {
  it("el filtro de proveedores no excluye a quien también es cliente", async () => {
    const client = new FakeClient([{ data: [contactRow], error: null }]);
    await new ContactService(client.asSupabase()).list(ORG, {
      role: "supplier",
    });

    const query = client.queries[0];
    // Solo se pide is_supplier: quien además es cliente sigue apareciendo.
    expect(query.has("eq", "is_supplier", true)).toBe(true);
    expect(query.argsOf("eq")?.[0]).toBe("organization_id");
    expect(query.has("eq", "is_customer", false)).toBe(false);
  });

  it("busca por nombre normalizado y esconde lo archivado", async () => {
    const client = new FakeClient([{ data: [contactRow], error: null }]);
    await new ContactService(client.asSupabase()).list(ORG, {
      search: "ÑAWI",
    });

    const query = client.queries[0];
    expect(query.has("like", "search_name", "%nawi%")).toBe(true);
    expect(query.has("is", "archived_at", null)).toBe(true);
  });

  it("entrega el contacto en camelCase con sus dos roles", async () => {
    const client = new FakeClient([
      { data: { ...contactRow, is_customer: true }, error: null },
    ]);
    const contact = await new ContactService(client.asSupabase()).findById(
      ORG,
      contactRow.id,
    );

    expect(contact).toMatchObject({ isSupplier: true, isCustomer: true });
  });
});

describe("ItemService.listProductsWithVariants", () => {
  const productRow = {
    ...itemRow,
    kind: "product",
    sale_price: "45.00",
  };

  it("pide solo productos vigentes de la organización", async () => {
    const client = new FakeClient([{ data: [], error: null }]);
    await new ItemService(client.asSupabase()).listProductsWithVariants(ORG);

    const query = client.queries[0];
    expect(client.tables[0]).toBe("items");
    expect(query.has("eq", "organization_id", ORG)).toBe(true);
    // `in` y no `eq`: la consulta acepta varios tipos desde que el formulario
    // de compra pide insumos y activos a la vez (KAM-19).
    expect(query.has("in", "kind", ["product"])).toBe(true);
    expect(query.has("is", "archived_at", null)).toBe(true);
  });


describe("ItemService.listPurchasableWithVariants", () => {
  it("pide insumos y activos, nunca productos: lo que se fabrica no se compra", async () => {
    const client = new FakeClient([{ data: [], error: null }]);
    await new ItemService(client.asSupabase()).listPurchasableWithVariants(ORG);

    const query = client.queries[0];
    expect(client.tables[0]).toBe("items");
    expect(query.has("in", "kind", ["supply", "asset"])).toBe(true);
    expect(query.has("eq", "organization_id", ORG)).toBe(true);
    expect(query.has("is", "archived_at", null)).toBe(true);
  });
});
  it("trae las variantes incrustadas y descarta las archivadas", async () => {
    const client = new FakeClient([
      {
        data: [
          {
            ...productRow,
            item_variants: [
              {
                id: "44444444-4444-4444-4444-444444444444",
                organization_id: ORG,
                item_id: ITEM,
                name: "15oz",
                attributes: null,
                sale_price: "55.00",
                archived_at: null,
              },
              {
                id: "55555555-5555-5555-5555-555555555555",
                organization_id: ORG,
                item_id: ITEM,
                name: "11oz",
                attributes: null,
                sale_price: "45.00",
                archived_at: "2026-01-01T00:00:00.000Z",
              },
            ],
          },
        ],
        error: null,
      },
    ]);

    const [product] = await new ItemService(
      client.asSupabase(),
    ).listProductsWithVariants(ORG);

    expect(product.salePrice).toBe(45);
    expect(product.variants).toHaveLength(1);
    expect(product.variants[0].name).toBe("15oz");
    expect(product.variants[0].salePrice).toBe(55);
  });

  /**
   * Un producto con todas sus variantes archivadas sigue siendo vendible: el
   * filtro es de variantes, no del producto padre.
   */
  it("un producto sin variantes vigentes se sigue ofreciendo", async () => {
    const client = new FakeClient([
      { data: [{ ...productRow, item_variants: [] }], error: null },
    ]);

    const products = await new ItemService(
      client.asSupabase(),
    ).listProductsWithVariants(ORG);

    expect(products).toHaveLength(1);
    expect(products[0].variants).toEqual([]);
  });

  it("ordena las variantes por nombre", async () => {
    const variant = (id: string, name: string) => ({
      id,
      organization_id: ORG,
      item_id: ITEM,
      name,
      attributes: null,
      sale_price: null,
      archived_at: null,
    });
    const client = new FakeClient([
      {
        data: [
          {
            ...productRow,
            item_variants: [
              variant("44444444-4444-4444-4444-444444444444", "Roja"),
              variant("55555555-5555-5555-5555-555555555555", "Azul"),
            ],
          },
        ],
        error: null,
      },
    ]);

    const [product] = await new ItemService(
      client.asSupabase(),
    ).listProductsWithVariants(ORG);

    expect(product.variants.map((v) => v.name)).toEqual(["Azul", "Roja"]);
  });
});
