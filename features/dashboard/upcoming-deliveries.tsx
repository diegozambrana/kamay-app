import { TruckIcon, PackageIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { lineColorClasses } from "@/lib/business-lines/colors";
import { formatCalendarDate } from "@/lib/format/datetime";
import { isOverdue } from "@/lib/orders/overdue";
import { cn } from "@/lib/utils";
import type { UpcomingDelivery } from "@/services/dashboard/dashboard-service";
import type { LineColor } from "@/types";

const DELIVERY_LABELS = { pickup: "Recojo", delivery: "Delivery" } as const;

export type DeliveryItem = UpcomingDelivery & {
  contactName: string | null;
  lineColor: LineColor;
  lineName: string;
};

/**
 * Entregas próximas: lo comprometido para los próximos siete días y lo que ya
 * venció.
 *
 * Quién está retrasado lo decide `isOverdue` y nadie más: es la única
 * definición de retraso del proyecto —solo alertan los estados de tipo
 * `initial` e `in_progress`, y nunca se compara por nombre— y la comparten el
 * tablero, la lista y el calendario (design D7). Un pedido vencido que está
 * esperando al cliente aparece igual, porque sigue siendo una entrega
 * comprometida, pero no se pinta de rojo.
 *
 * `showAmounts` no existe: esta lista no muestra importes en ninguna de sus
 * dos composiciones. Para el ayudante eso es obligatorio; para la persona
 * dueña, el dinero ya está en sus cuatro tarjetas y repetirlo aquí solo
 * quitaría sitio a la fecha, que es lo que esta tarjeta responde.
 */
export function UpcomingDeliveries({
  deliveries,
  today,
  emphasis = false,
}: {
  deliveries: readonly DeliveryItem[];
  /** "Hoy" en la zona de la organización, resuelto en el servidor. */
  today: string;
  /**
   * En la composición del ayudante esta es la pieza principal y se rinde con
   * más aire; en la de la persona dueña es una más de la retícula.
   */
  emphasis?: boolean;
}) {
  // Los vencidos primero: el servicio ordena por fecha, y esta es la única
  // reordenación —dentro de cada grupo el orden por fecha se conserva—.
  const sorted = [...deliveries].sort((a, b) => {
    const overdueA = isOverdue({ dueDate: a.dueDate, statusKind: a.statusKind, today });
    const overdueB = isOverdue({ dueDate: b.dueDate, statusKind: b.statusKind, today });
    if (overdueA !== overdueB) return overdueA ? -1 : 1;
    return a.dueDate.localeCompare(b.dueDate);
  });

  return (
    <Card data-testid="upcoming-deliveries" className={cn(emphasis && "h-full")}>
      <CardHeader>
        <CardTitle>Entregas próximas</CardTitle>
      </CardHeader>

      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay entregas comprometidas para los próximos días.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {sorted.map((delivery) => {
              const overdue = isOverdue({
                dueDate: delivery.dueDate,
                statusKind: delivery.statusKind,
                today,
              });

              return (
                <li key={delivery.id}>
                  <Link
                    href={`/orders/${delivery.id}`}
                    data-testid={`delivery-${delivery.id}`}
                    data-overdue={overdue ? "true" : undefined}
                    className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-accent/40"
                  >
                    <span
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        lineColorClasses(delivery.lineColor).dot,
                      )}
                      aria-hidden
                    />

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-medium">#{delivery.code}</span>
                        <span className="truncate text-muted-foreground">
                          {delivery.contactName ?? "Sin cliente"}
                        </span>
                      </span>
                      {emphasis && (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          {delivery.deliveryMode && (
                            <>
                              {delivery.deliveryMode === "delivery" ? (
                                <TruckIcon className="size-3.5" aria-hidden />
                              ) : (
                                <PackageIcon className="size-3.5" aria-hidden />
                              )}
                              {DELIVERY_LABELS[delivery.deliveryMode]}
                              <span aria-hidden>·</span>
                            </>
                          )}
                          {delivery.lineName}
                        </span>
                      )}
                    </span>

                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {formatCalendarDate(delivery.dueDate)}
                      </span>
                      {overdue && <Badge variant="destructive">Vencido</Badge>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
