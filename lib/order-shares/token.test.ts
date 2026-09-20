import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  generateOrderShareToken,
  hashOrderShareToken,
  orderShareExpiry,
  ORDER_SHARE_TTL_DAYS,
} from "./token";

describe("token de enlace público de pedido", () => {
  it("genera tokens distintos y usables en una URL sin escapar", () => {
    const first = generateOrderShareToken();
    const second = generateOrderShareToken();

    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("produce el hash sha256 en el formato bytea de Postgres", () => {
    const hash = hashOrderShareToken("token-conocido");

    expect(hash).toBe(
      `\\x${createHash("sha256").update("token-conocido", "utf8").digest("hex")}`,
    );
  });

  it("vence a los 180 días", () => {
    const from = new Date("2026-09-20T10:00:00.000Z");

    const expires = new Date(orderShareExpiry(from));

    expect(ORDER_SHARE_TTL_DAYS).toBe(180);
    expect(expires.toISOString()).toBe("2027-03-19T10:00:00.000Z");
  });
});
