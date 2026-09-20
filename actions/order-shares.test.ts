import { beforeEach, describe, expect, it, vi } from "vitest";

const ORG = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const ORDER = "33333333-3333-4333-8333-333333333333";
const SHARE = "44444444-4444-4444-8444-444444444444";

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

vi.mock("@/services/order-shares/order-share-service", () => ({
  OrderShareService: class {
    private registrar(metodo: string, args: unknown[]) {
      if (estado.fallo) throw new Error("caída");
      estado.llamadas.push({ metodo, args });
    }
    async create(...args: unknown[]) {
      this.registrar("create", args);
      return {
        share: { id: SHARE, orderId: ORDER },
        token: "token-de-prueba-1234567890",
      };
    }
    async regenerate(...args: unknown[]) {
      this.registrar("regenerate", args);
      return "token-regenerado-1234567890";
    }
    async revoke(...args: unknown[]) {
      this.registrar("revoke", args);
    }
    async archiveComment(...args: unknown[]) {
      this.registrar("archiveComment", args);
    }
  },
}));

vi.mock("@/services/notifications/emit-order-comment-events", () => ({
  emitOrderCommentReceived: async (input: unknown) => {
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
  generateOrderShare,
  regenerateOrderShare,
  revokeOrderShare,
  archiveOrderComment,
  submitOrderComment,
} = await import("@/actions/order-shares");

beforeEach(() => {
  estado.conSesion = true;
  estado.llamadas = [];
  estado.fallo = false;
  estado.revalidado = [];
  estado.avisos = [];
  estado.rpc = { data: null, error: null };
  estado.host = "kamay.app";
});

describe("generateOrderShare", () => {
  it("crea el enlace y devuelve la URL completa una sola vez", async () => {
    const result = await generateOrderShare(ORDER);

    expect(result).toEqual({
      id: SHARE,
      url: "https://kamay.app/p/token-de-prueba-1234567890",
    });
    expect(estado.llamadas).toEqual([
      { metodo: "create", args: [ORG, { orderId: ORDER, createdBy: USER }] },
    ]);
  });

  it("localhost arma la URL en http", async () => {
    estado.host = "localhost:3010";
    const result = await generateOrderShare(ORDER);

    expect(result).toMatchObject({ url: "http://localhost:3010/p/token-de-prueba-1234567890" });
  });

  it("sin sesión, no toca el servicio", async () => {
    estado.conSesion = false;
    const result = await generateOrderShare(ORDER);

    expect(result).toMatchObject({ error: expect.stringMatching(/sesión/) });
    expect(estado.llamadas).toEqual([]);
  });

  it("un pedido con enlace vigente propaga el mensaje del servicio", async () => {
    estado.fallo = true;
    const result = await generateOrderShare(ORDER);

    expect(result).toMatchObject({ error: "caída" });
  });
});

describe("regenerateOrderShare", () => {
  it("devuelve la nueva URL completa", async () => {
    const result = await regenerateOrderShare(ORDER, SHARE);

    expect(result).toEqual({ url: "https://kamay.app/p/token-regenerado-1234567890" });
  });
});

describe("revokeOrderShare", () => {
  it("revoca y revalida el pedido", async () => {
    expect(await revokeOrderShare(ORDER, SHARE)).toBeUndefined();
    expect(estado.llamadas).toEqual([{ metodo: "revoke", args: [ORG, SHARE] }]);
    expect(estado.revalidado).toEqual([[`/orders/${ORDER}`]]);
  });
});

describe("archiveOrderComment", () => {
  it("archiva y revalida el pedido", async () => {
    const commentId = "55555555-5555-4555-8555-555555555555";
    expect(await archiveOrderComment(ORDER, commentId)).toBeUndefined();
    expect(estado.llamadas).toEqual([
      { metodo: "archiveComment", args: [ORG, commentId] },
    ]);
  });
});

describe("submitOrderComment", () => {
  const form = { name: "Cliente Demo", body: "¿Para cuándo está listo?" };

  it("llama a la RPC y emite el aviso sin usar el cliente de sesión", async () => {
    const commentId = "66666666-6666-4666-8666-666666666666";
    estado.rpc = {
      data: { organization_id: ORG, order_id: ORDER, comment_id: commentId },
      error: null,
    };

    const result = await submitOrderComment("un-token", form);

    expect(result).toBeUndefined();
    expect(estado.avisos).toEqual([
      {
        organizationId: ORG,
        orderId: ORDER,
        commentId,
        title: "Nuevo comentario en un pedido",
        body: "Cliente Demo: ¿Para cuándo está listo?",
      },
    ]);
  });

  it("un token inválido no emite ningún aviso", async () => {
    estado.rpc = { data: null, error: { message: "El enlace no es válido" } };

    const result = await submitOrderComment("token-malo", form);

    expect(result).toMatchObject({ error: "El enlace no es válido" });
    expect(estado.avisos).toEqual([]);
  });

  it("rechaza sin nombre antes de llamar a la RPC", async () => {
    const result = await submitOrderComment("un-token", { ...form, name: "" });

    expect(result).toMatchObject({ error: expect.any(String) });
    expect(estado.avisos).toEqual([]);
  });
});
