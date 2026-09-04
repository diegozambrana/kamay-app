import { describe, expect, it } from "vitest";

import { FakeClient } from "@/tests/factories/supabase-fake";

import { PaymentService } from "./payment-service";

const ORG = "11111111-1111-1111-1111-111111111111";
const ORDER = "22222222-2222-2222-2222-222222222222";
const EXPENSE = "33333333-3333-3333-3333-333333333333";
const PAYMENT = "44444444-4444-4444-4444-444444444444";
const LINE = "55555555-5555-5555-5555-555555555555";

const paymentRow = {
  id: PAYMENT,
  organization_id: ORG,
  direction: "in",
  order_id: ORDER,
  expense_id: null,
  amount: "40.00",
  method: "cash",
  occurred_at: "2026-09-03T10:00:00.000Z",
  note: null,
  created_by: null,
  archived_at: null,
};

describe("PaymentService.listForOrder", () => {
  it("filtra por organización y por pedido, del más reciente al más antiguo", async () => {
    const client = new FakeClient([{ data: [paymentRow], error: null }]);
    await new PaymentService(client.asSupabase()).listForOrder(ORG, ORDER);

    const query = client.queries[0];
    expect(client.tables[0]).toBe("payments");
    // organization_id explícito aunque RLS ya filtre (convención nº 2).
    expect(query.has("eq", "organization_id", ORG)).toBe(true);
    expect(query.has("eq", "order_id", ORDER)).toBe(true);
    expect(query.has("order", "occurred_at", { ascending: false })).toBe(true);
    // Dos cobros del mismo minuto comparten `occurred_at`: sin el desempate
    // por la hora del servidor su orden sería indeterminado.
    expect(query.has("order", "created_at", { ascending: false })).toBe(true);
  });

  it("devuelve también los archivados: un movimiento anulado sigue siendo parte de lo que pasó", async () => {
    const client = new FakeClient([{ data: [paymentRow], error: null }]);
    await new PaymentService(client.asSupabase()).listForOrder(ORG, ORDER);

    // No se filtra por `archived_at`: lo que hace la vista es no contarlos.
    expect(client.queries[0].has("is", "archived_at", null)).toBe(false);
  });

  it("convierte el numeric de texto a número sin perder los centavos", async () => {
    const client = new FakeClient([
      { data: [{ ...paymentRow, amount: "115.35" }], error: null },
    ]);
    const [payment] = await new PaymentService(client.asSupabase()).listForOrder(
      ORG,
      ORDER,
    );

    expect(payment.amount).toBe(115.35);
    expect(payment.method).toBe("cash");
    expect(payment.direction).toBe("in");
  });

  it("propaga el error de la base con un mensaje entendible", async () => {
    const client = new FakeClient([
      { data: null, error: { message: "boom" } },
    ]);
    await expect(
      new PaymentService(client.asSupabase()).listForOrder(ORG, ORDER),
    ).rejects.toThrow("No se pudieron cargar los cobros: boom");
  });
});

describe("PaymentService.listForExpense", () => {
  it("filtra por egreso", async () => {
    const client = new FakeClient([{ data: [], error: null }]);
    await new PaymentService(client.asSupabase()).listForExpense(ORG, EXPENSE);

    expect(client.queries[0].has("eq", "expense_id", EXPENSE)).toBe(true);
  });
});

describe("PaymentService.registerCollection", () => {
  it("fija la dirección `in` desde el destino, no desde el llamador", async () => {
    const client = new FakeClient([{ data: null, error: null }]);
    await new PaymentService(client.asSupabase()).registerCollection(ORG, {
      id: PAYMENT,
      orderId: ORDER,
      amount: 150,
      method: "cash",
      occurredAt: "2026-09-03T12:00:00.000Z",
      note: null,
    });

    const [row] = client.queries[0].argsOf("insert") as [Record<string, unknown>];
    expect(row.direction).toBe("in");
    expect(row.order_id).toBe(ORDER);
    expect(row.organization_id).toBe(ORG);
    // El destino de egreso no viaja: exactly_one_target lo rechazaría.
    expect(row.expense_id).toBeUndefined();
  });

  it("no envía ningún saldo ni total: son derivados", async () => {
    const client = new FakeClient([{ data: null, error: null }]);
    await new PaymentService(client.asSupabase()).registerCollection(ORG, {
      id: PAYMENT,
      orderId: ORDER,
      amount: 150,
      method: null,
      occurredAt: "2026-09-03T12:00:00.000Z",
      note: null,
    });

    const [row] = client.queries[0].argsOf("insert") as [Record<string, unknown>];
    expect(row).not.toHaveProperty("balance");
    expect(row).not.toHaveProperty("paid");
    expect(row).not.toHaveProperty("payment_status");
  });
});

describe("PaymentService.registerPayment", () => {
  it("fija la dirección `out` desde el destino", async () => {
    const client = new FakeClient([{ data: null, error: null }]);
    await new PaymentService(client.asSupabase()).registerPayment(ORG, {
      id: PAYMENT,
      expenseId: EXPENSE,
      amount: 200,
      method: "transfer",
      occurredAt: "2026-09-03T12:00:00.000Z",
      note: null,
    });

    const [row] = client.queries[0].argsOf("insert") as [Record<string, unknown>];
    expect(row.direction).toBe("out");
    expect(row.expense_id).toBe(EXPENSE);
    expect(row.order_id).toBeUndefined();
  });
});

