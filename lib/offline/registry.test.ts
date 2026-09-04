import { afterEach, describe, expect, it } from "vitest";

import {
  clearOperations,
  getOperation,
  registerOperation,
  unknownOperationMessage,
} from "./registry";

afterEach(() => {
  clearOperations();
});

describe("registro de operaciones", () => {
  it("devuelve la operación registrada", async () => {
    registerOperation("order.create", {
      send: async () => ({ orderId: "a", code: 1 }),
      describe: () => "Pedido para Ana",
    });

    const operation = getOperation("order.create");
    expect(await operation?.send({})).toEqual({ orderId: "a", code: 1 });
    expect(operation?.describe({})).toBe("Pedido para Ana");
  });

  it("no conoce una clave que nadie registró", () => {
    expect(getOperation("order.create.v0")).toBeUndefined();
  });

  it("explica en español una operación de otra versión de la aplicación", () => {
    const message = unknownOperationMessage("order.create.v0");

    expect(message).toContain("versión anterior");
    expect(message).toContain("descártalo");
  });
});
