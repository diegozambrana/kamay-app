"use client";

import { useTransition } from "react";

import { moveOrderToStatus, reorderQueue } from "@/actions/orders";
import { KanbanBoard, type KanbanColumn } from "@/components/board/kanban-board";
import { Badge } from "@/components/ui/badge";
import { KIND_COLUMNS, targetStatusFor } from "@/lib/orders/kind-board";
import { queuePositions, sortByArrival } from "@/lib/orders/queue";
import { displayedPlacement, useBoardStore } from "@/stores/board-store";
import type { Status, StatusKind } from "@/types";

import { OrderCard, type OrderCardData } from "./order-card";

export type BoardOrder = OrderCardData & {
  statusId: string;
  queuedAt: string | null;
  /** Con «Todas» activa decide a qué juego de estados va el pedido al moverlo. */
  businessLineId: string;
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
  groupBy = "status",
  allStatuses = [],
  statusesByLine = {},
}: {
  orders: BoardOrder[];
  statuses: Status[];
  today: string;
  onError: (message: string) => void;
  /**
   * `status`: una columna por estado del juego de la línea activa.
   * `kind`: con «Todas», una columna por tipo de estado (design D5).
   */
  groupBy?: "status" | "kind";
  /** Todos los estados del flujo: nombre y tipo del estado de cada tarjeta. */
  allStatuses?: Status[];
  /** El juego resuelto de cada línea activa: el destino de cada movimiento. */
  statusesByLine?: Record<string, Status[]>;
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
      label: status.name,
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

  if (groupBy === "kind") {
    return (
      <KindBoard
        orders={orders}
        today={today}
        allStatuses={allStatuses}
        statusesByLine={statusesByLine}
        moveCard={moveCard}
      />
    );
  }

  return (
    <KanbanBoard
      id="orders-board"
      testId="orders-board"
      columns={columns}
      onMove={moveCard}
      onReorder={reorderCard}
      itemLabel={(order) => `Pedido #${order.code}`}
      renderCard={(order) => (
        <OrderCard order={order} today={today} position={positions.get(order.id)} />
      )}
      renderOverlay={(order) => <OrderCard order={order} today={today} />}
    />
  );
}

/**
 * El tablero con «Todas» activa: una columna por tipo de estado, con pedidos
 * de todas las líneas (design D5). Sin colas: su orden es por línea y aquí
 * conviven varias, así que no se numeran ni se reordenan.
 *
 * Soltar en una columna lleva el pedido al primer estado de ese tipo en el
 * juego de su línea; si su línea no tiene ninguno, la columna no lo acepta.
 * El movimiento en sí —optimista, con reversión y bitácora— es el mismo de
 * siempre.
 */
function KindBoard({
  orders,
  today,
  allStatuses,
  statusesByLine,
  moveCard,
}: {
  orders: BoardOrder[];
  today: string;
  allStatuses: Status[];
  statusesByLine: Record<string, Status[]>;
  moveCard: (orderId: string, statusId: string) => void;
}) {
  const pending = useBoardStore((state) => state.pending);
  const pendingQueue = useBoardStore((state) => state.pendingQueue);
  const statusById = new Map(allStatuses.map((status) => [status.id, status]));

  /** El estado que se muestra: el del servidor o el movimiento en vuelo. */
  function shownStatus(order: BoardOrder): Status | undefined {
    return statusById.get(displayedPlacement(order, pending, pendingQueue).statusId);
  }

  function kindOf(order: BoardOrder): StatusKind {
    return shownStatus(order)?.kind ?? order.statusKind;
  }

  function target(order: BoardOrder, kind: string): Status | null {
    return targetStatusFor(statusesByLine[order.businessLineId] ?? [], kind as StatusKind);
  }

  const columns: KanbanColumn<BoardOrder>[] = KIND_COLUMNS.map(({ kind, label }) => {
    const items = orders
      .filter((order) => kindOf(order) === kind)
      .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));

    return {
      id: kind,
      label,
      items,
      attributes: {
        "data-testid": "board-column",
        "data-status-name": label,
        "data-kind": kind,
        "data-is-queue": "0",
      },
      header: (
        <>
          <h2 className="text-sm font-medium">{label}</h2>
          <Badge variant="secondary" className="tabular-nums">
            {items.length}
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

  function moveToKind(orderId: string, kind: string) {
    const order = orders.find((candidate) => candidate.id === orderId);
    if (!order || kindOf(order) === kind) return;
    const destination = target(order, kind);
    if (destination) moveCard(orderId, destination.id);
  }

  return (
    <KanbanBoard
      id="orders-board-by-kind"
      testId="orders-board"
      columns={columns}
      onMove={moveToKind}
      canMoveTo={(order, kind) => target(order, kind) !== null}
      itemLabel={(order) => `Pedido #${order.code}`}
      renderCard={(order) => (
        <OrderCard order={order} today={today} statusName={shownStatus(order)?.name} />
      )}
      renderOverlay={(order) => (
        <OrderCard order={order} today={today} statusName={shownStatus(order)?.name} />
      )}
    />
  );
}
