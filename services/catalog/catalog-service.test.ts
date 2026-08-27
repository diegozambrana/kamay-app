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
  category: "Sustratos",
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

  it("el historial lee de la bitácora, no de una tabla propia", async () => {
    const client = new FakeClient([{ data: [], error: null }]);
    await new ItemService(client.asSupabase()).history(ORG, ITEM);

    expect(client.tables[0]).toBe("activity_log");
    const query = client.queries[0];
    expect(query.has("eq", "table_name", "items")).toBe(true);
    expect(query.has("eq", "record_id", ITEM)).toBe(true);
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
