import { describe, expect, it } from "vitest";

import {
  BASE_DELAY_MS,
  MAX_ATTEMPTS,
  MAX_DELAY_MS,
  backoffDelay,
  hasExhaustedAttempts,
} from "./backoff";

/**
 * Escenario de `offline-capture` — "Los reintentos esperan cada vez más y se
 * disparan al reconectar": «La espera crece entre intentos».
 */

// Sin desorden, para poder afirmar la progresión.
const sinAzar = () => 1;

describe("backoffDelay", () => {
  it("crece con cada fallo", () => {
    const esperas = [1, 2, 3, 4, 5].map((intentos) => backoffDelay(intentos, sinAzar));

    expect(esperas).toEqual([1_000, 2_000, 4_000, 8_000, 16_000]);
    expect(esperas).toEqual([...esperas].sort((a, b) => a - b));
  });

  it("nunca reintenta de forma inmediata", () => {
    expect(backoffDelay(1, () => 0)).toBeGreaterThanOrEqual(BASE_DELAY_MS / 2);
  });

  it("tiene techo: una espera no crece sin límite", () => {
    expect(backoffDelay(20, sinAzar)).toBe(MAX_DELAY_MS);
    expect(backoffDelay(100, sinAzar)).toBe(MAX_DELAY_MS);
  });

  it("desordena para que veinte teléfonos no reintenten en el mismo instante", () => {
    // La mitad alta de la espera calculada: el crecimiento sigue siendo
    // observable, pero dos dispositivos no coinciden.
    expect(backoffDelay(3, () => 0)).toBe(2_000);
    expect(backoffDelay(3, () => 1)).toBe(4_000);
  });
});

describe("hasExhaustedAttempts", () => {
  it("convierte lo transitorio en definitivo al llegar al tope", () => {
    expect(hasExhaustedAttempts(MAX_ATTEMPTS - 1)).toBe(false);
    expect(hasExhaustedAttempts(MAX_ATTEMPTS)).toBe(true);
  });
});
