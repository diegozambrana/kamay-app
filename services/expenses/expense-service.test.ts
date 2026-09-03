import { describe, expect, it } from "vitest";

import { FakeClient } from "@/tests/factories/supabase-fake";

import { ExpenseService } from "./expense-service";
import { ItemLastCostService } from "./item-last-cost-service";

const ORG = "11111111-1111-1111-1111-111111111111";
const LINE = "22222222-2222-2222-2222-222222222222";
const EXPENSE = "33333333-3333-3333-3333-333333333333";
const SUPPLIER = "44444444-4444-4444-4444-444444444444";
const CATEGORY = "55555555-5555-5555-5555-555555555555";
const ITEM = "66666666-6666-6666-6666-666666666666";

const purchaseRow = {
  id: EXPENSE,
  organization_id: ORG,
  business_line_id: LINE,
  kind: "purchase",
  contact_id: SUPPLIER,
  expense_category_id: null,
  order_id: null,
  amount: null,
  occurred_at: "2026-09-01T10:00:00.000Z",
  note: null,
  archived_at: null,
};

describe("ExpenseService.list", () => {
  it("filtra por organización y esconde lo archivado por defecto", async () => {
    const client = new FakeClient([
      { data: [purchaseRow], error: null },
      { data: [{ expense_id: EXPENSE, total: "615.00" }], error: null },
    ]);
    await new ExpenseService(client.asSupabase()).list(ORG);

    const query = client.queries[0];
    expect(client.tables[0]).toBe("expenses");
    // organization_id explícito aunque RLS ya filtre (convención nº 2).
    expect(query.has("eq", "organization_id", ORG)).toBe(true);
    expect(query.has("is", "archived_at", null)).toBe(true);
    expect(query.has("order", "occurred_at", { ascending: false })).toBe(true);
  });

  it("muestra lo archivado cuando se pide", async () => {
    const client = new FakeClient([
      { data: [purchaseRow], error: null },
      { data: [], error: null },
    ]);
    await new ExpenseService(client.asSupabase()).list(ORG, { includeArchived: true });

    expect(client.queries[0].has("is", "archived_at", null)).toBe(false);
  });

  it("traduce cada filtro a la consulta esperada", async () => {
    const client = new FakeClient([
      { data: [purchaseRow], error: null },
      { data: [], error: null },
    ]);
    await new ExpenseService(client.asSupabase()).list(ORG, {
      businessLineId: LINE,
      kind: "purchase",
      contactId: SUPPLIER,
      expenseCategoryId: CATEGORY,
      from: "2026-09-01T04:00:00.000Z",
      to: "2026-10-01T04:00:00.000Z",
    });

    const query = client.queries[0];
    expect(query.has("eq", "business_line_id", LINE)).toBe(true);
    expect(query.has("eq", "kind", "purchase")).toBe(true);
    expect(query.has("eq", "contact_id", SUPPLIER)).toBe(true);
    expect(query.has("eq", "expense_category_id", CATEGORY)).toBe(true);
    // Desde inclusivo, hasta exclusivo: el periodo son días civiles.
    expect(query.has("gte", "occurred_at", "2026-09-01T04:00:00.000Z")).toBe(true);
    expect(query.has("lt", "occurred_at", "2026-10-01T04:00:00.000Z")).toBe(true);
  });

  it("toma el total de la vista, no de una columna del egreso", async () => {
    const client = new FakeClient([
      { data: [purchaseRow], error: null },
      { data: [{ expense_id: EXPENSE, total: "615.00" }], error: null },
    ]);
    const [expense] = await new ExpenseService(client.asSupabase()).list(ORG);

    expect(client.tables[1]).toBe("expense_totals");
    expect(expense.total).toBe(615);
    // El total no viaja en la fila de `expenses`: no hay tal columna.
    expect("total" in purchaseRow).toBe(false);
  });

  it("un gasto archivado, ausente de la vista, vale su monto", async () => {
    const archivedCost = {
      ...purchaseRow,
      kind: "expense",
      contact_id: null,
      expense_category_id: CATEGORY,
      amount: "120.00",
      archived_at: "2026-09-02T10:00:00.000Z",
    };
    const client = new FakeClient([
      { data: [archivedCost], error: null },
      { data: [], error: null },
    ]);
    const [expense] = await new ExpenseService(client.asSupabase()).list(ORG, {
      includeArchived: true,
    });

    expect(expense.total).toBe(120);
    expect(client.tables).toEqual(["expenses", "expense_totals"]);
  });

  it("una compra archivada suma sus líneas con el mismo cálculo que la vista", async () => {
    const archivedPurchase = {
      ...purchaseRow,
      archived_at: "2026-09-02T10:00:00.000Z",
    };
    const client = new FakeClient([
      { data: [archivedPurchase], error: null },
      { data: [], error: null },
      {
        data: [
          { expense_id: EXPENSE, quantity: "3", unit_price: "25" },
          { expense_id: EXPENSE, quantity: "1", unit_price: "40" },
        ],
        error: null,
      },
    ]);
    const [expense] = await new ExpenseService(client.asSupabase()).list(ORG, {
      includeArchived: true,
    });

    expect(expense.total).toBe(115);
    expect(client.tables[2]).toBe("expense_items");
  });

  it("no consulta la vista si no hay egresos", async () => {
    const client = new FakeClient([{ data: [], error: null }]);
    const expenses = await new ExpenseService(client.asSupabase()).list(ORG);

    expect(expenses).toEqual([]);
    expect(client.tables).toEqual(["expenses"]);
  });
});

