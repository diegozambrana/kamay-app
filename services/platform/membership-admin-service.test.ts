import { describe, expect, it } from "vitest";

import { FakeClient } from "@/tests/factories/supabase-fake";

import { MembershipAdminService } from "./membership-admin-service";

const USER = "20000000-0000-0000-0000-000000000009";
const B = "10000000-0000-0000-0000-00000000000b";
const C = "10000000-0000-0000-0000-00000000000c";

describe("MembershipAdminService.assign", () => {
  it("crea la membresía cuando la cuenta no estaba", async () => {
    const client = new FakeClient([{ data: null, error: null }, { data: null, error: null }]);
    const outcomes = await new MembershipAdminService(client.asSupabase()).assign(USER, [
      { organizationId: B, role: "owner", displayName: "Ana" },
    ]);

    expect(outcomes).toEqual([{ organizationId: B, status: "created" }]);
    expect(client.queries[0].has("eq", "organization_id", B)).toBe(true);
    expect(client.queries[0].has("eq", "user_id", USER)).toBe(true);
    expect(client.queries[1].argsOf("insert")).toEqual([
      { organization_id: B, user_id: USER, role: "owner", display_name: "Ana" },
    ]);
  });

  it("reactiva una membresía archivada con el rol elegido", async () => {
    // Escenario «Adding a former member restores them».
    const client = new FakeClient([
      { data: { id: "m1", archived_at: "2026-09-01T00:00:00Z" }, error: null },
      { data: null, error: null },
    ]);
    const outcomes = await new MembershipAdminService(client.asSupabase()).assign(USER, [
      { organizationId: B, role: "assistant", displayName: "Ana" },
    ]);

    expect(outcomes).toEqual([{ organizationId: B, status: "restored" }]);
    expect(client.queries[1].argsOf("update")).toEqual([
      { archived_at: null, role: "assistant", display_name: "Ana" },
    ]);
    expect(client.queries[1].has("eq", "id", "m1")).toBe(true);
    expect(client.queries[1].has("eq", "organization_id", B)).toBe(true);
  });

  it("una membresía activa no se duplica", async () => {
    // Escenario «Adding a current member is rejected».
    const client = new FakeClient([{ data: { id: "m1", archived_at: null }, error: null }]);
    const outcomes = await new MembershipAdminService(client.asSupabase()).assign(USER, [
      { organizationId: B, role: "owner", displayName: "Ana" },
    ]);

    expect(outcomes).toEqual([{ organizationId: B, status: "already_member" }]);
    expect(client.queries).toHaveLength(1);
  });

  it("que ya perteneciera a una no oculta las demás", async () => {
    // Escenario «One failing assignment does not hide the others».
    const client = new FakeClient([
      { data: { id: "m1", archived_at: null }, error: null },
      { data: null, error: null },
      { data: null, error: null },
    ]);
    const outcomes = await new MembershipAdminService(client.asSupabase()).assign(USER, [
      { organizationId: B, role: "owner", displayName: "Ana" },
      { organizationId: C, role: "assistant", displayName: "Ana" },
    ]);

    expect(outcomes).toEqual([
      { organizationId: B, status: "already_member" },
      { organizationId: C, status: "created" },
    ]);
  });

  it("un rechazo de la base queda en el resultado de esa organización", async () => {
    const client = new FakeClient([
      { data: null, error: null },
      { data: null, error: { message: "denegado" } },
    ]);
    const outcomes = await new MembershipAdminService(client.asSupabase()).assign(USER, [
      { organizationId: B, role: "owner", displayName: "Ana" },
    ]);
    expect(outcomes).toEqual([{ organizationId: B, status: "failed", error: "denegado" }]);
  });
});

describe("MembershipAdminService · una membresía", () => {
  it("cambia el nombre visible dentro de su organización", async () => {
    const client = new FakeClient([{ data: null, error: null }]);
    await new MembershipAdminService(client.asSupabase()).setDisplayName(B, "m1", "Ana María");

    expect(client.queries[0].argsOf("update")).toEqual([{ display_name: "Ana María" }]);
    expect(client.queries[0].has("eq", "organization_id", B)).toBe(true);
  });

  it("restaura el acceso sin tocar el rol", async () => {
    const client = new FakeClient([{ data: null, error: null }]);
    await new MembershipAdminService(client.asSupabase()).restore(B, "m1");

    expect(client.queries[0].argsOf("update")).toEqual([{ archived_at: null }]);
  });

  it("informa los errores", async () => {
    const client = new FakeClient([
      { data: null, error: { message: "x" } },
      { data: null, error: { message: "y" } },
    ]);
    const service = new MembershipAdminService(client.asSupabase());
    await expect(service.setDisplayName(B, "m1", "A")).rejects.toThrow(/nombre/);
    await expect(service.restore(B, "m1")).rejects.toThrow(/restaurar/);
  });
});
