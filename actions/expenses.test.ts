import { beforeEach, describe, expect, it, vi } from "vitest";

const ORG = "11111111-1111-4111-8111-111111111111";
const LINE = "22222222-2222-4222-8222-222222222222";
const SUPPLIER = "33333333-3333-4333-8333-333333333333";
const PURCHASE = "44444444-4444-4444-8444-444444444444";
const PLA = "55555555-5555-4555-8555-555555555555";
const RESINA = "66666666-6666-4666-8666-666666666666";
const NEGRO = "77777777-7777-4777-8777-777777777777";
const GRIS = "88888888-8888-4888-8888-888888888888";

/** Estado que las dobles leen y escriben, reiniciado en cada prueba. */
const estado = vi.hoisted(() => ({
  compras: [] as unknown[],
  variantesPedidas: [] as string[][],
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

vi.mock("@/lib/auth/session-context", () => ({
  getOwnerContext: async () => ({ supabase: {}, organizationId: ORG }),
}));

vi.mock("@/services/catalog/contact-service", () => ({
  ContactService: class {
    async findById() {
      return { id: SUPPLIER, isSupplier: true, archivedAt: null };
    }
  },
}));

vi.mock("@/services/catalog/item-variant-service", () => ({
  ItemVariantService: class {
    async listByIds(_org: string, ids: string[]) {
      estado.variantesPedidas.push(ids);
      const itemOf: Record<string, string> = { [NEGRO]: PLA, [GRIS]: RESINA };
      return ids.filter((id) => itemOf[id]).map((id) => ({ id, itemId: itemOf[id] }));
    }
  },
}));

vi.mock("@/services/expenses/expense-service", () => ({
  ExpenseService: class {
    async createPurchase(_org: string, values: unknown) {
      estado.compras.push(values);
      return PURCHASE;
    }
  },
}));

const { createPurchase } = await import("./expenses");

function compra(items: { itemId: string; variantId?: string | null }[]) {
  return {
    id: PURCHASE,
    businessLineId: LINE,
    contactId: SUPPLIER,
    occurredAt: "2026-09-21T10:00:00.000Z",
    items: items.map((item, index) => ({
      id: `9999999${index}-9999-4999-8999-999999999999`,
      quantity: "1",
      unitPrice: "175",
      variantId: null,
      ...item,
    })),
  };
}

beforeEach(() => {
  estado.compras = [];
  estado.variantesPedidas = [];
});

describe("createPurchase · variantes de las líneas (catalog-custom-attributes)", () => {
  it("una línea con la variante de su ítem se guarda", async () => {
    const result = await createPurchase(compra([{ itemId: PLA, variantId: NEGRO }]));

    expect(result).toEqual({ expenseId: PURCHASE });
    expect(estado.compras).toHaveLength(1);
  });

  it("una línea con la variante de otro ítem se rechaza antes de llegar a la base", async () => {
    const result = await createPurchase(compra([{ itemId: PLA, variantId: GRIS }]));

    expect(result).toEqual({
      error: "Una de las variantes no es del ítem de su línea. Vuelve a elegirla.",
    });
    expect(estado.compras).toEqual([]);
  });

  it("una variante que no existe en la organización también se rechaza", async () => {
    const result = await createPurchase(
      compra([{ itemId: PLA, variantId: "00000000-0000-4000-8000-000000000000" }]),
    );
    expect(result).toEqual({ error: expect.any(String) });
    expect(estado.compras).toEqual([]);
  });

  it("sin variantes en las líneas no consulta variantes", async () => {
    const result = await createPurchase(compra([{ itemId: RESINA }]));

    expect(result).toEqual({ expenseId: PURCHASE });
    expect(estado.variantesPedidas).toEqual([]);
  });
});
