import { describe, expect, it } from "vitest";

import { FakeClient } from "@/tests/factories/supabase-fake";

import { FairSaleService } from "./fair-sale-service";

const ORG = "11111111-1111-1111-1111-111111111111";
const LINE = "22222222-2222-2222-2222-222222222222";
const SALE = "33333333-3333-3333-3333-333333333333";

const taza = { id: "item-taza", name: "Taza de barro", sale_price: "35.00", business_line_id: LINE };
const maceta = { id: "item-maceta", name: "Maceta", sale_price: "60.00", business_line_id: LINE };
const bolsa = { id: "item-bolsa", name: "Bolsa", sale_price: "5.00", business_line_id: null };

describe("FairSaleService.listSellableProducts", () => {
  it("filtra por organización, tipo producto, no archivados y con precio", async () => {
    const client = new FakeClient([
      { data: [taza], error: null },
      { data: [], error: null },
    ]);
    await new FairSaleService(client.asSupabase()).listSellableProducts(ORG, LINE);

    const query = client.queries[0];
    expect(client.tables[0]).toBe("items");
    // organization_id explícito aunque RLS ya filtre (convención nº 2).
    expect(query.has("eq", "organization_id", ORG)).toBe(true);
    // Ni insumos ni activos: la feria vende productos.
    expect(query.has("eq", "kind", "product")).toBe(true);
    expect(query.has("is", "archived_at", null)).toBe(true);
    // Sin precio no se vende en dos toques.
    expect(query.has("not", "sale_price", "is", null)).toBe(true);
  });

  it("Producto oculto de la venta rápida: pide solo los que se muestran", async () => {
    const client = new FakeClient([
      { data: [taza], error: null },
      { data: [], error: null },
    ]);
    await new FairSaleService(client.asSupabase()).listSellableProducts(ORG, LINE);

    expect(client.queries[0].has("eq", "show_in_fair", true)).toBe(true);
  });

  it("Producto con foto: la miniatura firmada de la foto más reciente", async () => {
    const photo = (id: string, entity: string, createdAt: string) => ({
      id,
      organization_id: ORG,
      entity_type: "item",
      entity_id: entity,
      bucket: "item-photos",
      storage_path: `${ORG}/item/${entity}/${id}.jpg`,
      file_name: `${id}.jpg`,
      mime_type: "image/jpeg",
      size_bytes: 1000,
      uploaded_by: null,
      created_at: createdAt,
      archived_at: null,
    });
    const client = new FakeClient([
      { data: [taza, maceta], error: null },
      { data: [], error: null },
      {
        data: [
          photo("vieja", "item-taza", "2026-09-01T00:00:00Z"),
          photo("nueva", "item-taza", "2026-09-20T00:00:00Z"),
        ],
        error: null,
      },
    ]);
    client.storageResults.signed = {
      data: [
        {
          path: `${ORG}/item/item-taza/nueva.jpg.thumb.webp`,
          signedUrl: "https://firmada/nueva-mini",
        },
        {
          path: `${ORG}/item/item-taza/vieja.jpg.thumb.webp`,
          signedUrl: "https://firmada/vieja-mini",
        },
      ],
      error: null,
    };
    const grid = await new FairSaleService(client.asSupabase()).listSellableProducts(ORG, LINE);

    expect(client.tables[2]).toBe("attachments");
    expect(client.queries[2].has("eq", "entity_type", "item")).toBe(true);
    const byId = new Map(grid.map((p) => [p.id, p]));
    expect(byId.get("item-taza")).toMatchObject({
      photoUrl: "https://firmada/nueva-mini",
      photoAttachmentId: "nueva",
    });
    // Producto sin foto: sin URL, y la tarjeta pinta el sustituto.
    expect(byId.get("item-maceta")).toMatchObject({ photoUrl: null, photoAttachmentId: null });
  });

  it("sin productos no pide fotos", async () => {
    const client = new FakeClient([
      { data: [], error: null },
      { data: [], error: null },
    ]);
    await new FairSaleService(client.asSupabase()).listSellableProducts(ORG, LINE);

    expect(client.tables).not.toContain("attachments");
  });

  it("pide los de la línea activa y también los compartidos", async () => {
    const client = new FakeClient([
      { data: [taza, bolsa], error: null },
      { data: [], error: null },
    ]);
    const grid = await new FairSaleService(client.asSupabase()).listSellableProducts(ORG, LINE);

    expect(client.queries[0].argsOf("or")?.[0]).toContain("business_line_id.is.null");
    expect(grid.map((p) => p.id)).toContain("item-bolsa");
  });

  it("lee las ventas recientes de la línea, no de toda la organización", async () => {
    const client = new FakeClient([
      { data: [taza], error: null },
      { data: [], error: null },
    ]);
    await new FairSaleService(client.asSupabase()).listSellableProducts(ORG, LINE);

    expect(client.tables[1]).toBe("best_selling_products");
    expect(client.queries[1].has("eq", "business_line_id", LINE)).toBe(true);
  });

  it("ordena por lo más vendido y deja al final lo que nunca se vendió", async () => {
    const client = new FakeClient([
      { data: [taza, maceta, bolsa], error: null },
      {
        data: [
          { item_id: "item-maceta", quantity_sold: "4" },
          { item_id: "item-taza", quantity_sold: "30" },
        ],
        error: null,
      },
    ]);
    const grid = await new FairSaleService(client.asSupabase()).listSellableProducts(ORG, LINE);

    expect(grid.map((p) => p.id)).toEqual(["item-taza", "item-maceta", "item-bolsa"]);
  });

  it("un producto sin ventas aparece igual, con cero", async () => {
    const client = new FakeClient([
      { data: [bolsa], error: null },
      { data: [], error: null },
    ]);
    const grid = await new FairSaleService(client.asSupabase()).listSellableProducts(ORG, LINE);

    expect(grid).toHaveLength(1);
    expect(grid[0].quantitySold).toBe(0);
  });

  it("convierte el precio a número: la base lo devuelve como texto", async () => {
    const client = new FakeClient([
      { data: [taza], error: null },
      { data: [], error: null },
    ]);
    const grid = await new FairSaleService(client.asSupabase()).listSellableProducts(ORG, LINE);

    expect(grid[0].salePrice).toBe(35);
  });

  it("propaga el error de la consulta en vez de devolver una cuadrícula vacía", async () => {
    const client = new FakeClient([{ data: null, error: { message: "sin permiso" } }]);

    await expect(
      new FairSaleService(client.asSupabase()).listSellableProducts(ORG, LINE),
    ).rejects.toThrow("sin permiso");
  });

  it("propaga el error de las ventas recientes", async () => {
    const client = new FakeClient([
      { data: [taza], error: null },
      { data: null, error: { message: "vista caída" } },
    ]);

    await expect(
      new FairSaleService(client.asSupabase()).listSellableProducts(ORG, LINE),
    ).rejects.toThrow("vista caída");
  });
});

