import { beforeEach, describe, expect, it, vi } from "vitest";

import { ORG_COOKIE } from "@/constants/auth";

const cookieValues = new Map<string, string>();
const getUser = vi.fn();
const listActiveForUser = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieValues.get(name);
      return value ? { name, value } : undefined;
    },
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

vi.mock("@/services/membership-service", () => ({
  MembershipService: class {
    listActiveForUser = listActiveForUser;
  },
}));

const { getOwnerContext, getSessionContext } = await import("./session-context");

const USER = { id: "u1" };

const membership = (organizationId: string, role: "owner" | "assistant") => ({
  id: `m-${organizationId}`,
  organizationId,
  role,
  displayName: null,
  organization: {
    id: organizationId,
    name: organizationId,
    logoPath: null,
    currency: "BOB",
    timezone: "America/La_Paz",
  },
});

describe("getSessionContext", () => {
  beforeEach(() => {
    cookieValues.clear();
    getUser.mockReset();
    listActiveForUser.mockReset();
    getUser.mockResolvedValue({ data: { user: USER } });
  });

  it("sin sesión no hay contexto", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    expect(await getSessionContext()).toBeNull();
  });

  it("sin membresías no hay contexto", async () => {
    listActiveForUser.mockResolvedValue([]);

    expect(await getSessionContext()).toBeNull();
  });

  it("con una sola membresía no hace falta la cookie", async () => {
    listActiveForUser.mockResolvedValue([membership("o1", "owner")]);

    const context = await getSessionContext();

    expect(context?.organizationId).toBe("o1");
    expect(context?.userId).toBe("u1");
  });

  it("con varias membresías manda la cookie de organización", async () => {
    listActiveForUser.mockResolvedValue([
      membership("o1", "owner"),
      membership("o2", "assistant"),
    ]);
    cookieValues.set(ORG_COOKIE, "o2");

    const context = await getSessionContext();

    expect(context?.organizationId).toBe("o2");
    expect(context?.membership.role).toBe("assistant");
  });

  it("con varias membresías y cookie inválida no se elige por el usuario", async () => {
    listActiveForUser.mockResolvedValue([
      membership("o1", "owner"),
      membership("o2", "owner"),
    ]);
    cookieValues.set(ORG_COOKIE, "o9");

    expect(await getSessionContext()).toBeNull();
  });
});

describe("getOwnerContext", () => {
  beforeEach(() => {
    cookieValues.clear();
    getUser.mockReset();
    listActiveForUser.mockReset();
    getUser.mockResolvedValue({ data: { user: USER } });
  });

  it("el dueño obtiene contexto", async () => {
    listActiveForUser.mockResolvedValue([membership("o1", "owner")]);

    expect((await getOwnerContext())?.organizationId).toBe("o1");
  });

  it("el ayudante no obtiene contexto de dueño", async () => {
    listActiveForUser.mockResolvedValue([membership("o1", "assistant")]);

    expect(await getOwnerContext()).toBeNull();
  });

  it("sin sesión tampoco", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    expect(await getOwnerContext()).toBeNull();
  });
});
