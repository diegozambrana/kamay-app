"use client";

import { Badge } from "@/components/ui/badge";
import { lineColorClasses } from "@/lib/business-lines/colors";
import { dueSignal } from "@/lib/tasks/overdue";
import { cn } from "@/lib/utils";

import type { BoardTask } from "./board-view";

/**
 * Vista de lista: las mismas tareas, en una tabla densa.
 *
 * A diferencia del tablero, la lista **sí cruza todas las líneas**: no necesita
 * un juego único de columnas, así que con el filtro en «Todas» sigue siendo
 * útil. Por eso los estados llegan como un mapa completo del flujo y no como el
 * juego resuelto de una línea.
 */
export function ListView({
  tasks,
  statusNames,
  today,
  showLine,
}: {
  tasks: BoardTask[];
  /** `statusId → nombre`, de todos los estados del flujo. */
  statusNames: Map<string, string>;
  today: string;
  showLine: boolean;
}) {
  if (tasks.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No hay tareas que mostrar.
      </p>
    );
  }

  return (
    <ul data-testid="tasks-list" className="divide-y rounded-lg border">
      {tasks.map((task) => {
        const signal = dueSignal(task.dueDate, today, {
          closed: Boolean(task.closedAt),
        });

        return (
          <li
            key={task.id}
            data-testid="task-row"
            data-task-id={task.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm"
          >
            {showLine && (
              <span
                aria-hidden
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  lineColorClasses(task.lineColor).dot,
                )}
              />
            )}

            <span className="flex-1 min-w-40">{task.title}</span>

            <Badge variant="outline" className="text-[11px]">
              {statusNames.get(task.statusId) ?? "—"}
            </Badge>

            {task.tags.map((tag) => (
              <Badge key={tag.id} variant="secondary" className="text-[11px]">
                {tag.name}
              </Badge>
            ))}

            {task.assigneeName && (
              <span className="text-xs text-muted-foreground">
                {task.assigneeName}
              </span>
            )}

            {task.dueDate && (
              <span
                className={cn(
                  "text-xs tabular-nums",
                  signal === "overdue" && "text-destructive font-medium",
                  signal === "today" && "text-amber-700 dark:text-amber-300",
                  (signal === "later" || signal === "soon") && "text-muted-foreground",
                )}
              >
                {task.dueDate}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
