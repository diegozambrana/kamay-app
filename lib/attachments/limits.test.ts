import { describe, expect, it } from "vitest";

import {
  MAX_ATTACHMENTS_PER_TASK,
  batchLimitMessage,
  fitsBatch,
  fitsFileSize,
  remainingSlots,
} from "./limits";

describe("límite de adjuntos por tarea", () => {
  it("el tope es quince", () => {
    expect(MAX_ATTACHMENTS_PER_TASK).toBe(15);
  });

  it("cuenta las ranuras libres", () => {
    expect(remainingSlots(0)).toBe(15);
    expect(remainingSlots(13)).toBe(2);
    expect(remainingSlots(15)).toBe(0);
  });

  it("nunca devuelve ranuras negativas", () => {
    // Dos personas adjuntando a la vez pueden dejar el conteo por encima del
    // tope antes de que nadie lo compruebe.
    expect(remainingSlots(17)).toBe(0);
  });

  it("acepta un lote que cabe", () => {
    expect(fitsBatch(13, 2)).toBe(true);
    expect(fitsBatch(0, 15)).toBe(true);
  });

  it("rechaza el lote entero cuando desborda", () => {
    // Trece adjuntos y cinco arrastrados: el requisito es que no quede en
    // quince con dos errores, sino que no entre ninguno.
    expect(fitsBatch(13, 5)).toBe(false);
  });

  it("rechaza el decimosexto de uno en uno", () => {
    expect(fitsBatch(15, 1)).toBe(false);
    expect(fitsBatch(14, 1)).toBe(true);
  });

  it("libera ranura al quitar un adjunto", () => {
    expect(fitsBatch(15, 1)).toBe(false);
    // Quitar archiva, así que el conteo de vigentes baja.
    expect(fitsBatch(14, 1)).toBe(true);
  });

  it("dice cuántas ranuras quedan y cuántas se piden", () => {
    expect(batchLimitMessage(13, 5)).toContain("2 adjuntos más");
    expect(batchLimitMessage(13, 5)).toContain("estás agregando 5");
  });

  it("concuerda el singular cuando queda una sola ranura", () => {
    expect(batchLimitMessage(14, 3)).toContain("1 adjunto más");
  });

  it("dice que está lleno cuando no queda ninguna", () => {
    expect(batchLimitMessage(15, 1)).toContain("ya tiene 15 adjuntos");
  });
});

describe("límite de peso por archivo", () => {
  it("acepta hasta 5 MB", () => {
    expect(fitsFileSize(5 * 1024 * 1024)).toBe(true);
  });

  it("rechaza lo que pasa de 5 MB", () => {
    expect(fitsFileSize(5 * 1024 * 1024 + 1)).toBe(false);
    expect(fitsFileSize(12 * 1024 * 1024)).toBe(false);
  });
});
