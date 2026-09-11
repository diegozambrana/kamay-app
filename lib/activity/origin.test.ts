import { describe, expect, it } from "vitest";

import { ORIGIN_HEADER, originFromUserAgent } from "@/lib/activity/origin";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36";
const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120";

/**
 * KAM-22 · El origen del cambio (design D12).
 *
 * Escenario de `activity-screen` § Cada fila se lee como una frase y trae su
 * contexto → «Un evento sin origen no lo inventa», en su parte pura: lo que la
 * deducción produce, y lo que la pantalla recibe cuando no hay nada que
 * deducir.
 */
describe("originFromUserAgent", () => {
  it("un teléfono es móvil", () => {
    expect(originFromUserAgent(IPHONE)).toBe("mobile");
    expect(originFromUserAgent(ANDROID)).toBe("mobile");
  });

  it("un escritorio es escritorio", () => {
    expect(originFromUserAgent(MAC)).toBe("desktop");
  });

  // El mismo criterio que decide el aterrizaje ante la misma duda: dos
  // criterios distintos para la misma pregunta sería peor que uno imperfecto.
  it("sin agente de usuario cae a escritorio, como el aterrizaje", () => {
    expect(originFromUserAgent(null)).toBe("desktop");
    expect(originFromUserAgent(undefined)).toBe("desktop");
    expect(originFromUserAgent("")).toBe("desktop");
  });

  it("la cabecera es la que el trigger de KAM-03 lee", () => {
    expect(ORIGIN_HEADER).toBe("x-client-origin");
  });

  // La deducción nunca produce `null`: los eventos sin origen son los
  // anteriores a este cambio, y la fila los rinde omitiendo el dato en vez de
  // suponer uno. Escribir historia falsa en la única pantalla cuyo trabajo es
  // no hacerlo sería el peor de los defectos posibles aquí.
  it("nunca devuelve vacío: lo vacío viene de la base, no de aquí", () => {
    for (const ua of [IPHONE, ANDROID, MAC, null, "", "curl/8.4.0"]) {
      expect(["mobile", "desktop"]).toContain(originFromUserAgent(ua));
    }
  });
});
