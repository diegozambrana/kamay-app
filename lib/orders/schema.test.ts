import { describe, expect, it } from "vitest";

import {
  moveOrderSchema,
  orderAttachmentSchema,
  orderFormSchema,
  orderIdSchema,
  orderLineSchema,
  reorderQueueSchema,
} from "@/lib/orders/schema";

const UUID_A = "00000000-0000-4000-8000-000000000001";
const UUID_B = "00000000-0000-4000-8000-000000000002";

describe("moveOrderSchema", () => {
  it("acepta dos identificadores válidos", () => {
    expect(
      moveOrderSchema.safeParse({ orderId: UUID_A, statusId: UUID_B }).success,
    ).toBe(true);
  });

  it("rechaza un identificador que no es UUID", () => {
    expect(
      moveOrderSchema.safeParse({ orderId: "142", statusId: UUID_B }).success,
    ).toBe(false);
  });
});

describe("reorderQueueSchema", () => {
  it("acepta una posición base 0", () => {
    expect(
      reorderQueueSchema.safeParse({ orderId: UUID_A, targetIndex: 0 }).success,
    ).toBe(true);
  });

  it("rechaza una posición negativa o fraccionaria", () => {
    expect(
      reorderQueueSchema.safeParse({ orderId: UUID_A, targetIndex: -1 }).success,
    ).toBe(false);
    expect(
      reorderQueueSchema.safeParse({ orderId: UUID_A, targetIndex: 1.5 }).success,
    ).toBe(false);
  });
});

describe("orderIdSchema", () => {
  it("exige un UUID", () => {
    expect(orderIdSchema.safeParse({ orderId: UUID_A }).success).toBe(true);
    expect(orderIdSchema.safeParse({ orderId: "" }).success).toBe(false);
  });
});

// ── El formulario de pedido (V5, KAM-08) ──────────────────────────────────

const LINE_ID = "00000000-0000-4000-8000-000000000010";
const ITEM_ID = "00000000-0000-4000-8000-000000000020";
const CHANNEL_ID = "00000000-0000-4000-8000-000000000030";

/** El mínimo que el backlog exige: cliente y una línea. Nada más. */
const minimalOrder = {
  id: UUID_A,
  businessLineId: UUID_B,
  contactId: "00000000-0000-4000-8000-000000000003",
  occurredAt: "2026-09-03T12:00:00.000Z",
  items: [{ id: LINE_ID, itemId: ITEM_ID, quantity: 1, unitPrice: 45 }],
};

