import { describe, expect, it } from "vitest";

import { FakeClient } from "@/tests/factories/supabase-fake";

import { BusinessLineService } from "./business-line-service";
import { ExpenseCategoryService } from "./expense-category-service";
import { SalesChannelService } from "./sales-channel-service";
import { UnitService } from "./unit-service";

const ORG = "11111111-1111-1111-1111-111111111111";

const lineRow = {
  id: "22222222-2222-2222-2222-222222222222",
  organization_id: ORG,
  name: "Sublimación",
  color: "blue",
  icon: null,
  is_shared: false,
  position: 1,
  archived_at: null,
};

describe("ConfigTableService", () => {
  it("filtra por organización y por lo vigente al listar activas", async () => {
    const client = new FakeClient([{ data: [lineRow], error: null }]);
    const lines = await new BusinessLineService(client.asSupabase()).listActive(
      ORG,
    );

    const query = client.queries[0];
    expect(client.tables[0]).toBe("business_lines");
    // organization_id explícito aunque RLS ya filtre (convención nº 2).
    expect(query.has("eq", "organization_id", ORG)).toBe(true);
    expect(query.has("is", "archived_at", null)).toBe(true);
    expect(lines).toHaveLength(1);
  });

  it("no filtra lo archivado al listar todo", async () => {
    const client = new FakeClient([{ data: [lineRow], error: null }]);
    await new BusinessLineService(client.asSupabase()).listAll(ORG);

    expect(client.queries[0].has("is", "archived_at", null)).toBe(false);
  });

  it("traduce la fila a la entidad en camelCase", async () => {
    const client = new FakeClient([
      { data: [{ ...lineRow, is_shared: true, archived_at: "2026-08-20" }], error: null },
    ]);
    const [line] = await new BusinessLineService(
      client.asSupabase(),
    ).listActive(ORG);

    expect(line).toEqual({
      id: lineRow.id,
      organizationId: ORG,
      name: "Sublimación",
      color: "blue",
      icon: null,
      isShared: true,
      position: 1,
      archivedAt: "2026-08-20",
    });
  });

  it("convierte el error de Supabase en un error con contexto", async () => {
    const client = new FakeClient([
      { data: null, error: { message: "permission denied" } },
    ]);

    await expect(
      new BusinessLineService(client.asSupabase()).listActive(ORG),
    ).rejects.toThrow(/las líneas de negocio: permission denied/);
  });

  it("archivar escribe una fecha y desarchivar la limpia", async () => {
    const client = new FakeClient([
      { data: { ...lineRow, archived_at: "2026-08-20T00:00:00.000Z" }, error: null },
      { data: lineRow, error: null },
    ]);
    const service = new BusinessLineService(client.asSupabase());

    await service.archive(ORG, lineRow.id);
    const [archivePayload] = client.queries[0].argsOf("update") as [
      { archived_at: string | null },
    ];
    expect(archivePayload.archived_at).toEqual(expect.any(String));
    // El id por sí solo no basta: la organización va siempre en el filtro.
    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);

    await service.unarchive(ORG, lineRow.id);
    const [unarchivePayload] = client.queries[1].argsOf("update") as [
      { archived_at: string | null },
    ];
    expect(unarchivePayload.archived_at).toBeNull();
  });

  it("propaga el error al actualizar", async () => {
    const client = new FakeClient([
      { data: null, error: { message: "sin política" } },
    ]);

    await expect(
      new BusinessLineService(client.asSupabase()).archive(ORG, lineRow.id),
    ).rejects.toThrow(/No se pudo actualizar/);
  });
});

describe("BusinessLineService", () => {
  it("crea la línea al final de la lista y con la organización del contexto", async () => {
    const client = new FakeClient([
      { data: [{ ...lineRow, position: 3 }], error: null },
      { data: { ...lineRow, position: 4 }, error: null },
    ]);

    await new BusinessLineService(client.asSupabase()).create(ORG, {
      name: "Alfarería",
      color: "orange",
    });

    const [payload] = client.queries[1].argsOf("insert") as [
      Record<string, unknown>,
    ];
    expect(payload).toMatchObject({
      name: "Alfarería",
      color: "orange",
      icon: null,
      position: 4,
      organization_id: ORG,
    });
    // `is_shared` no se escribe nunca desde la aplicación: es de la semilla.
    expect(payload).not.toHaveProperty("is_shared");
  });

  it("la primera línea de una organización vacía arranca en la posición 1", async () => {
    const client = new FakeClient([
      { data: [], error: null },
      { data: lineRow, error: null },
    ]);

    await new BusinessLineService(client.asSupabase()).create(ORG, {
      name: "Sublimación",
      color: "blue",
    });

    const [payload] = client.queries[1].argsOf("insert") as [
      { position: number },
    ];
    expect(payload.position).toBe(1);
  });

  it("renombrar no toca la posición ni la bandera de compartida", async () => {
    const client = new FakeClient([{ data: lineRow, error: null }]);

    await new BusinessLineService(client.asSupabase()).rename(ORG, lineRow.id, {
      name: "Sublimado",
      color: "cyan",
    });

    const [payload] = client.queries[0].argsOf("update") as [
      Record<string, unknown>,
    ];
    expect(payload).toMatchObject({ name: "Sublimado", color: "cyan" });
    expect(payload).not.toHaveProperty("position");
    expect(payload).not.toHaveProperty("is_shared");
  });

  it("propaga el error al crear", async () => {
    const client = new FakeClient([
      { data: [], error: null },
      { data: null, error: { message: "duplicado" } },
    ]);

    await expect(
      new BusinessLineService(client.asSupabase()).create(ORG, {
        name: "Sublimación",
        color: "blue",
      }),
    ).rejects.toThrow(/No se pudo crear/);
  });
});

