import { describe, expect, it } from "vitest";

import { FakeClient } from "@/tests/factories/supabase-fake";

import { OrganizationAdminService } from "./organization-admin-service";

const ORG = "10000000-0000-0000-0000-000000000003";

const row = {
  id: ORG,
  name: "Geeko Store",
  currency: "BOB",
  timezone: "America/La_Paz",
  created_at: "2026-09-01T00:00:00Z",
  archived_at: null,
  memberships: [
    { role: "owner", display_name: "Dueña Geeko", archived_at: null },
    { role: "assistant", display_name: "Ayudante", archived_at: null },
    { role: "owner", display_name: "Antigua dueña", archived_at: "2026-09-02T00:00:00Z" },
    { role: "owner", display_name: null, archived_at: null },
  ],
};

describe("OrganizationAdminService", () => {
  it("resume cada organización: dueños activos y miembros activos", async () => {
    const client = new FakeClient([{ data: [row], error: null }]);
    const {
      rows: [summary],
      hasMore,
    } = await new OrganizationAdminService(client.asSupabase()).listPage("", 50);

    expect(summary.owners).toEqual(["Dueña Geeko", "Sin nombre"]);
    expect(summary.activeMembers).toBe(3);
    expect(summary.createdAt).toBe("2026-09-01T00:00:00Z");
    expect(hasMore).toBe(false);
  });

  it("pide una ventana acotada, con búsqueda por nombre", async () => {
    // Spec `performance-budget` → *A list requests a bounded page*.
    const client = new FakeClient([{ data: [row, { ...row, id: "otra" }], error: null }]);
    const page = await new OrganizationAdminService(client.asSupabase()).listPage(" geeko ", 1);

    expect(client.queries[0].has("ilike", "name", "%geeko%")).toBe(true);
    expect(client.queries[0].has("limit", 2)).toBe(true);
    expect(page.rows).toHaveLength(1);
    expect(page.hasMore).toBe(true);
  });

  it("lee una organización por id, o null", async () => {
    const client = new FakeClient([{ data: row, error: null }, { data: null, error: null }]);
    const service = new OrganizationAdminService(client.asSupabase());

    expect((await service.get(ORG))?.name).toBe("Geeko Store");
    expect(client.queries[0].has("eq", "id", ORG)).toBe(true);
    expect(await service.get(ORG)).toBeNull();
  });

  it("crea por la función que siembra lo mínimo", async () => {
    const client = new FakeClient([{ data: ORG, error: null }]);
    const id = await new OrganizationAdminService(client.asSupabase()).create({
      name: "Taller Norte",
      currency: "BOB",
      timezone: "America/La_Paz",
    });

    expect(id).toBe(ORG);
    expect(client.rpcCalls[0]).toEqual({
      name: "create_organization",
      params: { p_name: "Taller Norte", p_currency: "BOB", p_timezone: "America/La_Paz" },
    });
  });

  it("un rechazo al crear se informa", async () => {
    const client = new FakeClient([{ data: null, error: { message: "denegado" } }]);
    await expect(
      new OrganizationAdminService(client.asSupabase()).create({
        name: "X",
        currency: "BOB",
        timezone: "UTC",
      }),
    ).rejects.toThrow(/denegado/);
  });

  it("edita solo nombre, moneda y zona horaria de esa organización", async () => {
    const client = new FakeClient([{ data: null, error: null }]);
    await new OrganizationAdminService(client.asSupabase()).update(ORG, {
      name: "Geeko",
      currency: "USD",
      timezone: "UTC",
    });

    const [payload] = client.queries[0].argsOf("update") as [Record<string, unknown>];
    expect(payload).toMatchObject({ name: "Geeko", currency: "USD", timezone: "UTC" });
    expect(payload).not.toHaveProperty("settings");
    expect(client.queries[0].has("eq", "id", ORG)).toBe(true);
  });
});
