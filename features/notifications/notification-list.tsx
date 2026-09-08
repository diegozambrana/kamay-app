"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format/datetime";
import { destinationOf } from "@/lib/notifications/destination";
import type { NotificationType } from "@/lib/notifications/types";
import { cn } from "@/lib/utils";
import type { Notification, NotificationGroup } from "@/types";

/**
 * Los rótulos de cada grupo de la bandeja.
 *
 * `stock_below_min` está aquí aunque nada lo genere todavía: el tipo existe en
 * el catálogo desde la migración de KAM-17 y la bandeja tiene que saber
 * rendirlo el día que KAM-18 lo encienda, sin que haga falta volver aquí.
 */
const GROUP_LABELS: Record<NotificationType, string> = {
  due_summary: "Resumen del día",
  task_assigned: "Tareas asignadas",
  task_review: "En revisión",
  task_overdue: "Vencidas",
  task_stalled: "Sin movimiento",
  stock_below_min: "Insumos bajo mínimo",
};

export type NotificationListProps = {
  groups: NotificationGroup[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  timezone: string;
  /** Qué registros siguen disponibles. Lo que no esté aquí se declara así. */
  available?: Set<string>;
};

/**
 * V21 · La bandeja.
 *
 * **No agrupa nada por sí misma.** La agrupación anti-ruido —un resumen por
 * persona y día en vez de cinco avisos— ya la hizo el generador, y aquí solo
 * se ponen encabezados por tipo. Esa separación es lo que permite comprobar el
 * criterio nº 1 del backlog sin mirar ninguna pantalla, y lo que haría que
 * siguiera cumpliéndose si esta lista cambiara de forma (design D10).
 */
export function NotificationList({
  groups,
  onMarkRead,
  onMarkAllRead,
  timezone,
  available,
}: NotificationListProps) {
  const hasUnread = groups.some((group) =>
    group.notifications.some((notification) => !notification.readAt),
  );

  if (groups.length === 0) {
    return (
      <p
        data-testid="notifications-empty"
        className="px-4 text-sm text-muted-foreground"
      >
        No tienes avisos.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
      {hasUnread && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-end"
          onClick={onMarkAllRead}
        >
          Marcar todas como leídas
        </Button>
      )}

      {groups.map((group) => (
        <section key={group.type} data-testid={`notification-group-${group.type}`}>
          <h3 className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {GROUP_LABELS[group.type]}
          </h3>
          <ul className="flex flex-col gap-1">
            {group.notifications.map((notification) => (
              <li key={notification.id}>
                <NotificationRow
                  notification={notification}
                  onMarkRead={onMarkRead}
                  timezone={timezone}
                  available={
                    !notification.entityId ||
                    !available ||
                    available.has(notification.entityId)
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function NotificationRow({
  notification,
  onMarkRead,
  timezone,
  available,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
  timezone: string;
  available: boolean;
}) {
  const destination = destinationOf(notification, available);
  const unread = !notification.readAt;

  const body = (
    <>
      <span className={cn("text-sm", unread && "font-medium")}>
        {notification.title}
      </span>
      {notification.body && (
        <span className="block text-xs text-muted-foreground">
          {notification.body}
        </span>
      )}
      <span className="block text-xs text-muted-foreground">
        {formatDateTime(notification.createdAt, timezone)}
      </span>
    </>
  );

  const className = cn(
    "block rounded-md px-2 py-2",
    // Las no leídas destacadas: es lo que hace que la bandeja se pueda barrer
    // de un vistazo en vez de leerla entera.
    unread && "bg-accent/50",
  );

  if (destination.kind !== "path") {
    return (
      <div data-testid={`notification-${notification.id}`} className={className}>
        {body}
        {/* Un aviso cuyo registro ya no está no ofrece un enlace roto: lo
            declara. El aviso sigue siendo un hecho que ocurrió. */}
        <span className="block text-xs text-muted-foreground italic">
          Ya no está disponible.
        </span>
      </div>
    );
  }

  return (
    <Link
      href={destination.path}
      data-testid={`notification-${notification.id}`}
      className={cn(className, "hover:bg-accent")}
      // Abrirla es haberla visto: obligar además a marcarla sería pedir dos
      // gestos para una sola intención.
      onClick={() => unread && onMarkRead(notification.id)}
    >
      {body}
    </Link>
  );
}
