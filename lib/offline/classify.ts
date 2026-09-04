import type { SendOutcome } from "./types";

/**
 * Fallo transitorio y fallo definitivo se distinguen por la **forma** de la
 * respuesta, no por su contenido (design.md, decisión 8):
 *
 * - la promesa **rechaza** (red caída, servidor inalcanzable, tiempo agotado)
 *   → transitorio, se reintenta;
 * - la promesa **resuelve con `{ error }`** → definitivo. Es un rechazo del
 *   dominio, de los permisos o de la sesión, y reintentarlo daría el mismo
 *   rechazo para siempre.
 *
 * Es la convención que ya siguen todas las Server Actions del proyecto, así
 * que la clasificación no inventa nada: lee lo que las acciones ya devuelven.
 */

/** El texto exacto con el que las acciones anuncian una sesión terminada. */
const SESSION_ENDED = "Tu sesión terminó. Vuelve a entrar.";

function isErrorResult(value: unknown): value is { error: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as { error: unknown }).error === "string"
  );
}

export function classifyResolution(value: unknown): SendOutcome {
  if (!isErrorResult(value)) return { kind: "ok", result: value };

  // La sesión terminada es el caso incómodo: definitivo para este intento,
  // pero se cura solo con volver a entrar. No se reintenta a ciegas y la
  // bandeja lo dice con sus palabras.
  return {
    kind: "permanent",
    message: value.error,
    recoverable: value.error === SESSION_ENDED,
  };
}

export function classifyRejection(error: unknown): SendOutcome {
  const message =
    error instanceof Error ? error.message : "No se pudo conectar con el servidor.";

  return { kind: "transient", message };
}

export function classify(settled: PromiseSettledResult<unknown>): SendOutcome {
  return settled.status === "fulfilled"
    ? classifyResolution(settled.value)
    : classifyRejection(settled.reason);
}

export { SESSION_ENDED };
