import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `fair-all-lines` · La acción que registra las ventas de un carrito con
 * productos de varias líneas. Es la que reenvía la cola, así que valida todo
 * y no confía en el sobre.
 */

const ORG = "11111111-1111-4111-8111-111111111111";
const LINE_A = "22222222-2222-4222-8222-222222222222";
const LINE_B = "33333333-3333-4333-8333-333333333333";

const estado = vi.hoisted(() => ({ lotes: [] as unknown[][], falla: null as string | null }));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

vi.mock("@/lib/auth/session-context", () => ({
  getSessionContext: async () => ({
    supabase: {},
    userId: "user",
    organizationId: ORG,
    role: "assistant",
  }),
}));

vi.mock("@/services/fair/fair-sale-service", () => ({
  FairSaleService: class {
    async createMany(sales: unknown[]) {
      if (estado.falla) throw new Error(estado.falla);
      estado.lotes.push(sales);
      return sales.map((sale) => (sale as { id: string }).id);
    }
  },
}));

const { registerDirectSales } = await import("./fair");

function venta(id: string, line: string, organizationId = ORG) {
  return {
    id,
    organizationId,
    businessLineId: line,
    contactId: null,
    salesChannelId: null,
    occurredAt: "2026-09-26T15:40:00.000Z",
    notes: null,
    items: [
      {
        id: crypto.randomUUID(),
        itemId: crypto.randomUUID(),
        variantId: null,
        description: null,
        quantity: 1,
        unitPrice: 45,
      },
    ],
    payment: null,
  };
}

beforeEach(() => {
  estado.lotes = [];
  estado.falla = null;
});

describe("registerDirectSales", () => {
  it("registra el lote entero en una llamada", async () => {
    const a = crypto.randomUUID();
    const b = crypto.randomUUID();

    const result = await registerDirectSales([venta(a, LINE_A), venta(b, LINE_B)]);

    expect(result).toEqual({ saleIds: [a, b] });
    expect(estado.lotes).toHaveLength(1);
    expect(estado.lotes[0]).toHaveLength(2);
  });

  it("rechaza un lote con una venta de otra organización y no escribe nada", async () => {
    const result = await registerDirectSales([
      venta(crypto.randomUUID(), LINE_A),
      venta(crypto.randomUUID(), LINE_B, "99999999-9999-4999-8999-999999999999"),
    ]);

    expect(result).toEqual({ error: "Esa venta pertenece a otra organización." });
    expect(estado.lotes).toHaveLength(0);
  });

  it("rechaza menos de dos ventas o más de veinte", async () => {
    expect(await registerDirectSales([venta(crypto.randomUUID(), LINE_A)])).toHaveProperty("error");
    const muchas = Array.from({ length: 21 }, () => venta(crypto.randomUUID(), LINE_A));
    expect(await registerDirectSales(muchas)).toHaveProperty("error");
    expect(estado.lotes).toHaveLength(0);
  });

  it("devuelve el error de la base para una persona", async () => {
    estado.falla = "La línea no tiene un estado final configurado";

    const result = await registerDirectSales([
      venta(crypto.randomUUID(), LINE_A),
      venta(crypto.randomUUID(), LINE_B),
    ]);

    expect(result).toHaveProperty("error");
  });
});
