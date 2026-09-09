import { describe, expect, it } from "vitest";

import { movementLabel, signedQuantity, sortByRecency } from "./movements";

import type { InventoryMovement } from "@/types";

function movement(overrides: Partial<InventoryMovement> & { id: string }): InventoryMovement {
  return {
    organizationId: "org",
    itemId: "item",
    variantId: null,
    kind: "out",
    quantity: -5,
    sourceType: "manual",
    sourceId: null,
    occurredAt: "2026-09-01T10:00:00.000Z",
    note: null,
    createdBy: null,
    createdAt: "2026-09-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("movementLabel", () => {
  // Escenario "El historial explica un número que no cuadra": cada fila dice
  // de dónde salió sin obligar a nadie a interpretar un `source_type`.
  it("nombra el origen documental de una entrada de compra", () => {
    expect(
      movementLabel(movement({ id: "a", kind: "in", quantity: 50, sourceType: "expense_item" })),
    ).toBe("Entrada por compra");
  });

  it("nombra el conteo de un ajuste", () => {
    expect(
      movementLabel(movement({ id: "a", kind: "adjustment", quantity: -3, sourceType: "count" })),
    ).toBe("Ajuste por conteo");
  });

  // `manual` es el caso normal, no la excepción que hay que señalar.
  it("no añade sufijo a lo registrado por una persona", () => {
    expect(movementLabel(movement({ id: "a", sourceType: "manual" }))).toBe("Consumo");
  });

  it("no añade sufijo cuando no hay origen", () => {
    expect(movementLabel(movement({ id: "a", sourceType: null }))).toBe("Consumo");
  });
});

describe("signedQuantity", () => {
  it("marca la entrada con su signo explícito", () => {
    expect(signedQuantity(movement({ id: "a", kind: "in", quantity: 50 }))).toBe("+50");
  });

  it("conserva el signo de la salida", () => {
    expect(signedQuantity(movement({ id: "a", quantity: -24 }))).toBe("-24");
  });
});

describe("sortByRecency", () => {
  // Por la hora del hecho, no la de registro: una compra anotada tarde no
  // puede colarse arriba.
  it("ordena por la hora del hecho, no por la de registro", () => {
    const rows = [
      movement({
        id: "anotado-tarde",
        occurredAt: "2026-08-01T10:00:00.000Z",
        createdAt: "2026-09-05T10:00:00.000Z",
      }),
      movement({
        id: "reciente",
        occurredAt: "2026-09-02T10:00:00.000Z",
        createdAt: "2026-09-02T10:00:00.000Z",
      }),
    ];

    expect(sortByRecency(rows).map((row) => row.id)).toEqual(["reciente", "anotado-tarde"]);
  });

  it("deshace el empate por la hora del servidor, que siempre avanza", () => {
    const rows = [
      movement({ id: "primero", createdAt: "2026-09-01T10:00:00.000Z" }),
      movement({ id: "segundo", createdAt: "2026-09-01T10:00:05.000Z" }),
    ];

    expect(sortByRecency(rows).map((row) => row.id)).toEqual(["segundo", "primero"]);
  });

  it("no muta el arreglo que recibe", () => {
    const rows = [
      movement({ id: "viejo", occurredAt: "2026-08-01T10:00:00.000Z" }),
      movement({ id: "nuevo", occurredAt: "2026-09-02T10:00:00.000Z" }),
    ];

    sortByRecency(rows);
    expect(rows[0].id).toBe("viejo");
  });
});
