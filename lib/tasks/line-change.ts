import { targetStatusFor } from "@/lib/orders/kind-board";
import type { Status } from "@/types";

/**
 * A qué estado va una tarea que cambia de línea (spec `tasks`, design D4).
 *
 * `assign_initial_task_status` es un trigger `before insert`: gobierna el alta
 * y nada más. Sin esto, cambiar la línea en un `update` deja la tarea con el
 * `status_id` del juego de la línea vieja, y la tarea desaparece del tablero de
 * su línea nueva porque ninguna columna la reclama.
 *
 * La correspondencia es por **tipo**, jamás por nombre (convención nº 5), con
 * la misma función que decide a qué estado cae un pedido soltado en una columna
 * de tipo en el tablero con «Todas»: es literalmente la misma pregunta.
 */
export type Retarget =
  /** El estado cambia: hay que escribirlo junto con la línea. */
  | { kind: "moved"; status: Status }
  /** El estado actual ya sirve en la línea nueva: no se toca. */
  | { kind: "kept" }
  /** La línea nueva no tiene ningún estado de ese tipo: no se escribe nada. */
  | { kind: "impossible" };

export function retargetStatusForLine(
  current: Status,
  destinationStatuses: readonly Status[],
): Retarget {
  // El juego de la línea nueva puede ser el mismo —ambas líneas sin juego
  // propio caen en el de la organización—. Reescribir el estado por el mismo
  // valor ensuciaría la bitácora con un cambio que no ocurrió.
  if (destinationStatuses.some((status) => status.id === current.id)) {
    return { kind: "kept" };
  }

  const target = targetStatusFor(destinationStatuses, current.kind);
  return target ? { kind: "moved", status: target } : { kind: "impossible" };
}
