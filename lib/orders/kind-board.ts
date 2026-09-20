import type { Status, StatusKind } from "@/types";

/**
 * El tablero con «Todas» activa (design D5 de
 * `navigation-breadcrumbs-and-all-lines-board`).
 *
 * Cada línea tiene su propio juego de estados y no se corresponden entre sí,
 * así que con todas las líneas a la vista las columnas no pueden ser estados:
 * son los **tipos**, que son el contrato estable (convención nº 5). Los
 * títulos son fijos por tipo porque los nombres de estado son configurables y
 * no dicen nada fuera de su línea.
 */
export const KIND_COLUMNS: readonly { kind: StatusKind; label: string }[] = [
  { kind: "initial", label: "Por empezar" },
  { kind: "in_progress", label: "En curso" },
  { kind: "waiting", label: "En espera" },
  { kind: "final", label: "Terminados" },
  { kind: "cancelled", label: "Cancelados" },
];

/**
 * A qué estado va un pedido que se suelta en la columna de un tipo: el primero
 * de ese tipo, en el orden declarado, dentro del juego de **su** línea. `null`
 * si ese juego no tiene ninguno — la columna no acepta el pedido.
 */
export function targetStatusFor(
  lineStatuses: readonly Status[],
  kind: StatusKind,
): Status | null {
  let best: Status | null = null;
  for (const status of lineStatuses) {
    if (status.kind !== kind || status.archivedAt) continue;
    if (!best || status.position < best.position) best = status;
  }
  return best;
}
