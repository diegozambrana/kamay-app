"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useRef, useState, useTransition } from "react";

import { moveOrderToStatus, reorderQueue } from "@/actions/orders";
import { Badge } from "@/components/ui/badge";
import { displayedPlacement, useBoardStore } from "@/features/orders/board-store";
import { queuePositions, sortByArrival } from "@/lib/orders/queue";
import { cn } from "@/lib/utils";
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

  // El pedido que se está arrastrando ahora mismo, para pintarlo en el
  // `DragOverlay` (design.md: la animación tiene que verse igual cuando el
  // arrastre cruza de una columna a otra).
  const [activeOrder, setActiveOrder] = useState<BoardOrder | null>(null);

  // Un arrastre solo empieza tras unos píxeles: si no, tocar una tarjeta en
  // el móvil nunca abriría su detalle.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  /** Dónde está ahora mismo cada pedido, contando los movimientos en vuelo. */
  function currentStatusOf(orderId: string): string | null {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return null;
    return displayedPlacement(order, pending, pendingQueue).statusId;
  }

  function onDragStart(event: DragStartEvent) {
    const orderId = String(event.active.id);
    setActiveOrder(orders.find((order) => order.id === orderId) ?? null);
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveOrder(null);

    const orderId = String(event.active.id);
    if (!event.over) return;

    const overId = String(event.over.id);
    const from = currentStatusOf(orderId);
    if (!from) return;

    // Se puede soltar sobre una columna o sobre otra tarjeta. En el segundo
    // caso el destino es la columna de esa tarjeta, y la posición importa
    // cuando es una cola.
    const overIsColumn = statuses.some((status) => status.id === overId);
    const to = overIsColumn ? overId : currentStatusOf(overId);
    if (!to) return;

    if (to !== from) {
      moveCard(orderId, to);
      return;
    }

    // Mismo sitio: solo tiene sentido reordenar, y solo en una cola.
    const status = statuses.find((s) => s.id === to);
    if (!status?.isQueue || overIsColumn || overId === orderId) return;

    reorderCard(orderId, to, overId);
  }

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
        .map((o) => ({ ...o, queuedAt: pendingQueue[o.id] ?? o.queuedAt })),
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
    <DndContext
      // Sin un id estable, dnd-kit numera sus descripciones con un contador
      // que difiere entre servidor y cliente.
      id="orders-board"
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveOrder(null)}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {statuses.map((status) => {
          const inColumn = orders.filter(
            (order) =>
              displayedPlacement(order, pending, pendingQueue).statusId === status.id,
          );

          return (
            <BoardColumn
              key={status.id}
              status={status}
              orders={inColumn}
              today={today}
              pendingQueue={pendingQueue}
            />
          );
        })}
      </div>

      {/* `useSortable` solo anima transiciones dentro de un mismo
          `SortableContext`, y cada columna tiene el suyo: sin esto, la
          tarjeta se movía con el cursor mientras seguía sobre su columna de
          origen, pero desaparecía sin transición al cruzar a otra. El
          `DragOverlay` es un clon que sigue al puntero por fuera de ambos
          contextos, así que la animación no se corta al cambiar de columna. */}
      <DragOverlay>
        {activeOrder && <OrderCard order={activeOrder} today={today} />}
      </DragOverlay>
    </DndContext>
  );
}

function BoardColumn({
  status,
  orders,
  today,
  pendingQueue,
}: {
  status: Status;
  orders: BoardOrder[];
  today: string;
  pendingQueue: Record<string, string>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });

  // En una columna de cola manda la llegada, no la urgencia; en las demás,
  // la fecha comprometida es el orden natural de trabajo.
  const ordered = status.isQueue
    ? sortByArrival(
        orders.map((order) => ({
          ...order,
          queuedAt: pendingQueue[order.id] ?? order.queuedAt,
        })),
      )
    : [...orders].sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));

  // La posición visible se deriva del orden: mover uno renumera a todos sin
  // escribir una sola fila más (design.md D4).
  const positions = status.isQueue ? queuePositions(ordered) : null;

  return (
    <section
      ref={setNodeRef}
      data-testid="board-column"
      data-status-name={status.name}
      data-is-queue={status.isQueue ? "1" : "0"}
      className={cn(
        "flex w-72 shrink-0 flex-col gap-2 rounded-lg bg-muted/40 p-2 transition-colors",
        isOver && "bg-accent",
      )}
    >
      <header className="flex items-center justify-between px-1 py-1">
        <h2 className="text-sm font-medium">{status.name}</h2>
        <Badge variant="secondary" className="tabular-nums">
          {ordered.length}
        </Badge>
      </header>

      <div className="flex flex-col gap-2">
        {/* Las tarjetas son ordenables además de arrastrables: soltar una
            sobre otra dentro de una cola es lo que reordena. */}
        <SortableContext
          items={ordered.map((order) => order.id)}
          strategy={verticalListSortingStrategy}
        >
          {ordered.map((order) => (
            <DraggableCard key={order.id} orderId={order.id}>
              <OrderCard
                order={order}
                today={today}
                position={positions?.get(order.id)}
              />
            </DraggableCard>
          ))}
        </SortableContext>

        {ordered.length === 0 && (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">
            Sin pedidos
          </p>
        )}
      </div>
    </section>
  );
}

function DraggableCard({
  orderId,
  children,
}: {
  orderId: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id: orderId,
  });

  // La tarjeta es un enlace al detalle, así que soltar tras arrastrar
  // dispararía la navegación además del movimiento. Se recuerda que hubo
  // arrastre y se cancela ese clic —solo ese—: un toque limpio sigue abriendo
  // el pedido, que es lo que el tablero necesita en el móvil.
  const dragged = useRef(false);

  useEffect(() => {
    if (isDragging) dragged.current = true;
  }, [isDragging]);

  function onClickCapture(event: React.MouseEvent) {
    if (!dragged.current) return;
    event.preventDefault();
    event.stopPropagation();
    dragged.current = false;
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(isDragging && "opacity-50")}
      onClickCapture={onClickCapture}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  );
}
