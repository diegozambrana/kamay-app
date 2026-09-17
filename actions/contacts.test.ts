import { beforeEach, describe, expect, it, vi } from "vitest";

const ORG = "11111111-1111-4111-8111-111111111111";
const USER = "55555555-5555-4555-8555-555555555555";
const CONTACT = "66666666-6666-4666-8666-666666666666";

/** Lo que la doble del servicio recibió, reiniciado en cada prueba. */
const estado = vi.hoisted(() => ({ creados: [] as unknown[] }));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

vi.mock("@/lib/auth/session-context", () => ({
  getSessionContext: async () => ({
    supabase: {},
    userId: USER,
    organizationId: ORG,
    role: "assistant",
  }),
}));

vi.mock("@/services/catalog/contact-service", () => ({
  ContactService: class {
    async create(organizationId: string, id: string, values: Record<string, unknown>) {
      estado.creados.push({ organizationId, id, values });
      return { id, organizationId, archivedAt: null, ...values };
    }
  },
}));

const { createContactInline } = await import("./contacts");

beforeEach(() => {
  estado.creados = [];
});

describe("createContactInline", () => {
  it("guarda correo y dirección cuando el diálogo de cliente los envía", async () => {
    const result = await createContactInline({
      id: CONTACT,
      name: "Florería Luna",
      phone: "77712345",
      email: "luna@example.com",
      address: "Av. Siempre Viva 123",
      isSupplier: false,
      isCustomer: true,
    });

    expect(result).toMatchObject({ contact: { id: CONTACT, name: "Florería Luna" } });
    expect(estado.creados).toEqual([
      {
        organizationId: ORG,
        id: CONTACT,
        values: {
          name: "Florería Luna",
          phone: "77712345",
          email: "luna@example.com",
          address: "Av. Siempre Viva 123",
          notes: null,
          isSupplier: false,
          isCustomer: true,
        },
      },
    ]);
  });

  it("sin correo ni dirección los guarda como ausentes", async () => {
    await createContactInline({
      id: CONTACT,
      name: "Marisol Quispe",
      phone: "",
      isSupplier: false,
      isCustomer: true,
    });

    expect(estado.creados).toEqual([
      expect.objectContaining({
        values: expect.objectContaining({ phone: null, email: null, address: null }),
      }),
    ]);
  });

  it("un correo inválido no llega al servicio", async () => {
    const result = await createContactInline({
      id: CONTACT,
      name: "Florería Luna",
      email: "no-es-correo",
      isSupplier: false,
      isCustomer: true,
    });

    expect(result).toEqual({ error: "El correo no tiene un formato válido" });
    expect(estado.creados).toEqual([]);
  });
});
