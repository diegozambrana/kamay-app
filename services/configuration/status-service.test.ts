import { describe, expect, it } from "vitest";

import { FakeClient } from "@/tests/factories/supabase-fake";

import { StatusService } from "./status-service";

const ORG = "11111111-1111-1111-1111-111111111111";
const LINE = "22222222-2222-2222-2222-222222222222";

const statusRow = {
  id: "33333333-3333-3333-3333-333333333333",
  organization_id: ORG,
  business_line_id: LINE,
  flow: "order",
  name: "En cola",
  kind: "waiting",
  color: "blue",
  position: 3,
  is_queue: true,
  archived_at: null,
};

describe("StatusService", () => {
  it("resuelve el juego vigente vía la función de la base, no en TypeScript", async () => {
    const client = new FakeClient([{ data: [statusRow], error: null }]);
    const statuses = await new StatusService(client.asSupabase()).resolve(
      ORG,
      LINE,
      "order",
    );

    expect(client.rpcCalls[0]).toEqual({
      name: "resolve_statuses",
      params: { org: ORG, line: LINE, p_flow: "order" },
    });
    // La fila llega a la aplicación en camelCase y con el kind del contrato.
    expect(statuses[0]).toMatchObject({
      businessLineId: LINE,
      kind: "waiting",
      isQueue: true,
    });
  });

  it("la lectura administrativa pide el alcance exacto e incluye lo archivado", async () => {
    const client = new FakeClient([{ data: [statusRow], error: null }]);
    await new StatusService(client.asSupabase()).listForScope(ORG, null, "task");

    const query = client.queries[0];
    expect(client.tables[0]).toBe("statuses");
    // organization_id explícito aunque RLS ya filtre (convención nº 2).
    expect(query.has("eq", "organization_id", ORG)).toBe(true);
    expect(query.has("eq", "flow", "task")).toBe(true);
    // null = juego de la organización, no "sin filtro".
    expect(query.has("is", "business_line_id", null)).toBe(true);
    // Sin filtro de archived_at: V22 también administra lo archivado.
    expect(query.has("is", "archived_at", null)).toBe(false);
  });

  it("crear coloca el estado al final de su juego", async () => {
    const client = new FakeClient([
      { data: [{ ...statusRow, position: 4 }], error: null },
      { data: { ...statusRow, position: 5 }, error: null },
    ]);
    await new StatusService(client.asSupabase()).create(ORG, LINE, "order", {
      name: "Nuevo",
      kind: "waiting",
      color: "zinc",
      isQueue: false,
    });

    const inserted = client.queries[1].argsOf("insert")?.[0] as Record<
      string,
      unknown
    >;
    expect(inserted.position).toBe(5);
    expect(inserted.organization_id).toBe(ORG);
    expect(inserted.business_line_id).toBe(LINE);
  });

  it("reordenar persiste la posición según el lugar en la lista", async () => {
    const client = new FakeClient([
      { data: null, error: null },
      { data: null, error: null },
    ]);
    await new StatusService(client.asSupabase()).reorder(ORG, ["a", "b"]);

    const first = client.queries[0].argsOf("update")?.[0] as { position: number };
    const second = client.queries[1].argsOf("update")?.[0] as { position: number };
    expect(first.position).toBe(1);
    expect(second.position).toBe(2);
    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);
  });

  it("archivar delega en archive_status con el estado de destino", async () => {
    const client = new FakeClient([{ data: null, error: null }]);
    await new StatusService(client.asSupabase()).archive(statusRow.id, "dest");

    expect(client.rpcCalls[0]).toEqual({
      name: "archive_status",
      params: { p_status_id: statusRow.id, p_move_to: "dest" },
    });
  });

  it("restaurar envía el juego por defecto del flujo en la forma de la base", async () => {
    const client = new FakeClient([{ data: null, error: null }]);
    await new StatusService(client.asSupabase()).restoreDefaults(
      ORG,
      null,
      "task",
    );

    const call = client.rpcCalls[0];
    expect(call.name).toBe("restore_default_statuses");
    const params = call.params as { p_defaults: { name: string; kind: string }[] };
    expect(params.p_defaults.map((status) => status.kind)).toContain("initial");
    expect(params.p_defaults.map((status) => status.kind)).toContain("final");
  });

  it("crear juego propio copia el juego activo de la organización en una sola transacción", async () => {
    const orgRow = { ...statusRow, business_line_id: null, name: "Registrado" };
    const client = new FakeClient([
      { data: [orgRow, { ...orgRow, name: "Viejo", archived_at: "2026-08-20" }], error: null },
      { data: null, error: null },
    ]);
    await new StatusService(client.asSupabase()).createOwnSet(ORG, LINE, "order");

    const call = client.rpcCalls[0];
    expect(call.name).toBe("restore_default_statuses");
    const params = call.params as {
      p_line: string;
      p_defaults: { name: string }[];
    };
    expect(params.p_line).toBe(LINE);
    // Solo lo vigente se copia: lo archivado no forma parte del juego.
    expect(params.p_defaults.map((status) => status.name)).toEqual([
      "Registrado",
    ]);
  });

  it("volver al juego de la organización delega en la función de la base", async () => {
    const client = new FakeClient([{ data: null, error: null }]);
    await new StatusService(client.asSupabase()).useOrganizationSet(
      ORG,
      LINE,
      "order",
    );

    expect(client.rpcCalls[0]).toEqual({
      name: "use_organization_statuses",
      params: { p_org: ORG, p_line: LINE, p_flow: "order" },
    });
  });

  it("convierte el error de Supabase en un error con contexto", async () => {
    const client = new FakeClient([
      { data: null, error: { message: "permission denied" } },
    ]);

    await expect(
      new StatusService(client.asSupabase()).resolve(ORG, null, "task"),
    ).rejects.toThrow(/juego de estados: permission denied/);
  });
});
