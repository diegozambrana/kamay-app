import { beforeEach, describe, expect, it, vi } from "vitest";

const ORG = "11111111-1111-4111-8111-111111111111";
const ORDER = "22222222-2222-4222-8222-222222222222";
const LINE = "33333333-3333-4333-8333-333333333333";

const estado = vi.hoisted(() => ({
  haySesion: true,
  pedido: null as null | { id: string; archivedAt: string | null },
  insertadas: [] as unknown[][],
  fallo: null as Error | null,
  revalidado: [] as string[],
}));

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => estado.revalidado.push(path),
}));

vi.mock("@/lib/auth/session-context", () => ({
  getSessionContext: async () =>
    estado.haySesion ? { supabase: {}, organizationId: ORG, role: "assistant" } : null,
}));

vi.mock("@/services/orders/order-service", () => ({
  OrderService: class {
    async getById() {
      return estado.pedido;
    }
  },
}));

vi.mock("@/services/orders/order-item-service", () => ({
  OrderItemService: class {
    async add(...args: unknown[]) {
      if (estado.fallo) throw estado.fallo;
      estado.insertadas.push(args);
    }
  },
}));

const { addOrderLine } = await import("@/actions/orders");

const line = { id: LINE, description: "Llavero calavera", quantity: 6, unitPrice: 27 };

beforeEach(() => {
  estado.haySesion = true;
  estado.pedido = { id: ORDER, archivedAt: null };
  estado.insertadas = [];
  estado.fallo = null;
  estado.revalidado = [];
});

/** KAM-27 · spec `orders` → *Añadir una línea sin tocar las demás*. */
describe("addOrderLine", () => {
  it("añade la línea libre al pedido, en la organización de la sesión, y revalida", async () => {
    expect(await addOrderLine({ orderId: ORDER, line })).toBeUndefined();

    expect(estado.insertadas).toEqual([
      [
        ORG,
        ORDER,
        {
          id: LINE,
          itemId: null,
          variantId: null,
          description: "Llavero calavera",
          quantity: 6,
          unitPrice: 27,
        },
      ],
    ]);
    expect(estado.revalidado).toEqual(["/orders", `/orders/${ORDER}`]);
  });

  it("una línea libre sin descripción se rechaza con el mensaje del formulario", async () => {
    const result = await addOrderLine({ orderId: ORDER, line: { ...line, description: "" } });
    expect(result).toEqual({ error: "Una línea sin producto necesita una descripción" });
    expect(estado.insertadas).toEqual([]);
  });

  it("cantidad en cero y precio negativo se rechazan como en el formulario", async () => {
    expect(await addOrderLine({ orderId: ORDER, line: { ...line, quantity: 0 } })).toEqual({
      error: "La cantidad tiene que ser mayor que cero",
    });
    expect(await addOrderLine({ orderId: ORDER, line: { ...line, unitPrice: -1 } })).toEqual({
      error: "El precio no puede ser negativo",
    });
    expect(estado.insertadas).toEqual([]);
  });

  it("no guarda nada más que la línea: costo y margen no viajan", async () => {
    await addOrderLine({ orderId: ORDER, line: { ...line, unitCost: 10.59, margin: 2.5 } });
    expect(estado.insertadas[0][2]).not.toHaveProperty("unitCost");
    expect(estado.insertadas[0][2]).not.toHaveProperty("margin");
  });

  it("un pedido fuera del alcance —de otra organización, o inexistente— se rechaza", async () => {
    estado.pedido = null;
    expect(await addOrderLine({ orderId: ORDER, line })).toEqual({
      error: "Ese pedido ya no está a tu alcance.",
    });
    expect(estado.insertadas).toEqual([]);
  });

  it("un pedido archivado se rechaza con el mismo mensaje que la edición", async () => {
    estado.pedido = { id: ORDER, archivedAt: "2026-09-20T10:00:00Z" };
    expect(await addOrderLine({ orderId: ORDER, line })).toEqual({
      error: "Este pedido está archivado: desarchívalo antes de editarlo.",
    });
    expect(estado.insertadas).toEqual([]);
    expect(estado.revalidado).toEqual([]);
  });

  it("sin sesión no toca nada", async () => {
    estado.haySesion = false;
    expect(await addOrderLine({ orderId: ORDER, line })).toEqual({
      error: "Tu sesión terminó. Vuelve a entrar.",
    });
    expect(estado.insertadas).toEqual([]);
  });

  it("traduce el rechazo de la base", async () => {
    estado.fallo = new Error('violates check constraint "order_items_quantity_check"');
    expect(await addOrderLine({ orderId: ORDER, line })).toEqual({
      error: "La cantidad de una línea tiene que ser mayor que cero.",
    });

    estado.fallo = new Error("row-level security");
    expect(await addOrderLine({ orderId: ORDER, line })).toEqual({
      error: "No se pudo añadir la línea. Intenta de nuevo.",
    });
  });

  it("un identificador de pedido que no lo es se rechaza antes de consultar", async () => {
    expect(await addOrderLine({ orderId: "no-es-uuid", line })).toMatchObject({
      error: expect.any(String),
    });
    expect(estado.insertadas).toEqual([]);
  });
});
