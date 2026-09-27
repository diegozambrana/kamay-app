import { beforeAll, describe, expect, it } from "vitest";

import { ItemService } from "@/services/catalog/item-service";
import { FairSaleService } from "@/services/fair/fair-sale-service";
import type { DirectSaleInput } from "@/lib/fair/sale-schema";

import { seedWorkshop, type Workshop } from "./tools-support";

/**
 * `fair-all-lines` · La feria con todas las líneas contra la base real, como
 * la dueña de una organización propia y con RLS decidiendo.
 *
 * Escenarios del delta `fair-mode`: «Con la bandera, productos de todas las
 * líneas», «Con la bandera, nada de líneas archivadas», «Un carrito de dos
 * líneas crea dos ventas» y «Reenvío sin duplicados».
 */

let workshop: Workshop;
let alfareria: { id: string; name: string };
let sublimacion: { id: string; name: string };
let archivada: { id: string; name: string };
const maceta = crypto.randomUUID();
const taza = crypto.randomUUID();
const oculto = crypto.randomUUID();

const product = {
  kind: "product" as const,
  unitId: null,
  categoryId: null,
  description: null,
  minStock: null,
};

async function newLine(name: string) {
  const { owner, organizationId } = workshop;
  const id = crypto.randomUUID();
  const { error } = await owner
    .from("business_lines")
    .insert({ id, organization_id: organizationId, name, color: "blue" });
  if (error) throw new Error(`línea ${name}: ${error.message}`);
  return { id, name };
}

beforeAll(async () => {
  workshop = await seedWorkshop("Feria todas las líneas");
  const { owner, organizationId } = workshop;

  alfareria = await newLine("Alfarería");
  sublimacion = await newLine("Sublimación");
  archivada = await newLine("Cerámica vieja");

  const items = new ItemService(owner);
  await items.create(organizationId, maceta, {
    ...product,
    name: "Maceta",
    businessLineId: alfareria.id,
    salePrice: 60,
  });
  await items.create(organizationId, taza, {
    ...product,
    name: "Taza",
    businessLineId: sublimacion.id,
    salePrice: 45,
  });
  await items.create(organizationId, oculto, {
    ...product,
    name: "Jarrón viejo",
    businessLineId: archivada.id,
    salePrice: 80,
  });

  const archived = await owner
    .from("business_lines")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", archivada.id);
  if (archived.error) throw new Error(`archivar: ${archived.error.message}`);
});

describe("la cuadrícula con todas las líneas", () => {
  it("trae productos de las líneas activas, con su nombre, y no los de una archivada", async () => {
    const { owner, organizationId } = workshop;

    const grid = await new FairSaleService(owner).listSellableProducts(
      organizationId,
      alfareria.id,
      { allLines: true, lines: [alfareria, sublimacion] },
    );
    const byId = new Map(grid.map((item) => [item.id, item]));

    expect(byId.get(maceta)?.businessLineName).toBe("Alfarería");
    expect(byId.get(taza)?.businessLineName).toBe("Sublimación");
    expect(byId.has(oculto)).toBe(false);
  });

  it("sin la bandera, solo la línea de la feria", async () => {
    const { owner, organizationId } = workshop;

    const grid = await new FairSaleService(owner).listSellableProducts(
      organizationId,
      alfareria.id,
    );

    expect(grid.map((item) => item.id)).toContain(maceta);
    expect(grid.map((item) => item.id)).not.toContain(taza);
  });
});

describe("registrar un carrito de dos líneas", () => {
  const occurredAt = new Date().toISOString();
  const sale = (
    id: string,
    line: string,
    itemId: string,
    quantity: number,
    unitPrice: number,
    amount: number,
  ): DirectSaleInput => ({
    id,
    organizationId: workshop.organizationId,
    businessLineId: line,
    contactId: null,
    salesChannelId: null,
    occurredAt,
    notes: null,
    items: [
      { id: crypto.randomUUID(), itemId, variantId: null, description: null, quantity, unitPrice },
    ],
    payment: { id: crypto.randomUUID(), amount, method: "cash" },
  });

  it("crea dos ventas con los cobros repartidos, y reenviar no duplica", async () => {
    const { owner } = workshop;
    const lote = [
      sale(crypto.randomUUID(), sublimacion.id, taza, 2, 45, 60),
      sale(crypto.randomUUID(), alfareria.id, maceta, 1, 60, 40),
    ];
    const service = new FairSaleService(owner);

    await service.createMany(lote);
    await service.createMany(lote);

    const ids = lote.map((venta) => venta.id);
    const { data: orders, error } = await owner
      .from("orders")
      .select("id, business_line_id, kind")
      .in("id", ids);
    if (error) throw new Error(error.message);
    expect(orders).toHaveLength(2);
    expect(new Set(orders!.map((order) => order.kind))).toEqual(new Set(["direct_sale"]));
    expect(orders!.find((order) => order.id === ids[0])?.business_line_id).toBe(sublimacion.id);
    expect(orders!.find((order) => order.id === ids[1])?.business_line_id).toBe(alfareria.id);

    const { data: payments, error: paymentsError } = await owner
      .from("payments")
      .select("order_id, amount")
      .in("order_id", ids);
    if (paymentsError) throw new Error(paymentsError.message);
    expect(payments).toHaveLength(2);
    expect(Number(payments!.find((p) => p.order_id === ids[0])?.amount)).toBe(60);
    expect(Number(payments!.find((p) => p.order_id === ids[1])?.amount)).toBe(40);
  });
});
