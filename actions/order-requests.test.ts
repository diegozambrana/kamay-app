import { beforeEach, describe, expect, it, vi } from "vitest";

const ORG = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const LINE = "33333333-3333-4333-8333-333333333333";
const REQUEST = "44444444-4444-4444-8444-444444444444";
const ORDER = "55555555-5555-4555-8555-555555555555";

const estado = vi.hoisted(() => ({
  conSesion: true,
  llamadas: [] as { metodo: string; args: unknown[] }[],
  fallo: false,
  revalidado: [] as unknown[][],
  avisos: [] as unknown[],
  rpc: { data: null as unknown, error: null as { message: string } | null },
  host: "kamay.app",
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => estado.revalidado.push(args),
}));

vi.mock("next/headers", () => ({
  headers: async () => ({ get: (name: string) => (name === "host" ? estado.host : null) }),
}));

vi.mock("@/lib/auth/session-context", () => ({
  getSessionContext: async () =>
    estado.conSesion
      ? { supabase: {}, organizationId: ORG, userId: USER, role: "owner" }
      : null,
}));

vi.mock("@/services/order-requests/order-request-service", () => ({
  OrderRequestService: class {
    private registrar(metodo: string, args: unknown[]) {
      if (estado.fallo) throw new Error("caída");
      estado.llamadas.push({ metodo, args });
    }
    async create(...args: unknown[]) {
      this.registrar("create", args);
      return {
        orderRequest: { id: REQUEST },
        token: "token-de-prueba-1234567890",
      };
    }
    async regenerate(...args: unknown[]) {
      this.registrar("regenerate", args);
      return "token-regenerado-1234567890";
    }
    async discard(...args: unknown[]) {
      this.registrar("discard", args);
    }
    async accept(...args: unknown[]) {
      this.registrar("accept", args);
    }
  },
}));

vi.mock("@/services/notifications/emit-order-request-events", () => ({
  emitOrderRequestReceived: async (input: unknown) => {
    estado.avisos.push(input);
  },
}));

vi.mock("@/lib/supabase/public", () => ({
  createPublicClient: () => ({
    rpc: () => ({
      single: async () => estado.rpc,
    }),
  }),
}));

const {
  generateOrderRequest,
  regenerateOrderRequestLink,
  discardOrderRequest,
  acceptOrderRequest,
  submitOrderRequest,
} = await import("@/actions/order-requests");

beforeEach(() => {
  estado.conSesion = true;
  estado.llamadas = [];
  estado.fallo = false;
  estado.revalidado = [];
  estado.avisos = [];
  estado.rpc = { data: null, error: null };
  estado.host = "kamay.app";
});

describe("generateOrderRequest", () => {
  const input = {
    id: REQUEST,
    businessLineId: LINE,
    contactId: null,
    prefilledName: "Cliente Real",
    prefilledPhone: "70099999",
  };

  it("crea la solicitud y devuelve la URL completa una sola vez", async () => {
    const result = await generateOrderRequest(input);

    expect(result).toEqual({
      id: REQUEST,
      url: "https://kamay.app/r/token-de-prueba-1234567890",
    });
    expect(estado.llamadas).toEqual([
      { metodo: "create", args: [ORG, { ...input, createdBy: USER }] },
    ]);
    expect(estado.revalidado).toEqual([["/orders/requests"]]);
  });

  it("sin sesión, no toca el servicio", async () => {
    estado.conSesion = false;
    const result = await generateOrderRequest(input);

    expect(result).toMatchObject({ error: expect.stringMatching(/sesión/) });
    expect(estado.llamadas).toEqual([]);
  });

  it("rechaza sin nombre ni teléfono, sin llegar al servicio", async () => {
    const result = await generateOrderRequest({
      ...input,
      prefilledName: "",
      prefilledPhone: "",
    });

    expect(result).toMatchObject({ error: expect.any(String) });
    expect(estado.llamadas).toEqual([]);
  });
});

describe("regenerateOrderRequestLink", () => {
  it("devuelve la nueva URL completa", async () => {
    const result = await regenerateOrderRequestLink(REQUEST);

    expect(result).toEqual({ url: "https://kamay.app/r/token-regenerado-1234567890" });
    expect(estado.revalidado).toEqual([["/orders/requests"], [`/orders/requests/${REQUEST}`]]);
  });

  it("propaga el mensaje cuando ya no está esperando al cliente", async () => {
    estado.fallo = true;
    const result = await regenerateOrderRequestLink(REQUEST);

    expect(result).toMatchObject({ error: expect.any(String) });
  });
});

describe("discardOrderRequest", () => {
  it("descarta y revalida la bandeja", async () => {
    expect(await discardOrderRequest(REQUEST)).toBeUndefined();
    expect(estado.llamadas).toEqual([{ metodo: "discard", args: [ORG, REQUEST] }]);
  });
});

describe("acceptOrderRequest", () => {
  it("acepta y revalida bandeja y pedido", async () => {
    expect(await acceptOrderRequest(REQUEST, ORDER)).toBeUndefined();
    expect(estado.llamadas).toEqual([
      { metodo: "accept", args: [ORG, REQUEST, ORDER, USER] },
    ]);
    expect(estado.revalidado).toContainEqual([`/orders/${ORDER}`]);
  });
});

describe("submitOrderRequest", () => {
  const form = { name: "Cliente Real", phone: "70099999", note: null };

  it("llama a la RPC y emite el aviso sin usar el cliente de sesión", async () => {
    estado.rpc = {
      data: { organization_id: ORG, request_id: REQUEST },
      error: null,
    };

    const result = await submitOrderRequest("un-token", form);

    expect(result).toBeUndefined();
    expect(estado.avisos).toEqual([
      {
        organizationId: ORG,
        requestId: REQUEST,
        title: "Nueva solicitud de pedido",
        body: "Cliente Real mandó sus datos por el enlace público.",
      },
    ]);
  });

  it("un token inválido no emite ningún aviso", async () => {
    estado.rpc = { data: null, error: { message: "El enlace no es válido" } };

    const result = await submitOrderRequest("token-malo", form);

    expect(result).toMatchObject({ error: expect.stringMatching(/no sirve/) });
    expect(estado.avisos).toEqual([]);
  });

  it("rechaza sin nombre antes de llamar a la RPC", async () => {
    const result = await submitOrderRequest("un-token", { ...form, name: "" });

    expect(result).toMatchObject({ error: expect.any(String) });
    expect(estado.avisos).toEqual([]);
  });
});
