import { describe, expect, it } from "vitest";

import { setIsComplete, statusFormSchema } from "./schema";

describe("statusFormSchema", () => {
  const valid = {
    name: "En cola",
    color: "blue",
    kind: "waiting",
    isQueue: true,
  };

  it("acepta un estado de espera marcado como cola", () => {
    expect(statusFormSchema.safeParse(valid).success).toBe(true);
  });

  it("rechaza la marca de cola sobre un estado que no es de espera", () => {
    const result = statusFormSchema.safeParse({
      ...valid,
      kind: "in_progress",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/En espera/);
  });

  it("rechaza el nombre vacío", () => {
    expect(statusFormSchema.safeParse({ ...valid, name: "  " }).success).toBe(
      false,
    );
  });

  it("rechaza un kind fuera del contrato", () => {
    expect(statusFormSchema.safeParse({ ...valid, kind: "done" }).success).toBe(
      false,
    );
  });
});

describe("setIsComplete", () => {
  it("un juego con inicial y final está completo", () => {
    expect(setIsComplete(["initial", "waiting", "final"])).toBe(true);
  });

  it("sin final no se puede enviar", () => {
    expect(setIsComplete(["initial", "in_progress"])).toBe(false);
  });

  it("sin inicial no se puede enviar", () => {
    expect(setIsComplete(["waiting", "final"])).toBe(false);
  });

  it("el juego vacío es válido: la línea vuelve al juego de la organización", () => {
    expect(setIsComplete([])).toBe(true);
  });
});
