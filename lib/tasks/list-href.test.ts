import { describe, expect, it } from "vitest";

import { MY_TASKS_ORIGIN, originCrumb, sanitizeFrom, tasksListHref, withFrom } from "./list-href";

describe("tasksListHref", () => {
  it("conserva la vista y los filtros conocidos (Volver al calendario filtrado)", () => {
    expect(tasksListHref("view=calendar&q=tazas")).toBe("/tasks?view=calendar&q=tazas");
  });

  it("conserva las nueve llaves de filtro del tablero de tareas", () => {
    const todas =
      "view=list&q=tazas&assignee=ana&tag=hornada&status=abc&archived=1&link=orders&nodeliv=1&closed=100";
    expect(tasksListHref(todas)).toBe(`/tasks?${todas}`);
  });

  it("sin origen vuelve a la pantalla sin filtros (Enlace directo)", () => {
    expect(tasksListHref(undefined)).toBe("/tasks");
    expect(tasksListHref(null)).toBe("/tasks");
    expect(tasksListHref("")).toBe("/tasks");
  });

  it("el token reservado vuelve a Mis pendientes (Desde Mis pendientes se vuelve a Mis pendientes)", () => {
    expect(tasksListHref(MY_TASKS_ORIGIN)).toBe("/my-tasks");
    expect(tasksListHref("?my-tasks")).toBe("/my-tasks");
  });

  it("descarta un origen ajeno (Origen ajeno ignorado)", () => {
    expect(tasksListHref("https://malo.example/tasks?view=list")).toBe("/tasks");
    expect(tasksListHref("//malo.example")).toBe("/tasks");
    expect(tasksListHref("/orders?view=list")).toBe("/tasks");
    expect(tasksListHref("redirect=x&token=y")).toBe("/tasks");
  });

  it("descarta llaves desconocidas y conserva las conocidas", () => {
    expect(tasksListHref("q=tazas&close=12&evil=1")).toBe("/tasks?q=tazas");
  });

  it("acepta la consulta con el signo de interrogación inicial", () => {
    expect(tasksListHref("?view=list")).toBe("/tasks?view=list");
  });

  it("suma parámetros extra", () => {
    expect(tasksListHref("view=list", { created: "42" })).toBe(
      "/tasks?view=list&created=42",
    );
    expect(tasksListHref(null, { created: "42" })).toBe("/tasks?created=42");
  });
});

describe("originCrumb", () => {
  it("nombra el tablero y conserva sus filtros (El origen sobrevive a la edición)", () => {
    expect(originCrumb("view=list&archived=1")).toEqual({
      label: "Tareas",
      href: "/tasks?view=list&archived=1",
    });
  });

  it("nombra Mis pendientes (Desde Mis pendientes se vuelve a Mis pendientes)", () => {
    expect(originCrumb(MY_TASKS_ORIGIN)).toEqual({
      label: "Mis pendientes",
      href: "/my-tasks",
    });
  });

  it("sin origen nombra Tareas sin filtros (Enlace directo)", () => {
    expect(originCrumb(null)).toEqual({ label: "Tareas", href: "/tasks" });
  });

  it("un origen ajeno nombra Tareas sin filtros (Origen ajeno ignorado)", () => {
    expect(originCrumb("https://malo.example/tasks")).toEqual({
      label: "Tareas",
      href: "/tasks",
    });
  });
});

describe("withFrom", () => {
  it("agrega el origen codificado", () => {
    expect(withFrom("/tasks/abc", "view=list&q=tazas")).toBe(
      "/tasks/abc?from=view%3Dlist%26q%3Dtazas",
    );
  });

  it("propaga el token de Mis pendientes", () => {
    expect(withFrom("/tasks/abc", MY_TASKS_ORIGIN)).toBe("/tasks/abc?from=my-tasks");
  });

  it("respeta una consulta existente", () => {
    expect(withFrom("/tasks/abc?close=1", "view=list")).toBe(
      "/tasks/abc?close=1&from=view%3Dlist",
    );
  });

  it("sin origen útil deja el enlace igual", () => {
    expect(withFrom("/tasks/abc", "")).toBe("/tasks/abc");
    expect(withFrom("/tasks/abc", "evil=1")).toBe("/tasks/abc");
  });
});

describe("sanitizeFrom", () => {
  it("devuelve solo filtros no vacíos", () => {
    expect(sanitizeFrom("view=&q=a")).toBe("q=a");
  });
});
