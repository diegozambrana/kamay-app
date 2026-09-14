import { describe, expect, it } from "vitest";

import type { MembershipWithOrganization, Organization } from "@/types";

import { resolveAccess } from "./access";

const organization = (id: string): Organization => ({
  id,
  name: `Org ${id}`,
  logoPath: null,
  currency: "BOB",
  timezone: "America/La_Paz",
});

const membership = (
  organizationId: string,
  role: "owner" | "assistant",
): MembershipWithOrganization => ({
  id: `m-${organizationId}`,
  organizationId,
  role,
  displayName: null,
  organization: organization(organizationId),
});

const base = { cookieOrgId: undefined, cookieOrganization: null };

describe("resolveAccess · cuentas que no son super admin", () => {
  it("sin membresías: el aviso sin organización", () => {
    expect(resolveAccess({ ...base, memberships: [], platformAdmin: false })).toEqual({
      kind: "no-organization",
    });
  });

  it("una membresía se toma sin preguntar, con su rol", () => {
    const resolution = resolveAccess({
      ...base,
      memberships: [membership("a", "assistant")],
      platformAdmin: false,
    });
    expect(resolution.kind === "active" && resolution.access.role).toBe("assistant");
  });

  it("varias sin cookie válida: elegir", () => {
    expect(
      resolveAccess({
        ...base,
        cookieOrgId: "z",
        memberships: [membership("a", "owner"), membership("b", "owner")],
        platformAdmin: false,
      }),
    ).toEqual({ kind: "choose-organization" });
  });

  it("la organización de la cookie sin membresía no cuenta para nadie más", () => {
    const resolution = resolveAccess({
      memberships: [membership("a", "owner"), membership("b", "owner")],
      platformAdmin: false,
      cookieOrgId: "z",
      cookieOrganization: organization("z"),
    });
    expect(resolution.kind).toBe("choose-organization");
  });
});

describe("resolveAccess · administrador de la plataforma", () => {
  it("sin organización va a la vista de plataforma, nunca al aviso", () => {
    // «A platform admin without memberships never sees the notice».
    expect(resolveAccess({ ...base, memberships: [], platformAdmin: true })).toEqual({
      kind: "platform",
    });
  });

  it("con varias membresías y sin elegir, tampoco pasa por la selección", () => {
    // «A platform admin never gets the selection screen».
    expect(
      resolveAccess({
        ...base,
        memberships: [membership("a", "owner"), membership("b", "assistant")],
        platformAdmin: true,
      }),
    ).toEqual({ kind: "platform" });
  });

  it("en una organización ajena actúa como dueño y sin membresía", () => {
    const resolution = resolveAccess({
      memberships: [],
      platformAdmin: true,
      cookieOrgId: "z",
      cookieOrganization: organization("z"),
    });
    expect(resolution).toEqual({
      kind: "active",
      access: {
        organizationId: "z",
        organization: organization("z"),
        role: "owner",
        membership: null,
        platformAdmin: true,
      },
    });
  });

  it("donde es ayudante, es dueño; y conserva su membresía", () => {
    const resolution = resolveAccess({
      ...base,
      cookieOrgId: "a",
      memberships: [membership("a", "assistant")],
      platformAdmin: true,
    });
    expect(resolution.kind === "active" && resolution.access.role).toBe("owner");
    expect(resolution.kind === "active" && resolution.access.membership?.id).toBe("m-a");
  });

  it("una organización leída que no coincide con la cookie no se usa", () => {
    expect(
      resolveAccess({
        memberships: [],
        platformAdmin: true,
        cookieOrgId: "z",
        cookieOrganization: organization("otra"),
      }),
    ).toEqual({ kind: "platform" });
  });
});
