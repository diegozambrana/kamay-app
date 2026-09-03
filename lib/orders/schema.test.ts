import { describe, expect, it } from "vitest";

import {
  moveOrderSchema,
  orderIdSchema,
  reorderQueueSchema,
} from "@/lib/orders/schema";

const UUID_A = "00000000-0000-4000-8000-000000000001";
const UUID_B = "00000000-0000-4000-8000-000000000002";

describe("moveOrderSchema", () => {
  it("acepta dos identificadores válidos", () => {
    expect(
      moveOrderSchema.safeParse({ orderId: UUID_A, statusId: UUID_B }).success,
    ).toBe(true);
  });

  it("rechaza un identificador que no es UUID", () => {
    expect(
      moveOrderSchema.safeParse({ orderId: "142", statusId: UUID_B }).success,
    ).toBe(false);
  });
});

describe("reorderQueueSchema", () => {
  it("acepta una posición base 0", () => {
    expect(
      reorderQueueSchema.safeParse({ orderId: UUID_A, targetIndex: 0 }).success,
    ).toBe(true);
  });

  it("rechaza una posición negativa o fraccionaria", () => {
    expect(
      reorderQueueSchema.safeParse({ orderId: UUID_A, targetIndex: -1 }).success,
    ).toBe(false);
    expect(
      reorderQueueSchema.safeParse({ orderId: UUID_A, targetIndex: 1.5 }).success,
    ).toBe(false);
  });
});

describe("orderIdSchema", () => {
  it("exige un UUID", () => {
    expect(orderIdSchema.safeParse({ orderId: UUID_A }).success).toBe(true);
    expect(orderIdSchema.safeParse({ orderId: "" }).success).toBe(false);
  });
});
