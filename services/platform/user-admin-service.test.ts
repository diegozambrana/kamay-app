import { describe, expect, it } from "vitest";

import { FakeClient } from "@/tests/factories/supabase-fake";

import { UserAdminService } from "./user-admin-service";

const ORG = "10000000-0000-0000-0000-000000000003";

const row = {
  user_id: "u1",
  email: "geeko@kamay.test",
  created_at: "2026-09-01T00:00:00Z",
  last_sign_in_at: null,
  is_platform_admin: false,
  memberships: [
    {
      membership_id: "m1",
      organization_id: ORG,
      organization_name: "Geeko Store",
      role: "owner",
      display_name: "Dueña Geeko",
      archived_at: null,
    },
  ],
};

describe("UserAdminService", () => {
  it("lista las cuentas por la función de plataforma y las traduce", async () => {
    const client = new FakeClient([{ data: [row], error: null }]);
    const [user] = await new UserAdminService(client.asSupabase()).list();

    expect(client.rpcCalls[0]).toEqual({ name: "platform_list_users", params: {} });
    expect(user).toEqual({
      id: "u1",
      email: "geeko@kamay.test",
      createdAt: "2026-09-01T00:00:00Z",
      lastSignInAt: null,
      platformAdmin: false,
      memberships: [
        {
          membershipId: "m1",
          organizationId: ORG,
          organizationName: "Geeko Store",
          role: "owner",
          displayName: "Dueña Geeko",
          archivedAt: null,
        },
      ],
    });
  });

  it("pasa los filtros a la base", async () => {
    const client = new FakeClient([{ data: [], error: null }]);
    await new UserAdminService(client.asSupabase()).list({
      organizationId: ORG,
      query: " ana ",
      withoutOrganization: true,
      limit: 10,
    });
    expect(client.rpcCalls[0].params).toEqual({
      p_organization_id: ORG,
      p_query: "ana",
      p_without_organization: true,
      p_limit: 10,
    });
  });

  it("una ventana pide una de más para saber si hay más", async () => {
    const client = new FakeClient([{ data: [row, { ...row, user_id: "u2" }], error: null }]);
    const page = await new UserAdminService(client.asSupabase()).listPage({}, 1);

    expect(client.rpcCalls[0].params).toEqual({ p_limit: 2 });
    expect(page.rows).toHaveLength(1);
    expect(page.hasMore).toBe(true);
  });

  it("busca una cuenta por su correo exacto", async () => {
    const client = new FakeClient([
      { data: [{ ...row, email: "geeko.store@kamay.test", user_id: "u9" }, row], error: null },
      { data: [], error: null },
    ]);
    const service = new UserAdminService(client.asSupabase());

    expect((await service.findByEmail(" GEEKO@kamay.test "))?.id).toBe("u1");
    expect(client.rpcCalls[0].params).toEqual({ p_query: "geeko@kamay.test", p_limit: 20 });
    expect(await service.findByEmail("nadie@kamay.test")).toBeNull();
    expect(await service.findByEmail("  ")).toBeNull();
  });

  it("quien no es super admin recibe un error, no una lista vacía", async () => {
    const client = new FakeClient([{ data: null, error: { message: "insufficient_privilege" } }]);
    await expect(new UserAdminService(client.asSupabase()).list()).rejects.toThrow(
      /No se pudieron leer las cuentas/,
    );
  });

  it("lee una cuenta por id, sin traer las demás", async () => {
    const client = new FakeClient([{ data: [row], error: null }, { data: [], error: null }]);
    const service = new UserAdminService(client.asSupabase());
    expect((await service.get("u1"))?.email).toBe("geeko@kamay.test");
    expect(client.rpcCalls[0].params).toEqual({ p_user_id: "u1" });
    expect(await service.get("otro")).toBeNull();
  });
});