/**
 * `fair-all-lines` · Con la bandera, la cuadrícula es de toda la organización.
 * Escenarios del delta `fair-mode`: «Con la bandera, productos de todas las
 * líneas», «Con la bandera, nada de líneas archivadas», «Con la bandera, el
 * orden es de toda la organización» y «Sin la bandera, nada cambia».
 */
describe("FairSaleService.listSellableProducts · todas las líneas", () => {
  const OTHER = "44444444-4444-4444-4444-444444444444";
  const lines = [
    { id: LINE, name: "Alfarería" },
    { id: OTHER, name: "Sublimación" },
  ];
  const tazaSub = { id: "item-taza-sub", name: "Taza sublimada", sale_price: "45.00", business_line_id: OTHER };

  it("Sin la bandera, nada cambia: la línea de la feria y los compartidos", async () => {
    const client = new FakeClient([
      { data: [taza], error: null },
      { data: [], error: null },
    ]);
    await new FairSaleService(client.asSupabase()).listSellableProducts(ORG, LINE, {
      allLines: false,
      lines,
    });

    expect(client.queries[0].argsOf("or")?.[0]).toBe(
      `business_line_id.eq.${LINE},business_line_id.is.null`,
    );
    expect(client.queries[1].has("eq", "business_line_id", LINE)).toBe(true);
  });

  it("Con la bandera, nada de líneas archivadas: pide solo las líneas activas y los compartidos", async () => {
    const client = new FakeClient([
      { data: [taza, tazaSub], error: null },
      { data: [], error: null },
    ]);
    await new FairSaleService(client.asSupabase()).listSellableProducts(ORG, LINE, {
      allLines: true,
      lines,
    });

    expect(client.queries[0].argsOf("or")?.[0]).toBe(
      `business_line_id.in.(${LINE},${OTHER}),business_line_id.is.null`,
    );
  });

  it("Con la bandera, productos de todas las líneas, con el nombre de su línea", async () => {
    const client = new FakeClient([
      { data: [taza, tazaSub, bolsa], error: null },
      { data: [], error: null },
    ]);
    const grid = await new FairSaleService(client.asSupabase()).listSellableProducts(ORG, LINE, {
      allLines: true,
      lines,
    });

    const byId = new Map(grid.map((p) => [p.id, p]));
    expect(byId.get("item-taza-sub")?.businessLineName).toBe("Sublimación");
    expect(byId.get("item-taza")?.businessLineName).toBe("Alfarería");
    expect(byId.get("item-bolsa")?.businessLineName).toBeNull();
  });

  it("Con la bandera, el orden es de toda la organización", async () => {
    const client = new FakeClient([
      { data: [taza, tazaSub], error: null },
      {
        data: [
          { item_id: "item-taza", quantity_sold: "4" },
          { item_id: "item-taza-sub", quantity_sold: "20" },
          { item_id: "item-taza-sub", quantity_sold: "10" },
        ],
        error: null,
      },
    ]);
    const grid = await new FairSaleService(client.asSupabase()).listSellableProducts(ORG, LINE, {
      allLines: true,
      lines,
    });

    // Las ventas no se filtran por la línea de la feria.
    expect(client.queries[1].has("eq", "business_line_id", LINE)).toBe(false);
    expect(client.queries[1].has("eq", "organization_id", ORG)).toBe(true);
    expect(grid.map((p) => p.id)).toEqual(["item-taza-sub", "item-taza"]);
    expect(grid[0].quantitySold).toBe(30);
  });
});

