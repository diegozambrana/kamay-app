import { describe, expect, it } from "vitest";

import { FakeClient } from "@/tests/factories/supabase-fake";

import { PlatformService } from "./platform-service";

const ORG = "10000000-0000-0000-0000-000000000003";

describe("PlatformService", () => {
  it("pregunta a la base si la cuenta es super admin", async () => {
    const client = new FakeClient([{ data: true, error: null }]);
    expect(await new PlatformService(client.asSupabase()).isPlatformAdmin()).toBe(true);
    expect(client.rpcCalls[0].name).toBe("is_platform_admin");
  });

  it("cualquier otra respuesta es que no", async () => {
    const client = new FakeClient([{ data: null, error: null }]);
    expect(await new PlatformService(client.asSupabase()).isPlatformAdmin()).toBe(false);
  });

  it("un error de la base no se confunde con un no", async () => {
    const client = new FakeClient([{ data: null, error: { message: "caída" } }]);
    await expect(new PlatformService(client.asSupabase()).isPlatformAdmin()).rejects.toThrow(
      /caída/,
    );
  });

  it("busca la organización de la cookie viva y la traduce", async () => {
    const client = new FakeClient([
      {
        data: { id: ORG, name: "Geeko", logo_path: null, currency: "BOB", timezone: "America/La_Paz" },
        error: null,
      },
    ]);
    const organization = await new PlatformService(client.asSupabase()).findActiveOrganization(ORG);

    expect(organization?.name).toBe("Geeko");
    expect(client.queries[0].has("eq", "id", ORG)).toBe(true);
    expect(client.queries[0].has("is", "archived_at", null)).toBe(true);
  });

  it("una cookie que no es uuid no llega a la base", async () => {
    const client = new FakeClient([]);
    expect(
      await new PlatformService(client.asSupabase()).findActiveOrganization("basura"),
    ).toBeNull();
    expect(client.queries).toHaveLength(0);
  });

  it("una organización inexistente es null", async () => {
    const client = new FakeClient([{ data: null, error: null }]);
    expect(await new PlatformService(client.asSupabase()).findActiveOrganization(ORG)).toBeNull();
  });

  it("lista las organizaciones vivas por nombre para el selector, con tope", async () => {
    const client = new FakeClient([
      { data: [{ id: ORG, name: "Geeko" }, { id: "o2", name: "Taller" }], error: null },
    ]);
    const result = await new PlatformService(client.asSupabase()).listActiveOrganizations(1);

    expect(result).toEqual({ organizations: [{ id: ORG, name: "Geeko" }], hasMore: true });
    expect(client.queries[0].has("is", "archived_at", null)).toBe(true);
    expect(client.queries[0].has("order", "name", { ascending: true })).toBe(true);
    expect(client.queries[0].has("limit", 2)).toBe(true);
  });
});
