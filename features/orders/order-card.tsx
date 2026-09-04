"use client";

import { PackageIcon, TriangleAlertIcon, TruckIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { PaymentStatusBadge } from "@/features/payments/payment-status-badge";
import { lineColorClasses } from "@/lib/business-lines/colors";
import { isOverdue } from "@/lib/orders/overdue";
import { cn } from "@/lib/utils";
import type { DeliveryMode, LineColor, StatusKind } from "@/types";

/** Lo que una tarjeta necesita mostrar, ya resuelto por el servidor. */
export type OrderCardData = {
  id: string;
  code: number;
  contactName: string | null;
  dueDate: string | null;
  deliveryMode: DeliveryMode | null;
  lineColor: LineColor;
  statusKind: StatusKind;
  total: number;
  /** Lo cobrado, de `order_totals`. La señal de pago sale de aquí. */
  paid: number;
  itemsSummary: string | null;
  archivedAt: string | null;
};

const DELIVERY_LABELS: Record<DeliveryMode, string> = {
  pickup: "Recojo",
  delivery: "Delivery",
};

/** Fecha corta y legible; la comparación de retraso ya viene decidida. */
function shortDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year.slice(2)}`;
}

/**
 * Tarjeta del tablero (V3).
 *
 * La alerta de retraso la decide `isOverdue` a partir del `kind` del estado,
 * nunca de su nombre (convención nº 5): un pedido vencido en espera no se
 * pinta de rojo, porque el trabajo del taller ya terminó.
 *
 * La señal de pago se deriva de `total` y `paid` y no depende del estado del
 * pedido: entregado y cobrado son hechos distintos (modelo 6.1). Tampoco es
 * editable desde aquí — no hay ningún campo detrás.
 */
export function OrderCard({
  order,
  today,
  position,
}: {
  order: OrderCardData;
  /** "Hoy" en la zona horaria de la organización. */
  today: string;
  /** Posición en la cola, solo en columnas con `is_queue`. */
  position?: number;
}) {
  const overdue = isOverdue({
    dueDate: order.dueDate,
    statusKind: order.statusKind,
    today,
  });

  const colors = lineColorClasses(order.lineColor);

  return (
    <Link
      href={`/orders/${order.id}`}
      data-testid="order-card"
      data-order-code={order.code}
      data-overdue={overdue ? "1" : "0"}
      className={cn(
        "block rounded-lg border bg-card p-3 text-card-foreground shadow-xs transition-colors hover:bg-accent/50",
        order.archivedAt && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Barra de color de la línea: identifica el origen de un vistazo. */}
          <span className={cn("size-2 shrink-0 rounded-full", colors.dot)} />
          <span className="font-medium tabular-nums">#{order.code}</span>
          {position !== undefined && (
            <Badge
              variant="secondary"
              data-testid="queue-position"
              className="tabular-nums"
            >
              {position}
            </Badge>
          )}
        </div>

        {overdue && (
          <span
            data-testid="overdue-alert"
            title="Retrasado"
            className="flex items-center gap-1 text-destructive"
          >
            <TriangleAlertIcon className="size-4" aria-hidden />
            <span className="sr-only">Retrasado</span>
          </span>
        )}
      </div>

      <p className="mt-1 truncate text-sm">
        {order.contactName ?? (
          <span className="text-muted-foreground">Sin cliente</span>
        )}
      </p>

      {order.itemsSummary && (
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {order.itemsSummary}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          {order.dueDate && (
            <span className="tabular-nums">{shortDate(order.dueDate)}</span>
          )}
          {/* Recojo y delivery se distinguen por ícono y por texto accesible. */}
          {order.deliveryMode && (
            <span
              className="flex items-center gap-1"
              data-testid="delivery-mode"
              data-mode={order.deliveryMode}
            >
              {order.deliveryMode === "delivery" ? (
                <TruckIcon className="size-3.5" aria-hidden />
              ) : (
                <PackageIcon className="size-3.5" aria-hidden />
              )}
              {DELIVERY_LABELS[order.deliveryMode]}
            </span>
          )}
        </span>

        <span className="flex items-center gap-2">
          <PaymentStatusBadge total={order.total} paid={order.paid} />
          <span className="tabular-nums">{order.total.toFixed(2)}</span>
        </span>
      </div>

      {order.archivedAt && (
        <Badge variant="outline" className="mt-2">
          Archivado
        </Badge>
      )}
    </Link>
  );
}
