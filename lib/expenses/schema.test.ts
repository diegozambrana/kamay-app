import { describe, expect, it } from "vitest";

import { costFormSchema, purchaseFormSchema } from "./schema";

const ID = "11111111-1111-1111-1111-111111111111";
const LINE = "22222222-2222-2222-2222-222222222222";
const CATEGORY = "33333333-3333-3333-3333-333333333333";
const SUPPLIER = "44444444-4444-4444-4444-444444444444";
const ITEM = "55555555-5555-5555-5555-555555555555";
const ORDER = "66666666-6666-6666-6666-666666666666";

const minimalCost = {
  id: ID,
  businessLineId: LINE,
  expenseCategoryId: CATEGORY,
  amount: "120",
  occurredAt: "2026-09-03T10:00:00.000Z",
};

function firstMessage(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.success ? null : result.error?.issues[0]?.message;
}

describe("costFormSchema", () => {
  it("un gasto con monto, categoría y línea se acepta", () => {
    const result = costFormSchema.safeParse(minimalCost);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(120);
      expect(result.data.orderId).toBeNull();
      expect(result.data.note).toBeNull();
    }
  });

  it("sin monto se rechaza señalando el monto", () => {
    expect(firstMessage(costFormSchema.safeParse({ ...minimalCost, amount: "" }))).toBe(
      "Escribe el monto",
    );
    expect(firstMessage(costFormSchema.safeParse({ ...minimalCost, amount: "0" }))).toBe(
      "Escribe el monto",
    );
    expect(firstMessage(costFormSchema.safeParse({ ...minimalCost, amount: "-5" }))).toBe(
      "Escribe el monto",
    );
  });

  it("sin categoría se rechaza señalando la categoría", () => {
    expect(
      firstMessage(costFormSchema.safeParse({ ...minimalCost, expenseCategoryId: "" })),
    ).toBe("Elige una categoría");
  });

  it("sin línea se rechaza señalando la línea", () => {
    expect(
      firstMessage(costFormSchema.safeParse({ ...minimalCost, businessLineId: "" })),
    ).toBe("Elige una línea de negocio");
  });

  it("acepta la asignación a un pedido y convierte el vacío en nulo", () => {
    const withOrder = costFormSchema.safeParse({ ...minimalCost, orderId: ORDER });
    expect(withOrder.success && withOrder.data.orderId).toBe(ORDER);

    const without = costFormSchema.safeParse({ ...minimalCost, orderId: "" });
    expect(without.success && without.data.orderId).toBeNull();
  });
});

describe("purchaseFormSchema", () => {
  const minimalPurchase = {
    id: ID,
    businessLineId: LINE,
    contactId: SUPPLIER,
    occurredAt: "2026-09-03T10:00:00.000Z",
    items: [{ id: ITEM, itemId: ITEM, quantity: "2", unitPrice: "9.50" }],
  };

  it("una compra con proveedor y una línea se acepta", () => {
    const result = purchaseFormSchema.safeParse(minimalPurchase);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items[0].quantity).toBe(2);
      expect(result.data.items[0].unitPrice).toBe(9.5);
      expect(result.data.items[0].variantId).toBeNull();
    }
  });

  it("sin proveedor se rechaza señalando el proveedor", () => {
    expect(
      firstMessage(purchaseFormSchema.safeParse({ ...minimalPurchase, contactId: "" })),
    ).toBe("Elige o crea un proveedor");
  });

  it("sin líneas se rechaza señalando la tabla de insumos", () => {
    expect(
      firstMessage(purchaseFormSchema.safeParse({ ...minimalPurchase, items: [] })),
    ).toBe("Agrega al menos un insumo");
  });

  it("una línea sin insumo, con cantidad cero o precio negativo se rechaza", () => {
    expect(
      firstMessage(
        purchaseFormSchema.safeParse({
          ...minimalPurchase,
          items: [{ id: ITEM, itemId: "", quantity: "2", unitPrice: "1" }],
        }),
      ),
    ).toBe("Elige un insumo");
    expect(
      firstMessage(
        purchaseFormSchema.safeParse({
          ...minimalPurchase,
          items: [{ id: ITEM, itemId: ITEM, quantity: "0", unitPrice: "1" }],
        }),
      ),
    ).toBe("La cantidad tiene que ser mayor que cero");
    expect(
      firstMessage(
        purchaseFormSchema.safeParse({
          ...minimalPurchase,
          items: [{ id: ITEM, itemId: ITEM, quantity: "1", unitPrice: "-1" }],
        }),
      ),
    ).toBe("El precio no puede ser negativo");
  });

  it("un precio de 0 es válido: hay insumos regalados", () => {
    expect(
      purchaseFormSchema.safeParse({
        ...minimalPurchase,
        items: [{ id: ITEM, itemId: ITEM, quantity: "1", unitPrice: "0" }],
      }).success,
    ).toBe(true);
  });
});
