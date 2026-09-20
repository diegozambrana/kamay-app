import { describe, expect, it } from "vitest";

import { FakeClient } from "@/tests/factories/supabase-fake";

import { OrganizationToolService } from "./organization-tool-service";

const ORG = "11111111-1111-1111-1111-111111111111";
const SLUG = "print-cost-3d";

const row = {
  id: "22222222-2222-2222-2222-222222222222",
  organization_id: ORG,
  slug: SLUG,
  config: { filamentPricePerKg: 190 },
  archived_at: null,
};
const archived = { ...row, archived_at: "2026-09-20T10:00:00Z" };

/** KAM-27 · spec `tenant-tools` → *La activación de herramientas se guarda por organización*. */
describe("OrganizationToolService", () => {
  it("los slugs activos salen de la función, no de la tabla", async () => {
    const client = new FakeClient([{ data: [SLUG], error: null }]);
    const slugs = await new OrganizationToolService(client.asSupabase()).activeSlugs(ORG);

    expect(client.rpcCalls).toEqual([
      { name: "active_tool_slugs", params: { p_organization_id: ORG } },
    ]);
    expect(client.tables).toEqual([]);
    expect(slugs).toEqual([SLUG]);
  });

  it("sin filas devuelve una lista vacía, y un error se propaga", async () => {
    const empty = new FakeClient([{ data: null, error: null }]);
    expect(await new OrganizationToolService(empty.asSupabase()).activeSlugs(ORG)).toEqual([]);

    const broken = new FakeClient([{ data: null, error: { message: "caída" } }]);
    await expect(new OrganizationToolService(broken.asSupabase()).activeSlugs(ORG)).rejects.toThrow(
      /caída/,
    );
  });

  it("lista las filas de la organización, con la organización explícita", async () => {
    const client = new FakeClient([{ data: [row, archived], error: null }]);
    const tools = await new OrganizationToolService(client.asSupabase()).list(ORG);

    expect(client.tables[0]).toBe("organization_tools");
    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);
    expect(tools.map((tool) => tool.archivedAt)).toEqual([null, archived.archived_at]);
    expect(tools[0]).toEqual({
      id: row.id,
      organizationId: ORG,
      slug: SLUG,
      config: { filamentPricePerKg: 190 },
      archivedAt: null,
    });
  });

  it("un error al listar o al buscar se propaga", async () => {
    const broken = () => new FakeClient([{ data: null, error: { message: "caída" } }]);
    await expect(new OrganizationToolService(broken().asSupabase()).list(ORG)).rejects.toThrow();
    await expect(
      new OrganizationToolService(broken().asSupabase()).findBySlug(ORG, SLUG),
    ).rejects.toThrow();
  });

  it("los parámetros solo se entregan si la herramienta está activa", async () => {
    const active = new FakeClient([{ data: row, error: null }]);
    expect(
      await new OrganizationToolService(active.asSupabase()).getActiveConfig(ORG, SLUG),
    ).toEqual({ filamentPricePerKg: 190 });
    expect(active.queries[0].has("eq", "organization_id", ORG)).toBe(true);
    expect(active.queries[0].has("eq", "slug", SLUG)).toBe(true);

    const off = new FakeClient([{ data: archived, error: null }]);
    expect(await new OrganizationToolService(off.asSupabase()).getActiveConfig(ORG, SLUG)).toBeNull();

    const never = new FakeClient([{ data: null, error: null }]);
    expect(await new OrganizationToolService(never.asSupabase()).getActiveConfig(ORG, SLUG)).toBeNull();
  });

  it("activar por primera vez inserta con los valores por defecto", async () => {
    const client = new FakeClient([
      { data: null, error: null },
      { data: null, error: null },
    ]);
    await new OrganizationToolService(client.asSupabase()).activate(ORG, SLUG, { a: 1 });

    expect(client.queries[1].argsOf("insert")?.[0]).toEqual({
      organization_id: ORG,
      slug: SLUG,
      config: { a: 1 },
    });
  });

  it("reactivar desarchiva y NO toca los parámetros", async () => {
    const client = new FakeClient([
      { data: archived, error: null },
      { data: [{ id: row.id }], error: null },
    ]);
    await new OrganizationToolService(client.asSupabase()).activate(ORG, SLUG, { a: 1 });

    const update = client.queries[1].argsOf("update")?.[0] as Record<string, unknown>;
    expect(update.archived_at).toBeNull();
    expect(update).not.toHaveProperty("config");
    expect(client.queries[1].has("eq", "organization_id", ORG)).toBe(true);
    expect(client.queries[1].has("eq", "slug", SLUG)).toBe(true);
  });

  it("activar lo que ya está activo no escribe nada", async () => {
    const client = new FakeClient([{ data: row, error: null }]);
    await new OrganizationToolService(client.asSupabase()).activate(ORG, SLUG, { a: 1 });
    expect(client.queries).toHaveLength(1);
  });

  it("un fallo al insertar se propaga", async () => {
    const client = new FakeClient([
      { data: null, error: null },
      { data: null, error: { message: "duplicate key" } },
    ]);
    await expect(
      new OrganizationToolService(client.asSupabase()).activate(ORG, SLUG, {}),
    ).rejects.toThrow(/duplicate key/);
  });

  it("desactivar archiva, sin tocar los parámetros", async () => {
    const client = new FakeClient([{ data: [{ id: row.id }], error: null }]);
    await new OrganizationToolService(client.asSupabase()).deactivate(ORG, SLUG);

    const update = client.queries[0].argsOf("update")?.[0] as Record<string, unknown>;
    expect(typeof update.archived_at).toBe("string");
    expect(update).not.toHaveProperty("config");
    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);
  });

  it("guardar parámetros escribe solo config", async () => {
    const client = new FakeClient([{ data: [{ id: row.id }], error: null }]);
    await new OrganizationToolService(client.asSupabase()).updateConfig(ORG, SLUG, { b: 2 });

    const update = client.queries[0].argsOf("update")?.[0] as Record<string, unknown>;
    expect(update.config).toEqual({ b: 2 });
    expect(update).not.toHaveProperty("archived_at");
  });

  it("escribir sobre una fila que la RLS no deja ver es un error, no un guardado", async () => {
    const zero = new FakeClient([{ data: [], error: null }]);
    await expect(
      new OrganizationToolService(zero.asSupabase()).updateConfig(ORG, SLUG, {}),
    ).rejects.toThrow(/no está a tu alcance/);

    const broken = new FakeClient([{ data: null, error: { message: "caída" } }]);
    await expect(
      new OrganizationToolService(broken.asSupabase()).deactivate(ORG, SLUG),
    ).rejects.toThrow(/caída/);
  });
});
