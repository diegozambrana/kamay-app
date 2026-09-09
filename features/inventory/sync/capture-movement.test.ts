import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  INVENTORY_ADJUSTMENT,
  INVENTORY_CONSUMPTION,
} from "@/features/sync/operations";
import type { ConsumptionValues, CountValues } from "@/lib/inventory/schema";
import type { DrainOutcomes, EnqueueInput } from "@/lib/offline";

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

const { captureAdjustment, captureConsumption } = await import("./capture-movement");

const ORG = "00000000-0000-4000-8000-000000000001";
const USER = "00000000-0000-4000-8000-000000000002";
const MOVEMENT = "00000000-0000-4000-8000-000000000003";
const ITEM = "00000000-0000-4000-8000-000000000004";

const consumption: ConsumptionValues = {
  id: MOVEMENT,
  itemId: ITEM,
  variantId: null,
  quantity: 5,
  occurredAt: "2026-09-08T15:40:00.000Z",
  note: "Pedido #1",
};

const adjustment: CountValues = {
  id: MOVEMENT,
  itemId: ITEM,
  variantId: null,
  difference: -5,
  occurredAt: "2026-09-08T15:40:00.000Z",
  note: null,
};

const deps = { organizationId: ORG, userId: USER, isOnline: () => true };

beforeEach(() => {
  enqueue.mockClear();
  drainOutbox.mockClear();
});

describe("captureConsumption", () => {
  it("encola el consumo con su operación y el sobre completo", async () => {
    await captureConsumption(consumption, deps);

    const [input] = enqueue.mock.calls[0];
    expect(input.operation).toBe(INVENTORY_CONSUMPTION);
    expect(input.payload).toEqual(consumption);
    expect(input.organizationId).toBe(ORG);
    expect(input.userId).toBe(USER);
  });

  // El `recordId` es el `uuid` del propio movimiento: reenviarlo no puede
  // crear un segundo, porque la clave primaria lo impide.
  it("usa el identificador del movimiento como identidad del sobre", async () => {
    await captureConsumption(consumption, deps);

    expect(enqueue.mock.calls[0][0].recordId).toBe(MOVEMENT);
  });

  // Un movimiento no espera a ningún padre: el insumo ya existe.
  it("no declara ninguna dependencia", async () => {
    await captureConsumption(consumption, deps);

    expect(enqueue.mock.calls[0][0].dependsOn).toBeUndefined();
  });

  it("dispara el vaciado con la sesión de quien registra", async () => {
    await captureConsumption(consumption, deps);

    expect(drainOutbox).toHaveBeenCalledWith({
      session: { organizationId: ORG, userId: USER },
    });
  });

  // Sin red no se espera nada: `capture` devuelve encolado y la interfaz
  // confirma igual.
  it("sin red devuelve encolado sin esperar al servidor", async () => {
    const result = await captureConsumption(consumption, {
      ...deps,
      isOnline: () => false,
    });

    expect(result.status).toBe("queued");
    expect(drainOutbox).not.toHaveBeenCalled();
  });
});

describe("captureAdjustment", () => {
  it("encola el ajuste con su propia operación", async () => {
    await captureAdjustment(adjustment, deps);

    const [input] = enqueue.mock.calls[0];
    expect(input.operation).toBe(INVENTORY_ADJUSTMENT);
    expect(input.recordId).toBe(MOVEMENT);
  });

  // La diferencia viaja tal cual: es lo que hace correcto un ajuste que se
  // sincroniza tarde (design D6).
  it("lleva la diferencia calculada en el dispositivo, no el conteo", async () => {
    await captureAdjustment(adjustment, deps);

    expect(enqueue.mock.calls[0][0].payload).toEqual(adjustment);
  });
});
