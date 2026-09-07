import { describe, expect, it } from "vitest";

import { FakeClient } from "@/tests/factories/supabase-fake";

import { TagService } from "./tag-service";

const ORG = "11111111-1111-4111-8111-111111111111";

const hornada = { id: "t1", organization_id: ORG, name: "Hornada-07" };

/**
 * KAM-15 · Etiquetas creadas al vuelo.
 *
 * Escenarios del delta spec `tasks` — requisito "Etiquetas por organización
 * creadas al vuelo": «Etiqueta nueva desde la tarea», «Búsqueda tolerante a
 * tildes», «La misma etiqueta no se duplica».
 */
describe("TagService", () => {
  it("busca contra search_name con el término normalizado", async () => {
    const client = new FakeClient([{ data: [hornada], error: null }]);

    await new TagService(client.asSupabase()).search(ORG, "  HORNADA  ");

    expect(client.queries[0].has("like", "search_name", "%hornada%")).toBe(true);
    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);
  });

  it("un término con tildes encuentra la etiqueta sin ellas", async () => {
    const client = new FakeClient([{ data: [], error: null }]);

    await new TagService(client.asSupabase()).search(ORG, "Sublimación");

    expect(client.queries[0].has("like", "search_name", "%sublimacion%")).toBe(true);
  });

  it("reutiliza una etiqueta existente aunque se escriba distinto", async () => {
    // Solo la lectura: no debe insertar nada.
    const client = new FakeClient([{ data: [hornada], error: null }]);

    const ids = await new TagService(client.asSupabase()).resolveNames(ORG, [
      "hornada-07",
    ]);

    expect(ids).toEqual(["t1"]);
    expect(client.tables).toEqual(["tags"]);
  });

  it("crea las que faltan y devuelve todas juntas", async () => {
    const client = new FakeClient([
      { data: [hornada], error: null },
      { data: [{ id: "t2", organization_id: ORG, name: "feria-agosto" }], error: null },
    ]);

    const ids = await new TagService(client.asSupabase()).resolveNames(ORG, [
      "Hornada-07",
      "feria-agosto",
    ]);

    expect(ids).toEqual(["t1", "t2"]);
    expect(client.queries[1].argsOf("insert")?.[0]).toEqual([
      { organization_id: ORG, name: "feria-agosto" },
    ]);
  });

  it("guarda el nombre tal como se escribió, no normalizado", async () => {
    const client = new FakeClient([
      { data: [], error: null },
      { data: [{ id: "t3", organization_id: ORG, name: "Sublimación" }], error: null },
    ]);

    await new TagService(client.asSupabase()).resolveNames(ORG, ["Sublimación"]);

    // `search_name` sirve para encontrar; `name`, para mostrar.
    expect(client.queries[1].argsOf("insert")?.[0]).toEqual([
      { organization_id: ORG, name: "Sublimación" },
    ]);
  });

  it("no crea dos veces la misma etiqueta repetida en la entrada", async () => {
    const client = new FakeClient([
      { data: [], error: null },
      { data: [{ id: "t4", organization_id: ORG, name: "feria" }], error: null },
    ]);

    await new TagService(client.asSupabase()).resolveNames(ORG, [
      "feria",
      "feria",
    ]);

    expect(client.queries[1].argsOf("insert")?.[0]).toHaveLength(1);
  });

  it("sin nombres no toca la base", async () => {
    const client = new FakeClient([]);

    const ids = await new TagService(client.asSupabase()).resolveNames(ORG, []);

    expect(ids).toEqual([]);
    expect(client.tables).toEqual([]);
  });

  it("un fallo al listar se cuenta con su motivo", async () => {
    const client = new FakeClient([
      { data: null, error: { message: "sin acceso a etiquetas" } },
    ]);

    await expect(
      new TagService(client.asSupabase()).listAll(ORG),
    ).rejects.toThrow(/sin acceso a etiquetas/);
  });

  it("un fallo al buscar se cuenta con su motivo", async () => {
    const client = new FakeClient([
      { data: null, error: { message: "búsqueda rechazada" } },
    ]);

    await expect(
      new TagService(client.asSupabase()).search(ORG, "hornada"),
    ).rejects.toThrow(/búsqueda rechazada/);
  });

  it("un fallo al crear se cuenta con su motivo", async () => {
    const client = new FakeClient([
      { data: [], error: null },
      { data: null, error: { message: "duplicate key" } },
    ]);

    await expect(
      new TagService(client.asSupabase()).resolveNames(ORG, ["feria"]),
    ).rejects.toThrow(/duplicate key/);
  });

  it("buscar con el término vacío devuelve todas", async () => {
    const client = new FakeClient([{ data: [hornada], error: null }]);

    const tags = await new TagService(client.asSupabase()).search(ORG, "   ");

    // Sin término no hay nada que filtrar: se lista, no se busca.
    expect(client.queries[0].calls.some((c) => c.method === "like")).toBe(false);
    expect(tags).toHaveLength(1);
  });
});
