import { describe, expect, it } from "vitest";

import { findServiceRoleLeaks } from "./client-bundle-secrets.mjs";

/** Un JWT sin firma válida: solo importa su carga. */
function jwt(payload: Record<string, unknown>) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.firma`;
}

describe("findServiceRoleLeaks", () => {
  it("un paquete limpio, con la llave pública dentro, no delata nada", () => {
    const bundle = `const url="https://x.supabase.co";const key="${jwt({ role: "anon" })}";const pk="sb_publishable_abcdefghij";`;
    expect(findServiceRoleLeaks(bundle, "sb_secret_la-de-verdad")).toEqual([]);
  });

  it("encuentra el valor configurado", () => {
    expect(findServiceRoleLeaks('x="clave-rara-123"', "clave-rara-123")).toEqual([
      "el valor de SUPABASE_SERVICE_ROLE_KEY",
    ]);
  });

  it("encuentra una clave secreta del formato nuevo aunque no sea la configurada", () => {
    expect(findServiceRoleLeaks('k="sb_secret_inventada-para-esta-prueba"', undefined)).toEqual([
      "una clave secreta sb_secret_…",
    ]);
  });

  it("encuentra un JWT antiguo con rol service_role", () => {
    const bundle = `a="${jwt({ role: "anon" })}";b="${jwt({ iss: "supabase-demo", role: "service_role" })}"`;
    expect(findServiceRoleLeaks(bundle, undefined)).toEqual(["un JWT con rol service_role"]);
  });

  it("nunca devuelve el valor encontrado", () => {
    const leaks = findServiceRoleLeaks("sb_secret_inventada-para-esta-prueba", undefined);
    expect(leaks.join(" ")).not.toContain("inventada");
  });
});
