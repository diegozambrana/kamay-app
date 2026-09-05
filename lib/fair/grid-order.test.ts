import { describe, expect, it } from "vitest";

import { orderGrid, type GridProduct } from "./grid-order";

const producto = (name: string, quantitySold: number): GridProduct => ({
  id: name,
  name,
  salePrice: 10,
  quantitySold,
});

describe("orderGrid", () => {
  // Escenario: Orden por ventas recientes
  it("pone delante lo que más se vendió", () => {
    const orden = orderGrid([producto("Plato", 4), producto("Taza", 30), producto("Maceta", 12)]);

    expect(orden.map((p) => p.name)).toEqual(["Taza", "Maceta", "Plato"]);
  });

  // Escenario: Producto sin ventas
  it("los productos sin ventas van después, ordenados por nombre", () => {
    const orden = orderGrid([
      producto("Zafiro", 0),
      producto("Taza", 30),
      producto("Ánfora", 0),
    ]);

    expect(orden.map((p) => p.name)).toEqual(["Taza", "Ánfora", "Zafiro"]);
  });

  it("un producto recién creado aparece, no desaparece de la cuadrícula", () => {
    const orden = orderGrid([producto("Taza", 30), producto("Novedad", 0)]);

    expect(orden.map((p) => p.name)).toContain("Novedad");
  });

  // El desempate estable: sin él la cuadrícula se reordena sola entre recargas
  // y se toca el producto equivocado.
  it("a igualdad de ventas desempata por nombre, siempre igual", () => {
    const entrada = [producto("Bandeja", 5), producto("Ánfora", 5), producto("Cuenco", 5)];

    expect(orderGrid(entrada).map((p) => p.name)).toEqual(["Ánfora", "Bandeja", "Cuenco"]);
    expect(orderGrid([...entrada].reverse()).map((p) => p.name)).toEqual([
      "Ánfora",
      "Bandeja",
      "Cuenco",
    ]);
  });

  it("no muta el arreglo que recibe", () => {
    const entrada = [producto("Plato", 1), producto("Taza", 9)];
    orderGrid(entrada);

    expect(entrada.map((p) => p.name)).toEqual(["Plato", "Taza"]);
  });

  it("la cuadrícula vacía no rompe", () => {
    expect(orderGrid([])).toEqual([]);
  });
});
