import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } from "next/constants";
import { afterEach, describe, expect, it, vi } from "vitest";

import config from "../next.config";

const COMPLETE = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_x",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_y",
  CRON_SECRET: "un-secreto-de-verdad-largo",
  APP_URL: "https://kamay.example",
};

function stubEnv(values: Record<string, string | undefined>) {
  for (const [name, value] of Object.entries(values)) vi.stubEnv(name, value);
}

const argv = process.argv;

afterEach(() => {
  vi.unstubAllEnvs();
  process.argv = argv;
});

/**
 * KAM-23 · Escenario «A missing variable fails at startup, not at first use»:
 * la validación vive en `next.config.ts`, que Next ejecuta al compilar y al
 * arrancar con `next start`.
 */
describe("next.config valida el entorno", () => {
  it("al compilar, un entorno incompleto hace fallar la compilación nombrando lo que falta", () => {
    stubEnv({ ...COMPLETE, CRON_SECRET: undefined, APP_URL: undefined, VERCEL: undefined });
    expect(() => config(PHASE_PRODUCTION_BUILD)).toThrow(/CRON_SECRET.*APP_URL/);
  });

  it("al compilar en Vercel también", () => {
    stubEnv({ ...COMPLETE, SUPABASE_SERVICE_ROLE_KEY: undefined, VERCEL: "1" });
    expect(() => config(PHASE_PRODUCTION_BUILD)).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("con el entorno completo, compila", () => {
    stubEnv({ ...COMPLETE, VERCEL: undefined });
    expect(config(PHASE_PRODUCTION_BUILD).poweredByHeader).toBe(false);
  });

  it("`next start` fuera de Vercel valida al arrancar", () => {
    stubEnv({ ...COMPLETE, CRON_SECRET: undefined, VERCEL: undefined });
    expect(() => config(PHASE_PRODUCTION_SERVER)).toThrow(/CRON_SECRET/);
  });

  it("dentro de Vercel no se valida al arrancar: el proxy no recibe las variables de servidor", () => {
    stubEnv({ ...COMPLETE, CRON_SECRET: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined, VERCEL: "1" });
    expect(() => config(PHASE_PRODUCTION_SERVER)).not.toThrow();
  });

  it("`next typegen` carga la fase de compilación, pero no despliega nada y no valida", () => {
    stubEnv({ ...COMPLETE, NEXT_PUBLIC_SUPABASE_URL: undefined, CRON_SECRET: undefined });
    process.argv = [...argv.slice(0, 2), "typegen"];
    expect(() => config(PHASE_PRODUCTION_BUILD)).not.toThrow();
  });

  it("en desarrollo no exige las de producción", () => {
    stubEnv({ ...COMPLETE, CRON_SECRET: undefined, APP_URL: undefined, VERCEL: undefined });
    expect(() => config(PHASE_DEVELOPMENT_SERVER)).not.toThrow();
  });
});
