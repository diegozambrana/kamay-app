"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { moveTaskToStatus } from "@/actions/tasks";
import { KanbanBoard, type KanbanColumn } from "@/components/board/kanban-board";
import { opensClosingWizard } from "@/lib/tasks/deliverables";
import { Badge } from "@/components/ui/badge";
import { displayedPlacement, useBoardStore } from "@/stores/board-store";
import type { Status } from "@/types";

import { QuickAdd } from "./quick-add";
import { TaskCard, type TaskCardData } from "./task-card";

export type BoardTask = TaskCardData & { statusId: string };

/**
 * V17 · Tablero de tareas. Las columnas son el juego de estados que la base
 * resolvió para la línea activa, en su orden declarado.
 *
 * Comparte el cascarón de arrastre con el tablero de pedidos
 * (`components/board/kanban-board.tsx`), pero **no la cola**: ninguna columna
 * de tareas numera por llegada, así que no se pasa `onReorder` y soltar una
 * tarjeta sobre otra dentro de la misma columna no hace nada.
 *
 * Retroceder no lleva ninguna rama: es el mismo `moveTaskToStatus` que avanzar.
 * Que volver de *En revisión* a *Por hacer* no pida confirmación ni tenga
 * efectos secundarios no es una decisión que se tome aquí — es que no hay
 * ningún sitio donde tomarla.
 */
export function BoardView({
  tasks,
  statuses,
  today,
  showLine,
  quickAddLineId,
  onError,
}: {
  tasks: BoardTask[];
  statuses: Status[];
  today: string;
  showLine: boolean;
  /** La línea que usará el alta rápida, o `null` si hay que pedirla. */
  quickAddLineId: string | null;
  onError: (message: string) => void;
}) {
  const [, startTransition] = useTransition();
  const router = useRouter();
  const pending = useBoardStore((state) => state.pending);
  const pendingQueue = useBoardStore((state) => state.pendingQueue);
  const move = useBoardStore((state) => state.move);
  const settle = useBoardStore((state) => state.settle);
  const revert = useBoardStore((state) => state.revert);

  const initialStatusId = statuses.find((status) => status.kind === "initial")?.id;

  const columns: KanbanColumn<BoardTask>[] = statuses.map((status) => {
    const inColumn = tasks.filter(
      (task) =>
        displayedPlacement({ ...task, queuedAt: null }, pending, pendingQueue)
          .statusId === status.id,
    );

    // La fecha límite es el orden natural del trabajo propio; las que no la
    // tienen van al final, no al principio.
    const ordered = [...inColumn].sort((a, b) =>
      (a.dueDate ?? "9999-99-99").localeCompare(b.dueDate ?? "9999-99-99"),
    );

    return {
      id: status.id,
      items: ordered,
      attributes: {
        "data-testid": "task-column",
        "data-status-name": status.name,
        "data-status-kind": status.kind,
      },
      header: (
        <>
          <h2 className="text-sm font-medium">{status.name}</h2>
          <Badge variant="secondary" className="tabular-nums">
            {ordered.length}
          </Badge>
        </>
      ),
      empty: (
        <p className="px-1 py-6 text-center text-xs text-muted-foreground">
          Sin tareas
        </p>
      ),
    };
  });

  function moveCard(taskId: string, statusId: string) {
    /**
     * Soltar en una columna de tipo `final` con entregables sin cumplir no
     * cierra la tarea: abre el asistente (design D7).
     *
     * El asistente vive en el detalle y no aquí porque necesita el cuerpo de
     * la tarea, sus adjuntos, los proveedores, las categorías y los insumos —
     * datos que el tablero no carga y que preacargar por tarjeta sería
     * absurdo—. Se navega con el estado destino en la dirección y el diálogo
     * abre allí. **El movimiento no se envía**: si se cancela, la tarea sigue
     * donde estaba, que es lo que el requisito promete.
     */
    const task = tasks.find((candidate) => candidate.id === taskId);
    const destination = statuses.find((status) => status.id === statusId);

    if (
      task &&
      destination &&
      opensClosingWizard(destination.kind, task.pendingDeliverableCount)
    ) {
      router.push(`/tasks/${taskId}?close=${statusId}`);
      return;
    }

    // La tarjeta se mueve ya; el servidor confirma después.
    move(taskId, statusId);

    startTransition(async () => {
      const result = await moveTaskToStatus({ taskId, statusId });
      if (result?.error) {
        revert(taskId);
        onError(result.error);
        return;
      }
      settle(taskId);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* El alta rápida vive sobre la columna inicial, que es donde la tarea
          va a aparecer: abrir, escribir, confirmar. */}
      {initialStatusId && (
        <QuickAdd businessLineId={quickAddLineId} onError={onError} />
      )}

      <KanbanBoard
        id="tasks-board"
        testId="tasks-board"
        columns={columns}
        onMove={moveCard}
        renderCard={(task) => (
          <TaskCard
            task={task}
            today={today}
            showLine={showLine}
            // Activar una tarjeta abre V18. KAM-15 editaba responsable, fecha
            // y etiquetas en un panel provisional y dejó dicho que al llegar
            // KAM-16 «sustituir este panel es cambiar a dónde apunta la
            // tarjeta»: esto es ese cambio.
            onOpen={() => router.push(`/tasks/${task.id}`)}
          />
        )}
        renderOverlay={(task) => (
          <TaskCard task={task} today={today} showLine={showLine} />
        )}
      />

    </div>
  );
}