describe("FairSaleService.createMany", () => {
  it("registra el lote con una sola llamada a create_direct_sales", async () => {
    const client = new FakeClient([{ data: ["s1", "s2"], error: null }]);
    const base = {
      organizationId: ORG,
      contactId: null,
      salesChannelId: "canal",
      occurredAt: "2026-09-26T15:40:00.000Z",
      notes: null,
    };

    const ids = await new FairSaleService(client.asSupabase()).createMany([
      {
        ...base,
        id: "s1",
        businessLineId: LINE,
        items: [{ id: "l1", itemId: "taza", variantId: null, description: null, quantity: 2, unitPrice: 45 }],
        payment: { id: "p1", amount: 90, method: "cash" },
      },
      {
        ...base,
        id: "s2",
        businessLineId: "otra",
        items: [{ id: "l2", itemId: "maceta", variantId: null, description: null, quantity: 1, unitPrice: 60 }],
        payment: null,
      },
    ]);

    expect(ids).toEqual(["s1", "s2"]);
    expect(client.rpcCalls).toHaveLength(1);
    expect(client.rpcCalls[0].name).toBe("create_direct_sales");
    const [first, second] = (client.rpcCalls[0].params as { p_sales: Record<string, unknown>[] })
      .p_sales;
    expect(first).toMatchObject({
      sale: { id: "s1", business_line_id: LINE, sales_channel_id: "canal", occurred_at: base.occurredAt },
      items: [{ id: "l1", item_id: "taza", quantity: 2, unit_price: 45 }],
      payment: { id: "p1", amount: 90, method: "cash", occurred_at: base.occurredAt },
    });
    expect(second).toMatchObject({ sale: { id: "s2", business_line_id: "otra" }, payment: null });
  });

  it("propaga el error de la base", async () => {
    const client = new FakeClient([{ data: null, error: { message: "La línea no tiene un estado final configurado" } }]);

    await expect(new FairSaleService(client.asSupabase()).createMany([])).rejects.toThrow(
      "estado final",
    );
  });
});

