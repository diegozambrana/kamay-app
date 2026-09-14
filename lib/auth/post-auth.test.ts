import { beforeEach, describe, expect, it, vi } from "vitest";

import { ORG_COOKIE } from "@/constants/auth";

/**
 * KAM-26 · A dónde aterriza cada cuenta tras entrar (`resolvePostAuthPath`).
 *
 * Escenarios de `user-auth` «A platform admin without an organization lands on
 * Organizations», «A platform admin back in an organization lands on the
 * home» y «A platform admin never gets the selection screen», a nivel
 * unitario; la regla de siempre para el resto sigue igual.
 */

const cookieValues = new Map<string, string>();
const setCookie = vi.fn();
const listActiveForUser = vi.fn();
const isPlatformAdmin = vi.fn();
const findActiveOrganization = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieValues.get(name);
      return value ? { name, value } : undefined;
    },
    set: setCookie,
  }),
  headers: async () => new Headers({ "user-agent": "Mozilla/5.0 (Macintosh)" }),
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

const { isPlatformPath, resolvePostAuthPath } = await import("./post-auth");

const supabase = {
  auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
} as never;

const membership = (organizationId: string) => ({
  id: `m-${organizationId}`,
  organizationId,
  role: "owner" as const,
  displayName: null,
  organization: {
    id: organizationId,
    name: organizationId,
    logoPath: null,
    currency: "BOB",
    timezone: "America/La_Paz",
  },
});

beforeEach(() => {
  cookieValues.clear();
  setCookie.mockReset();
  listActiveForUser.mockReset().mockResolvedValue([]);
  isPlatformAdmin.mockReset().mockResolvedValue(false);
  findActiveOrganization.mockReset().mockResolvedValue(null);
});

describe("resolvePostAuthPath · super admin", () => {
  beforeEach(() => isPlatformAdmin.mockResolvedValue(true));

  it("sin organización aterriza en Organizaciones", async () => {
    expect(await resolvePostAuthPath(supabase, null)).toBe("/admin/organizations");
  });

  it("con varias membresías no pasa por la selección", async () => {
    listActiveForUser.mockResolvedValue([membership("a"), membership("b")]);

    expect(await resolvePostAuthPath(supabase, null)).toBe("/admin/organizations");
  });

  it("si pedía una ruta de plataforma, va a ella", async () => {
    expect(await resolvePostAuthPath(supabase, "/admin/users")).toBe("/admin/users");
    expect(await resolvePostAuthPath(supabase, "/orders")).toBe("/admin/organizations");
  });

  it("con su organización de la cookie aún válida, aterriza como todos", async () => {
    cookieValues.set(ORG_COOKIE, "z");
    findActiveOrganization.mockResolvedValue({ ...membership("z").organization });

    expect(await resolvePostAuthPath(supabase, null)).toBe("/dashboard");
    // No se reescribe la cookie: ya dice dónde está.
    expect(setCookie).not.toHaveBeenCalled();
  });
});

describe("resolvePostAuthPath · el resto, como siempre", () => {
  it("varias membresías: selección", async () => {
    listActiveForUser.mockResolvedValue([membership("a"), membership("b")]);

    expect(await resolvePostAuthPath(supabase, null)).toBe("/auth/select-org");
  });

  it("una membresía: fija la cookie y aterriza", async () => {
    listActiveForUser.mockResolvedValue([membership("a")]);

    expect(await resolvePostAuthPath(supabase, null)).toBe("/dashboard");
    expect(setCookie).toHaveBeenCalledWith(ORG_COOKIE, "a", expect.anything());
  });
});

describe("isPlatformPath", () => {
  it("reconoce las rutas de plataforma por segmento", () => {
    expect(isPlatformPath("/admin/organizations")).toBe(true);
    expect(isPlatformPath("/administracion")).toBe(false);
  });
});
