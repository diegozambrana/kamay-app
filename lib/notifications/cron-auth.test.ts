import { describe, expect, it } from "vitest";

import { isAuthorizedCron } from "./cron-auth";

/**
 * KAM-17 · La puerta del trabajo programado.
 *
 * Escenario del delta spec `notifications` — requisito "La generación
 * privilegiada se limita al trabajo programado y a la creación de avisos":
 * «Disparo sin credencial».
 *
 * Es la única puerta del sistema que corre con service role, así que la
 * prueba se ocupa sobre todo de los casos en que **no** debe abrirse.
 */
describe("isAuthorizedCron", () => {
  it("abre con la credencial correcta", () => {
    expect(isAuthorizedCron("Bearer secreto", "secreto")).toBe(true);
  });

  it("no abre con una credencial equivocada", () => {
    expect(isAuthorizedCron("Bearer otra", "secreto")).toBe(false);
  });

  it("no abre sin cabecera", () => {
    expect(isAuthorizedCron(null, "secreto")).toBe(false);
    expect(isAuthorizedCron("", "secreto")).toBe(false);
  });

  it("sin secreto configurado no abre para nadie", () => {
    // Dejar pasar cuando la variable falta convertiría un despliegue mal
    // configurado en un generador de avisos abierto a cualquiera.
    expect(isAuthorizedCron("Bearer secreto", undefined)).toBe(false);
    expect(isAuthorizedCron("Bearer secreto", "")).toBe(false);
    expect(isAuthorizedCron(null, undefined)).toBe(false);
  });

  it("no abre con el secreto desnudo, sin el esquema Bearer", () => {
    expect(isAuthorizedCron("secreto", "secreto")).toBe(false);
  });

  it("no abre con un prefijo del secreto ni con el secreto más algo", () => {
    expect(isAuthorizedCron("Bearer secret", "secreto")).toBe(false);
    expect(isAuthorizedCron("Bearer secretoo", "secreto")).toBe(false);
  });

  it("distingue mayúsculas", () => {
    expect(isAuthorizedCron("Bearer SECRETO", "secreto")).toBe(false);
  });
});
