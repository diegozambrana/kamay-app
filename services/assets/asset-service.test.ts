import { describe, expect, it } from "vitest";

import { FakeClient } from "@/tests/factories/supabase-fake";

import { AssetService } from "./asset-service";

const ORG = "11111111-1111-1111-1111-111111111111";
const LINE_3D = "30000000-0000-0000-0000-000000000002";
const PRINTER = "44444444-4444-4444-4444-444444444444";

function recoveryRow(overrides: Record<string, unknown> = {}) {
  return {
    item_id: PRINTER,
    organization_id: ORG,
    business_line_id: LINE_3D,
    name: "Impresora 3D",
    acquired_on: "2026-03-01",
    acquisition_cost: "7000.00",
    maintenance_cost: "500.00",
    total_cost: "7500.00",
    line_margin_since: "6700.00",
    items: { archived_at: null },
    ...overrides,
  };
}

/**
 * Escenarios del delta spec `assets`, requisito "Pantalla de activos (V12)":
 * "La pantalla sigue el selector de línea" y "Archivados fuera por omisión".
 * Ambos recortes tienen que llegar a la consulta: filtrarlos después sería
 * traer filas para tirarlas, y con meses de historia eso se nota.
 */
describe("AssetService.list", () => {
  it("filtra siempre por organización, aunque RLS ya lo haga", async () => {
    const client = new FakeClient([{ data: [recoveryRow()], error: null }]);
    await new AssetService(client.asSupabase()).list(ORG);

    expect(client.tables[0]).toBe("asset_recovery");
    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);
  });

  it("la línea activa se recorta en la consulta", async () => {
    const client = new FakeClient([{ data: [recoveryRow()], error: null }]);
    await new AssetService(client.asSupabase()).list(ORG, { businessLineId: LINE_3D });

    expect(client.queries[0].has("eq", "business_line_id", LINE_3D)).toBe(true);
  });

  it('con "Todas" no se filtra por línea', async () => {
    const client = new FakeClient([{ data: [recoveryRow()], error: null }]);
    await new AssetService(client.asSupabase()).list(ORG, { businessLineId: null });

    expect(client.queries[0].has("eq", "business_line_id", null)).toBe(false);
  });

  it("los archivados quedan fuera por omisión, y el archivado se lee del ítem", async () => {
    const client = new FakeClient([{ data: [recoveryRow()], error: null }]);
    await new AssetService(client.asSupabase()).list(ORG);

    expect(client.queries[0].has("is", "items.archived_at", null)).toBe(true);
  });

  it('con "Ver archivados" el filtro desaparece', async () => {
    const client = new FakeClient([{ data: [recoveryRow()], error: null }]);
    await new AssetService(client.asSupabase()).list(ORG, { includeArchived: true });

    expect(client.queries[0].has("is", "items.archived_at", null)).toBe(false);
  });

  it("los numéricos llegan como texto y se convierten sin perder precisión", async () => {
    const client = new FakeClient([{ data: [recoveryRow()], error: null }]);
    const [asset] = await new AssetService(client.asSupabase()).list(ORG);

    expect(asset.acquisitionCost).toBe(7000);
    expect(asset.maintenanceCost).toBe(500);
    expect(asset.totalCost).toBe(7500);
    expect(asset.lineMarginSince).toBe(6700);
  });

  it("un activo compartido conserva su línea nula, que es lo que la tarjeta lee", async () => {
    const client = new FakeClient([
      { data: [recoveryRow({ business_line_id: null })], error: null },
    ]);
    const [asset] = await new AssetService(client.asSupabase()).list(ORG);

    expect(asset.businessLineId).toBeNull();
  });
});

describe("AssetService.save", () => {
  it("escribe la organización del contexto, no la que venga del formulario", async () => {
    const client = new FakeClient([{ data: null, error: null }]);
    await new AssetService(client.asSupabase()).save(ORG, {
      itemId: PRINTER,
      acquisitionCost: 7000,
      acquiredOn: "2026-03-01",
      supplierId: null,
      notes: null,
    });

    expect(client.tables[0]).toBe("asset_details");
    const [payload] = client.queries[0].argsOf("upsert") as [Record<string, unknown>];
    expect(payload.organization_id).toBe(ORG);
    expect(payload.item_id).toBe(PRINTER);
    expect(payload.acquisition_cost).toBe(7000);
  });
});

