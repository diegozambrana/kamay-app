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
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Una columna del tablero, con sus elementos **ya ordenados** por quien la
 * rinde.
 *
 * El cascarón no ordena: el criterio es de cada dominio —los pedidos ordenan
 * por llegada en las colas y por fecha comprometida en el resto; las tareas,
 * por fecha límite— y meterlo aquí obligaría a que este archivo conociera
 * ambos.
 */
export type KanbanColumn<T> = {
  id: string;
  /** Cabecera de la columna: título, contador, lo que haga falta. */
  header: React.ReactNode;
  items: T[];
  /**
   * Soltar una tarjeta sobre otra de esta misma columna llama a `onReorder`.
   * Solo las colas de pedidos lo usan; en una columna normal, soltar sobre
   * otra tarjeta no significa nada.
   */
  sortable?: boolean;
  /** Lo que se rinde cuando la columna está vacía. */
  empty?: React.ReactNode;
  /** Atributos extra de la sección, para que las pruebas la reconozcan. */
  attributes?: Record<string, string>;
};

/**
 * El cascarón de arrastre que comparten el tablero de pedidos (V3) y el de
 * tareas (V17): sensores, columnas soltables, tarjetas ordenables, capa de
 * arrastre y la resolución de dónde se soltó.
 *
 * Lo que **no** hace, a propósito (KAM-15, design D6): ordenar, numerar
 * posiciones de cola, decidir qué es una cola, ni hablar con el servidor. La
 * cola es un concepto de pedidos y se quedó allí; este archivo solo sabe que
 * una columna puede admitir reordenamiento.
 */
export function KanbanBoard<T extends { id: string }>({
  id,
  columns,
  renderCard,
  renderOverlay,
  onMove,
  onReorder,
  testId,
}: {
  /**
   * Identificador estable para dnd-kit. Sin él, dnd-kit numera sus
   * descripciones con un contador que difiere entre servidor y cliente.
   */
  id: string;
  columns: KanbanColumn<T>[];
  renderCard: (item: T, columnId: string) => React.ReactNode;
  /** La tarjeta que sigue al puntero mientras dura el arrastre. */
  renderOverlay: (item: T) => React.ReactNode;
  onMove: (itemId: string, toColumnId: string) => void;
  onReorder?: (itemId: string, columnId: string, overItemId: string) => void;
  testId: string;
}) {
  const [active, setActive] = useState<T | null>(null);

  // Un arrastre solo empieza tras unos píxeles: si no, tocar una tarjeta en
  // el móvil nunca abriría su detalle.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  /**
   * En qué columna está ahora mismo el elemento.
   *
   * Se lee de `columns`, que es lo que se está pintando: quien lo rinde ya
   * aplicó los movimientos en vuelo al repartir los elementos, así que aquí
   * no hace falta consultar el store otra vez.
   */
  function columnOf(itemId: string): string | null {
    for (const column of columns) {
      if (column.items.some((item) => item.id === itemId)) return column.id;
    }
    return null;
  }

  function findItem(itemId: string): T | null {
    for (const column of columns) {
      const item = column.items.find((candidate) => candidate.id === itemId);
      if (item) return item;
    }
    return null;
  }

  function onDragStart(event: DragStartEvent) {
    setActive(findItem(String(event.active.id)));
  }

  function onDragEnd(event: DragEndEvent) {
    setActive(null);

    const itemId = String(event.active.id);
    if (!event.over) return;

    const overId = String(event.over.id);
    const from = columnOf(itemId);
    if (!from) return;

    // Se puede soltar sobre una columna o sobre otra tarjeta. En el segundo
    // caso el destino es la columna de esa tarjeta, y la posición importa
    // cuando la columna admite orden.
    const overIsColumn = columns.some((column) => column.id === overId);
    const to = overIsColumn ? overId : columnOf(overId);
    if (!to) return;

    if (to !== from) {
      onMove(itemId, to);
      return;
    }

    // Mismo sitio: solo tiene sentido reordenar, y solo donde se admite.
    const column = columns.find((candidate) => candidate.id === to);
    if (!column?.sortable || overIsColumn || overId === itemId) return;

    onReorder?.(itemId, to, overId);
  }

  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
    >
      {/* El desplazamiento horizontal vive aquí, dentro del tablero: en un
          teléfono las columnas se recorren de lado, pero la página no se
          mueve (`user-auth` — "No app screen scrolls horizontally"). */}
      <div data-testid={testId} className="flex gap-3 overflow-x-auto pb-4">
        {columns.map((column) => (
          <BoardColumn key={column.id} column={column} renderCard={renderCard} />
        ))}
      </div>

      {/* `useSortable` solo anima transiciones dentro de un mismo
          `SortableContext`, y cada columna tiene el suyo: sin esto, la
          tarjeta se movía con el cursor mientras seguía sobre su columna de
          origen, pero desaparecía sin transición al cruzar a otra. El
          `DragOverlay` es un clon que sigue al puntero por fuera de ambos
          contextos, así que la animación no se corta al cambiar de columna. */}
      <DragOverlay>{active && renderOverlay(active)}</DragOverlay>
    </DndContext>
  );
}

function BoardColumn<T extends { id: string }>({
  column,
  renderCard,
}: {
  column: KanbanColumn<T>;
  renderCard: (item: T, columnId: string) => React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <section
      ref={setNodeRef}
      {...column.attributes}
      className={cn(
        "flex w-72 shrink-0 flex-col gap-2 rounded-lg bg-muted/40 p-2 transition-colors",
        isOver && "bg-accent",
      )}
    >
      <header className="flex items-center justify-between px-1 py-1">
        {column.header}
      </header>

      <div className="flex flex-col gap-2">
        {/* Las tarjetas son ordenables además de arrastrables: soltar una
            sobre otra dentro de una columna ordenable es lo que reordena. */}
        <SortableContext
          items={column.items.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.items.map((item) => (
            <DraggableCard key={item.id} itemId={item.id}>
              {renderCard(item, column.id)}
            </DraggableCard>
          ))}
        </SortableContext>

        {column.items.length === 0 && column.empty}
      </div>
    </section>
  );
}

function DraggableCard({
  itemId,
  children,
}: {
  itemId: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id: itemId,
  });

  // La tarjeta suele ser un enlace al detalle, así que soltar tras arrastrar
  // dispararía la navegación además del movimiento. Se recuerda que hubo
  // arrastre y se cancela ese clic —solo ese—: un toque limpio sigue abriendo
  // el registro, que es lo que el tablero necesita en el móvil.
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
