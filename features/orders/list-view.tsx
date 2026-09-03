"use client";

import { EyeIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  DataTable,
  type DataTableAction,
  type DataTableColumn,
} from "@/components/data-table/data-table";
import { Badge } from "@/components/ui/badge";
import { lineColorClasses } from "@/lib/business-lines/colors";
import { isOverdue } from "@/lib/orders/overdue";
import { cn } from "@/lib/utils";
import type { Status } from "@/types";

import type { BoardOrder } from "./board-view";

const DELIVERY_LABELS = { pickup: "Recojo", delivery: "Delivery" } as const;

/**
 * Vista de lista: una sección por estado, en el mismo orden que el tablero.
 * Un estado sin pedidos no desaparece de la lista — muestra su propio espacio
 * vacío, igual que una columna vacía del tablero — así ambas vistas leen el
 * mismo flujo, solo que una en columnas y la otra en filas.
 *
 * Cada sección usa `DataTable`, la misma pieza de `/catalog`: el clic para
 * ver el detalle es el mismo gesto en toda la aplicación, y no una tabla
 * aparte que hay que aprender de nuevo.
 */
export function ListView({
  orders,
  statuses,
  today,
}: {
  orders: BoardOrder[];
  statuses: Status[];
  today: string;
}) {
  const router = useRouter();

  if (statuses.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No hay pedidos que mostrar.
      </p>
    );
  }

  function onAction(actionId: string, order: BoardOrder) {
    if (actionId === "view") router.push(`/orders/${order.id}`);
  }

  const actions: DataTableAction<BoardOrder>[] = [
    { id: "view", label: "Ver", icon: EyeIcon },
  ];

  const columns: DataTableColumn<BoardOrder>[] = [
    {
      id: "code",
      label: "#",
      className: "w-16",
      value: (order) => (
        // Enlace directo además del menú de acciones: se puede abrir el
        // pedido con un solo clic, sin pasar por el "…".
        <Link
          href={`/orders/${order.id}`}
          className="tabular-nums hover:underline"
        >
          #{order.code}
        </Link>
      ),
    },
    {
      id: "contact",
      label: "Cliente",
      value: (order) => (
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "size-2 shrink-0 rounded-full",
              lineColorClasses(order.lineColor).dot,
            )}
          />
          {order.contactName ?? (
            <span className="text-muted-foreground">Sin cliente</span>
          )}
          {order.archivedAt && (
            <Badge variant="outline" className="ml-1">
              Archivado
            </Badge>
          )}
        </span>
      ),
    },
    {
      id: "dueDate",
      label: "Compromiso",
      value: (order) => {
        const overdue = isOverdue({
          dueDate: order.dueDate,
          statusKind: order.statusKind,
          today,
        });
        return (
          <span
            className={cn("tabular-nums", overdue && "text-destructive")}
            data-overdue={overdue ? "1" : "0"}
          >
            {order.dueDate ?? "—"}
          </span>
        );
      },
    },
    {
      id: "delivery",
      label: "Entrega",
      value: (order) =>
        order.deliveryMode ? DELIVERY_LABELS[order.deliveryMode] : "—",
    },
    {
      id: "total",
      label: "Total",
      align: "end",
      value: (order) => (
        <span className="tabular-nums">{order.total.toFixed(2)}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {statuses.map((status) => {
        const rows = orders.filter((order) => order.statusId === status.id);

        return (
          <section
            key={status.id}
            data-testid="list-section"
            data-status-name={status.name}
          >
            <h2 className="mb-2 flex items-center gap-2 text-sm font-medium">
              {status.name}
              <Badge variant="secondary" className="tabular-nums">
                {rows.length}
              </Badge>
            </h2>

            <DataTable
              data-testid="orders-list"
              columns={columns}
              rows={rows}
              rowKey={(order) => order.id}
              actions={actions}
              onAction={onAction}
              rowProps={(order) => ({
                "data-testid": "order-row",
                "data-order-code": order.code,
                className: order.archivedAt ? "text-muted-foreground" : undefined,
              })}
              empty={{ title: "Sin pedidos en este estado" }}
            />
          </section>
        );
      })}
    </div>
  );
}
