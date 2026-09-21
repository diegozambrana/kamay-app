import "server-only";

/** Sin `AI_WRITING_ASSIST_MONTHLY_LIMIT`, un valor con margen de sobra. */
const DEFAULT_MONTHLY_LIMIT = 200;

/**
 * Cuántas solicitudes puede hacer una organización por mes calendario.
 *
 * `lib/env.ts` ya rechaza un valor mal formado al arrancar; aquí solo falta
 * el valor por omisión cuando la variable está ausente (design.md → "Límite:
 * un valor global, no por organización").
 */
export function monthlyRequestLimit(): number {
  const raw = process.env.AI_WRITING_ASSIST_MONTHLY_LIMIT?.trim();
  if (!raw) return DEFAULT_MONTHLY_LIMIT;

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MONTHLY_LIMIT;
}
