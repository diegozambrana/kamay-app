import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  generateOrderRequestToken,
  hashOrderRequestToken,
  orderRequestExpiry,
  ORDER_REQUEST_TTL_DAYS,
} from "./token";

describe("token de solicitud de pedido", () => {
  it("genera tokens distintos y usables en una URL sin escapar", () => {
    const first = generateOrderRequestToken();
    const second = generateOrderRequestToken();

    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(first.length).toBeGreaterThanOrEqual(43);
  });

  it("produce el hash sha256 en el formato bytea de Postgres", () => {
    const hash = hashOrderRequestToken("token-conocido");

    expect(hash).toBe(
      `\\x${createHash("sha256").update("token-conocido", "utf8").digest("hex")}`,
    );
    expect(hash).toMatch(/^\\x[0-9a-f]{64}$/);
  });

  it("el mismo token da siempre el mismo hash", () => {
    expect(hashOrderRequestToken("t")).toBe(hashOrderRequestToken("t"));
    expect(hashOrderRequestToken("t")).not.toBe(hashOrderRequestToken("u"));
  });

  it("vence a los siete días", () => {
    const from = new Date("2026-09-20T10:00:00.000Z");

    const expires = new Date(orderRequestExpiry(from));

    expect(ORDER_REQUEST_TTL_DAYS).toBe(7);
    expect(expires.toISOString()).toBe("2026-09-27T10:00:00.000Z");
  });
});
