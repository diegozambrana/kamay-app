import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

/**
 * KAM-17 · La frontera del service role.
 *
 * Escenario del delta spec `notifications` — requisito "La generación
 * privilegiada se limita al trabajo programado y a la creación de avisos".
 *
 * Es la primera vez que el proyecto usa el cliente que se salta la RLS
 * (convención nº 2), y el riesgo real no es la línea que se escribió hoy: es
 * la que alguien escriba dentro de seis meses porque «era más rápido». Una
 * revisión no lo va a atrapar; esta prueba sí.
 */

/** Quién puede importar `lib/supabase/admin.ts`, y por qué. */
const ALLOWED = [
  // El trabajo programado: el disparo del cron, autorizado por secreto.
  "app/api/notifications/",
  // El único servicio que escribe notificaciones (design D5).
  "services/notifications/",
];

function importersOfAdminClient(): string[] {
  let output = "";
  try {
    output = execFileSync(
      "git",
      [
        "grep",
        // `--untracked` importa: un archivo recién creado y todavía sin
        // añadir es exactamente el que hay que atrapar, y sin esto la prueba
        // pasaría en vacío justo cuando más falta hace.
        "--untracked",
        "-l",
        "-E",
        // Solo importaciones reales. Mencionar la ruta en un comentario —como
        // hace `vitest.config.ts` al explicar su alias— no es importarla.
        'from ["\'][^"\']*supabase/admin["\']',
        "--",
        "*.ts",
        "*.tsx",
      ],
      { encoding: "utf8" },
    );
  } catch (error) {
    // `git grep` sale con 1 cuando no encuentra nada, que aquí es un
    // resultado válido y no un fallo.
    if ((error as { status?: number }).status === 1) return [];
    throw error;
  }

  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    // El propio módulo y esta prueba se nombran a sí mismos.
    .filter(
      (path) =>
        path !== "lib/supabase/admin.ts" &&
        !path.endsWith("service-role-boundary.test.ts"),
    );
}

describe("frontera del cliente con service role", () => {
  it("solo lo importan el trabajo programado y el generador de avisos", () => {
    const offenders = importersOfAdminClient().filter(
      (path) => !ALLOWED.some((prefix) => path.startsWith(prefix)),
    );

    expect(
      offenders,
      `Estos módulos importan el cliente que se salta la RLS y no deberían:\n` +
        `${offenders.join("\n")}\n\n` +
        `El service role solo va en trabajos programados y en la generación de ` +
        `notificaciones (convención nº 2). Si de verdad hace falta uno nuevo, ` +
        `añádelo a ALLOWED en esta prueba y explica por qué en la propuesta.`,
    ).toEqual([]);
  });

  it("nunca lo importa una rebanada de interfaz", () => {
    // El caso más grave: `features/` acaba en el bundle del navegador, y con
    // él la llave que se salta el aislamiento entre organizaciones.
    const inFeatures = importersOfAdminClient().filter(
      (path) =>
        path.startsWith("features/") ||
        path.startsWith("components/") ||
        path.startsWith("hooks/") ||
        path.startsWith("stores/"),
    );

    expect(inFeatures).toEqual([]);
  });

  it("ninguna Server Action lo importa directamente", () => {
    // Una acción disparada por una persona escribe con el cliente de sesión y
    // deja la creación del aviso al generador, que es quien tiene el
    // privilegio acotado a insertar en `notifications` (design D5).
    const inActions = importersOfAdminClient().filter((path) =>
      path.startsWith("actions/"),
    );

    expect(inActions).toEqual([]);
  });
});