describe("SalesChannelService", () => {
  it("crea el canal al final y lo traduce", async () => {
    const channelRow = {
      id: "33333333-3333-3333-3333-333333333333",
      organization_id: ORG,
      name: "Feria",
      position: 2,
      archived_at: null,
    };
    const client = new FakeClient([
      { data: [channelRow], error: null },
      { data: { ...channelRow, name: "Redes", position: 3 }, error: null },
    ]);

    const created = await new SalesChannelService(client.asSupabase()).create(
      ORG,
      { name: "Redes" },
    );

    expect(client.tables[1]).toBe("sales_channels");
    expect(client.queries[1].argsOf("insert")).toEqual([
      { name: "Redes", position: 3, organization_id: ORG },
    ]);
    expect(created).toEqual({
      id: channelRow.id,
      organizationId: ORG,
      name: "Redes",
      position: 3,
      archivedAt: null,
    });
  });

  it("renombra el canal", async () => {
    const client = new FakeClient([
      {
        data: {
          id: "33333333-3333-3333-3333-333333333333",
          organization_id: ORG,
          name: "Ferias",
          position: 1,
          archived_at: null,
        },
        error: null,
      },
    ]);

    await new SalesChannelService(client.asSupabase()).rename(ORG, "33333333-3333-3333-3333-333333333333", {
      name: "Ferias",
    });

    expect(client.queries[0].argsOf("update")).toEqual([{ name: "Ferias" }]);
  });
});

describe("ExpenseCategoryService", () => {
  it("crea y traduce la categoría", async () => {
    const client = new FakeClient([
      {
        data: {
          id: "44444444-4444-4444-4444-444444444444",
          organization_id: ORG,
          name: "Insumos",
          archived_at: null,
        },
        error: null,
      },
    ]);

    const created = await new ExpenseCategoryService(
      client.asSupabase(),
    ).create(ORG, { name: "Insumos" });

    expect(client.tables[0]).toBe("expense_categories");
    expect(created).toEqual({
      id: "44444444-4444-4444-4444-444444444444",
      organizationId: ORG,
      name: "Insumos",
      archivedAt: null,
    });
  });

  it("renombra la categoría", async () => {
    const client = new FakeClient([
      {
        data: {
          id: "44444444-4444-4444-4444-444444444444",
          organization_id: ORG,
          name: "Insumos y materiales",
          archived_at: null,
        },
        error: null,
      },
    ]);

    await new ExpenseCategoryService(client.asSupabase()).rename(
      ORG,
      "44444444-4444-4444-4444-444444444444",
      { name: "Insumos y materiales" },
    );

    expect(client.queries[0].argsOf("update")).toEqual([
      { name: "Insumos y materiales" },
    ]);
  });
});

describe("UnitService", () => {
  it("crea la unidad con su código y la traduce", async () => {
    const client = new FakeClient([
      {
        data: {
          id: "55555555-5555-5555-5555-555555555555",
          organization_id: ORG,
          code: "kg",
          name: "Kilogramo",
          archived_at: null,
        },
        error: null,
      },
    ]);

    const created = await new UnitService(client.asSupabase()).create(ORG, {
      code: "kg",
      name: "Kilogramo",
    });

    expect(client.tables[0]).toBe("units");
    expect(client.queries[0].argsOf("insert")).toEqual([
      { code: "kg", name: "Kilogramo", organization_id: ORG },
    ]);
    expect(created).toEqual({
      id: "55555555-5555-5555-5555-555555555555",
      organizationId: ORG,
      code: "kg",
      name: "Kilogramo",
      archivedAt: null,
    });
  });

  it("renombra la unidad con su código", async () => {
    const client = new FakeClient([
      {
        data: {
          id: "55555555-5555-5555-5555-555555555555",
          organization_id: ORG,
          code: "kgs",
          name: "Kilos",
          archived_at: null,
        },
        error: null,
      },
    ]);

    await new UnitService(client.asSupabase()).rename(
      ORG,
      "55555555-5555-5555-5555-555555555555",
      { code: "kgs", name: "Kilos" },
    );

    expect(client.queries[0].argsOf("update")).toEqual([
      { code: "kgs", name: "Kilos" },
    ]);
  });
});
