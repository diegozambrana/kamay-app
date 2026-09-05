import { describe, expect, it } from "vitest";

import { FakeClient } from "@/tests/factories/supabase-fake";

import { OrderItemService } from "./order-item-service";
import { OrderService } from "./order-service";

const ORG = "11111111-1111-1111-1111-111111111111";
const LINE = "22222222-2222-2222-2222-222222222222";
const ORDER = "33333333-3333-3333-3333-333333333333";
const STATUS = "44444444-4444-4444-4444-444444444444";

const orderRow = {
  id: ORDER,
  organization_id: ORG,
  business_line_id: LINE,
  kind: "order",
  code: 142,
  contact_id: "55555555-5555-5555-5555-555555555555",
  status_id: STATUS,
  sales_channel_id: null,
  delivery_mode: "delivery",
  due_date: "2026-09-05",
  occurred_at: "2026-08-24T10:00:00.000Z",
  queued_at: "2026-08-24T10:00:00.000Z",
  notes: null,
  archived_at: null,
};

describe("OrderService.list", () => {
  it("filtra por organización y esconde lo archivado por defecto", async () => {
    const client = new FakeClient([
      { data: [orderRow], error: null },
      { data: [{ order_id: ORDER, total: "190.00" }], error: null },
    ]);
    await new OrderService(client.asSupabase()).list(ORG);

    const query = client.queries[0];
    expect(client.tables[0]).toBe("orders");
    // organization_id explícito aunque RLS ya filtre (convención nº 2).
    expect(query.has("eq", "organization_id", ORG)).toBe(true);
    expect(query.has("is", "archived_at", null)).toBe(true);
  });

  it("deja fuera la venta directa: el tablero es de pedidos", async () => {
    const client = new FakeClient([
      { data: [orderRow], error: null },
      { data: [], error: null },
    ]);
    await new OrderService(client.asSupabase()).list(ORG);

    expect(client.queries[0].has("eq", "kind", "order")).toBe(true);
  });

  it("muestra lo archivado cuando se pide", async () => {
    const client = new FakeClient([
      { data: [orderRow], error: null },
      { data: [], error: null },
    ]);
    await new OrderService(client.asSupabase()).list(ORG, { includeArchived: true });

    expect(client.queries[0].has("is", "archived_at", null)).toBe(false);
  });

  // «Ver archivados» no trae de vuelta las ventas directas: el filtro por
  // `kind` no depende de ningún filtro que el usuario pueda desactivar.
  it("sigue excluyendo las ventas directas con «Ver archivados» activado", async () => {
    const client = new FakeClient([
      { data: [orderRow], error: null },
      { data: [], error: null },
    ]);
    await new OrderService(client.asSupabase()).list(ORG, { includeArchived: true });

    expect(client.queries[0].has("eq", "kind", "order")).toBe(true);
  });

  it("sigue excluyendo las ventas directas al filtrar por línea y estado", async () => {
    const client = new FakeClient([
      { data: [orderRow], error: null },
      { data: [], error: null },
    ]);
    await new OrderService(client.asSupabase()).list(ORG, {
      businessLineId: LINE,
      statusId: STATUS,
    });

    expect(client.queries[0].has("eq", "kind", "order")).toBe(true);
  });

  it("filtra por línea y por estado cuando se piden", async () => {
    const client = new FakeClient([
      { data: [orderRow], error: null },
      { data: [], error: null },
    ]);
    await new OrderService(client.asSupabase()).list(ORG, {
      businessLineId: LINE,
      statusId: STATUS,
    });

    const query = client.queries[0];
    expect(query.has("eq", "business_line_id", LINE)).toBe(true);
    expect(query.has("eq", "status_id", STATUS)).toBe(true);
  });

  it("toma el total de la vista, no de una columna del pedido", async () => {
    const client = new FakeClient([
      { data: [orderRow], error: null },
      { data: [{ order_id: ORDER, total: "190.00" }], error: null },
    ]);
    const [order] = await new OrderService(client.asSupabase()).list(ORG);

    expect(client.tables[1]).toBe("order_totals");
    expect(order.total).toBe(190);
    // El total no viaja en la fila de `orders`: no hay tal columna.
    expect("total" in orderRow).toBe(false);
  });

  it("da 0 al pedido que la vista no devuelve, no undefined", async () => {
    const client = new FakeClient([
      { data: [orderRow], error: null },
      { data: [], error: null },
    ]);
    const [order] = await new OrderService(client.asSupabase()).list(ORG);

    expect(order.total).toBe(0);
  });

  it("traduce numeric en texto a número sin perder precisión", async () => {
    const client = new FakeClient([
      { data: [orderRow], error: null },
      { data: [{ order_id: ORDER, total: "1234.56" }], error: null },
    ]);
    const [order] = await new OrderService(client.asSupabase()).list(ORG);

    expect(order.total).toBe(1234.56);
  });

  it("no consulta la vista si no hay pedidos", async () => {
    const client = new FakeClient([{ data: [], error: null }]);
    const orders = await new OrderService(client.asSupabase()).list(ORG);

    expect(orders).toEqual([]);
    expect(client.tables).toEqual(["orders"]);
  });
});

