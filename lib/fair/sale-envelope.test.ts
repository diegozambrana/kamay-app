import { describe, expect, it } from "vitest";

import { addLine } from "./cart";
import { buildSaleEnvelope, proposedAmount } from "./sale-envelope";
import { directSaleSchema } from "./sale-schema";

const ORG = "00000000-0000-4000-8000-000000000001";
const LINE = "00000000-0000-4000-8000-000000000002";
const CHANNEL = "00000000-0000-4000-8000-000000000003";
const SALE = "00000000-0000-4000-8000-000000000004";
const PAYMENT = "00000000-0000-4000-8000-000000000005";
const L1 = "00000000-0000-4000-8000-000000000011";
const L2 = "00000000-0000-4000-8000-000000000012";

const taza = { id: "00000000-0000-4000-8000-0000000000a1", name: "Taza", salePrice: 35 };
const maceta = { id: "00000000-0000-4000-8000-0000000000a2", name: "Maceta", salePrice: 60 };

const carrito = addLine(addLine([], taza, L1), maceta, L2);

const base = {
  organizationId: ORG,
  businessLineId: LINE,
  salesChannelId: CHANNEL,
  contactId: null,
  lines: carrito,
  amount: 95,
  method: "cash" as const,
  saleId: SALE,
  paymentId: PAYMENT,
  occurredAt: "2026-09-01T15:40:00.000Z",
};

describe("buildSaleEnvelope", () => {
  it("produce un sobre que el esquema acepta", () => {
    expect(directSaleSchema.safeParse(buildSaleEnvelope(base)).success).toBe(true);
  });

  // El id del sobre es el uuid de la venta: es lo que hace idempotente el
  // reenvío de la cola (design, decisión 5).
  it("usa el uuid de la venta como identificador del sobre", () => {
    expect(buildSaleEnvelope(base).id).toBe(SALE);
  });

  it("conserva el id de cada línea del carrito, no genera otros", () => {
    expect(buildSaleEnvelope(base).items.map((i) => i.id)).toEqual([L1, L2]);
  });

  it("construir el mismo sobre dos veces da exactamente lo mismo", () => {
    expect(buildSaleEnvelope(base)).toEqual(buildSaleEnvelope(base));
  });

  // Escenario: La hora real es la del hecho
  it("la venta y su cobro llevan la hora que fijó el cliente", () => {
    const sobre = buildSaleEnvelope(base);

    expect(sobre.occurredAt).toBe("2026-09-01T15:40:00.000Z");
    expect(sobre.payment).not.toBeNull();
  });

  it("lleva las líneas con su cantidad y su precio del momento", () => {
    const sobre = buildSaleEnvelope(base);

    expect(sobre.items[0]).toMatchObject({ quantity: 1, unitPrice: 35 });
    expect(sobre.items[1]).toMatchObject({ quantity: 1, unitPrice: 60 });
  });

  // Escenario: Venta sin cobro
  it("un monto de cero no registra ningún movimiento de dinero", () => {
    expect(buildSaleEnvelope({ ...base, amount: 0 }).payment).toBeNull();
  });

  it("un cobro parcial viaja con su monto, no con el total", () => {
    expect(buildSaleEnvelope({ ...base, amount: 40 }).payment?.amount).toBe(40);
  });

  it("guarda el cliente cuando se eligió", () => {
    const conCliente = buildSaleEnvelope({ ...base, contactId: ORG });

    expect(conCliente.contactId).toBe(ORG);
  });
});

// Escenario: Venta sin líneas — el esquema lo rechaza antes de salir del cliente
describe("directSaleSchema", () => {
  it("rechaza una venta sin líneas", () => {
    const sobre = buildSaleEnvelope({ ...base, lines: [] });

    expect(directSaleSchema.safeParse(sobre).success).toBe(false);
  });

  it("rechaza una cantidad no positiva", () => {
    const sobre = buildSaleEnvelope(base);
    sobre.items[0].quantity = 0;

    expect(directSaleSchema.safeParse(sobre).success).toBe(false);
  });

  it("rechaza un precio negativo", () => {
    const sobre = buildSaleEnvelope(base);
    sobre.items[0].unitPrice = -1;

    expect(directSaleSchema.safeParse(sobre).success).toBe(false);
  });

  it("rechaza un cobro negativo", () => {
    const sobre = buildSaleEnvelope(base);
    sobre.payment = { id: PAYMENT, amount: -5, method: "cash" };

    expect(directSaleSchema.safeParse(sobre).success).toBe(false);
  });

  it("rechaza un método de pago fuera del dominio", () => {
    const sobre = buildSaleEnvelope(base) as unknown as { payment: { method: string } };
    sobre.payment.method = "crypto";

    expect(directSaleSchema.safeParse(sobre).success).toBe(false);
  });
});

// Escenario: Monto propuesto
describe("proposedAmount", () => {
  it("propone el total del carrito", () => {
    expect(proposedAmount(carrito)).toBe(95);
  });

  it("el carrito vacío propone cero", () => {
    expect(proposedAmount([])).toBe(0);
  });
});
