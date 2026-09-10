import Link from "next/link";

import { formatDate } from "@/lib/format/datetime";
import type { RelatedTask } from "@/services/tasks/task-service";

export type RelatedTasksProps = {
  tasks: RelatedTask[];
  timezone: string;
};

/**
 * El bloque *Tareas relacionadas*, uno solo para las cuatro pantallas que lo
 * muestran: pedido (V4), ítem (V11), activo (V12) y contacto (V13).
 *
 * Cuatro bloques casi iguales es cómo tres de ellos se quedan atrás cuando el
 * cuarto cambia (design D4).
 *
 * **Aquí no se filtra por rol ni por línea.** Lo hace RLS sobre `tasks`, y
 * `task_links` hereda de ella: al ayudante le llegan menos filas, no un error.
 * Repetir esa condición en TypeScript sería el segundo sitio donde
 * desincronizarse.
 */
export function RelatedTasks({ tasks, timezone }: RelatedTasksProps) {
  if (tasks.length === 0) {
    return (
      <p
        className="text-muted-foreground text-sm"
        data-testid="empty-related-tasks"
      >
        Ninguna tarea apunta a este registro.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2" data-testid="related-tasks">
      {tasks.map((task) => (
        <li key={task.id}>
          <Link
            href={`/tasks/${task.id}`}
            className="hover:bg-muted/50 flex flex-col gap-0.5 rounded-md border px-3 py-2 text-sm"
          >
            <span className="font-medium">{task.title}</span>
            <span className="text-muted-foreground flex flex-wrap gap-x-2 text-xs">
              {task.statusName !== null && <span>{task.statusName}</span>}
              {task.dueAt !== null && (
                <span>Para el {formatDate(task.dueAt, timezone)}</span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
