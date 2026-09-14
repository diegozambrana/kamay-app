import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * KAM-26 · Las acciones de plataforma: la guardia de super admin, la
 * validación y la traducción de errores. Lo que la base decide se prueba en
 * pgTAP y en integración.
 */

const ORG = "10000000-0000-0000-0000-00000000000b";
const USER = "20000000-0000-0000-0000-000000000009";
const MEMBERSHIP = "30000000-0000-0000-0000-000000000001";

const estado = vi.hoisted(() => ({
  context: null as null | { supabase: unknown; userId: string },
  llamadas: [] as { metodo: string; args: unknown[] }[],
  fallo: null as null | Error,
  revalidadas: [] as string[],
}));

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => estado.revalidadas.push(path),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "localhost:3010" }),
}));

vi.mock("@/lib/auth/session-context", () => ({
  getPlatformAdminContext: async () => estado.context,
}));

function registrar(metodo: string, resultado?: unknown) {
  return async (...args: unknown[]) => {
    estado.llamadas.push({ metodo, args });
    if (estado.fallo) throw estado.fallo;
    return resultado;
  };
}

vi.mock("@/services/platform/organization-admin-service", () => ({
  OrganizationAdminService: class {
    create = registrar("create", ORG);
    update = registrar("update");
  },
}));

vi.mock("@/services/platform/membership-admin-service", () => ({
  MembershipAdminService: class {
    assign = registrar("assign", [{ organizationId: ORG, status: "created" }]);
    setDisplayName = registrar("setDisplayName");
    restore = registrar("restore");
  },
}));

const cuentas = vi.hoisted(() => ({
  encontrada: null as null | { id: string; email: string; memberships: unknown[] },
}));

vi.mock("@/services/platform/user-admin-service", () => ({
  UserAdminService: class {
    findByEmail = async () => cuentas.encontrada;
  },
}));

vi.mock("@/services/invitation-service", () => ({
  InvitationService: class {
    create = registrar("invite", { token: "tok" });
    changeRole = registrar("changeRole");
    archiveMembership = registrar("archiveMembership");
  },
}));

const actions = await import("./platform");

beforeEach(() => {
  cuentas.encontrada = null;
  estado.context = { supabase: {}, userId: USER };
  estado.llamadas = [];
  estado.fallo = null;
  estado.revalidadas = [];
});

describe("guardia de super admin", () => {
  it("quien no es super admin recibe un error sin llegar al servicio", async () => {
    estado.context = null;

    const results = await Promise.all([
      actions.createOrganization({ name: "T", currency: "BOB", timezone: "UTC" }),
      actions.updateOrganization({ organizationId: ORG, name: "T", currency: "BOB", timezone: "UTC" }),
      actions.assignMemberships({
        userId: USER,
        assignments: [{ organizationId: ORG, role: "owner", displayName: "Ana" }],
      }),
      actions.addUserToOrganization({ organizationId: ORG, email: "a@b.co", role: "owner" }),
      actions.setMembershipRole({ organizationId: ORG, membershipId: MEMBERSHIP, role: "owner" }),
      actions.setMembershipDisplayName({ organizationId: ORG, membershipId: MEMBERSHIP, displayName: "A" }),
      actions.archiveMembership({ organizationId: ORG, membershipId: MEMBERSHIP }),
      actions.restoreMembership({ organizationId: ORG, membershipId: MEMBERSHIP }),
    ]);

    for (const result of results) {
      expect(result).toEqual({ error: "Solo el administrador de la plataforma puede hacer esto." });
    }
    expect(estado.llamadas).toEqual([]);
  });
});

describe("createOrganization", () => {
  it("un nombre vacío no llega al servicio", async () => {
    expect(await actions.createOrganization({ name: " ", currency: "BOB", timezone: "UTC" })).toEqual({
      error: "La organización necesita un nombre",
    });
    expect(estado.llamadas).toEqual([]);
  });

  it("devuelve el id para ir al detalle", async () => {
    expect(
      await actions.createOrganization({ name: "Taller Norte", currency: "bob", timezone: "UTC" }),
    ).toEqual({ organizationId: ORG });
    expect(estado.llamadas[0].args[0]).toEqual({
      name: "Taller Norte",
      currency: "BOB",
      timezone: "UTC",
    });
    expect(estado.revalidadas).toContain("/admin/organizations");
  });

  it("un fallo se dice en lenguaje humano", async () => {
    estado.fallo = new Error("pg");
    expect(
      await actions.createOrganization({ name: "T", currency: "BOB", timezone: "UTC" }),
    ).toEqual({ error: "No se pudo crear la organización. Intenta de nuevo." });
  });
});

