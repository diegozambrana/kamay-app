import { describe, expect, it } from "vitest";

import { ordersListHref, sanitizeFrom, withFrom } from "./list-href";

describe("ordersListHref", () => {
  it("conserva la vista y los filtros conocidos (Volver al calendario filtrado)", () => {
    expect(ordersListHref("view=calendar&q=tazas")).toBe("/orders?view=calendar&q=tazas");
    expect(ordersListHref("view=list&archived=1&closed=100")).toBe(
      "/orders?view=list&archived=1&closed=100",
    );
  });

  it("sin origen vuelve a la pantalla sin filtros (Enlace directo)", () => {
    expect(ordersListHref(undefined)).toBe("/orders");
    expect(ordersListHref(null)).toBe("/orders");
    expect(ordersListHref("")).toBe("/orders");
  });

  it("descarta un origen ajeno (Origen ajeno ignorado)", () => {
    expect(ordersListHref("https://malo.example/orders?view=list")).toBe("/orders");
    expect(ordersListHref("//malo.example")).toBe("/orders");
    expect(ordersListHref("/tasks?view=list")).toBe("/orders");
    expect(ordersListHref("redirect=x&token=y")).toBe("/orders");
  });

  it("descarta llaves desconocidas y conserva las conocidas", () => {
    expect(ordersListHref("q=tazas&created=12&evil=1")).toBe("/orders?q=tazas");
  });

  it("acepta la consulta con el signo de interrogación inicial", () => {
    expect(ordersListHref("?view=list")).toBe("/orders?view=list");
  });

  it("suma parámetros extra", () => {
    expect(ordersListHref("view=list", { created: "42" })).toBe(
      "/orders?view=list&created=42",
    );
    expect(ordersListHref(null, { created: "42" })).toBe("/orders?created=42");
  });
});

describe("withFrom", () => {
  it("agrega el origen codificado", () => {
    expect(withFrom("/orders/abc", "view=list&q=tazas")).toBe(
      "/orders/abc?from=view%3Dlist%26q%3Dtazas",
    );
  });

  it("respeta una consulta existente", () => {
    expect(withFrom("/tasks/new?orderId=1", "view=list")).toBe(
      "/tasks/new?orderId=1&from=view%3Dlist",
    );
  });

  it("sin origen útil deja el enlace igual", () => {
    expect(withFrom("/orders/new", "")).toBe("/orders/new");
    expect(withFrom("/orders/new", "evil=1")).toBe("/orders/new");
  });
});

describe("sanitizeFrom", () => {
  it("devuelve solo filtros no vacíos", () => {
    expect(sanitizeFrom("view=&q=a")).toBe("q=a");
  });
});
