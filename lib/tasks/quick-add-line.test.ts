import { describe, expect, it } from "vitest";

import { ALL_LINES, type BusinessLine } from "@/types";

import { resolveQuickAddLine } from "./quick-add-line";

function line(id: string, name: string, isShared = false): BusinessLine {
  return {
    id,
    organizationId: "11111111-1111-1111-1111-111111111111",
    name,
    color: "zinc",
    icon: null,
    isShared,
    position: 1,
    archivedAt: null,
  };
}

const SUBLIMACION = line("33333333-3333-4333-8333-333333333333", "Sublimación");
const GENERAL = line("44444444-4444-4444-8444-444444444444", "General", true);

/**
 * KAM-15 · La línea del alta rápida.
 *
 * Escenarios del delta spec `tasks` — requisito "Alta rápida de tarea en tres
 * interacciones o menos": «Crear una tarea con la línea activa» y «Crear una
 * tarea con el selector en Todas».
 */
describe("resolveQuickAddLine", () => {
  it("con una línea activa, usa esa", () => {
    expect(resolveQuickAddLine(SUBLIMACION.id, [SUBLIMACION, GENERAL])).toEqual({
      kind: "resolved",
      businessLineId: SUBLIMACION.id,
    });
  });

  it("con «Todas», usa la compartida y no pregunta", () => {
    expect(resolveQuickAddLine(ALL_LINES, [SUBLIMACION, GENERAL])).toEqual({
      kind: "resolved",
      businessLineId: GENERAL.id,
    });
  });

  it("con «Todas», no cae en la primera de la lista", () => {
    const resuelta = resolveQuickAddLine(ALL_LINES, [SUBLIMACION, GENERAL]);
    expect(resuelta).not.toEqual({
      kind: "resolved",
      businessLineId: SUBLIMACION.id,
    });
  });

  it("sin línea activa se comporta como «Todas»", () => {
    expect(resolveQuickAddLine(null, [SUBLIMACION, GENERAL])).toEqual({
      kind: "resolved",
      businessLineId: GENERAL.id,
    });
  });

  it("sin línea compartida, pide la línea en vez de inventarla", () => {
    expect(resolveQuickAddLine(ALL_LINES, [SUBLIMACION])).toEqual({ kind: "ask" });
  });

  it("una línea compartida archivada no sirve para resolver", () => {
    const archivada = { ...GENERAL, archivedAt: "2026-09-01T00:00:00.000Z" };
    expect(resolveQuickAddLine(ALL_LINES, [SUBLIMACION, archivada])).toEqual({
      kind: "ask",
    });
  });
});
