"use client";

import { Badge } from "@/components/ui/badge";

import { OrderCard } from "./order-card";
import type { BoardOrder } from "./board-view";

/**
 * Vista de calendario: los pedidos agrupados por fecha comprometida. Los que
 * no tienen fecha se muestran aparte, porque no pertenecen a ningún día y
 * esconderlos los haría desaparecer del alcance del usuario.
 */
export function CalendarView({
  orders,
  today,
}: {
  orders: BoardOrder[];
  today: string;
}) {
  const withDate = orders.filter((order) => order.dueDate);
  const withoutDate = orders.filter((order) => !order.dueDate);

  const byDate = new Map<string, BoardOrder[]>();
  for (const order of withDate) {
    const key = order.dueDate!;
    byDate.set(key, [...(byDate.get(key) ?? []), order]);
  }

  const days = [...byDate.keys()].sort();

  if (orders.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No hay pedidos que mostrar.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {days.map((day) => (
        <section key={day} data-testid="calendar-day" data-day={day}>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-medium">
            <span className="tabular-nums">{day}</span>
            {day === today && <Badge variant="secondary">Hoy</Badge>}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {byDate.get(day)!.map((order) => (
              <OrderCard key={order.id} order={order} today={today} />
            ))}
          </div>
        </section>
      ))}

      {withoutDate.length > 0 && (
        <section data-testid="calendar-undated">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">
            Sin fecha comprometida
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {withoutDate.map((order) => (
              <OrderCard key={order.id} order={order} today={today} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
