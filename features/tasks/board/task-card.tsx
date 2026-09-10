"use client";

import { CalendarIcon, LinkIcon, PackageIcon, UserIcon } from "lucide-react";
import { useRef } from "react";

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
  /** Cuántos vínculos tiene. Solo importa si hay o no hay (KAM-21). */
  linkCount: number;
  /** Cuántos entregables declarados tiene (KAM-21). */
  deliverableCount: number;
  /** Cuántos quedan sin cumplir: es lo que abre el asistente al cerrar. */
  pendingDeliverableCount: number;
  /** Se cerró sin crear nada de lo que había declarado (KAM-21). */
  closedWithoutDeliverables: boolean;
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
/**
 * Cuánto puede temblar el puntero entre pulsar y soltar sin que deje de ser un
 * clic, en píxeles. Por encima de eso fue un arrastre y la tarjeta no navega.
 *
 * Coincide con el umbral con el que dnd-kit arranca el arrastre: por debajo no
 * hubo movimiento que nadie pudiera pretender.
 */
const DRAG_SLOP = 6;

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
   * Abrir el detalle de la tarea (V18).
   *
   * El manejador vive en la propia tarjeta y no en un `<button>` que la
   * envuelva: el contenedor que pinta el tablero ya lleva `role="button"` —se
   * lo pone dnd-kit para poder arrastrar con el teclado—, y meter un control
   * dentro de otro control es HTML inválido además de una trampa para el
   * puntero, que es de quien depende el arrastre.
   *
   * **Solo se invoca si el puntero no se movió**: ver `DRAG_SLOP`.
   */
  onOpen?: () => void;
}) {
  const signal = dueSignal(task.dueDate, today, { closed: Boolean(task.closedAt) });
  const colors = lineColorClasses(task.lineColor);

  // Dónde empezó el gesto, para distinguir un clic de un arrastre.
  const origin = useRef<{ x: number; y: number } | null>(null);

  return (
    <article
      data-testid="task-card"
      data-task-id={task.id}
      data-due-signal={signal}
      onPointerDown={(event) => {
        origin.current = { x: event.clientX, y: event.clientY };
      }}
      onClick={(event) => {
        // Soltar una tarjeta arrastrada también dispara un clic. Antes eso
        // abría un panel encima del tablero y se cerraba solo; ahora navega a
        // otra pantalla, así que un arrastre acabaría sacando a la persona del
        // tablero a mitad de gesto.
        const start = origin.current;
        origin.current = null;
        if (start) {
          const recorrido = Math.hypot(
            event.clientX - start.x,
            event.clientY - start.y,
          );
          if (recorrido > DRAG_SLOP) return;
        }
        onOpen?.();
      }}
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

        {/* Íconos, no recuentos: en una tarjeta lo que importa es si hay algo
            que mirar dentro, no cuántas cosas (KAM-21). */}
        {task.linkCount > 0 && (
          <span
            className="text-muted-foreground flex items-center gap-1"
            data-testid="card-links"
          >
            <LinkIcon className="size-3" aria-hidden />
            <span className="sr-only">Tiene vínculos</span>
          </span>
        )}

        {task.deliverableCount > 0 && (
          <span
            className="text-muted-foreground flex items-center gap-1"
            data-testid="card-deliverables"
          >
            <PackageIcon className="size-3" aria-hidden />
            <span className="sr-only">Tiene entregables</span>
          </span>
        )}

        {/* Discreta: es una nota al margen, no una alerta. Cerrar sin crear
            nada es una salida legítima que nadie tiene que justificar. */}
        {task.closedWithoutDeliverables && (
          <span
            className="text-muted-foreground text-[11px]"
            data-testid="card-closed-without-deliverables"
          >
            Sin entregables
          </span>
        )}
      </div>
    </article>
  );
}
