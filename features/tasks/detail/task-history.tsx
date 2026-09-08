import { formatDateTime } from "@/lib/format/datetime";
import type { ActivityEntry } from "@/types";

const ACTION_LABELS: Record<ActivityEntry["action"], string> = {
  created: "Registrada",
  updated: "Editada",
  status_changed: "Cambió de estado",
  archived: "Archivada",
  unarchived: "Desarchivada",
};

export type TaskHistoryProps = {
  history: ActivityEntry[];
  timezone: string;
};

/**
 * El historial de la tarea (design D7).
 *
 * Un solo historial (convención nº 7): esto lee de `activity_log` a través del
 * servicio y de ninguna otra fuente. **No existe ninguna tabla de historial de
 * tareas**, y la manera de garantizarlo es no haber escrito ninguna.
 *
 * Para el ayudante llega vacío, porque RLS reserva la bitácora al dueño: el
 * bloque se rinde con su mensaje de lista sin contenido, no con un error.
 */
export function TaskHistory({ history, timezone }: TaskHistoryProps) {
  if (history.length === 0) {
    return (
      <p className="text-muted-foreground text-sm" data-testid="empty-history">
        No hay historial que mostrar.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-2 text-sm">
        {history.map((entry) => (
          <li
            key={entry.id}
            data-testid="history-entry"
            data-action={entry.action}
            className="flex flex-wrap items-baseline gap-2"
          >
            <span className="font-medium">{ACTION_LABELS[entry.action]}</span>
            <span className="text-muted-foreground">
              {formatDateTime(entry.occurredAt, timezone)}
            </span>
            {entry.actorLabel && (
              <span className="text-muted-foreground">· {entry.actorLabel}</span>
            )}
          </li>
        ))}
      </ol>

      {/* La bitácora completa filtrada por esta tarea llega con KAM-22 (V23).
          Se declara la salida y se dice por qué no está, en vez de dejar un
          enlace roto o de fingir que nunca existirá. */}
      <p className="text-muted-foreground text-xs" data-testid="activity-link-pending">
        Ver todo en la bitácora — llega con la pantalla de bitácora.
      </p>
    </div>
  );
}
