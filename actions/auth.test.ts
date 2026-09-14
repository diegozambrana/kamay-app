import { beforeEach, describe, expect, it, vi } from "vitest";

import { ORG_COOKIE } from "@/constants/auth";

/**
 * KAM-26 · Entrar a una organización o salir a la vista de plataforma
 * (`enterOrganization`, design D8).
 */

const estado = vi.hoisted(() => ({
  platformContext: null as null | { supabase: unknown },
  organization: null as null | { id: string },
  deleted: [] as string[],
  set: [] as string[],
}));

class Redirect extends Error {
  constructor(readonly to: string) {
    super(`redirect ${to}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Redirect(to);
  },
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": "Mozilla/5.0 (Macintosh)" }),
  cookies: async () => ({
    delete: (name: string) => estado.deleted.push(name),
    get: () => undefined,
  }),
}));

vi.mock("@/lib/auth/session-context", () => ({
  getPlatformAdminContext: async () => estado.platformContext,
}));

vi.mock("@/lib/auth/post-auth", () => ({
  resolvePostAuthPath: vi.fn(),
  setActiveOrganizationCookie: async (id: string) => {
    estado.set.push(id);
  },
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));

vi.mock("@/services/platform/platform-service", () => ({
  PlatformService: class {
    findActiveOrganization = async () => estado.organization;
    isPlatformAdmin = async () => estado.platformContext !== null;
  },
}));

const { enterOrganization } = await import("./auth");

async function destinationOf(call: Promise<unknown>): Promise<string> {
  try {
    await call;
  } catch (error) {
    if (error instanceof Redirect) return error.to;
    throw error;
  }
  throw new Error("no redirigió");
}

beforeEach(() => {
  estado.platformContext = { supabase: {} };
  estado.organization = null;
  estado.deleted = [];
  estado.set = [];
});

describe("enterOrganization", () => {
  it("entra a una organización existente y aterriza en su panel", async () => {
    estado.organization = { id: "o1" };

    expect(await destinationOf(enterOrganization("o1"))).toBe("/dashboard");
    expect(estado.set).toEqual(["o1"]);
  });

  it("una organización inexistente o archivada no fija la cookie", async () => {
    expect(await destinationOf(enterOrganization("o9"))).toBe("/admin/organizations");
    expect(estado.set).toEqual([]);
  });

  it("con null sale a la vista de plataforma y borra la cookie", async () => {
    expect(await destinationOf(enterOrganization(null))).toBe("/admin/organizations");
    expect(estado.deleted).toEqual([ORG_COOKIE]);
  });

  it("quien no es super admin vuelve a su inicio sin tocar nada", async () => {
    estado.platformContext = null;
    estado.organization = { id: "o1" };

    expect(await destinationOf(enterOrganization("o1"))).toBe("/dashboard");
    expect(estado.set).toEqual([]);
    expect(estado.deleted).toEqual([]);
  });
});
