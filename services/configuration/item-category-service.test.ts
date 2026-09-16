import { describe, expect, it } from "vitest";

import { FakeClient } from "@/tests/factories/supabase-fake";

import { ItemCategoryService } from "./item-category-service";

const ORG = "11111111-1111-1111-1111-111111111111";
const CATEGORY = "22222222-2222-2222-2222-222222222222";

const row = {
  id: CATEGORY,
  organization_id: ORG,
  kind: "supply",
  name: "Sustratos",
  archived_at: null,
};

describe("ItemCategoryService", () => {
  it("lista las vigentes de un tipo, de la organización, por nombre", async () => {
    const client = new FakeClient([{ data: [row], error: null }]);
    const categories = await new ItemCategoryService(
      client.asSupabase(),
    ).listByKind(ORG, "supply");

    const query = client.queries[0];
    expect(client.tables[0]).toBe("item_categories");
    expect(query.has("eq", "organization_id", ORG)).toBe(true);
    expect(query.has("eq", "kind", "supply")).toBe(true);
    expect(query.has("is", "archived_at", null)).toBe(true);
    expect(query.has("order", "name", { ascending: true })).toBe(true);
    expect(categories).toEqual([
      { id: CATEGORY, organizationId: ORG, kind: "supply", name: "Sustratos", archivedAt: null },
    ]);
  });

  it("con las archivadas no filtra lo archivado", async () => {
    const client = new FakeClient([{ data: [row], error: null }]);
    await new ItemCategoryService(client.asSupabase()).listByKind(ORG, "product", {
      includeArchived: true,
    });

    expect(client.queries[0].has("is", "archived_at", null)).toBe(false);
    expect(client.queries[0].has("eq", "kind", "product")).toBe(true);
  });

  it("crear escribe el tipo y el nombre", async () => {
    const client = new FakeClient([{ data: row, error: null }]);
    await new ItemCategoryService(client.asSupabase()).create(ORG, {
      kind: "supply",
      name: "Sustratos",
    });

    expect(client.queries[0].argsOf("insert")?.[0]).toEqual({
      kind: "supply",
      name: "Sustratos",
      organization_id: ORG,
    });
  });

  // «The kind of a category cannot change», a nivel de servicio.
  it("renombrar no escribe el tipo", async () => {
    const client = new FakeClient([{ data: row, error: null }]);
    await new ItemCategoryService(client.asSupabase()).rename(ORG, CATEGORY, {
      name: "Sustratos y tazas",
    });

    const patch = client.queries[0].argsOf("update")?.[0] as Record<string, unknown>;
    expect(patch.name).toBe("Sustratos y tazas");
    expect(patch).not.toHaveProperty("kind");
    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);
  });

  it("busca una categoría por id dentro de la organización", async () => {
    const client = new FakeClient([{ data: null, error: null }]);
    const found = await new ItemCategoryService(client.asSupabase()).findById(
      ORG,
      CATEGORY,
    );

    expect(found).toBeNull();
    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);
    expect(client.queries[0].has("eq", "id", CATEGORY)).toBe(true);
  });
});
