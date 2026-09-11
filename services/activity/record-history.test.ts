import { describe, expect, it } from "vitest";

import { FakeClient } from "@/tests/factories/supabase-fake";

import { loadRecordHistory } from "./record-history";

const ORG = "11111111-1111-1111-1111-111111111111";
const STATUS_A = "aaaaaaaa-0000-0000-0000-000000000001";
const STATUS_B = "aaaaaaaa-0000-0000-0000-000000000002";
const USER = "bbbbbbbb-0000-0000-0000-000000000001";

const opciones = {
  organizationId: ORG,
  tableName: "orders",
  recordId: "order-1",
  timezone: "America/La_Paz",
  currency: "Bs",
};

const evento = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  action: "status_changed",
  actor_id: USER,
  actor_label: null,
  changes: { status_id: { antes: STATUS_A, despues: STATUS_B } },
  occurred_at: "2026-08-19T18:22:00.000Z",
  table_name: "orders",
  record_id: "order-1",
  business_line_id: null,
  origin: "desktop",
  ...overrides,
});

/**
 * KAM-22 · El historial de un registro, compuesto una sola vez.
 *
 * Es la pieza de la que dependen las cinco pantallas de detalle. Lo que se
 * comprueba es que lee de `activity_log` —y de ninguna otra tabla—, que
 * redacta con la función compartida y que resuelve las referencias antes de
 * construir el diff.
 */
describe("loadRecordHistory", () => {
  it("lee de la bitácora y de ninguna otra tabla de historial", async () => {
    const client = new FakeClient([
      { data: [evento()], error: null },
      { data: [{ id: STATUS_A, name: "En diseño" }], error: null },
      { data: [{ user_id: USER, display_name: "Marcela" }], error: null },
    ]);

    await loadRecordHistory(client.asSupabase(), opciones);

    expect(client.tables[0]).toBe("activity_log");
    expect(client.tables).not.toContain("order_history");
    expect(client.queries[0].has("eq", "table_name", "orders")).toBe(true);
    expect(client.queries[0].has("eq", "record_id", "order-1")).toBe(true);
  });

  it("redacta con la función compartida, sin repetir el rótulo del registro", async () => {
    const client = new FakeClient([
      { data: [evento()], error: null },
      { data: [{ id: STATUS_B, name: "En cola" }], error: null },
      { data: [{ user_id: USER, display_name: "Marcela" }], error: null },
    ]);

    const { items } = await loadRecordHistory(client.asSupabase(), opciones);

    // Quien mira ya está dentro del pedido: repetir «#142» en cada línea de
    // su propio historial sería ruido.
    expect(items[0].sentence).toBe("Marcela cambió el estado del pedido");
    expect(items[0].sentence).not.toMatch(/#/);
  });

  it("resuelve las referencias antes de construir el diff", async () => {
    const client = new FakeClient([
      { data: [evento()], error: null },
      {
        data: [
          { id: STATUS_A, name: "En diseño" },
          { id: STATUS_B, name: "En cola" },
        ],
        error: null,
      },
      { data: [{ user_id: USER, display_name: "Marcela" }], error: null },
    ]);

    const { items } = await loadRecordHistory(client.asSupabase(), opciones);

    expect(items[0].detail).toEqual({
      kind: "rows",
      rows: [{ label: "Estado", before: "En diseño", after: "En cola" }],
    });
  });

  it("ofrece el paso a la bitácora filtrada por este registro", async () => {
    const client = new FakeClient([{ data: [], error: null }]);

    const { activityHref } = await loadRecordHistory(
      client.asSupabase(),
      opciones,
    );

    expect(activityHref).toBe("/activity?type=orders&q=order-1");
  });

  // Al ayudante RLS le devuelve cero filas: ni se resuelven rótulos ni se
  // consulta nada más, y el bloque se rinde vacío en vez de fallar.
  it("sin eventos no consulta nada más y devuelve una lista vacía", async () => {
    const client = new FakeClient([{ data: [], error: null }]);

    const { items, activityHref } = await loadRecordHistory(
      client.asSupabase(),
      opciones,
    );

    expect(items).toEqual([]);
    expect(activityHref).toBe("/activity?type=orders&q=order-1");
    expect(client.tables).toEqual(["activity_log"]);
  });

  it("un evento purgado por la retención llega declarado, no vacío", async () => {
    const client = new FakeClient([
      { data: [evento({ changes: null })], error: null },
      { data: [{ user_id: USER, display_name: "Marcela" }], error: null },
    ]);

    const { items } = await loadRecordHistory(client.asSupabase(), opciones);

    expect(items[0].detail).toEqual({ kind: "purged" });
    expect(items[0].sentence).toBe("Marcela cambió el estado del pedido");
  });

  it("un autor no humano se nombra por su etiqueta", async () => {
    const client = new FakeClient([
      { data: [evento({ actor_id: null, actor_label: "sistema" })], error: null },
      { data: [{ id: STATUS_B, name: "En cola" }], error: null },
    ]);

    const { items } = await loadRecordHistory(client.asSupabase(), opciones);

    expect(items[0].sentence).toMatch(/^Sistema /);
  });
});