describe("assignMemberships", () => {
  it("devuelve el resultado de cada organización", async () => {
    const result = await actions.assignMemberships({
      userId: USER,
      assignments: [{ organizationId: ORG, role: "owner", displayName: "Ana" }],
    });
    expect(result).toEqual({ outcomes: [{ organizationId: ORG, status: "created" }] });
    expect(estado.revalidadas).toContain(`/admin/users/${USER}`);
  });
});

describe("archiveMembership", () => {
  it("el último dueño se explica con el mensaje de la regla", async () => {
    // Escenario «The last owner stays» (el mensaje que se ve).
    estado.fallo = new Error("La organización debe conservar al menos un dueño activo");
    expect(await actions.archiveMembership({ organizationId: ORG, membershipId: MEMBERSHIP })).toEqual({
      error: "La organización debe conservar al menos un dueño activo.",
    });
  });

  it("identificadores inválidos no llegan al servicio", async () => {
    expect(await actions.archiveMembership({ organizationId: "x", membershipId: "y" })).toEqual({
      error: "No se pudo identificar la membresía.",
    });
    expect(estado.llamadas).toEqual([]);
  });
});

describe("una membresía", () => {
  it("cambia rol, nombre y acceso dentro de su organización", async () => {
    await actions.setMembershipRole({ organizationId: ORG, membershipId: MEMBERSHIP, role: "owner" });
    await actions.setMembershipDisplayName({
      organizationId: ORG,
      membershipId: MEMBERSHIP,
      displayName: " Ana ",
    });
    await actions.restoreMembership({ organizationId: ORG, membershipId: MEMBERSHIP });
    await actions.updateOrganization({ organizationId: ORG, name: "G", currency: "usd", timezone: "UTC" });

    expect(estado.llamadas.map((l) => l.metodo)).toEqual([
      "changeRole",
      "setDisplayName",
      "restore",
      "update",
    ]);
    expect(estado.llamadas[1].args).toEqual([ORG, MEMBERSHIP, "Ana"]);
    expect(estado.llamadas[3].args).toEqual([ORG, { name: "G", currency: "USD", timezone: "UTC" }]);
  });

  it("un nombre vacío se rechaza", async () => {
    expect(
      await actions.setMembershipDisplayName({ organizationId: ORG, membershipId: MEMBERSHIP, displayName: "" }),
    ).toEqual({ error: "El nombre visible no puede quedar vacío" });
  });
});

describe("addUserToOrganization", () => {
  it("con una cuenta existente, la agrega con el nombre que ya usa", async () => {
    // «Adding an existing account from the Users view».
    cuentas.encontrada = {
      id: USER,
      email: "ana@kamay.test",
      memberships: [
        {
          membershipId: "m9",
          organizationId: "otra",
          organizationName: "Otra",
          role: "owner",
          displayName: "Ana",
          archivedAt: null,
        },
      ],
    };

    expect(
      await actions.addUserToOrganization({
        organizationId: ORG,
        email: " Ana@Kamay.test ",
        role: "assistant",
      }),
    ).toEqual({ kind: "created", email: "ana@kamay.test" });
    expect(estado.llamadas[0]).toEqual({
      metodo: "assign",
      args: [USER, [{ organizationId: ORG, role: "assistant", displayName: "Ana" }]],
    });
    expect(estado.revalidadas).toContain(`/admin/users/${USER}`);
  });

  it("sin cuenta, crea la invitación y devuelve su enlace", async () => {
    // «Adding an email with no account invites it».
    expect(
      await actions.addUserToOrganization({
        organizationId: ORG,
        email: "Nueva@Kamay.test",
        role: "owner",
      }),
    ).toEqual({
      kind: "invited",
      email: "nueva@kamay.test",
      inviteUrl: "http://localhost:3010/auth/invite/tok",
    });
    expect(estado.llamadas[0]).toEqual({
      metodo: "invite",
      args: [ORG, { email: "nueva@kamay.test", role: "owner", invitedBy: USER }],
    });
  });

  it("una invitación pendiente duplicada se explica", async () => {
    estado.fallo = new Error("duplicate key value");
    expect(
      await actions.addUserToOrganization({ organizationId: ORG, email: "a@b.co", role: "owner" }),
    ).toEqual({ error: "Ese correo ya tiene una invitación pendiente en esta organización." });
  });

  it("un correo inválido no llega a buscar", async () => {
    expect(
      await actions.addUserToOrganization({ organizationId: ORG, email: "no", role: "owner" }),
    ).toEqual({ error: "Ingresa un correo válido" });
    expect(estado.llamadas).toEqual([]);
  });
});