describe("AssetService.expenses", () => {
  it("pide solo los egresos vigentes de ese activo, de su organización", async () => {
    const client = new FakeClient([{ data: [], error: null }]);
    await new AssetService(client.asSupabase()).expenses(ORG, PRINTER);

    expect(client.tables[0]).toBe("expenses");
    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);
    expect(client.queries[0].has("eq", "asset_id", PRINTER)).toBe(true);
    expect(client.queries[0].has("is", "archived_at", null)).toBe(true);
  });

  it("los totales se piden aparte: `expense_totals` es una vista y no se incrusta", async () => {
    // PostgREST no sabe unir una vista sin foránea. Incrustarla devolvía
    // PGRST200 en el navegador y ninguna doble lo habría notado: por eso la
    // prueba mira la tabla consultada, no solo la forma del resultado.
    const client = new FakeClient([
      {
        data: [
          {
            id: "e1",
            organization_id: ORG,
            business_line_id: LINE_3D,
            kind: "expense",
            contact_id: null,
            expense_category_id: null,
            order_id: null,
            amount: "500.00",
            occurred_at: "2026-03-11T16:00:00.000Z",
            note: null,
            asset_id: PRINTER,
            asset_expense_role: "maintenance",
            archived_at: null,
          },
        ],
        error: null,
      },
      { data: [{ expense_id: "e1", total: "500.00" }], error: null },
    ]);

    const [expense] = await new AssetService(client.asSupabase()).expenses(ORG, PRINTER);

    expect(client.tables).toEqual(["expenses", "expense_totals"]);
    expect(client.queries[1].has("in", "expense_id", ["e1"])).toBe(true);
    expect(expense.total).toBe(500);
  });

  it("sin egresos no se pide ningún total", async () => {
    const client = new FakeClient([{ data: [], error: null }]);
    await new AssetService(client.asSupabase()).expenses(ORG, PRINTER);

    expect(client.tables).toEqual(["expenses"]);
  });
});

describe("AssetService.recovery", () => {
  it("pide un solo activo, de su organización, sin traerse la lista", async () => {
    const client = new FakeClient([{ data: recoveryRow(), error: null }]);
    const asset = await new AssetService(client.asSupabase()).recovery(ORG, PRINTER);

    expect(client.tables[0]).toBe("asset_recovery");
    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);
    expect(client.queries[0].has("eq", "item_id", PRINTER)).toBe(true);
    expect(client.queries[0].has("maybeSingle")).toBe(true);
    expect(asset?.totalCost).toBe(7500);
  });

  it("un activo que no existe devuelve nulo, no un error", async () => {
    const client = new FakeClient([{ data: null, error: null }]);
    expect(await new AssetService(client.asSupabase()).recovery(ORG, PRINTER)).toBeNull();
  });
});

describe("AssetService.details", () => {
  it("lee los datos declarados para el formulario que los edita", async () => {
    const client = new FakeClient([
      {
        data: {
          item_id: PRINTER,
          organization_id: ORG,
          acquisition_cost: "7000.00",
          acquired_on: "2026-03-01",
          supplier_id: null,
          notes: "Comprada con la primera tanda.",
        },
        error: null,
      },
    ]);

    const details = await new AssetService(client.asSupabase()).details(ORG, PRINTER);

    expect(client.tables[0]).toBe("asset_details");
    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);
    expect(details?.acquisitionCost).toBe(7000);
    expect(details?.acquiredOn).toBe("2026-03-01");
  });

  it("un activo sin datos declarados devuelve nulo", async () => {
    const client = new FakeClient([{ data: null, error: null }]);
    expect(await new AssetService(client.asSupabase()).details(ORG, PRINTER)).toBeNull();
  });

  it("un fallo de la base se propaga: nadie lo esconde tras un nulo", async () => {
    const client = new FakeClient([{ data: null, error: { message: "boom" } }]);
    await expect(new AssetService(client.asSupabase()).details(ORG, PRINTER)).rejects.toEqual({
      message: "boom",
    });
  });
});

