import { describe, expect, it } from "vitest";

import {
  ANY,
  EMPTY_FILTERS,
  activityHref,
  hasActiveFilters,
  parseFilters,
  rangeInstants,
  recordActivityHref,
  toSearchParams,
} from "@/lib/activity/filters";

const LINE = "11111111-1111-1111-1111-111111111111";
const ACTOR = "22222222-2222-2222-2222-222222222222";

/**
 * KAM-22 · Los filtros de V23 viven en la dirección.
 *
 * Escenarios de `activity-screen` § Los filtros se aplican en la consulta y
 * viven en la dirección: «El filtro se comparte por enlace», «Volver atrás
 * recupera el filtro anterior», «Los filtros se combinan» — la parte que se
 * puede afirmar sin navegador: que la dirección conserva el filtro entero y lo
 * devuelve igual.
 */
describe("parseFilters", () => {
  it("sin parámetros no filtra nada", () => {
    expect(parseFilters({})).toEqual(EMPTY_FILTERS);
    expect(EMPTY_FILTERS.line).toBe("all");
    expect(hasActiveFilters(parseFilters({}))).toBe(false);
  });

  // Escenario: Los filtros se combinan
  it("lee los seis filtros a la vez", () => {
    const filters = parseFilters({
      from: "2026-08-17",
      to: "2026-08-19",
      line: LINE,
      actor: ACTOR,
      type: "orders",
      action: "archived",
      q: "142",
    });

    expect(filters).toEqual({
      from: "2026-08-17",
      to: "2026-08-19",
      line: LINE,
      actor: ACTOR,
      table: "orders",
      action: "archived",
      search: "142",
      cursor: null,
    });
    expect(hasActiveFilters(filters)).toBe(true);
  });

  // `isCivilDate` solo mira el patrón, así que «2026-13-45» lo pasaba y
  // `startOfDayInTimezone` lanzaba «Invalid time value»: una dirección escrita
  // a mano devolvía un 500 en vez de la bitácora sin ese filtro.
  it("descarta en silencio lo que no es una fecha real", () => {
    const filters = parseFilters({ from: "ayer", to: "2026-13-45" });
    expect(filters.from).toBeNull();
    expect(filters.to).toBeNull();
  });

  it("descarta un día que no existe en su mes", () => {
    expect(parseFilters({ from: "2026-02-31" }).from).toBeNull();
    expect(parseFilters({ from: "2026-02-28" }).from).toBe("2026-02-28");
  });

  it("descarta una acción que no existe en vez de fallar", () => {
    expect(parseFilters({ action: "borró" }).action).toBe(ANY);
  });

  it("endereza un rango escrito al revés", () => {
    const filters = parseFilters({ from: "2026-08-19", to: "2026-08-17" });
    expect(filters).toMatchObject({ from: "2026-08-17", to: "2026-08-19" });
  });

  it("se queda con el primer valor cuando el parámetro llega repetido", () => {
    expect(parseFilters({ type: ["orders", "tasks"] }).table).toBe("orders");
  });

  it("ignora un parámetro presente pero vacío", () => {
    expect(parseFilters({ q: "   ", line: "" })).toEqual(EMPTY_FILTERS);
  });
});

describe("toSearchParams", () => {
  // Escenario: El filtro se comparte por enlace
  // Escenario: Volver atrás recupera el filtro anterior
  it("la dirección devuelve exactamente los mismos filtros", () => {
    const original = parseFilters({
      from: "2026-08-17",
      to: "2026-08-19",
      line: LINE,
      actor: ACTOR,
      type: "orders",
      action: "status_changed",
      q: "142",
    });

    const roundTrip = parseFilters(
      Object.fromEntries(toSearchParams(original)),
    );

    expect(roundTrip).toEqual(original);
  });

  it("no escribe los filtros que no filtran", () => {
    expect(toSearchParams(EMPTY_FILTERS).toString()).toBe("");
    expect(activityHref(EMPTY_FILTERS)).toBe("/activity");
  });

  // El cursor fuera: cambiar un filtro devuelve a la primera página, y
  // arrastrar el de la página siete mostraría un hueco sin explicación.
  it("omite el cursor salvo que se pida conservarlo", () => {
    const filters = { ...EMPTY_FILTERS, cursor: "2026-08-19T14:22:00Z|91" };

    expect(toSearchParams(filters).has("after")).toBe(false);
    expect(toSearchParams(filters, { keepCursor: true }).get("after")).toBe(
      "2026-08-19T14:22:00Z|91",
    );
  });

  it("el enlace de un registro filtra por su tabla y su identificador", () => {
    const href = recordActivityHref("orders", "abc");
    expect(parseFilters(Object.fromEntries(new URL(href, "http://x").searchParams))).toMatchObject({
      table: "orders",
      search: "abc",
    });
  });
});

describe("rangeInstants", () => {
  it("el día final entra entero: el corte es el principio del siguiente", () => {
    const { fromInstant, toInstant } = rangeInstants(
      { ...EMPTY_FILTERS, from: "2026-08-17", to: "2026-08-19" },
      "America/La_Paz",
    );

    expect(fromInstant).toBe("2026-08-17T04:00:00.000Z");
    expect(toInstant).toBe("2026-08-20T04:00:00.000Z");
  });

  it("sin rango no hay instantes", () => {
    expect(rangeInstants(EMPTY_FILTERS, "America/La_Paz")).toEqual({
      fromInstant: null,
      toInstant: null,
    });
  });
});
