import { describe, expect, it } from "vitest";

import { ALL_LINES, type BusinessLine } from "@/types";

import {
  findActiveLine,
  preselectedLineId,
  resolveActiveLine,
} from "./active-line";

const line = (id: string, overrides: Partial<BusinessLine> = {}): BusinessLine => ({
  id,
  organizationId: "11111111-1111-1111-1111-111111111111",
  name: "Sublimación",
  color: "blue",
  icon: null,
  isShared: false,
  position: 1,
  archivedAt: null,
  ...overrides,
});

const SUBLIMACION = line("22222222-2222-2222-2222-222222222222");
const ALFARERIA = line("33333333-3333-3333-3333-333333333333", {
  name: "Alfarería",
  color: "orange",
  position: 2,
});

describe("resolveActiveLine", () => {
  it("sin cookie resuelve a Todas", () => {
    expect(resolveActiveLine(undefined, [SUBLIMACION])).toBe(ALL_LINES);
  });

  it("la cookie con el literal `all` resuelve a Todas", () => {
    expect(resolveActiveLine(ALL_LINES, [SUBLIMACION])).toBe(ALL_LINES);
  });

  it("una cookie válida resuelve a esa línea", () => {
    expect(resolveActiveLine(SUBLIMACION.id, [SUBLIMACION, ALFARERIA])).toBe(
      SUBLIMACION.id,
    );
  });

  it("ignora una línea archivada: solo se le pasan las vigentes", () => {
    // El layout entrega únicamente las activas; una archivada ya no está ahí.
    expect(resolveActiveLine(ALFARERIA.id, [SUBLIMACION])).toBe(ALL_LINES);
  });

  it("ignora una línea de otra organización", () => {
    const ajena = line("44444444-4444-4444-4444-444444444444", {
      organizationId: "99999999-9999-9999-9999-999999999999",
    });

    expect(resolveActiveLine(ajena.id, [SUBLIMACION])).toBe(ALL_LINES);
  });

  it("una cookie corrupta no rompe la resolución", () => {
    expect(resolveActiveLine("no-es-un-uuid", [SUBLIMACION])).toBe(ALL_LINES);
    expect(resolveActiveLine("", [SUBLIMACION])).toBe(ALL_LINES);
  });
});

describe("findActiveLine", () => {
  it("devuelve la entidad de la línea activa", () => {
    expect(findActiveLine(SUBLIMACION.id, [SUBLIMACION, ALFARERIA])).toEqual(
      SUBLIMACION,
    );
  });

  it("devuelve null cuando el contexto es Todas", () => {
    expect(findActiveLine(ALL_LINES, [SUBLIMACION])).toBeNull();
  });

  it("devuelve null cuando la línea ya no está en la lista", () => {
    expect(findActiveLine(ALFARERIA.id, [SUBLIMACION])).toBeNull();
  });
});

describe("preselectedLineId", () => {
  it("preselecciona la línea activa en los formularios de creación", () => {
    expect(preselectedLineId(SUBLIMACION.id)).toBe(SUBLIMACION.id);
  });

  it("con Todas no preselecciona nada: la elección es explícita", () => {
    expect(preselectedLineId(ALL_LINES)).toBeUndefined();
  });
});
