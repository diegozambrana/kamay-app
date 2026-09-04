import { describe, expect, it, vi } from "vitest";

import { capture, type CaptureDeps } from "./capture";
import type { DrainOutcomes } from "./drain";
import type { SendOutcome } from "./types";

/**
 * Escenarios de `offline-capture` — "Todo registro cubierto se guarda
 * localmente antes de intentar enviarse": «Registrar con red no cambia la
 * experiencia», «La red se cae a mitad del envío», «Registrar sin red».
 */

const entrada = {
  recordId: "a",
  operation: "order.create",
  payload: { id: "a" },
  organizationId: "org-a",
  userId: "user-a",
};

function deps(overrides: Partial<CaptureDeps> & { outcome?: SendOutcome }): CaptureDeps {
  const outcomes: DrainOutcomes = new Map();
  if (overrides.outcome) outcomes.set(1, overrides.outcome);

  return {
    enqueue: vi.fn(async () => 1),
    drain: vi.fn(async () => outcomes),
    isOnline: () => true,
    // Por omisión el plazo no vence: así la prueba observa lo que el vaciado
    // devolvió, no una carrera entre dos promesas que resuelven a la vez.
    wait: () => new Promise<void>(() => undefined),
    ...overrides,
  };
}

describe("capture", () => {
  it("encola siempre, antes de intentar nada", async () => {
    const enqueue = vi.fn(async () => 1);
    await capture(entrada, deps({ enqueue, isOnline: () => false }));

    expect(enqueue).toHaveBeenCalledWith(entrada);
  });

  // Escenario: «Registrar sin red». No se espera un plazo que se sabe agotado.
  it("sin red confirma de inmediato y no dispara el vaciado", async () => {
    const drain = vi.fn(async () => new Map());
    const result = await capture(entrada, deps({ drain, isOnline: () => false }));

    expect(result).toEqual({ status: "queued" });
    expect(drain).not.toHaveBeenCalled();
  });

  // Escenario: «Registrar con red no cambia la experiencia».
  it("con red devuelve el resultado real dentro del plazo", async () => {
    const result = await capture(
      entrada,
      deps({ outcome: { kind: "ok", result: { orderId: "a", code: 142 } } }),
    );

    expect(result).toEqual({ status: "sent", result: { orderId: "a", code: 142 } });
  });

  // Escenario: «La red se cae a mitad del envío». Para quien registró es lo
  // mismo que no haber tenido red: se confirma y la cola sigue con lo suyo.
  it("un fallo transitorio se confirma como encolado", async () => {
    const result = await capture(
      entrada,
      deps({ outcome: { kind: "transient", message: "Failed to fetch" } }),
    );

    expect(result).toEqual({ status: "queued" });
  });

  it("un rechazo definitivo se devuelve con su mensaje", async () => {
    const result = await capture(
      entrada,
      deps({
        outcome: { kind: "permanent", message: "Elige o crea un cliente", recoverable: false },
      }),
    );

    expect(result).toEqual({ status: "failed", message: "Elige o crea un cliente" });
  });

  it("vencido el plazo confirma como encolado sin cancelar el envío", async () => {
    let resolveDrain: (value: DrainOutcomes) => void = () => undefined;
    const draining = new Promise<DrainOutcomes>((resolve) => {
      resolveDrain = resolve;
    });

    const result = await capture(
      entrada,
      deps({ drain: () => draining, wait: async () => undefined }),
    );

    expect(result).toEqual({ status: "queued" });

    // El envío sigue vivo: el plazo es cuánto espera la interfaz, no un
    // tiempo de espera de red.
    resolveDrain(new Map([[1, { kind: "ok", result: undefined }]]));
    await expect(draining).resolves.toBeInstanceOf(Map);
  });

  it("un vaciado que revienta no tumba la captura", async () => {
    const result = await capture(
      entrada,
      deps({ drain: async () => { throw new Error("boom"); } }),
    );

    expect(result).toEqual({ status: "queued" });
  });
});
