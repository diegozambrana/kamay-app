import { describe, expect, it } from "vitest";

import {
  QUICK_DESTINATIONS,
  destinationsFor,
  isAvailable,
} from "./destinations";

describe("QUICK_DESTINATIONS", () => {
  it("son seis, en el orden de la retícula", () => {
    // Seis ranuras desde el primer día: la disposición no cambia cuando
    // llegan KAM-16 y KAM-18, así que el alcance del pulgar se verifica
    // una sola vez (design D7).
    expect(QUICK_DESTINATIONS.map((d) => d.label)).toEqual([
      "Venta rápida",
      "Pedido",
      "Compra",
      "Gasto",
      "Consumo",
      "Tarea",
    ]);
  });

  it("los cinco destinos vivos llevan href y ninguna leyenda", () => {
    const vivos = QUICK_DESTINATIONS.filter(isAvailable);

    expect(vivos.map((d) => d.href)).toEqual([
      "/fair",
      "/orders/new",
      "/expenses/purchases/new",
      "/expenses/costs/new",
      // Encendido por KAM-15, que construyó el alta de tarea.
      "/tasks/new",
    ]);
    expect(vivos.every((d) => d.availableFrom === undefined)).toBe(true);
  });

  it("solo Consumo sigue pendiente: declara qué falta y no lleva href", () => {
    const pendientes = QUICK_DESTINATIONS.filter((d) => !isAvailable(d));

    expect(pendientes.map((d) => d.label)).toEqual(["Consumo"]);
    expect(pendientes.every((d) => d.availableFrom !== undefined)).toBe(true);
  });

  it("tarea enlaza al alta, que existe desde KAM-15", () => {
    const tarea = QUICK_DESTINATIONS.find((d) => d.key === "task");

    expect(tarea?.href).toBe("/tasks/new");
    expect(tarea?.availableFrom).toBeUndefined();
  });

  it("venta rápida enlaza al modo feria, que ya existe desde KAM-12", () => {
    const venta = QUICK_DESTINATIONS.find((d) => d.key === "direct-sale");

    expect(venta?.href).toBe("/fair");
    expect(venta?.availableFrom).toBeUndefined();
  });
});

describe("destinationsFor", () => {
  it("el dueño ve los seis destinos", () => {
    expect(destinationsFor("owner")).toHaveLength(6);
  });

  it("el ayudante no ve los destinos de egreso", () => {
    // `expenses` no tiene ninguna política para el ayudante: ni lectura ni
    // escritura. Se oculta, no se deshabilita (mapa §4.4).
    const labels = destinationsFor("assistant").map((d) => d.label);

    expect(labels).not.toContain("Compra");
    expect(labels).not.toContain("Gasto");
  });

  it("el ayudante sí ve los destinos de trabajo", () => {
    const labels = destinationsFor("assistant").map((d) => d.label);

    expect(labels).toContain("Pedido");
    expect(labels).toContain("Venta rápida");
  });

  it("conserva el orden de la retícula al filtrar", () => {
    expect(destinationsFor("assistant").map((d) => d.label)).toEqual([
      "Venta rápida",
      "Pedido",
      "Consumo",
      "Tarea",
    ]);
  });

  it("sin rol no hay destinos", () => {
    expect(destinationsFor(null)).toEqual([]);
    expect(destinationsFor(undefined)).toEqual([]);
  });
});
