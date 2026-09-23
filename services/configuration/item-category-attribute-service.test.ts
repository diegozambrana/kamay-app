import { describe, expect, it } from "vitest";

import { FakeClient } from "@/tests/factories/supabase-fake";

import { ItemCategoryAttributeService } from "./item-category-attribute-service";

const ORG = "11111111-1111-1111-1111-111111111111";
const CATEGORY = "22222222-2222-2222-2222-222222222222";
const OTHER = "33333333-3333-3333-3333-333333333333";
const ATTRIBUTE = "44444444-4444-4444-4444-444444444444";

const row = {
  id: ATTRIBUTE,
  organization_id: ORG,
  category_id: CATEGORY,
  name: "Color",
  type: "list",
  unit: null,
  options: ["Negro", "Rojo"],
  required: true,
  scope: "variant",
  position: 5,
  archived_at: null,
};

describe("ItemCategoryAttributeService", () => {
  it("lista los vigentes de una categoría, de la organización, por posición", async () => {
    const client = new FakeClient([{ data: [row], error: null }]);
    const attributes = await new ItemCategoryAttributeService(
      client.asSupabase(),
    ).listForCategory(ORG, CATEGORY);

    const query = client.queries[0];
    expect(client.tables[0]).toBe("item_category_attributes");
    expect(query.has("eq", "organization_id", ORG)).toBe(true);
    expect(query.has("in", "category_id", [CATEGORY])).toBe(true);
    expect(query.has("is", "archived_at", null)).toBe(true);
    expect(query.has("order", "position", { ascending: true })).toBe(true);
    expect(attributes).toEqual([
      {
        id: ATTRIBUTE,
        organizationId: ORG,
        categoryId: CATEGORY,
        name: "Color",
        type: "list",
        unit: null,
        options: ["Negro", "Rojo"],
        required: true,
        scope: "variant",
        position: 5,
        archivedAt: null,
      },
    ]);
  });

  it("con los archivados no filtra lo archivado", async () => {
    const client = new FakeClient([{ data: [], error: null }]);
    await new ItemCategoryAttributeService(client.asSupabase()).listForCategory(ORG, CATEGORY, {
      includeArchived: true,
    });
    expect(client.queries[0].has("is", "archived_at", null)).toBe(false);
  });

  it("carga los vigentes de varias categorías en una consulta", async () => {
    const client = new FakeClient([{ data: [row], error: null }]);
    await new ItemCategoryAttributeService(client.asSupabase()).listActiveForCategories(ORG, [
      CATEGORY,
      OTHER,
    ]);
    expect(client.queries).toHaveLength(1);
    expect(client.queries[0].has("in", "category_id", [CATEGORY, OTHER])).toBe(true);
    expect(client.queries[0].has("is", "archived_at", null)).toBe(true);
  });

  it("sin categorías no consulta", async () => {
    const client = new FakeClient([]);
    const attributes = await new ItemCategoryAttributeService(
      client.asSupabase(),
    ).listActiveForCategories(ORG, []);
    expect(attributes).toEqual([]);
    expect(client.queries).toHaveLength(0);
  });

  it("descarta opciones que no son texto", async () => {
    const client = new FakeClient([{ data: [{ ...row, options: ["Negro", 3, null] }], error: null }]);
    const [attribute] = await new ItemCategoryAttributeService(
      client.asSupabase(),
    ).listForCategory(ORG, CATEGORY);
    expect(attribute.options).toEqual(["Negro"]);
  });

  it("crear pone el atributo al final, contando los archivados", async () => {
    const client = new FakeClient([
      { data: [{ position: 4 }], error: null },
      { data: row, error: null },
    ]);
    await new ItemCategoryAttributeService(client.asSupabase()).create(ORG, {
      categoryId: CATEGORY,
      name: "Color",
      type: "list",
      unit: null,
      options: ["Negro", "Rojo"],
      required: true,
      scope: "variant",
    });

    const lookup = client.queries[0];
    expect(lookup.has("eq", "category_id", CATEGORY)).toBe(true);
    expect(lookup.has("is", "archived_at", null)).toBe(false);
    expect(lookup.has("order", "position", { ascending: false })).toBe(true);

    expect(client.queries[1].argsOf("insert")?.[0]).toEqual({
      category_id: CATEGORY,
      name: "Color",
      type: "list",
      unit: null,
      options: ["Negro", "Rojo"],
      required: true,
      scope: "variant",
      position: 5,
      organization_id: ORG,
    });
  });

  it("el primer atributo de una categoría va en la posición 1", async () => {
    const client = new FakeClient([
      { data: [], error: null },
      { data: row, error: null },
    ]);
    await new ItemCategoryAttributeService(client.asSupabase()).create(ORG, {
      categoryId: CATEGORY,
      name: "Marca",
      type: "text",
      unit: null,
      options: [],
      required: false,
      scope: "item",
    });
    expect((client.queries[1].argsOf("insert")?.[0] as { position: number }).position).toBe(1);
  });

  // «Type and scope cannot change», nivel de servicio.
  it("editar no escribe tipo, alcance ni categoría", async () => {
    const client = new FakeClient([{ data: row, error: null }]);
    await new ItemCategoryAttributeService(client.asSupabase()).update(ORG, ATTRIBUTE, {
      name: "Color de rollo",
      unit: null,
      options: ["Negro", "Rojo", "Azul"],
      required: true,
    });

    const patch = client.queries[0].argsOf("update")?.[0] as Record<string, unknown>;
    expect(patch).toMatchObject({ name: "Color de rollo", options: ["Negro", "Rojo", "Azul"] });
    expect(patch).not.toHaveProperty("type");
    expect(patch).not.toHaveProperty("scope");
    expect(patch).not.toHaveProperty("category_id");
    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);
  });

  it("busca un atributo por id dentro de la organización", async () => {
    const client = new FakeClient([{ data: row, error: null }]);
    const found = await new ItemCategoryAttributeService(client.asSupabase()).findById(
      ORG,
      ATTRIBUTE,
    );
    expect(found?.name).toBe("Color");
    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);
    expect(client.queries[0].has("eq", "id", ATTRIBUTE)).toBe(true);
  });
});
