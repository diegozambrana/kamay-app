"use client";

import { useTransition } from "react";

import { moveOrderToStatus, reorderQueue } from "@/actions/orders";
import { KanbanBoard, type KanbanColumn } from "@/components/board/kanban-board";
import { Badge } from "@/components/ui/badge";
import { queuePositions, sortByArrival } from "@/lib/orders/queue";
import { displayedPlacement, useBoardStore } from "@/stores/board-store";
import type { Status } from "@/types";

import { OrderCard, type OrderCardData } from "./order-card";

export type BoardOrder = OrderCardData & {
  statusId: string;
  queuedAt: string | null;
};

/**
 * V3 · Tablero. Las columnas son exactamente el juego de estados que la base
 * resolvió para la línea activa, en su orden declarado: aquí no hay ninguna
 * lista de estados ni ninguna rama por línea.
 *
 * La mecánica de arrastre vive en `components/board/kanban-board.tsx`, que
 * comparte con el tablero de tareas (KAM-15, design D6). Lo que se queda aquí
 * es lo que solo los pedidos tienen: la cola, su orden por llegada y su
 * numeración visible.
 */
export function BoardView({
  orders,
  statuses,
  today,
  onError,
}: {
  orders: BoardOrder[];
  statuses: Status[];
  today: string;
  onError: (message: string) => void;
}) {
  const [, startTransition] = useTransition();
  const pending = useBoardStore((state) => state.pending);
  const pendingQueue = useBoardStore((state) => state.pendingQueue);
  const move = useBoardStore((state) => state.move);
  const reorder = useBoardStore((state) => state.reorder);
  const settle = useBoardStore((state) => state.settle);
  const revert = useBoardStore((state) => state.revert);

  /** El pedido con su llegada en vuelo aplicada, si la tiene. */
  function withPendingQueue(order: BoardOrder): BoardOrder {
    return { ...order, queuedAt: pendingQueue[order.id] ?? order.queuedAt };
  }

  // Las posiciones visibles se derivan del orden de cada cola, así que hay que
  // calcularlas antes de rendir las tarjetas: mover uno renumera a todos sin
  // escribir una sola fila más (design.md D4 de KAM-07).
  const positions = new Map<string, number>();

  const columns: KanbanColumn<BoardOrder>[] = statuses.map((status) => {
    const inColumn = orders.filter(
      (order) => displayedPlacement(order, pending, pendingQueue).statusId === status.id,
    );

    // En una columna de cola manda la llegada, no la urgencia; en las demás,
    // la fecha comprometida es el orden natural de trabajo.
    const ordered = status.isQueue
      ? sortByArrival(inColumn.map(withPendingQueue))
      : [...inColumn].sort((a, b) =>
          (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"),
        );

    if (status.isQueue) {
      for (const [orderId, position] of queuePositions(ordered)) {
        positions.set(orderId, position);
      }
    }

    return {
      id: status.id,
      sortable: status.isQueue,
      items: ordered,
      attributes: {
        "data-testid": "board-column",
        "data-status-name": status.name,
        "data-is-queue": status.isQueue ? "1" : "0",
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
          Sin pedidos
        </p>
      ),
    };
  });

  function moveCard(orderId: string, statusId: string) {
    // La tarjeta se mueve ya; el servidor confirma después (design.md D6).
    move(orderId, statusId);

    startTransition(async () => {
      const result = await moveOrderToStatus({ orderId, statusId });
      if (result?.error) {
        revert(orderId);
        onError(result.error);
        return;
      }
      settle(orderId);
    });
  }

  function reorderCard(orderId: string, statusId: string, overOrderId: string) {
    const column = sortByArrival(
      orders
        .filter((o) => displayedPlacement(o, pending, pendingQueue).statusId === statusId)
        .map(withPendingQueue),
    );

    const targetIndex = column.findIndex((o) => o.id === overOrderId);
    if (targetIndex < 0) return;

    // Llegada optimista: la de la tarjeta desplazada, para que la posición
    // visible cambie antes de que el servidor calcule el punto medio real.
    const optimistic = column[targetIndex].queuedAt;
    if (optimistic) reorder(orderId, optimistic);

    startTransition(async () => {
      const result = await reorderQueue({ orderId, targetIndex });
      if (result?.error) {
        revert(orderId);
        onError(result.error);
        return;
      }
      settle(orderId);
    });
  }

  return (
    <KanbanBoard
      id="orders-board"
      testId="orders-board"
      columns={columns}
      onMove={moveCard}
      onReorder={reorderCard}
      renderCard={(order) => (
        <OrderCard order={order} today={today} position={positions.get(order.id)} />
      )}
      renderOverlay={(order) => <OrderCard order={order} today={today} />}
    />
  );
}