describe("FairSaleService.create", () => {
  const sale = {
    id: SALE,
    organizationId: ORG,
    businessLineId: LINE,
    contactId: null,
    salesChannelId: null,
    occurredAt: "2026-09-01T15:40:00.000Z",
    notes: null,
    items: [
      {
        id: "line-1",
        itemId: "item-taza",
        variantId: null,
        description: null,
        quantity: 2,
        unitPrice: 35,
      },
    ],
    payment: { id: "pay-1", amount: 70, method: "cash" as const },
  };

  it("llama a create_direct_sale con una sola llamada", async () => {
    const client = new FakeClient([{ data: SALE, error: null }]);
    await new FairSaleService(client.asSupabase()).create(sale);

    expect(client.rpcCalls).toHaveLength(1);
    expect(client.rpcCalls[0].name).toBe("create_direct_sale");
  });

  it("manda el cobro dentro de la misma llamada, no en una segunda", async () => {
    const client = new FakeClient([{ data: SALE, error: null }]);
    await new FairSaleService(client.asSupabase()).create(sale);

    const params = client.rpcCalls[0].params as { p_payment: { amount: number } | null };
    expect(params.p_payment?.amount).toBe(70);
    expect(client.rpcCalls).toHaveLength(1);
  });

  it("el cobro hereda la hora del hecho de la venta", async () => {
    const client = new FakeClient([{ data: SALE, error: null }]);
    await new FairSaleService(client.asSupabase()).create(sale);

    const params = client.rpcCalls[0].params as {
      p_sale: { occurred_at: string };
      p_payment: { occurred_at: string };
    };
    expect(params.p_payment.occurred_at).toBe(params.p_sale.occurred_at);
    expect(params.p_sale.occurred_at).toBe("2026-09-01T15:40:00.000Z");
  });

  it("una venta sin cobro manda p_payment nulo", async () => {
    const client = new FakeClient([{ data: SALE, error: null }]);
    await new FairSaleService(client.asSupabase()).create({ ...sale, payment: null });

    const params = client.rpcCalls[0].params as { p_payment: unknown };
    expect(params.p_payment).toBeNull();
  });

  it("manda el id de cliente de la venta y de cada línea", async () => {
    const client = new FakeClient([{ data: SALE, error: null }]);
    await new FairSaleService(client.asSupabase()).create(sale);

    const params = client.rpcCalls[0].params as {
      p_sale: { id: string };
      p_items: { id: string; unit_price: number }[];
    };
    expect(params.p_sale.id).toBe(SALE);
    expect(params.p_items[0].id).toBe("line-1");
    expect(params.p_items[0].unit_price).toBe(35);
  });

  it("devuelve el identificador de la venta cuando la base no devuelve nada", async () => {
    const client = new FakeClient([{ data: null, error: null }]);

    await expect(new FairSaleService(client.asSupabase()).create(sale)).resolves.toBe(SALE);
  });

  it("propaga el mensaje de la base tal como llega", async () => {
    const client = new FakeClient([
      { data: null, error: { message: "Una venta necesita al menos una línea" } },
    ]);

    await expect(new FairSaleService(client.asSupabase()).create(sale)).rejects.toThrow(
      "Una venta necesita al menos una línea",
    );
  });
});
