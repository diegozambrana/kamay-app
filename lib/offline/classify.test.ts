import { describe, expect, it } from "vitest";

import { SESSION_ENDED, classify, classifyRejection, classifyResolution } from "./classify";

/**
 * Escenarios de `offline-capture` — "Un fallo definitivo se muestra, nunca se
 * pierde en silencio": «Rechazo por permisos», «Nada se pierde en silencio».
 */

describe("una promesa rechazada es un fallo transitorio", () => {
  it("clasifica el fallo de red como transitorio", () => {
    expect(classifyRejection(new TypeError("Failed to fetch"))).toEqual({
      kind: "transient",
      message: "Failed to fetch",
    });
  });

  it("clasifica un rechazo sin forma de Error como transitorio", () => {
    expect(classifyRejection("lo que sea")).toEqual({
      kind: "transient",
      message: "No se pudo conectar con el servidor.",
    });
  });
});

describe("una resolución con error es un fallo definitivo", () => {
  it("no reintenta un rechazo de permisos", () => {
    expect(classifyResolution({ error: "Solo el dueño puede hacer esto." })).toEqual({
      kind: "permanent",
      message: "Solo el dueño puede hacer esto.",
      recoverable: false,
    });
  });

  it("no reintenta un rechazo de contenido", () => {
    expect(classifyResolution({ error: "Elige o crea un cliente" })).toMatchObject({
      kind: "permanent",
    });
  });

  it("marca la sesión terminada como recuperable: se cura al volver a entrar", () => {
    expect(classifyResolution({ error: SESSION_ENDED })).toEqual({
      kind: "permanent",
      message: SESSION_ENDED,
      recoverable: true,
    });
  });
});

describe("una resolución sin error es un envío correcto", () => {
  it("acepta el resultado del alta de pedido", () => {
    expect(classifyResolution({ orderId: "a", code: 142 })).toEqual({
      kind: "ok",
      result: { orderId: "a", code: 142 },
    });
  });

  it("acepta una acción que no devuelve nada", () => {
    expect(classifyResolution(undefined)).toEqual({ kind: "ok", result: undefined });
  });
});

describe("classify", () => {
  it("lee el resultado de una promesa ya asentada", () => {
    expect(classify({ status: "fulfilled", value: undefined })).toEqual({
      kind: "ok",
      result: undefined,
    });
    expect(
      classify({ status: "rejected", reason: new TypeError("Failed to fetch") }),
    ).toMatchObject({ kind: "transient" });
  });
});
