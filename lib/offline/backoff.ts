/**
 * Espera creciente entre reintentos (design.md, decisión 8).
 *
 * El desorden aleatorio no es cosmético: veinte teléfonos en la misma feria
 * recuperan la señal en el mismo segundo y, sin él, reintentarían todos a la
 * vez, una y otra vez, en los mismos instantes.
 */

export const BASE_DELAY_MS = 1_000;
export const MAX_DELAY_MS = 5 * 60 * 1_000;

/**
 * Tope de intentos. Convierte lo transitorio en definitivo para que una
 * entrada rota no reintente en silencio durante días — el criterio 6 del
 * backlog pide que la persona acabe viéndola.
 */
export const MAX_ATTEMPTS = 8;

/**
 * Espera antes del intento siguiente, en milisegundos.
 *
 * @param attempts intentos fallidos acumulados (1 tras el primer fallo).
 * @param random inyectable para poder probar el desorden.
 */
export function backoffDelay(attempts: number, random: () => number = Math.random): number {
  const exponent = Math.max(0, attempts - 1);
  const ceiling = Math.min(BASE_DELAY_MS * 2 ** exponent, MAX_DELAY_MS);

  // Desorden a la mitad alta: nunca reintenta antes de la mitad de la espera
  // calculada, para que el crecimiento siga siendo observable.
  return Math.round(ceiling * (0.5 + random() * 0.5));
}

/** Un fallo transitorio deja de serlo cuando se agotan los intentos. */
export function hasExhaustedAttempts(attempts: number): boolean {
  return attempts >= MAX_ATTEMPTS;
}
