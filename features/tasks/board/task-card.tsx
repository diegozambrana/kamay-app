"use client";

import { CalendarIcon, UserIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { lineColorClasses } from "@/lib/business-lines/colors";
import { dueSignal, type DueSignal } from "@/lib/tasks/overdue";
import { cn } from "@/lib/utils";
import type { LineColor, Tag } from "@/types";

export type TaskCardData = {
  id: string;
  title: string;
  /** Fecha límite en `YYYY-MM-DD`, o `null`. */
  dueDate: string | null;
  closedAt: string | null;
  assigneeName: string | null;
  tags: Tag[];
  lineName: string;
  lineColor: LineColor;
};

/** Cómo se pinta cada señal. `none` y `later` no gritan: no hay nada urgente. */
const SIGNAL_CLASSES: Record<DueSignal, string> = {
  none: "",
  later: "text-muted-foreground",
  soon: "text-amber-600 dark:text-amber-400",
  today: "text-amber-700 dark:text-amber-300 font-medium",
  overdue: "text-destructive font-medium",
};

const SIGNAL_LABELS: Record<DueSignal, string> = {
  none: "",
  later: "",
  soon: "Pronto",
  today: "Hoy",
  overdue: "Vencida",
};

/**
 * Tarjeta del tablero de tareas.
 *
 * El color de la línea solo aparece cuando el filtro está en «Todas»: con una
 * línea seleccionada todas las tarjetas serían del mismo color, y un color que
 * no distingue nada es ruido.
 */
export function TaskCard({
  task,
  today,
  showLine,
  onOpen,
}: {
  task: TaskCardData;
  today: string;
  /** El filtro de línea está en «Todas». */
  showLine: boolean;
  /**
   * Abrir el panel de edición.
   *
   * El manejador vive en la propia tarjeta y no en un `<button>` que la
   * envuelva: el contenedor que pinta el tablero ya lleva `role="button"` —se
   * lo pone dnd-kit para poder arrastrar con el teclado—, y meter un control
   * dentro de otro control es HTML inválido además de una trampa para el
   * puntero, que es de quien depende el arrastre.
   */
  onOpen?: () => void;
}) {
  const signal = dueSignal(task.dueDate, today, { closed: Boolean(task.closedAt) });
  const colors = lineColorClasses(task.lineColor);

  return (
    <article
      data-testid="task-card"
      data-task-id={task.id}
      data-due-signal={signal}
      onClick={onOpen}
      className="flex flex-col gap-2 rounded-lg border bg-card p-3 shadow-xs"
    >
      <div className="flex items-start gap-2">
        {showLine && (
          <span
            aria-hidden
            className={cn("mt-1 size-2 shrink-0 rounded-full", colors.dot)}
          />
        )}
        <h3 className="flex-1 text-sm leading-snug">{task.title}</h3>
      </div>

      {showLine && (
        <span className={cn("w-fit rounded px-1.5 py-0.5 text-[11px]", colors.badge)}>
          {task.lineName}
        </span>
      )}

      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <Badge key={tag.id} variant="secondary" className="text-[11px]">
              {tag.name}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-xs">
        {task.assigneeName && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <UserIcon className="size-3" aria-hidden />
            {task.assigneeName}
          </span>
        )}

        {/* Sin fecha no se pinta nada: una tarea sin fecha no está ni al día
            ni retrasada, y cualquier señal afirmaría algo que nadie declaró. */}
        {task.dueDate && (
          <span className={cn("flex items-center gap-1", SIGNAL_CLASSES[signal])}>
            <CalendarIcon className="size-3" aria-hidden />
            {task.dueDate}
            {SIGNAL_LABELS[signal] && (
              <span className="sr-only">{SIGNAL_LABELS[signal]}</span>
            )}
          </span>
        )}
      </div>
    </article>
  );
}
