import type { InventoryMovement } from "@/types";

/**
 * Cómo se lee un movimiento y en qué orden se listan.
 *
 * La sección *Movimientos* de V11 es la que resuelve el flujo F de la
 * especificación —«este número no cuadra»—, así que cada fila tiene que decir
 * de dónde salió sin obligar a nadie a interpretar un `source_type`.
 */

const KIND_LABELS: Record<InventoryMovement["kind"], string> = {
  in: "Entrada",
  out: "Consumo",
  adjustment: "Ajuste",
};

const SOURCE_SUFFIX: Record<string, string> = {
  expense_item: "por compra",
  order_item: "por pedido",
  count: "por conteo",
};

/**
 * El rótulo de un movimiento: «Entrada por compra», «Consumo», «Ajuste por
 * conteo».
 *
 * `manual` no añade sufijo: «Consumo manual» no dice nada que «Consumo» no
 * diga ya, y el origen humano es el caso normal, no la excepción que hay que
 * señalar.
 */
export function movementLabel(movement: InventoryMovement): string {
  const kind = KIND_LABELS[movement.kind];
  const suffix = movement.sourceType ? SOURCE_SUFFIX[movement.sourceType] : undefined;
  return suffix ? `${kind} ${suffix}` : kind;
}

/**
 * La cantidad con su signo explícito, que es lo que hace legible una columna
 * donde conviven entradas y salidas. El cero no existe en esta tabla.
 */
export function signedQuantity(movement: InventoryMovement): string {
  return movement.quantity > 0 ? `+${movement.quantity}` : String(movement.quantity);
}

/**
 * Del más reciente al más antiguo, **por la hora del hecho** y no por la de
 * registro: una compra anotada tarde no puede colarse arriba. Empate deshecho
 * por `createdAt`, que sí es del servidor y siempre avanza.
 */
export function sortByRecency(movements: InventoryMovement[]): InventoryMovement[] {
  return [...movements].sort((a, b) => {
    const byOccurrence = b.occurredAt.localeCompare(a.occurredAt);
    if (byOccurrence !== 0) return byOccurrence;
    return b.createdAt.localeCompare(a.createdAt);
  });
}