describe("AssetService.history", () => {
  it("lee de la única bitácora, acotado a este activo (convención nº 7)", async () => {
    const client = new FakeClient([
      {
        data: [
          {
            id: 7,
            action: "updated",
            actor_id: null,
            actor_label: "Diego",
            changes: null,
            occurred_at: "2026-03-12T16:00:00.000Z",
          },
        ],
        error: null,
      },
    ]);

    const [entry] = await new AssetService(client.asSupabase()).history(ORG, PRINTER);

    expect(client.tables[0]).toBe("activity_log");
    expect(client.queries[0].has("eq", "table_name", "asset_details")).toBe(true);
    expect(client.queries[0].has("eq", "record_id", PRINTER)).toBe(true);
    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);
    expect(entry.action).toBe("updated");
    expect(entry.actorLabel).toBe("Diego");
  });

  it("un activo sin historial devuelve una lista vacía", async () => {
    const client = new FakeClient([{ data: null, error: null }]);
    expect(await new AssetService(client.asSupabase()).history(ORG, PRINTER)).toEqual([]);
  });
});

/**
 * Los caminos de error no son adorno: si el servicio se los tragara, la
 * pantalla mostraría una lista vacía en vez de decir que algo falló, que es
 * exactamente la clase de mentira que este proyecto evita.
 */
describe("AssetService · fallos de la base", () => {
  it("list propaga el error", async () => {
    const client = new FakeClient([{ data: null, error: { message: "boom" } }]);
    await expect(new AssetService(client.asSupabase()).list(ORG)).rejects.toEqual({
      message: "boom",
    });
  });

  it("recovery propaga el error", async () => {
    const client = new FakeClient([{ data: null, error: { message: "boom" } }]);
    await expect(new AssetService(client.asSupabase()).recovery(ORG, PRINTER)).rejects.toEqual({
      message: "boom",
    });
  });

  it("save propaga el error", async () => {
    const client = new FakeClient([{ data: null, error: { message: "boom" } }]);
    await expect(
      new AssetService(client.asSupabase()).save(ORG, {
        itemId: PRINTER,
        acquisitionCost: 1,
        acquiredOn: "2026-03-01",
        supplierId: null,
        notes: null,
      }),
    ).rejects.toEqual({ message: "boom" });
  });

  it("expenses propaga el error de los egresos y el de los totales", async () => {
    const primero = new FakeClient([{ data: null, error: { message: "boom" } }]);
    await expect(
      new AssetService(primero.asSupabase()).expenses(ORG, PRINTER),
    ).rejects.toEqual({ message: "boom" });

    const segundo = new FakeClient([
      {
        data: [
          {
            id: "e1",
            organization_id: ORG,
            business_line_id: LINE_3D,
            kind: "expense",
            contact_id: null,
            expense_category_id: null,
            order_id: null,
            amount: null,
            occurred_at: "2026-03-11T16:00:00.000Z",
            note: null,
            asset_id: PRINTER,
            asset_expense_role: "maintenance",
            archived_at: null,
          },
        ],
        error: null,
      },
      { data: null, error: { message: "totales" } },
    ]);
    await expect(
      new AssetService(segundo.asSupabase()).expenses(ORG, PRINTER),
    ).rejects.toEqual({ message: "totales" });
  });

  it("history propaga el error", async () => {
    const client = new FakeClient([{ data: null, error: { message: "boom" } }]);
    await expect(new AssetService(client.asSupabase()).history(ORG, PRINTER)).rejects.toEqual({
      message: "boom",
    });
  });

  it("un numérico ilegible cuenta como cero, no como NaN en la barra", async () => {
    const client = new FakeClient([
      { data: [recoveryRow({ line_margin_since: null, total_cost: "sin sentido" })], error: null },
    ]);
    const [asset] = await new AssetService(client.asSupabase()).list(ORG);

    expect(asset.lineMarginSince).toBe(0);
    expect(asset.totalCost).toBe(0);
  });

  it("un egreso sin total asociado cuenta como cero", async () => {
    const client = new FakeClient([
      {
        data: [
          {
            id: "e1",
            organization_id: ORG,
            business_line_id: LINE_3D,
            kind: "expense",
            contact_id: null,
            expense_category_id: null,
            order_id: null,
            amount: "120.00",
            occurred_at: "2026-03-11T16:00:00.000Z",
            note: null,
            asset_id: PRINTER,
            asset_expense_role: "maintenance",
            archived_at: null,
          },
        ],
        error: null,
      },
      { data: [], error: null },
    ]);

    const [expense] = await new AssetService(client.asSupabase()).expenses(ORG, PRINTER);
    expect(expense.total).toBe(0);
    expect(expense.amount).toBe(120);
  });
});
