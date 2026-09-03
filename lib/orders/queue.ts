/**
 * La cola: posiciones derivadas y reordenamiento.
 *
 * La posición visible (1, 2, 3…) **no se almacena** (convención nº 4): es el
 * índice en el orden por `queuedAt`. Por eso mover un pedido renumera al
 * resto sin escribir una sola fila más — la garantía sale de la derivación,
 * no de mantener N filas consistentes.
 */

/** Lo mínimo que hace falta para ordenar una cola. */
export type Queueable = {
  id: string;
  /** Momento de entrada a la cola, ISO 8601. */
  queuedAt: string | null;
  /** Desempate estable cuando dos llegadas coinciden al microsegundo. */
  code: number;
};

/**
 * Ordena por llegada, no por urgencia: el criterio de la cola es la
 * antigüedad. `code` desempata para que el orden sea determinista.
 */
export function sortByArrival<T extends Queueable>(orders: readonly T[]): T[] {
  return [...orders].sort((a, b) => {
    const left = a.queuedAt ?? "";
    const right = b.queuedAt ?? "";
    if (left !== right) return left < right ? -1 : 1;
    return a.code - b.code;
  });
}

/** La posición visible de cada pedido de la cola, empezando en 1. */
export function queuePositions<T extends Queueable>(
  orders: readonly T[],
): Map<string, number> {
  const positions = new Map<string, number>();
  sortByArrival(orders).forEach((order, index) => {
    positions.set(order.id, index + 1);
  });
  return positions;
}

/**
 * `timestamptz` guarda microsegundos, pero las cadenas ISO que viajan entre
 * el cliente y PostgREST solo llevan milisegundos: esa es la resolución real
 * con la que se puede colocar una tarjeta. Hacen falta al menos dos de
 * separación para que quepa un valor estrictamente entre las vecinas.
 */
const MIN_GAP_MS = 2;

export type Midpoint =
  | { kind: "ok"; queuedAt: string }
  /**
   * Las vecinas están tan juntas que no cabe un valor entre ellas. Quien
   * llame debe reespaciar la columna y reintentar (design.md D4).
   */
  | { kind: "needs_renormalization" };

/**
 * El instante que coloca un pedido entre sus dos vecinas.
 *
 * `before` nulo = va al principio; `after` nulo = va al final. Una cola vacía
 * no llama aquí.
 */
export function midpoint(
  before: string | null,
  after: string | null,
  now: Date = new Date(),
): Midpoint {
  if (!before && !after) {
    return { kind: "ok", queuedAt: now.toISOString() };
  }

  if (!before) {
    // Al frente: un segundo antes de quien hoy es primero.
    return { kind: "ok", queuedAt: new Date(Date.parse(after!) - 1000).toISOString() };
  }

  if (!after) {
    // Al final: un segundo después de quien hoy es último.
    return { kind: "ok", queuedAt: new Date(Date.parse(before) + 1000).toISOString() };
  }

  const left = Date.parse(before);
  const right = Date.parse(after);

  if (right - left < MIN_GAP_MS) {
    return { kind: "needs_renormalization" };
  }

  // `Math.floor` porque `new Date()` trunca a milisegundos de todos modos:
  // mejor calcular el valor exacto que se va a escribir.
  return { kind: "ok", queuedAt: new Date(Math.floor((left + right) / 2)).toISOString() };
}

/**
 * Reparte llegadas espaciadas un segundo sobre el orden dado. Es la salida
 * cuando el punto medio ya no cabe: se reescribe la columna entera una vez y
 * el problema desaparece por mucho tiempo.
 */
export function renormalize(
  orderedIds: readonly string[],
  start: Date = new Date(),
): Map<string, string> {
  const base = start.getTime() - orderedIds.length * 1000;
  const result = new Map<string, string>();
  orderedIds.forEach((id, index) => {
    result.set(id, new Date(base + index * 1000).toISOString());
  });
  return result;
}

/**
 * El orden resultante de mover `movedId` a la posición `targetIndex`
 * (base 0) dentro de la cola. Sirve para calcular vecinas antes de escribir.
 */
export function reorderedIds(
  orderedIds: readonly string[],
  movedId: string,
  targetIndex: number,
): string[] {
  const without = orderedIds.filter((id) => id !== movedId);
  const clamped = Math.max(0, Math.min(targetIndex, without.length));
  return [...without.slice(0, clamped), movedId, ...without.slice(clamped)];
}
