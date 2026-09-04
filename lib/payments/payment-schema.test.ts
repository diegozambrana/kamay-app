import { describe, expect, it } from "vitest";

import { collectionSchema, paymentSchema, voidPaymentSchema } from "./payment-schema";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const EXPENSE_ID = "22222222-2222-4222-8222-222222222222";
const PAYMENT_ID = "33333333-3333-4333-8333-333333333333";

function collection(overrides: Record<string, unknown> = {}) {
  return {
    id: PAYMENT_ID,
    orderId: ORDER_ID,
    amount: "150",
    method: "cash",
    occurredAt: "2026-09-03T12:00:00.000Z",
    note: "",
    ...overrides,
  };
}

describe("collectionSchema", () => {
  it("acepta un cobro completo y convierte el monto a número", () => {
    const parsed = collectionSchema.parse(collection());
    expect(parsed.amount).toBe(150);
    expect(parsed.method).toBe("cash");
  });

  // Scenario: Monto vacío o no positivo — se impide con un mensaje claro
  // señalando el campo, y no se registra nada.
  it("rechaza el monto vacío", () => {
    const result = collectionSchema.safeParse(collection({ amount: "" }));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["amount"]);
    expect(result.error?.issues[0].message).toBe("Escribe un monto mayor que cero");
  });

  it("rechaza el monto en cero", () => {
    expect(collectionSchema.safeParse(collection({ amount: "0" })).success).toBe(false);
  });

  it("rechaza el monto negativo", () => {
    expect(collectionSchema.safeParse(collection({ amount: "-10" })).success).toBe(false);
  });

  it("rechaza un monto que no es número", () => {
    expect(collectionSchema.safeParse(collection({ amount: "mucho" })).success).toBe(false);
  });

  it("acepta un cobro sin método: declararlo es opcional", () => {
    expect(collectionSchema.parse(collection({ method: "" })).method).toBeNull();
  });

  it("rechaza un método fuera del dominio, igual que la base", () => {
    expect(collectionSchema.safeParse(collection({ method: "crypto" })).success).toBe(false);
  });

  it("una nota vacía es ausencia de dato, no cadena vacía", () => {
    expect(collectionSchema.parse(collection()).note).toBeNull();
  });

  it("exige el pedido: un cobro sin destino no existe", () => {
    const result = collectionSchema.safeParse(collection({ orderId: "" }));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["orderId"]);
  });

  it("exige la fecha del hecho", () => {
    expect(collectionSchema.safeParse(collection({ occurredAt: "" })).success).toBe(false);
  });

  it("no admite un destino de egreso: la dirección se deduce del destino", () => {
    const parsed = collectionSchema.parse(collection({ expenseId: EXPENSE_ID }));
    expect(parsed).not.toHaveProperty("expenseId");
  });
});

describe("paymentSchema", () => {
  it("acepta un pago contra un egreso", () => {
    const parsed = paymentSchema.parse({
      id: PAYMENT_ID,
      expenseId: EXPENSE_ID,
      amount: 200,
      method: "transfer",
      occurredAt: "2026-09-03T12:00:00.000Z",
    });
    expect(parsed.amount).toBe(200);
    expect(parsed.expenseId).toBe(EXPENSE_ID);
  });

  it("exige el egreso", () => {
    const result = paymentSchema.safeParse({
      id: PAYMENT_ID,
      amount: 200,
      occurredAt: "2026-09-03T12:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("voidPaymentSchema", () => {
  it("solo pide el identificador del movimiento", () => {
    expect(voidPaymentSchema.parse({ id: PAYMENT_ID }).id).toBe(PAYMENT_ID);
  });

  it("rechaza un identificador que no es UUID", () => {
    expect(voidPaymentSchema.safeParse({ id: "42" }).success).toBe(false);
  });
});
