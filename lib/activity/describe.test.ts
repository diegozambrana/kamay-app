import { describe, expect, it } from "vitest";

import { describeEvent, recordHref } from "@/lib/activity/describe";

describe("describeEvent", () => {
  // Scenario: A status change reads as a sentence
  it("redacta un cambio de estado nombrando persona, acción y registro", () => {
    const sentence = describeEvent({
      action: "status_changed",
      tableName: "orders",
      actorName: "Diego",
      recordLabel: "#142",
    });

    expect(sentence).toBe("Diego cambió el estado del pedido #142");
  });

  it("no deja llegar a la frase el nombre de la tabla ni el de una columna", () => {
    const sentence = describeEvent({
      action: "updated",
      tableName: "order_items",
      actorName: "Diego",
    });

    expect(sentence).not.toContain("order_items");
    expect(sentence).not.toContain("_");
  });

  // Scenario: A system actor is named
  it("atribuye la acción a la etiqueta cuando no hay persona", () => {
    const sentence = describeEvent({
      action: "created",
      tableName: "payments",
      actorName: null,
      actorLabel: "sistema",
    });

    expect(sentence).toBe("Sistema registró el movimiento de dinero");
  });

  it("sin persona y sin etiqueta la frase sigue siendo una frase", () => {
    const sentence = describeEvent({
      action: "archived",
      tableName: "contacts",
    });

    expect(sentence).toBe("Alguien archivó el contacto");
  });

  // Scenario: An unknown action degrades gracefully
  it("una acción desconocida produce una frase legible y ningún identificador", () => {
    const sentence = describeEvent({
      action: "teleported",
      tableName: "orders",
      actorName: "Diego",
      recordLabel: "#7",
    });

    expect(sentence).toBe("Diego actualizó el pedido #7");
    expect(sentence).not.toContain("teleported");
  });

  it("una tabla desconocida se nombra en vago, no con su nombre real", () => {
    const sentence = describeEvent({
      action: "created",
      tableName: "tabla_del_futuro",
      actorName: "Ana",
    });

    expect(sentence).toBe("Ana registró un registro");
    expect(sentence).not.toContain("tabla_del_futuro");
  });

  it("un registro sin rótulo no deja un espacio colgando al final", () => {
    const sentence = describeEvent({
      action: "created",
      tableName: "orders",
      actorName: "Ana",
      recordLabel: "  ",
    });

    expect(sentence).toBe("Ana registró el pedido");
  });
});

describe("recordHref", () => {
  it("lleva al detalle de las entidades que tienen pantalla propia", () => {
    expect(recordHref("orders", "abc")).toBe("/orders/abc");
    expect(recordHref("expenses", "abc")).toBe("/expenses/abc");
    expect(recordHref("items", "abc")).toBe("/catalog/abc");
  });

  it("devuelve null para lo que no se abre por su cuenta", () => {
    expect(recordHref("order_items", "abc")).toBeNull();
    expect(recordHref("statuses", "abc")).toBeNull();
    expect(recordHref("tabla_del_futuro", "abc")).toBeNull();
  });
});
