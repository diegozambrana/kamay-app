import { describe, expect, it } from "vitest";

import { assertEnv, envProblems } from "./env";

const BASE = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_x",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_y",
};
const PRODUCTION = {
  ...BASE,
  CRON_SECRET: "un-secreto-de-verdad-largo",
  APP_URL: "https://kamay.example",
};

describe("envProblems", () => {
  it("un entorno de producción completo no tiene problemas", () => {
    expect(envProblems(PRODUCTION, "production")).toEqual([]);
  });

  it("en desarrollo bastan las de Supabase", () => {
    expect(envProblems(BASE, "development")).toEqual([]);
  });

  it("en producción faltar CRON_SECRET o APP_URL es un problema", () => {
    expect(envProblems(BASE, "production")).toEqual([
      { name: "CRON_SECRET", problem: "falta" },
      { name: "APP_URL", problem: "falta o no es una URL" },
    ]);
  });

  it("un secreto de disparo corto no vale", () => {
    const problems = envProblems({ ...PRODUCTION, CRON_SECRET: "corto" }, "production");
    expect(problems).toEqual([
      { name: "CRON_SECRET", problem: "tiene menos de 16 caracteres" },
    ]);
  });

  it("una variable vacía o de solo espacios cuenta como ausente", () => {
    const problems = envProblems({ ...BASE, SUPABASE_SERVICE_ROLE_KEY: "  " }, "development");
    expect(problems).toEqual([{ name: "SUPABASE_SERVICE_ROLE_KEY", problem: "falta" }]);
  });

  it("la clave de service role en una variable pública se detecta", () => {
    const problems = envProblems(
      { ...PRODUCTION, NEXT_PUBLIC_SUPABASE_ANON_KEY: PRODUCTION.SUPABASE_SERVICE_ROLE_KEY },
      "production",
    );
    expect(problems).toEqual([
      { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", problem: "contiene la clave de service role" },
    ]);
  });
});

describe("assertEnv", () => {
  it("falla nombrando lo que falta, sin mostrar ningún valor", () => {
    const env = { ...BASE, CRON_SECRET: "corto" };
    expect(() => assertEnv(env, "production")).toThrow(/CRON_SECRET.*APP_URL/);
    try {
      assertEnv(env, "production");
    } catch (error) {
      const message = String(error);
      expect(message).not.toContain("corto");
      expect(message).not.toContain(BASE.SUPABASE_SERVICE_ROLE_KEY);
    }
  });

  it("no hace nada si el entorno está completo", () => {
    expect(() => assertEnv(PRODUCTION, "production")).not.toThrow();
  });
});