describe("OrderService.moveToStatus", () => {
  it("escribe solo el estado: queued_at lo decide el trigger", async () => {
    const client = new FakeClient([{ data: null, error: null }]);
    await new OrderService(client.asSupabase()).moveToStatus(ORG, ORDER, STATUS);

    const [payload] = client.queries[0].argsOf("update") as [
      Record<string, unknown>,
    ];
    expect(payload.status_id).toBe(STATUS);
    expect("queued_at" in payload).toBe(false);
    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);
  });
});

describe("OrderService.setQueuedAt", () => {
  it("escribe la llegada sin tocar el estado", async () => {
    const client = new FakeClient([{ data: null, error: null }]);
    await new OrderService(client.asSupabase()).setQueuedAt(
      ORG,
      ORDER,
      "2026-08-25T10:00:00.000Z",
    );

    const [payload] = client.queries[0].argsOf("update") as [
      Record<string, unknown>,
    ];
    expect(payload.queued_at).toBe("2026-08-25T10:00:00.000Z");
    // Si tocara el estado, el trigger pisaría la llegada recién escrita.
    expect("status_id" in payload).toBe(false);
  });
});

describe("OrderService.setArchived", () => {
  it("deja subir el error de la base para que la acción lo traduzca", async () => {
    const client = new FakeClient([
      { data: null, error: { message: "Solo la persona dueña puede archivar" } },
    ]);

    await expect(
      new OrderService(client.asSupabase()).setArchived(ORG, ORDER, true),
    ).rejects.toMatchObject({ message: "Solo la persona dueña puede archivar" });
  });

  it("desarchivar pone archived_at a nulo", async () => {
    const client = new FakeClient([{ data: null, error: null }]);
    await new OrderService(client.asSupabase()).setArchived(ORG, ORDER, false);

    const [payload] = client.queries[0].argsOf("update") as [
      Record<string, unknown>,
    ];
    expect(payload.archived_at).toBeNull();
  });
});

describe("OrderService.history", () => {
  it("lee de activity_log y de ninguna otra fuente (convención nº 7)", async () => {
    const client = new FakeClient([{ data: [], error: null }]);
    await new OrderService(client.asSupabase()).history(ORG, ORDER);

    expect(client.tables[0]).toBe("activity_log");
    const query = client.queries[0];
    expect(query.has("eq", "table_name", "orders")).toBe(true);
    expect(query.has("eq", "record_id", ORDER)).toBe(true);
  });
});

describe("OrderItemService", () => {
  it("calcula el total de línea desde cantidad y precio registrados", async () => {
    const client = new FakeClient([
      {
        data: [
          {
            id: "66666666-6666-6666-6666-666666666666",
            organization_id: ORG,
            order_id: ORDER,
            item_id: "77777777-7777-7777-7777-777777777777",
            variant_id: null,
            description: "Foto de la familia",
            quantity: "3.000",
            unit_price: "45.00",
            items: { name: "Taza personalizada" },
            item_variants: null,
          },
        ],
        error: null,
      },
    ]);

    const [line] = await new OrderItemService(client.asSupabase()).listByOrder(
      ORG,
      ORDER,
    );

    expect(line.quantity).toBe(3);
    expect(line.unitPrice).toBe(45);
    expect(line.lineTotal).toBe(135);
    expect(line.itemName).toBe("Taza personalizada");
    expect(line.variantName).toBeNull();
    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);
  });
});

// ── Alta y edición (KAM-08) ───────────────────────────────────────────────

const CONTACT = "55555555-5555-5555-5555-555555555555";
const ITEM = "77777777-7777-7777-7777-777777777777";
const LINE_ID = "88888888-8888-8888-8888-888888888888";

const formValues = {
  id: ORDER,
  businessLineId: LINE,
  contactId: CONTACT,
  salesChannelId: null,
  deliveryMode: "delivery" as const,
  dueDate: "2026-12-24",
  notes: "Diseño enviado por WhatsApp",
  occurredAt: "2026-09-03T12:00:00.000Z",
  items: [
    {
      id: LINE_ID,
      itemId: ITEM,
      variantId: null,
      description: null,
      quantity: 3,
      unitPrice: 45,
    },
  ],
};

