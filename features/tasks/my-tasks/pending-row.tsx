"use client";

import { CheckIcon, ClockIcon } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LineColor } from "@/types";

export type PendingTask = {
  id: string;
  title: string;
  dueDate: string | null;
  lineName: string;
  lineColor: LineColor;
  statusId: string;
  /** Marcada hecha en esta sesión de pantalla: se tacha, no desaparece. */
  done?: boolean;
};

/**
 * Cuántos píxeles hay que arrastrar para que el gesto cuente.
 *
 * Ochenta: menos convertiría en aplazamiento cualquier desplazamiento
 * horizontal accidental mientras se recorre la lista con el pulgar.
 */
const SWIPE_THRESHOLD = 80;

/**
 * Una fila de *Mis pendientes*.
 *
 * El gesto de deslizar existe **además** de los botones, nunca en su lugar: un
 * gesto invisible e inalcanzable con el teclado dejaría fuera a quien no
 * arrastra. El criterio pide que posponer sea *un solo gesto*, no que sea el
 * único camino.
 */
export function PendingRow({
  task,
  onComplete,
  onUncomplete,
  onPostpone,
  onReschedule,
}: {
  task: PendingTask;
  onComplete: (task: PendingTask) => void;
  onUncomplete: (task: PendingTask) => void;
  onPostpone: (task: PendingTask) => void;
  onReschedule: (task: PendingTask, dueDate: string) => void;
}) {
  const [offset, setOffset] = useState(0);
  const startX = useRef<number | null>(null);

  function onTouchStart(event: React.TouchEvent) {
    startX.current = event.touches[0]?.clientX ?? null;
  }

  function onTouchMove(event: React.TouchEvent) {
    if (startX.current === null) return;
    const delta = (event.touches[0]?.clientX ?? 0) - startX.current;
    // Solo hacia la izquierda: deslizar a la derecha no significa nada aquí y
    // arrastrar la fila fuera de su sitio confundiría más que ayudar.
    setOffset(Math.min(0, delta));
  }

  function onTouchEnd() {
    if (offset <= -SWIPE_THRESHOLD) onPostpone(task);
    setOffset(0);
    startX.current = null;
  }

  return (
    <li
      data-testid={`pending-${task.id}`}
      data-done={task.done ? "true" : undefined}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={offset ? { transform: `translateX(${offset}px)` } : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md border px-3 py-2",
        task.done && "opacity-60",
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        aria-label={
          task.done ? `Deshacer «${task.title}»` : `Marcar hecha «${task.title}»`
        }
        aria-pressed={Boolean(task.done)}
        onClick={() => (task.done ? onUncomplete(task) : onComplete(task))}
      >
        <CheckIcon
          className={cn("size-4", task.done && "text-primary")}
          aria-hidden
        />
      </Button>

      <div className="min-w-0 flex-1">
        <Link
          href={`/tasks/${task.id}`}
          className={cn(
            "block truncate text-sm hover:underline",
            // Tachada en su sitio: hacerla desaparecer al instante deja a
            // quien la marcó sin saber si acertó de fila.
            task.done && "line-through",
          )}
        >
          {task.title}
        </Link>
        <div className="flex items-center gap-2">
          {/* La línea va en cada fila porque esta pantalla no tiene selector
              de línea que lo diga. */}
          <Badge variant="outline" className="text-[0.625rem]">
            {task.lineName}
          </Badge>
          {task.dueDate && (
            <span className="text-xs text-muted-foreground">{task.dueDate}</span>
          )}
        </div>
      </div>

      {/* Reprogramar a una fecha elegida, sin salir de la pantalla. */}
      <input
        type="date"
        aria-label={`Reprogramar «${task.title}»`}
        value={task.dueDate ?? ""}
        onChange={(event) =>
          event.target.value && onReschedule(task, event.target.value)
        }
        className="h-7 w-32 shrink-0 rounded-md border bg-transparent px-1 text-xs"
      />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        aria-label={`Posponer «${task.title}» a mañana`}
        onClick={() => onPostpone(task)}
      >
        <ClockIcon className="size-4" aria-hidden />
      </Button>
    </li>
  );
}
