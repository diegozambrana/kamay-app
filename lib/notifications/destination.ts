import type { NotificationType } from "./types";

/**
 * A dónde lleva una notificación.
 *
 * `unavailable` no es un fallo: es un resultado. Un aviso cuya tarea se
 * archivó sigue siendo un hecho que ocurrió, y la bandeja tiene que poder
 * rendirlo diciendo que ya no está disponible en lugar de ofrecer un enlace
 * que abre una pantalla vacía.
 */
export type Destination =
  | { kind: "path"; path: string }
  | { kind: "unavailable" };

/**
 * Resuelve el destino de un aviso.
 *
 * El resumen diario no apunta a ningún registro —resume varios— y por eso
 * lleva a *Mis pendientes*, que es donde están todos juntos. Los demás llevan
 * al registro que los originó: «no a una pantalla genérica» es literalmente el
 * criterio de aceptación.
 *
 * @param available si el registro referido sigue disponible para quien mira.
 *   Lo decide quien consulta, no esta función: aquí no hay acceso a datos.
 */
export function destinationOf(
  notification: {
    type: NotificationType;
    entityType: string | null;
    entityId: string | null;
  },
  available = true,
): Destination {
  if (notification.type === "due_summary") {
    return { kind: "path", path: "/my-tasks" };
  }

  if (!notification.entityType || !notification.entityId || !available) {
    return { kind: "unavailable" };
  }

  switch (notification.entityType) {
    case "task":
      return { kind: "path", path: `/tasks/${notification.entityId}` };
    // El inventario llega con KAM-18. El destino se resuelve desde ya porque
    // el tipo ya existe en el catálogo y la bandeja tiene que saber rendirlo.
    case "item":
      return { kind: "path", path: `/catalog/${notification.entityId}` };
    default:
      return { kind: "unavailable" };
  }
}
