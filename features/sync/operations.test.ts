import { describe, expect, it } from "vitest";

import { clearOperations, getOperation } from "@/lib/offline";

import {
  INVENTORY_ADJUSTMENT,
  INVENTORY_CONSUMPTION,
  describeAdjustment,
  describeConsumption,
  registerOfflineOperations,
} from "./operations";

describe("operaciones de inventario en la cola", () => {
  // Una operación sin registrar acaba en la bandeja como «versión anterior»
  // sin serlo: activar el destino Consumo sin registrarla lo rompería sin red.
  it("registra el consumo y el ajuste con el resto", () => {
    clearOperations();
    registerOfflineOperations();

    expect(getOperation(INVENTORY_CONSUMPTION)).toBeDefined();
    expect(getOperation(INVENTORY_ADJUSTMENT)).toBeDefined();
  });
});

describe("describeConsumption", () => {
  // Lo que la bandeja enseña. Sin jerga, y sin el nombre del insumo: el sobre
  // lleva su identificador, no su nombre, y la bandeja no consulta.
  it("dice la cantidad y la referencia cuando la hay", () => {
    expect(describeConsumption({ quantity: 5, note: "Pedido #1" })).toBe(
      "Consumo de 5 · Pedido #1",
    );
  });

  it("se queda en la cantidad cuando no hay nota", () => {
    expect(describeConsumption({ quantity: 5, note: null })).toBe("Consumo de 5");
  });

  it("no se rompe con un sobre incompleto", () => {
    expect(describeConsumption({})).toBe("Consumo de 0");
  });
});

describe("describeAdjustment", () => {
  it("marca el signo de la diferencia, que es lo único que distingue un ajuste", () => {
    expect(describeAdjustment({ difference: -5 })).toBe("Ajuste por conteo · -5");
    expect(describeAdjustment({ difference: 12 })).toBe("Ajuste por conteo · +12");
  });

  it("no se rompe con un sobre incompleto", () => {
    expect(describeAdjustment({})).toBe("Ajuste por conteo · 0");
  });
});
