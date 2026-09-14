import { beforeEach, describe, expect, it, vi } from "vitest";

import { ORG_COOKIE } from "@/constants/auth";

const cookieValues = new Map<string, string>();
const getUser = vi.fn();
const listActiveForUser = vi.fn();
const isPlatformAdmin = vi.fn();
const findActiveOrganization = vi.fn();

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

vi.mock("@/services/platform/platform-service", () => ({
  PlatformService: class {
    isPlatformAdmin = isPlatformAdmin;
    findActiveOrganization = findActiveOrganization;
  },
}));

const { getOwnerContext, getPlatformAdminContext, getSessionContext } = await import(
  "./session-context"
);

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
    isPlatformAdmin.mockReset().mockResolvedValue(false);
    findActiveOrganization.mockReset().mockResolvedValue(null);
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
    expect(context?.role).toBe("assistant");
    expect(context?.membership?.role).toBe("assistant");
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
    isPlatformAdmin.mockReset().mockResolvedValue(false);
    findActiveOrganization.mockReset().mockResolvedValue(null);
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

const organization = (id: string) => ({
  id,
  name: id,
  logoPath: null,
  currency: "BOB",
  timezone: "America/La_Paz",
});

describe("administrador de la plataforma (KAM-26)", () => {
  beforeEach(() => {
    cookieValues.clear();
    getUser.mockReset().mockResolvedValue({ data: { user: USER } });
    listActiveForUser.mockReset().mockResolvedValue([]);
    isPlatformAdmin.mockReset().mockResolvedValue(true);
    findActiveOrganization.mockReset().mockResolvedValue(null);
  });

  it("sin membresía y con cookie válida actúa como dueño, sin membresía", async () => {
    cookieValues.set(ORG_COOKIE, "o9");
    findActiveOrganization.mockResolvedValue(organization("o9"));

    const context = await getSessionContext();

    expect(findActiveOrganization).toHaveBeenCalledWith("o9");
    expect(context?.organizationId).toBe("o9");
    expect(context?.role).toBe("owner");
    expect(context?.membership).toBeNull();
    expect(context?.platformAdmin).toBe(true);
    expect((await getOwnerContext())?.organizationId).toBe("o9");
  });

  it("ayudante en una organización, es dueño ahí", async () => {
    listActiveForUser.mockResolvedValue([membership("o1", "assistant")]);
    cookieValues.set(ORG_COOKIE, "o1");

    const context = await getSessionContext();

    expect(context?.role).toBe("owner");
    expect(context?.membership?.role).toBe("assistant");
    expect(findActiveOrganization).not.toHaveBeenCalled();
  });

  it("con la cookie de una organización archivada o inexistente no hay contexto", async () => {
    cookieValues.set(ORG_COOKIE, "archivada");

    expect(await getSessionContext()).toBeNull();
  });

  it("sin cookie no hay contexto, aunque tenga una sola membresía", async () => {
    listActiveForUser.mockResolvedValue([membership("o1", "owner")]);

    expect(await getSessionContext()).toBeNull();
  });

  it("el contexto de plataforma existe con o sin organización", async () => {
    const withoutOrganization = await getPlatformAdminContext();
    expect(withoutOrganization?.access).toBeNull();

    cookieValues.set(ORG_COOKIE, "o9");
    findActiveOrganization.mockResolvedValue(organization("o9"));
    const inside = await getPlatformAdminContext();
    expect(inside?.access?.organizationId).toBe("o9");
  });

  it("una cuenta revocada con la cookie de una organización ajena vuelve a la regla normal", async () => {
    isPlatformAdmin.mockResolvedValue(false);
    listActiveForUser.mockResolvedValue([membership("o1", "owner")]);
    cookieValues.set(ORG_COOKIE, "o9");

    const context = await getSessionContext();

    expect(findActiveOrganization).not.toHaveBeenCalled();
    expect(context?.organizationId).toBe("o1");
    expect(await getPlatformAdminContext()).toBeNull();
  });
});
