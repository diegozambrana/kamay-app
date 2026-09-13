import { describe, expect, it } from "vitest";

import { chunk, MAX_LIMIT, PAGE_SIZE, resolveLimit, takeWindow } from "./pagination";

describe("resolveLimit", () => {
  it("sin límite en la dirección trae una vuelta", () => {
    expect(resolveLimit(undefined)).toBe(PAGE_SIZE);
    expect(resolveLimit("")).toBe(PAGE_SIZE);
    expect(resolveLimit("cien")).toBe(PAGE_SIZE);
  });

  it("redondea a vueltas enteras", () => {
    expect(resolveLimit("51")).toBe(100);
    expect(resolveLimit("100")).toBe(100);
  });

  it("no baja de una vuelta ni sube del techo", () => {
    expect(resolveLimit("3")).toBe(PAGE_SIZE);
    expect(resolveLimit("-20")).toBe(PAGE_SIZE);
    expect(resolveLimit("999999")).toBe(MAX_LIMIT);
  });
});

describe("takeWindow", () => {
  it("con una fila de más, recorta y avisa que hay más", () => {
    expect(takeWindow([1, 2, 3], 2)).toEqual({ rows: [1, 2], hasMore: true });
  });

  it("sin fila de más, no hay más", () => {
    expect(takeWindow([1, 2], 2)).toEqual({ rows: [1, 2], hasMore: false });
    expect(takeWindow([], 2)).toEqual({ rows: [], hasMore: false });
  });
});

describe("chunk", () => {
  it("parte en tandas del tamaño pedido, la última con el resto", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("una lista vacía no produce tandas", () => {
    expect(chunk([], 100)).toEqual([]);
  });
});
