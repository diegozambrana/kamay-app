import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

import { OrderItemService } from "@/services/orders/order-item-service";
import { OrderService } from "@/services/orders/order-service";

import { loggedActions, seedWorkshop, type Workshop } from "./tools-support";

/**
 * KAM-27 · spec `orders` → *Añadir una línea sin tocar las demás*, contra la
 * base real: que la tercera línea no toca las dos primeras, que dos altas
 * casi simultáneas conservan ambas —justo lo que `update_order` no garantiza—,
 * que otra organización no puede, y que la bitácora lo registra.
 */
const TIMEOUT = 60_000;

let a: Workshop;
let b: Workshop;

async function firstLineId(db: SupabaseClient, organizationId: string): Promise<string> {
  const { data, error } = await db
    .from("business_lines")
    .select("id")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .limit(1)
    .single();
  if (error) throw new Error(`línea: ${error.message}`);
  return data.id as string;
}

async function newOrder(shop: Workshop, lines: { description: string; price: number }[]) {
  const contactId = crypto.randomUUID();
  const { error } = await shop.owner.from("contacts").insert({
    id: contactId,
    organization_id: shop.organizationId,
    name: `Cliente ${contactId.slice(0, 8)}`,
    is_customer: true,
  });
  if (error) throw new Error(`contacto: ${error.message}`);

  const id = crypto.randomUUID();
  await new OrderService(shop.owner).create(shop.organizationId, {
    id,
    businessLineId: await firstLineId(shop.owner, shop.organizationId),
    contactId,
    salesChannelId: null,
    deliveryMode: null,
    dueDate: null,
    notes: null,
    occurredAt: new Date().toISOString(),
    items: lines.map((line) => ({
      id: crypto.randomUUID(),
      itemId: null,
      variantId: null,
      description: line.description,
      quantity: 1,
      unitPrice: line.price,
    })),
  });
  return id;
}

const freeLine = (description: string, quantity: number, unitPrice: number) => ({
  id: crypto.randomUUID(),
  itemId: null,
  variantId: null,
  description,
  quantity,
  unitPrice,
});

beforeAll(async () => {
  [a, b] = await Promise.all([seedWorkshop("Líneas A"), seedWorkshop("Líneas B")]);
}, TIMEOUT);

describe("añadir una línea a un pedido", { timeout: TIMEOUT }, () => {
  it("la tercera línea no toca las dos primeras y entra en el total derivado", async () => {
    const orderId = await newOrder(a, [
      { description: "Taza", price: 40 },
      { description: "Polera", price: 60 },
    ]);
    const items = new OrderItemService(a.owner);
    const before = await items.listByOrder(a.organizationId, orderId);

    await items.add(a.organizationId, orderId, freeLine("Llavero calavera", 6, 27));

    const after = await items.listByOrder(a.organizationId, orderId);
    expect(after).toHaveLength(3);
    // Las dos primeras, idénticas: mismo id, misma descripción, mismo precio, vigentes.
    for (const line of before) {
      expect(after.find((candidate) => candidate.id === line.id)).toEqual(line);
    }
    expect(after.find((line) => line.description === "Llavero calavera")).toMatchObject({
      quantity: 6,
      unitPrice: 27,
      lineTotal: 162,
      itemId: null,
    });

    // El total no se guarda en ninguna parte: sale de `order_totals`.
    const order = await new OrderService(a.owner).getById(a.organizationId, orderId);
    expect(order?.total).toBe(40 + 60 + 162);
  });

  it("dos altas casi simultáneas conservan las dos líneas", async () => {
    const orderId = await newOrder(a, [{ description: "Base", price: 10 }]);

    await Promise.all([
      new OrderItemService(a.owner).add(a.organizationId, orderId, freeLine("De la dueña", 1, 5)),
      new OrderItemService(a.assistant).add(
        a.organizationId,
        orderId,
        freeLine("Del ayudante", 1, 7),
      ),
    ]);

    const lines = await new OrderItemService(a.owner).listByOrder(a.organizationId, orderId);
    expect(lines.map((line) => line.description).sort()).toEqual([
      "Base",
      "De la dueña",
      "Del ayudante",
    ]);
  });

  it("otra organización no puede añadir una línea al pedido de A", async () => {
    const orderId = await newOrder(a, [{ description: "Base", price: 10 }]);
    const intruder = new OrderItemService(b.owner);

    // La RLS exige ser miembro de la organización de la línea.
    await expect(
      intruder.add(a.organizationId, orderId, freeLine("Intrusa", 1, 1)),
    ).rejects.toThrow();

    // Y la acción `addOrderLine` ni siquiera llega al insert: primero busca el
    // pedido **dentro de la organización de la sesión**, y B no lo encuentra.
    expect(await new OrderService(b.owner).getById(b.organizationId, orderId)).toBeNull();
    expect(await new OrderService(b.owner).getById(a.organizationId, orderId)).toBeNull();

    const lines = await new OrderItemService(a.owner).listByOrder(a.organizationId, orderId);
    expect(lines.map((line) => line.description)).toEqual(["Base"]);
    expect((await new OrderService(a.owner).getById(a.organizationId, orderId))?.total).toBe(10);
  });

  it("la base rechaza una cantidad en cero", async () => {
    const orderId = await newOrder(a, [{ description: "Base", price: 10 }]);
    await expect(
      new OrderItemService(a.owner).add(a.organizationId, orderId, freeLine("Nada", 0, 5)),
    ).rejects.toThrow(/order_items_quantity_check/);
  });

  it("la bitácora registra la creación de la línea", async () => {
    const orderId = await newOrder(a, [{ description: "Base", price: 10 }]);
    const before = await loggedActions(a.owner, a.organizationId, "order_items");

    await new OrderItemService(a.owner).add(a.organizationId, orderId, freeLine("Nueva", 2, 9));

    const after = await loggedActions(a.owner, a.organizationId, "order_items");
    expect(after.slice(before.length)).toEqual(["created"]);
  });
});
