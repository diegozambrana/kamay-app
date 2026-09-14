import { describe, expect, it } from "vitest";

import { type PlatformUser, defaultDisplayName, displayNameOf, matchesName } from "./users";

const user = (overrides: Partial<PlatformUser> = {}): PlatformUser => ({
  id: "u1",
  email: "ana.perez@kamay.test",
  createdAt: "2026-09-01T00:00:00Z",
  lastSignInAt: null,
  platformAdmin: false,
  memberships: [],
  ...overrides,
});

const membership = (displayName: string | null, archivedAt: string | null = null) => ({
  membershipId: `m-${displayName}`,
  organizationId: "o1",
  organizationName: "Geeko",
  role: "owner" as const,
  displayName,
  archivedAt,
});

describe("nombres", () => {
  it("prefiere el nombre de una membresía activa", () => {
    const u = user({ memberships: [membership("Vieja", "2026-01-01"), membership("Ana")] });
    expect(displayNameOf(u)).toBe("Ana");
  });

  it("sin membresías, el nombre por defecto es la parte local del correo", () => {
    expect(displayNameOf(user())).toBeNull();
    expect(defaultDisplayName(user())).toBe("ana.perez");
  });
});

describe("matchesName", () => {
  it("coincide por fragmento, sin tildes", () => {
    expect(matchesName("Kamay Histórico", "historico")).toBe(true);
    expect(matchesName("Geeko", "")).toBe(true);
    expect(matchesName("Geeko", "taller")).toBe(false);
  });
});
