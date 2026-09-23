import { beforeAll, describe, expect, it } from "vitest";

import { ContactService } from "@/services/catalog/contact-service";
import { ItemService } from "@/services/catalog/item-service";
import { ItemVariantService } from "@/services/catalog/item-variant-service";
import { ExpenseService } from "@/services/expenses/expense-service";
import { MovementService } from "@/services/inventory/movement-service";
import { VariantBalanceService } from "@/services/inventory/variant-balance-service";

import { seedWorkshop, type Workshop } from "./tools-support";

/**
 * `catalog-custom-attributes` · El saldo por variante contra la base real.
 *
 * Recorre el camino de la aplicación —compra por `create_expense`, consumo
 * por el servicio, lectura por la vista— como la dueña de una organización
 * propia, con RLS decidiendo. La comparación se hace contra la suma directa
 * de `inventory_movements`: sumar por otro camino es lo que da valor a la
 * prueba.
 *
 * Escenario del delta `inventory`: «Cada saldo coincide con la suma de sus
 * movimientos», nivel de integración.
 */

let workshop: Workshop;
const itemId = crypto.randomUUID();
const negro = crypto.randomUUID();
const rojo = crypto.randomUUID();

beforeAll(async () => {
  workshop = await seedWorkshop("Saldos por variante");
  const { owner, organizationId } = workshop;

  const { data: line, error } = await owner
    .from("business_lines")
    .select("id")
    .eq("organization_id", organizationId)
    .limit(1)
    .single();
  if (error) throw new Error(`línea: ${error.message}`);

  await new ItemService(owner).create(organizationId, itemId, {
    name: "PLA Sunlu",
    kind: "supply",
    businessLineId: null,
    unitId: null,
    categoryId: null,
    description: null,
    salePrice: null,
    minStock: null,
  });
  const variants = new ItemVariantService(owner);
  await variants.create(organizationId, itemId, negro, { name: "Negro", salePrice: null });
  await variants.create(organizationId, itemId, rojo, { name: "Rojo", salePrice: null });

  const supplier = crypto.randomUUID();
  await new ContactService(owner).create(organizationId, supplier, {
    name: "Distribuidora 3D",
    phone: null,
    email: null,
    address: null,
    notes: null,
    isSupplier: true,
    isCustomer: false,
  });

  await new ExpenseService(owner).createPurchase(organizationId, {
    id: crypto.randomUUID(),
    businessLineId: line.id as string,
    contactId: supplier,
    occurredAt: new Date().toISOString(),
    note: null,
    items: [
      { id: crypto.randomUUID(), itemId, variantId: negro, quantity: 2, unitPrice: 175 },
      { id: crypto.randomUUID(), itemId, variantId: rojo, quantity: 1, unitPrice: 175 },
    ],
  });

  await new MovementService(owner).registerConsumption(organizationId, {
    id: crypto.randomUUID(),
    itemId,
    variantId: negro,
    quantity: 0.5,
    occurredAt: new Date().toISOString(),
    note: null,
  });
});

describe("saldo por variante", () => {
  it("cada variante tiene el saldo de sus movimientos, y juntas suman el del ítem", async () => {
    const { owner, organizationId } = workshop;
    const balances = await new VariantBalanceService(owner).forItem(organizationId, itemId);

    const { data: movements, error } = await owner
      .from("inventory_movements")
      .select("variant_id, quantity")
      .eq("organization_id", organizationId)
      .eq("item_id", itemId);
    if (error) throw new Error(error.message);

    const direct = new Map<string, number>();
    for (const row of movements ?? []) {
      const key = String(row.variant_id);
      direct.set(key, (direct.get(key) ?? 0) + Number(row.quantity));
    }

    expect(balances.map((row) => [row.variantName, row.balance])).toEqual([
      ["Negro", 1.5],
      ["Rojo", 1],
    ]);
    for (const row of balances) {
      expect(row.balance).toBeCloseTo(direct.get(String(row.variantId)) ?? 0, 3);
    }

    const itemBalance = await new MovementService(owner).balanceFor(organizationId, itemId);
    expect(balances.reduce((sum, row) => sum + row.balance, 0)).toBeCloseTo(
      itemBalance?.balance ?? Number.NaN,
      3,
    );
  });

  it("la ayudante lee los mismos saldos", async () => {
    const { assistant, organizationId } = workshop;
    const balances = await new VariantBalanceService(assistant).forItem(organizationId, itemId);
    expect(balances.map((row) => row.balance)).toEqual([1.5, 1]);
  });
});