describe("ExpenseService.create", () => {
  it("una compra viaja a create_expense con encabezado y líneas en nombres de columna", async () => {
    const client = new FakeClient([{ data: EXPENSE, error: null }]);
    const id = await new ExpenseService(client.asSupabase()).createPurchase(ORG, {
      id: EXPENSE,
      businessLineId: LINE,
      contactId: SUPPLIER,
      occurredAt: "2026-09-01T10:00:00.000Z",
      note: null,
      items: [
        { id: ITEM, itemId: ITEM, variantId: null, quantity: 3, unitPrice: 25 },
      ],
    });

    expect(id).toBe(EXPENSE);
    expect(client.rpcCalls[0].name).toBe("create_expense");
    expect(client.rpcCalls[0].params).toEqual({
      p_expense: {
        id: EXPENSE,
        organization_id: ORG,
        business_line_id: LINE,
        kind: "purchase",
        contact_id: SUPPLIER,
        occurred_at: "2026-09-01T10:00:00.000Z",
        note: null,
      },
      p_items: [
        { id: ITEM, item_id: ITEM, variant_id: null, quantity: 3, unit_price: 25 },
      ],
    });
  });

  it("un gasto viaja sin líneas y con su monto, categoría y pedido", async () => {
    const client = new FakeClient([{ data: EXPENSE, error: null }]);
    await new ExpenseService(client.asSupabase()).createCost(ORG, {
      id: EXPENSE,
      businessLineId: LINE,
      expenseCategoryId: CATEGORY,
      amount: 120,
      occurredAt: "2026-09-01T10:00:00.000Z",
      note: "Internet",
      orderId: null,
    });

    const params = client.rpcCalls[0].params as { p_expense: Record<string, unknown>; p_items: unknown[] };
    expect(params.p_expense).toMatchObject({
      kind: "expense",
      expense_category_id: CATEGORY,
      amount: 120,
      note: "Internet",
      order_id: null,
    });
    expect(params.p_items).toEqual([]);
    // Ningún total viaja: es un derivado (convención nº 4).
    expect("total" in params.p_expense).toBe(false);
  });

  it("sube el mensaje de la base tal cual para que la acción lo traduzca", async () => {
    const client = new FakeClient([
      { data: null, error: { message: "Una compra necesita al menos una línea" } },
    ]);
    await expect(
      new ExpenseService(client.asSupabase()).createPurchase(ORG, {
        id: EXPENSE,
        businessLineId: LINE,
        contactId: SUPPLIER,
        occurredAt: "2026-09-01T10:00:00.000Z",
        note: null,
        items: [],
      }),
    ).rejects.toThrow("Una compra necesita al menos una línea");
  });
});

describe("ItemLastCostService.mapFor", () => {
  it("lee la vista una sola vez para la organización y la indexa por ítem", async () => {
    const client = new FakeClient([
      {
        data: [
          {
            item_id: ITEM,
            last_cost: "9.20",
            last_purchase_at: "2026-08-31T10:00:00.000Z",
            last_supplier_id: SUPPLIER,
          },
        ],
        error: null,
      },
    ]);
    const map = await new ItemLastCostService(client.asSupabase()).mapFor(ORG);

    expect(client.tables).toEqual(["item_last_cost"]);
    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);
    expect(map.get(ITEM)).toEqual({
      itemId: ITEM,
      lastCost: 9.2,
      lastPurchaseAt: "2026-08-31T10:00:00.000Z",
      lastSupplierId: SUPPLIER,
    });
  });
});
