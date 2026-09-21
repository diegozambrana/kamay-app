import { afterEach, describe, expect, it, vi } from "vitest";

import { monthlyRequestLimit } from "./config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("monthlyRequestLimit", () => {
  it("sin la variable, usa el valor por omisión", () => {
    vi.stubEnv("AI_WRITING_ASSIST_MONTHLY_LIMIT", "");

    expect(monthlyRequestLimit()).toBe(200);
  });

  it("con la variable configurada, la usa", () => {
    vi.stubEnv("AI_WRITING_ASSIST_MONTHLY_LIMIT", "50");

    expect(monthlyRequestLimit()).toBe(50);
  });

  it("con un valor inválido, cae al valor por omisión: lib/env.ts ya lo rechazó al arrancar", () => {
    vi.stubEnv("AI_WRITING_ASSIST_MONTHLY_LIMIT", "no-numero");

    expect(monthlyRequestLimit()).toBe(200);
  });
});