describe("PaymentService.voidPayment", () => {
  it("archiva en vez de borrar, y no toca el importe", async () => {
    const client = new FakeClient([{ data: null, error: null }]);
    await new PaymentService(client.asSupabase()).voidPayment(ORG, PAYMENT);

    const query = client.queries[0];
    const [patch] = query.argsOf("update") as [Record<string, unknown>];
    expect(Object.keys(patch)).toEqual(["archived_at"]);
    expect(query.has("eq", "organization_id", ORG)).toBe(true);
    expect(query.has("eq", "id", PAYMENT)).toBe(true);
  });

  it("propaga el rechazo del trigger cuando quien anula no es el dueño", async () => {
    const client = new FakeClient([
      { data: null, error: { message: "Solo la persona dueña puede archivar" } },
    ]);
    await expect(
      new PaymentService(client.asSupabase()).voidPayment(ORG, PAYMENT),
    ).rejects.toThrow("Solo la persona dueña puede archivar");
  });
});

describe("PaymentService.orderTotals", () => {
  it("lee total y paid de la vista, en una sola consulta", async () => {
    const client = new FakeClient([
      {
        data: [{ order_id: ORDER, total: "115.00", paid: "40.00" }],
        error: null,
      },
    ]);
    const totals = await new PaymentService(client.asSupabase()).orderTotals(ORG, [
      ORDER,
    ]);

    expect(client.tables[0]).toBe("order_totals");
    expect(client.queries[0].has("in", "order_id", [ORDER])).toBe(true);
    expect(totals.get(ORDER)).toEqual({ total: 115, paid: 40 });
  });

  it("sin identificadores no consulta nada", async () => {
    const client = new FakeClient([]);
    const totals = await new PaymentService(client.asSupabase()).orderTotals(ORG, []);

    expect(totals.size).toBe(0);
    expect(client.tables).toHaveLength(0);
  });
});

describe("PaymentService.expenseTotals", () => {
  it("lee de expense_totals", async () => {
    const client = new FakeClient([
      { data: [{ expense_id: EXPENSE, total: "500", paid: "200" }], error: null },
    ]);
    const totals = await new PaymentService(client.asSupabase()).expenseTotals(ORG, [
      EXPENSE,
    ]);

    expect(client.tables[0]).toBe("expense_totals");
    expect(totals.get(EXPENSE)).toEqual({ total: 500, paid: 200 });
  });
});

describe("PaymentService.receivables / payables", () => {
  it("lee Por cobrar de su vista, filtrando por organización", async () => {
    const client = new FakeClient([
      {
        data: [
          { organization_id: ORG, business_line_id: LINE, outstanding: "125.00" },
        ],
        error: null,
      },
    ]);
    const rows = await new PaymentService(client.asSupabase()).receivables(ORG);

    expect(client.tables[0]).toBe("receivables_by_line");
    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);
    expect(rows).toEqual([
      { organizationId: ORG, businessLineId: LINE, outstanding: 125 },
    ]);
  });

  it("lee Por pagar de la suya, sin lógica de permisos propia", async () => {
    // Al ayudante le llegan cero filas por `security_invoker`, no porque el
    // servicio filtre (design D7).
    const client = new FakeClient([{ data: [], error: null }]);
    const rows = await new PaymentService(client.asSupabase()).payables(ORG);

    expect(client.tables[0]).toBe("payables_by_line");
    expect(rows).toEqual([]);
  });
});

describe("PaymentService · errores de la base", () => {
  it("propaga el rechazo al registrar un movimiento", async () => {
    const client = new FakeClient([
      { data: null, error: { message: 'violates check constraint "amount"' } },
    ]);
    await expect(
      new PaymentService(client.asSupabase()).registerCollection(ORG, {
        id: PAYMENT,
        orderId: ORDER,
        amount: 0,
        method: null,
        occurredAt: "2026-09-03T12:00:00.000Z",
        note: null,
      }),
    ).rejects.toThrow("No se pudo registrar el movimiento");
  });

  it("propaga el error al calcular los saldos", async () => {
    const client = new FakeClient([
      { data: null, error: { message: "vista no disponible" } },
    ]);
    await expect(
      new PaymentService(client.asSupabase()).orderTotals(ORG, [ORDER]),
    ).rejects.toThrow("No se pudieron calcular los saldos: vista no disponible");
  });

  it("propaga el error al calcular lo pendiente", async () => {
    const client = new FakeClient([
      { data: null, error: { message: "sin privilegio" } },
    ]);
    await expect(
      new PaymentService(client.asSupabase()).receivables(ORG),
    ).rejects.toThrow("No se pudo calcular lo pendiente: sin privilegio");
  });

  it("una fila sin datos no revienta la conversión", async () => {
    // PostgREST puede devolver `null` en un `numeric` agregado sin filas.
    const client = new FakeClient([
      {
        data: [{ organization_id: ORG, business_line_id: LINE, outstanding: null }],
        error: null,
      },
    ]);
    const [row] = await new PaymentService(client.asSupabase()).receivables(ORG);

    expect(row.outstanding).toBe(0);
  });

  it("una respuesta vacía devuelve lista vacía, no indefinido", async () => {
    const client = new FakeClient([{ data: null, error: null }]);

    expect(
      await new PaymentService(client.asSupabase()).listForOrder(ORG, ORDER),
    ).toEqual([]);
  });
});
