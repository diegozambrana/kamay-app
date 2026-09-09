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

  // Escenario "Destinos disponibles hoy": los seis, desde KAM-18.
  it("los cinco destinos que navegan llevan href y ninguna leyenda", () => {
    const navegan = QUICK_DESTINATIONS.filter((d) => d.href !== undefined);

    expect(navegan.map((d) => d.href)).toEqual([
      "/fair",
      "/orders/new",
      "/expenses/purchases/new",
      "/expenses/costs/new",
      // Encendido por KAM-15, que construyó el alta de tarea.
      "/tasks/new",
    ]);
    expect(navegan.every((d) => d.availableFrom === undefined)).toBe(true);
  });

  // Escenario "Destinos aún no construidos": ya no queda ninguno.
  it("ningún destino sigue pendiente", () => {
    const pendientes = QUICK_DESTINATIONS.filter((d) => !isAvailable(d));

    expect(pendientes).toEqual([]);
    expect(QUICK_DESTINATIONS.every((d) => d.availableFrom === undefined)).toBe(
      true,
    );
  });

  // Escenario "El destino que es diálogo no cambia de pantalla": Consumo es el
  // único de los seis que no navega (mapa §5).
  it("Consumo está disponible como diálogo, sin dirección propia", () => {
    const consumo = QUICK_DESTINATIONS.find((d) => d.key === "consumption");

    expect(consumo?.opensDialog).toBe(true);
    expect(consumo?.href).toBeUndefined();
    expect(isAvailable(consumo!)).toBe(true);
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
