import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  generateInvitationToken,
  hashInvitationToken,
  invitationExpiry,
  INVITATION_TTL_DAYS,
} from "./token";

describe("token de invitación", () => {
  it("genera tokens distintos y usables en una dirección", () => {
    const first = generateInvitationToken();
    const second = generateInvitationToken();

    expect(first).not.toBe(second);
    // base64url: seguro en una URL sin escapar nada.
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(first.length).toBeGreaterThanOrEqual(43);
  });

  it("produce el hash sha256 en el formato bytea de Postgres", () => {
    const hash = hashInvitationToken("token-conocido");

    expect(hash).toBe(
      `\\x${createHash("sha256").update("token-conocido", "utf8").digest("hex")}`,
    );
    expect(hash).toMatch(/^\\x[0-9a-f]{64}$/);
  });

  it("el mismo token da siempre el mismo hash", () => {
    expect(hashInvitationToken("t")).toBe(hashInvitationToken("t"));
    expect(hashInvitationToken("t")).not.toBe(hashInvitationToken("u"));
  });

  it("caduca a los siete días", () => {
    const from = new Date("2026-08-20T10:00:00.000Z");

    const expires = new Date(invitationExpiry(from));

    expect(INVITATION_TTL_DAYS).toBe(7);
    expect(expires.toISOString()).toBe("2026-08-27T10:00:00.000Z");
  });
});