describe("OrderService.create", () => {
  it("llama a create_order con la organización explícita y el pedido completo", async () => {
    const client = new FakeClient([{ data: ORDER, error: null }]);
    const id = await new OrderService(client.asSupabase()).create(ORG, formValues);

    expect(id).toBe(ORDER);
    expect(client.rpcCalls[0].name).toBe("create_order");

    const params = client.rpcCalls[0].params as {
      p_order: Record<string, unknown>;
      p_items: Record<string, unknown>[];
    };
    // Convención nº 2: la organización viaja explícita aunque RLS ya filtre.
    expect(params.p_order.organization_id).toBe(ORG);
    expect(params.p_order.id).toBe(ORDER);
    expect(params.p_order.business_line_id).toBe(LINE);
    expect(params.p_order.contact_id).toBe(CONTACT);
    expect(params.p_order.due_date).toBe("2026-12-24");
    expect(params.p_order.delivery_mode).toBe("delivery");
    expect(params.p_order.occurred_at).toBe("2026-09-03T12:00:00.000Z");
  });

  /** El estado inicial lo decide la base desde el juego de la línea (D3). */
  it("no envía status_id ni code: los decide la base", async () => {
    const client = new FakeClient([{ data: ORDER, error: null }]);
    await new OrderService(client.asSupabase()).create(ORG, formValues);

    const { p_order } = client.rpcCalls[0].params as {
      p_order: Record<string, unknown>;
    };
    expect(p_order).not.toHaveProperty("status_id");
    expect(p_order).not.toHaveProperty("code");
    expect(p_order).not.toHaveProperty("archived_at");
  });

  it("manda las líneas con nombres de columna y su propio precio", async () => {
    const client = new FakeClient([{ data: ORDER, error: null }]);
    await new OrderService(client.asSupabase()).create(ORG, formValues);

    const { p_items } = client.rpcCalls[0].params as {
      p_items: Record<string, unknown>[];
    };
    expect(p_items).toEqual([
      {
        id: LINE_ID,
        item_id: ITEM,
        variant_id: null,
        description: null,
        quantity: 3,
        unit_price: 45,
      },
    ]);
  });

  it("envuelve el error de la base en un Error para que la acción lo traduzca", async () => {
    const client = new FakeClient([
      { data: null, error: { message: "Un pedido necesita al menos una línea" } },
    ]);

    await expect(
      new OrderService(client.asSupabase()).create(ORG, formValues),
    ).rejects.toThrow("Un pedido necesita al menos una línea");
  });
});

describe("OrderService.update", () => {
  it("llama a update_order con la lista completa de líneas vigentes", async () => {
    const client = new FakeClient([{ data: null, error: null }]);
    await new OrderService(client.asSupabase()).update(ORG, {
      ...formValues,
      items: [
        ...formValues.items,
        {
          id: "99999999-9999-9999-9999-999999999999",
          itemId: null,
          variantId: null,
          description: "Pieza a medida",
          quantity: 1,
          unitPrice: 120,
        },
      ],
    });

    expect(client.rpcCalls[0].name).toBe("update_order");
    const params = client.rpcCalls[0].params as {
      p_order: Record<string, unknown>;
      p_items: Record<string, unknown>[];
    };
    expect(params.p_order.organization_id).toBe(ORG);
    expect(params.p_order.id).toBe(ORDER);
    // Es la lista completa, no un diferencial: lo que no viaje se archiva.
    expect(params.p_items.map((item) => item.id)).toEqual([
      LINE_ID,
      "99999999-9999-9999-9999-999999999999",
    ]);
  });

  it("no envía la línea de negocio ni el estado: no se editan", async () => {
    const client = new FakeClient([{ data: null, error: null }]);
    await new OrderService(client.asSupabase()).update(ORG, formValues);

    const { p_order } = client.rpcCalls[0].params as {
      p_order: Record<string, unknown>;
    };
    expect(p_order).not.toHaveProperty("business_line_id");
    expect(p_order).not.toHaveProperty("status_id");
  });

  it("sube el rechazo del pedido archivado", async () => {
    const client = new FakeClient([
      {
        data: null,
        error: {
          message: "Un registro archivado no se puede editar: desarchívalo primero",
        },
      },
    ]);

    await expect(
      new OrderService(client.asSupabase()).update(ORG, formValues),
    ).rejects.toThrow("Un registro archivado no se puede editar");
  });
});

describe("OrderItemService · líneas archivadas", () => {
  it("el detalle no pide las líneas archivadas", async () => {
    const client = new FakeClient([{ data: [], error: null }]);
    await new OrderItemService(client.asSupabase()).listByOrder(ORG, ORDER);

    expect(client.queries[0].has("is", "archived_at", null)).toBe(true);
  });

  it("el resumen de la tarjeta tampoco las cuenta", async () => {
    const client = new FakeClient([{ data: [], error: null }]);
    await new OrderItemService(client.asSupabase()).summariesFor(ORG, [ORDER]);

    expect(client.queries[0].has("is", "archived_at", null)).toBe(true);
  });
});
