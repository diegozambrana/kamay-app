import { describe, expect, it } from "vitest";

import { FakeClient } from "@/tests/factories/supabase-fake";

import { OrganizationService } from "./organization-service";

const ORG = "11111111-1111-1111-1111-111111111111";

const row = {
  id: ORG,
  name: "Geeko Store",
  logo_path: null,
  currency: "BOB",
  timezone: "America/La_Paz",
};

describe("OrganizationService", () => {
  it("lee la organización y la traduce", async () => {
    const client = new FakeClient([{ data: row, error: null }]);

    const organization = await new OrganizationService(
      client.asSupabase(),
    ).getById(ORG);

    expect(client.queries[0].has("eq", "id", ORG)).toBe(true);
    expect(organization).toEqual({
      id: ORG,
      name: "Geeko Store",
      logoPath: null,
      currency: "BOB",
      timezone: "America/La_Paz",
    });
  });

  it("guarda solo los datos generales", async () => {
    const client = new FakeClient([
      { data: { ...row, name: "Geeko", currency: "USD" }, error: null },
    ]);

    await new OrganizationService(client.asSupabase()).updateGeneral(ORG, {
      name: "Geeko",
      currency: "USD",
      timezone: "America/La_Paz",
      logoPath: "logos/geeko.png",
    });

    const [payload] = client.queries[0].argsOf("update") as [
      Record<string, unknown>,
    ];
    expect(payload).toMatchObject({
      name: "Geeko",
      currency: "USD",
      timezone: "America/La_Paz",
      logo_path: "logos/geeko.png",
    });
    // La configuración y la membresía no se tocan desde la sección General.
    expect(payload).not.toHaveProperty("settings");
    expect(client.queries[0].has("eq", "id", ORG)).toBe(true);
  });

  it("propaga los errores con contexto", async () => {
    const failing = { data: null, error: { message: "sin política" } };

    await expect(
      new OrganizationService(new FakeClient([failing]).asSupabase()).getById(
        ORG,
      ),
    ).rejects.toThrow(/No se pudo cargar la organización/);

    await expect(
      new OrganizationService(
        new FakeClient([failing]).asSupabase(),
      ).updateGeneral(ORG, {
        name: "x",
        currency: "BOB",
        timezone: "America/La_Paz",
        logoPath: null,
      }),
    ).rejects.toThrow(/No se pudo guardar la organización/);
  });
});

describe("OrganizationService.listActiveForJobs", () => {
  const page = (count: number, offset = 0) =>
    Array.from({ length: count }, (_, index) => ({
      id: `org-${offset + index}`,
      timezone: "America/La_Paz",
    }));

  it("sigue leyendo páginas hasta agotarlas: nadie queda fuera por el tope de filas", async () => {
    const client = new FakeClient([
      { data: page(500), error: null },
      { data: page(500, 500), error: null },
      { data: page(3, 1000), error: null },
    ]);

    const organizations = await new OrganizationService(client.asSupabase()).listActiveForJobs();

    expect(organizations).toHaveLength(1003);
    expect(client.queries.map((query) => query.argsOf("range"))).toEqual([
      [0, 499],
      [500, 999],
      [1000, 1499],
    ]);
    expect(client.queries[0].has("is", "archived_at", null)).toBe(true);
  });

  it("una página que falla se reporta, no se toma por el final", async () => {
    const client = new FakeClient([{ data: null, error: { message: "sin conexión" } }]);
    await expect(
      new OrganizationService(client.asSupabase()).listActiveForJobs(),
    ).rejects.toThrow("sin conexión");
  });
});
