import { beforeEach, describe, expect, it, vi } from "vitest";

const ORG = "11111111-1111-4111-8111-111111111111";
const USER = "55555555-5555-4555-8555-555555555555";
const ITEM = "22222222-2222-4222-8222-222222222222";
const MOVEMENT = "33333333-3333-4333-8333-333333333333";

/** Estado que las dobles leen y escriben, reiniciado en cada prueba. */
const estado = vi.hoisted(() => ({
  haySesion: true,
  consumos: [] as unknown[],
  ajustes: [] as unknown[],
  fallo: null as unknown,
  revalidadas: [] as string[],
}));

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => {
    estado.revalidadas.push(path);
  },
}));

vi.mock("@/lib/auth/session-context", () => ({
  getSessionContext: async () =>
    estado.haySesion
      ? {
          supabase: {},
          userId: USER,
          organizationId: ORG,
          membership: { role: "assistant" },
        }
      : null,
}));

vi.mock("@/services/inventory/movement-service", () => ({
  MovementService: class {
    async registerConsumption(_org: string, values: unknown) {
      if (estado.fallo) throw estado.fallo;
      estado.consumos.push(values);
    }
    async registerCountAdjustment(_org: string, values: unknown) {
      if (estado.fallo) throw estado.fallo;
      estado.ajustes.push(values);
    }
  },
}));

const { registerConsumption, registerCountAdjustment } = await import("./inventory");

const consumo = {
  id: MOVEMENT,
  itemId: ITEM,
  quantity: "5",
  occurredAt: "2026-09-08T10:00:00.000Z",
  note: "Pedido #1",
};

const ajuste = {
  id: MOVEMENT,
  itemId: ITEM,
  difference: "-5",
  occurredAt: "2026-09-08T10:00:00.000Z",
};

beforeEach(() => {
  estado.haySesion = true;
  estado.consumos = [];
  estado.ajustes = [];
  estado.fallo = null;
  estado.revalidadas = [];
});

describe("registerConsumption", () => {
  // Matriz de acceso §16: el ayudante crea movimientos. Es quien está delante
  // del estante, así que aquí no hay guardia de dueño.
  it("el ayudante registra un consumo", async () => {
    const result = await registerConsumption(consumo);

    expect(result).toBeUndefined();
    expect(estado.consumos).toHaveLength(1);
  });

  it("rechaza una cantidad de cero con el mensaje del campo", async () => {
    const result = await registerConsumption({ ...consumo, quantity: "0" });

    expect(result).toEqual({ error: expect.stringContaining("mayor que cero") });
    expect(estado.consumos).toHaveLength(0);
  });

  it("sin sesión no escribe nada", async () => {
    estado.haySesion = false;
    const result = await registerConsumption(consumo);

    expect(result).toEqual({ error: "Tu sesión terminó. Vuelve a entrar." });
    expect(estado.consumos).toHaveLength(0);
  });

  // El saldo se ve en tres sitios; un saldo viejo en la tarjeta de bajo mínimo
  // es la clase de mentira que este módulo existe para evitar.
  it("revalida el detalle, el catálogo y el panel", async () => {
    await registerConsumption(consumo);

    expect(estado.revalidadas).toEqual([`/catalog/${ITEM}`, "/catalog", "/dashboard"]);
  });

  // Reenviar un registro nunca crea un segundo, y tampoco un error: la cola
  // reintentó y el servidor tenía razón.
  it("da por bueno el reenvío de un movimiento que ya existía", async () => {
    estado.fallo = { code: "23505", message: "duplicate key" };
    const result = await registerConsumption(consumo);

    expect(result).toBeUndefined();
    expect(estado.revalidadas).toContain("/dashboard");
  });

  it("traduce cualquier otro fallo de la base", async () => {
    estado.fallo = { code: "23514", message: "sign_matches_kind" };
    const result = await registerConsumption(consumo);

    expect(result).toEqual({ error: "sign_matches_kind" });
  });

  it("cae en un mensaje entendible cuando el fallo no trae ninguno", async () => {
    estado.fallo = new Error("");
    const result = await registerConsumption(consumo);

    expect(result).toEqual({ error: "No se pudo registrar el consumo." });
  });
});

describe("registerCountAdjustment", () => {
  it("registra el ajuste con la diferencia que llega del diálogo", async () => {
    const result = await registerCountAdjustment(ajuste);

    expect(result).toBeUndefined();
    expect(estado.ajustes).toHaveLength(1);
    expect((estado.ajustes[0] as { difference: number }).difference).toBe(-5);
  });

  // Escenario "Conteo que coincide con el saldo": el diálogo lo detecta antes,
  // y si aun así llegara, el esquema lo rechaza con su mensaje.
  it("rechaza una diferencia de cero", async () => {
    const result = await registerCountAdjustment({ ...ajuste, difference: 0 });

    expect(result).toEqual({
      error: expect.stringContaining("no hay nada que ajustar"),
    });
    expect(estado.ajustes).toHaveLength(0);
  });

  it("sin sesión no escribe nada", async () => {
    estado.haySesion = false;
    const result = await registerCountAdjustment(ajuste);

    expect(result).toEqual({ error: "Tu sesión terminó. Vuelve a entrar." });
  });

  it("da por bueno el reenvío de un ajuste que ya existía", async () => {
    estado.fallo = { code: "23505", message: "duplicate key" };

    expect(await registerCountAdjustment(ajuste)).toBeUndefined();
  });

  it("traduce cualquier otro fallo de la base", async () => {
    estado.fallo = { code: "42501", message: "permiso denegado" };

    expect(await registerCountAdjustment(ajuste)).toEqual({ error: "permiso denegado" });
  });
});
