import { describe, expect, it } from "vitest";

import { consumptionSchema, countSchema } from "./schema";

const ID = "00000000-0000-0000-0000-000000000001";
const ITEM = "00000000-0000-0000-0000-000000000002";

describe("consumptionSchema", () => {
  it("acepta el mínimo: insumo, cantidad y fecha", () => {
    const parsed = consumptionSchema.safeParse({
      id: ID,
      itemId: ITEM,
      quantity: "5",
      occurredAt: "2026-09-08T10:00:00.000Z",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.quantity).toBe(5);
      expect(parsed.data.note).toBeNull();
      expect(parsed.data.variantId).toBeNull();
    }
  });

  it("rechaza una cantidad de cero", () => {
    const parsed = consumptionSchema.safeParse({
      id: ID,
      itemId: ITEM,
      quantity: "0",
      occurredAt: "2026-09-08T10:00:00.000Z",
    });

    expect(parsed.success).toBe(false);
  });

  it("rechaza una cantidad negativa: el consumo lleva el signo, no el formulario", () => {
    const parsed = consumptionSchema.safeParse({
      id: ID,
      itemId: ITEM,
      quantity: -5,
      occurredAt: "2026-09-08T10:00:00.000Z",
    });

    expect(parsed.success).toBe(false);
  });

  it("un campo vacío cae en el mensaje de cantidad, no en uno de tipo", () => {
    const parsed = consumptionSchema.safeParse({
      id: ID,
      itemId: ITEM,
      quantity: "",
      occurredAt: "2026-09-08T10:00:00.000Z",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toContain("mayor que cero");
    }
  });

  it("exige elegir un insumo", () => {
    const parsed = consumptionSchema.safeParse({
      id: ID,
      itemId: "",
      quantity: "5",
      occurredAt: "2026-09-08T10:00:00.000Z",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toBe("Elige un insumo");
    }
  });

  it("la nota vacía es ausencia de dato, no una cadena vacía", () => {
    const parsed = consumptionSchema.safeParse({
      id: ID,
      itemId: ITEM,
      quantity: 5,
      occurredAt: "2026-09-08T10:00:00.000Z",
      note: "   ",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.note).toBeNull();
  });
});

describe("countSchema", () => {
  // Lo que viaja es la diferencia, no la cantidad contada (design D6): es lo
  // que hace correcto un ajuste que se sincroniza tarde.
  it("acepta la diferencia calculada en el dispositivo", () => {
    const parsed = countSchema.safeParse({
      id: ID,
      itemId: ITEM,
      difference: "-5",
      occurredAt: "2026-09-08T10:00:00.000Z",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.difference).toBe(-5);
  });

  it("acepta una diferencia positiva", () => {
    const parsed = countSchema.safeParse({
      id: ID,
      itemId: ITEM,
      difference: 12,
      occurredAt: "2026-09-08T10:00:00.000Z",
    });

    expect(parsed.success).toBe(true);
  });

  // La base rechazaría `quantity = 0`; el diálogo no llega a intentarlo.
  it("rechaza la diferencia cero con el mensaje del conteo que coincide", () => {
    const parsed = countSchema.safeParse({
      id: ID,
      itemId: ITEM,
      difference: 0,
      occurredAt: "2026-09-08T10:00:00.000Z",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toContain("no hay nada que ajustar");
    }
  });

  // Escenario "No se pide explicación": la ausencia del campo es la
  // funcionalidad, así que se comprueba que nada obligue a justificar.
  it("guarda sin motivo, porque no hay campo de motivo", () => {
    const parsed = countSchema.safeParse({
      id: ID,
      itemId: ITEM,
      difference: -3,
      occurredAt: "2026-09-08T10:00:00.000Z",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(Object.keys(parsed.data)).not.toContain("reason");
      expect(parsed.data.note).toBeNull();
    }
  });
});
