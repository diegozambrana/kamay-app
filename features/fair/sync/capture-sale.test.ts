import { beforeEach, describe, expect, it, vi } from "vitest";

import { DIRECT_SALE_CREATE, DIRECT_SALE_CREATE_BATCH } from "@/features/sync/operations";
import type { DirectSaleInput } from "@/lib/fair/sale-schema";

import type { DrainOutcomes, EnqueueInput } from "@/lib/offline";

// Los tipos van en la firma del mock, no en parámetros sin usar: es lo que
// hace que `mock.calls[0][0]` esté tipado sin castings en cada aserción.
const enqueue = vi.fn<(input: EnqueueInput) => Promise<number>>(async () => 1);
const drainOutbox = vi.fn<(options: unknown) => Promise<DrainOutcomes>>(
  async () => new Map(),
);

vi.mock("@/lib/offline", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/offline")>();
  return {
    ...actual,
    enqueue: (input: EnqueueInput) => enqueue(input),
    drainOutbox: (options: unknown) => drainOutbox(options),
    outboxDatabase: () => ({}),
  };
});

const { captureSale, captureSales, FAIR_FLUSH_DEADLINE_MS } = await import("./capture-sale");

const ORG = "00000000-0000-4000-8000-000000000001";
const SALE = "00000000-0000-4000-8000-000000000004";

const sale: DirectSaleInput = {
  id: SALE,
  organizationId: ORG,
  businessLineId: "00000000-0000-4000-8000-000000000002",
  contactId: null,
  salesChannelId: null,
  occurredAt: "2026-09-01T15:40:00.000Z",
  notes: null,
  items: [
    {
      id: "00000000-0000-4000-8000-000000000011",
      itemId: null,
      variantId: null,
      description: null,
      quantity: 1,
      unitPrice: 35,
    },
  ],
  payment: { id: "00000000-0000-4000-8000-000000000005", amount: 35, method: "cash" },
};

beforeEach(() => {
  enqueue.mockClear();
  drainOutbox.mockClear();
});

describe("captureSale", () => {
  it("el plazo de espera de la feria es cero", () => {
    expect(FAIR_FLUSH_DEADLINE_MS).toBe(0);
  });

  it("usa el uuid de la venta como recordId del sobre", async () => {
    await captureSale(sale, "user-a", { isOnline: () => true });

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls[0][0]).toMatchObject({
      recordId: SALE,
      operation: DIRECT_SALE_CREATE,
      organizationId: ORG,
      userId: "user-a",
    });
  });

  it("el occurredAt viaja dentro del payload, no como campo de la entrada", async () => {
    await captureSale(sale, "user-a", { isOnline: () => true });

    const input = enqueue.mock.calls[0][0];
    expect((input.payload as DirectSaleInput).occurredAt).toBe("2026-09-01T15:40:00.000Z");
    expect(input).not.toHaveProperty("occurredAt");
  });

  it("una venta no depende de nada: su cobro va dentro del mismo sobre", async () => {
    await captureSale(sale, "user-a", { isOnline: () => true });

    const input = enqueue.mock.calls[0][0];
    expect(input.dependsOn ?? []).toEqual([]);
    expect((input.payload as DirectSaleInput).payment).not.toBeNull();
  });

  // Escenario: La aplicación se cierra con ventas pendientes — encolar primero
  it("encola siempre, también con red: un solo camino", async () => {
    await captureSale(sale, "user-a", { isOnline: () => true });
    expect(enqueue).toHaveBeenCalledTimes(1);

    enqueue.mockClear();
    await captureSale(sale, "user-a", { isOnline: () => false });
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  // Escenario: No se espera al servidor
  it("con red no espera al vaciado: devuelve encolada", async () => {
    drainOutbox.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(new Map()), 5_000)),
    );

    const result = await captureSale(sale, "user-a", { isOnline: () => true });

    expect(result.status).toBe("queued");
  });

  // Escenario: Reintento por fallo de red
  it("reenviar el mismo sobre conserva el recordId", async () => {
    await captureSale(sale, "user-a", { isOnline: () => false });
    await captureSale(sale, "user-a", { isOnline: () => false });

    expect(enqueue.mock.calls[0][0].recordId).toBe(enqueue.mock.calls[1][0].recordId);
  });

  it("sin red no dispara el vaciado", async () => {
    await captureSale(sale, "user-a", { isOnline: () => false });

    expect(drainOutbox).not.toHaveBeenCalled();
  });
});

// `fair-all-lines` · Un registro con varias líneas es UNA entrada de la cola.
describe("captureSales", () => {
  const second: DirectSaleInput = {
    ...sale,
    id: "00000000-0000-4000-8000-000000000006",
    businessLineId: "00000000-0000-4000-8000-000000000003",
    payment: null,
  };

  it("encola una sola entrada directSale.createBatch con todas las ventas", async () => {
    await captureSales([sale, second], "user-a", { isOnline: () => false });

    expect(enqueue).toHaveBeenCalledTimes(1);
    const input = enqueue.mock.calls[0][0];
    expect(input).toMatchObject({
      // La primera venta identifica el registro: reenviarlo conserva la clave.
      recordId: SALE,
      operation: DIRECT_SALE_CREATE_BATCH,
      organizationId: ORG,
      userId: "user-a",
    });
    expect((input.payload as { sales: DirectSaleInput[] }).sales).toEqual([sale, second]);
    expect(input.dependsOn ?? []).toEqual([]);
  });

  it("con red tampoco espera: devuelve encolada", async () => {
    drainOutbox.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(new Map()), 5_000)),
    );

    const result = await captureSales([sale, second], "user-a", { isOnline: () => true });

    expect(result.status).toBe("queued");
  });
});
