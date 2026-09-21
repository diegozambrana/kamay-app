import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

/**
 * KAM-30 · La frontera de la credencial de IA.
 *
 * Mismo patrón que `services/notifications/service-role-boundary.test.ts`
 * para el cliente de service role: el SDK de Anthropic construye con la
 * credencial en `lib/ai/anthropic.ts`, guardado con `import "server-only"`
 * para que `next build` se niegue a empaquetarlo en el cliente — esta prueba
 * es la que atrapa el día en que alguien lo importe de todos modos desde una
 * rebanada de interfaz, antes de que el build lo haga.
 */

function importersOf(specifier: string): string[] {
  let output = "";
  try {
    output = execFileSync(
      "git",
      [
        "grep",
        "--untracked",
        "-l",
        "-E",
        `from ["'][^"']*${specifier}["']`,
        "--",
        "*.ts",
        "*.tsx",
      ],
      { encoding: "utf8" },
    );
  } catch (error) {
    if ((error as { status?: number }).status === 1) return [];
    throw error;
  }

  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((path) => !path.endsWith("client-boundary.test.ts"));
}

describe("frontera del cliente con la credencial de IA", () => {
  it("nada fuera de lib/ai importa el SDK de Anthropic directamente", () => {
    const offenders = importersOf("@anthropic-ai/sdk").filter(
      (path) => path !== "lib/ai/anthropic.ts",
    );

    expect(
      offenders,
      `Estos módulos importan el SDK de Anthropic directamente y no deberían — ` +
        `pasan por lib/ai/port.ts:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("ninguna rebanada de interfaz importa el adaptador real", () => {
    const inClientCode = importersOf("lib/ai/anthropic").filter(
      (path) =>
        path.startsWith("features/") ||
        path.startsWith("components/") ||
        path.startsWith("hooks/") ||
        path.startsWith("stores/"),
    );

    expect(inClientCode).toEqual([]);
  });
});