describe("orderLineSchema", () => {
  it("acepta una línea de catálogo", () => {
    expect(
      orderLineSchema.safeParse({
        id: LINE_ID,
        itemId: ITEM_ID,
        quantity: 3,
        unitPrice: 45,
      }).success,
    ).toBe(true);
  });

  it("acepta cantidad y precio como texto, que es como llegan del formulario", () => {
    const parsed = orderLineSchema.safeParse({
      id: LINE_ID,
      itemId: ITEM_ID,
      quantity: "3",
      unitPrice: "45.50",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.quantity).toBe(3);
    expect(parsed.data?.unitPrice).toBe(45.5);
  });

  it("rechaza cantidad cero y negativa señalando la cantidad", () => {
    const cero = orderLineSchema.safeParse({
      id: LINE_ID,
      itemId: ITEM_ID,
      quantity: 0,
      unitPrice: 45,
    });
    expect(cero.success).toBe(false);
    expect(cero.error?.issues[0].path).toEqual(["quantity"]);

    expect(
      orderLineSchema.safeParse({
        id: LINE_ID,
        itemId: ITEM_ID,
        quantity: -2,
        unitPrice: 45,
      }).success,
    ).toBe(false);
  });

  it("una cantidad vacía se rechaza como si fuera cero", () => {
    expect(
      orderLineSchema.safeParse({
        id: LINE_ID,
        itemId: ITEM_ID,
        quantity: "",
        unitPrice: 45,
      }).success,
    ).toBe(false);
  });

  it("rechaza un precio negativo pero acepta el cero", () => {
    expect(
      orderLineSchema.safeParse({
        id: LINE_ID,
        itemId: ITEM_ID,
        quantity: 1,
        unitPrice: -1,
      }).success,
    ).toBe(false);
    expect(
      orderLineSchema.safeParse({
        id: LINE_ID,
        itemId: ITEM_ID,
        quantity: 1,
        unitPrice: 0,
      }).success,
    ).toBe(true);
  });

  it("una línea libre necesita descripción", () => {
    const sinNada = orderLineSchema.safeParse({
      id: LINE_ID,
      quantity: 1,
      unitPrice: 120,
    });
    expect(sinNada.success).toBe(false);
    expect(sinNada.error?.issues[0].path).toEqual(["description"]);

    expect(
      orderLineSchema.safeParse({
        id: LINE_ID,
        quantity: 1,
        unitPrice: 120,
        description: "Pieza a medida según plano",
      }).success,
    ).toBe(true);
  });

  it("un producto sin descripción es válido: el nombre ya lo dice", () => {
    expect(
      orderLineSchema.safeParse({
        id: LINE_ID,
        itemId: ITEM_ID,
        description: "",
        quantity: 1,
        unitPrice: 45,
      }).success,
    ).toBe(true);
  });
});

describe("orderFormSchema", () => {
  it("acepta el alta mínima: cliente y una línea, sin fecha, canal ni modo", () => {
    const parsed = orderFormSchema.safeParse(minimalOrder);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.dueDate).toBeNull();
    expect(parsed.data?.salesChannelId).toBeNull();
    expect(parsed.data?.deliveryMode).toBeNull();
    expect(parsed.data?.notes).toBeNull();
  });

  it("sin cliente falla señalando el campo, con su mensaje", () => {
    const sinCliente: Record<string, unknown> = { ...minimalOrder };
    delete sinCliente.contactId;

    const parsed = orderFormSchema.safeParse(sinCliente);
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].path).toEqual(["contactId"]);
    expect(parsed.error?.issues[0].message).toBe("Elige o crea un cliente");
  });

  it("sin líneas falla señalando la sección de líneas", () => {
    const parsed = orderFormSchema.safeParse({ ...minimalOrder, items: [] });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].path).toEqual(["items"]);
    expect(parsed.error?.issues[0].message).toBe("Agrega al menos una línea");
  });

  it("una línea inválida señala esa línea, no el pedido entero", () => {
    const parsed = orderFormSchema.safeParse({
      ...minimalOrder,
      items: [{ id: LINE_ID, itemId: ITEM_ID, quantity: 0, unitPrice: 45 }],
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].path).toEqual(["items", 0, "quantity"]);
  });

  it("sin línea de negocio falla con su mensaje", () => {
    const parsed = orderFormSchema.safeParse({
      ...minimalOrder,
      businessLineId: "",
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].message).toBe("Elige una línea de negocio");
  });

  it("los opcionales vacíos son ausencia de dato, no cadena vacía", () => {
    const parsed = orderFormSchema.safeParse({
      ...minimalOrder,
      salesChannelId: "",
      deliveryMode: "",
      dueDate: "",
      notes: "   ",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.salesChannelId).toBeNull();
    expect(parsed.data?.deliveryMode).toBeNull();
    expect(parsed.data?.dueDate).toBeNull();
    expect(parsed.data?.notes).toBeNull();
  });

  it("conserva los opcionales cuando llegan con valor", () => {
    const parsed = orderFormSchema.safeParse({
      ...minimalOrder,
      salesChannelId: CHANNEL_ID,
      deliveryMode: "delivery",
      dueDate: "2026-12-24",
      notes: "Diseño enviado por WhatsApp",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.deliveryMode).toBe("delivery");
    expect(parsed.data?.dueDate).toBe("2026-12-24");
  });

  it("rechaza un modo de entrega fuera del dominio", () => {
    expect(
      orderFormSchema.safeParse({ ...minimalOrder, deliveryMode: "drone" }).success,
    ).toBe(false);
  });

  it("rechaza una fecha que no es civil", () => {
    expect(
      orderFormSchema.safeParse({ ...minimalOrder, dueDate: "24/12/2026" }).success,
    ).toBe(false);
    expect(
      orderFormSchema.safeParse({
        ...minimalOrder,
        dueDate: "2026-12-24T00:00:00Z",
      }).success,
    ).toBe(false);
  });

  /**
   * El estado inicial lo decide la base desde el juego de la línea
   * (design.md D3). Si alguien manda `status_id`, se descarta aquí y nunca
   * llega al servicio.
   */
  it("descarta un statusId de la entrada: el estado no lo elige el formulario", () => {
    const parsed = orderFormSchema.safeParse({
      ...minimalOrder,
      statusId: "00000000-0000-4000-8000-000000000099",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data).not.toHaveProperty("statusId");
  });

  it("no tiene total: es un derivado y no se almacena", () => {
    const parsed = orderFormSchema.safeParse({ ...minimalOrder, total: 999 });
    expect(parsed.success).toBe(true);
    expect(parsed.data).not.toHaveProperty("total");
  });
});

describe("orderAttachmentSchema", () => {
  it("exige identificar el adjunto y su pedido", () => {
    expect(
      orderAttachmentSchema.safeParse({
        id: UUID_A,
        orderId: UUID_B,
        archived: true,
      }).success,
    ).toBe(true);
    expect(
      orderAttachmentSchema.safeParse({ id: UUID_A, archived: true }).success,
    ).toBe(false);
  });
});
