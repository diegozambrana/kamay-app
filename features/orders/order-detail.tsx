"use client";

import { ArrowLeftIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { moveOrderToStatus } from "@/actions/orders";
import { MainContainer } from "@/components/layout/main-container";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { lineColorClasses } from "@/lib/business-lines/colors";
import { formatDateTime } from "@/lib/format/datetime";
import { isOverdue } from "@/lib/orders/overdue";
import type { OrderItemWithNames } from "@/services/orders/order-item-service";
import type { OrderWithTotal } from "@/services/orders/order-service";
import { cn } from "@/lib/utils";
import type {
  ActivityEntry,
  BusinessLine,
  Contact,
  Status,
  StatusKind,
} from "@/types";

import { CancelOrderButton } from "./cancel-order-button";

const DELIVERY_LABELS = { pickup: "Recojo", delivery: "Delivery" } as const;

const ACTION_LABELS: Record<ActivityEntry["action"], string> = {
  created: "Registrado",
  updated: "Editado",
  status_changed: "Cambió de estado",
  archived: "Archivado",
  unarchived: "Desarchivado",
};

export type OrderImage = { id: string; fileName: string; url: string | null };

/**
 * V4 · Detalle de pedido. El total sale de la vista, nunca de una columna, y
 * el historial de `activity_log`, nunca de una tabla propia.
 */
export function OrderDetail({
  order,
  lines,
  statuses,
  statusName,
  statusKind,
  contact,
  businessLine,
  channelName,
  images,
  history,
  today,
  timezone,
}: {
  order: OrderWithTotal;
  lines: OrderItemWithNames[];
  statuses: Status[];
  statusName: string;
  statusKind: StatusKind;
  contact: Contact | null;
  businessLine: BusinessLine | null;
  channelName: string | null;
  images: OrderImage[];
  history: ActivityEntry[];
  today: string;
  timezone: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const overdue = isOverdue({ dueDate: order.dueDate, statusKind, today });

  function changeStatus(statusId: string) {
    if (statusId === order.statusId) return;
    setError(null);

    startTransition(async () => {
      const result = await moveOrderToStatus({ orderId: order.id, statusId });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <MainContainer
      title={
        <span className="flex flex-wrap items-center gap-3">
          <span className="tabular-nums">#{order.code}</span>

          {businessLine && (
            <Badge variant="secondary" className="gap-1.5">
              <span
                className={cn(
                  "size-2 rounded-full",
                  lineColorClasses(businessLine.color).dot,
                )}
              />
              {businessLine.name}
            </Badge>
          )}

          {order.archivedAt && <Badge variant="outline">Archivado</Badge>}

          {overdue && (
            <span
              data-testid="overdue-alert"
              className="flex items-center gap-1 text-sm font-normal text-destructive"
            >
              <TriangleAlertIcon className="size-4" aria-hidden /> Retrasado
            </span>
          )}
        </span>
      }
      description={
        <Link
          href="/orders"
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" aria-hidden /> Pedidos
        </Link>
      }
      action={
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-56">
            {/* El destino sale del juego de la línea de este pedido; el
                servidor lo vuelve a comprobar antes de escribir (D6). */}
            <Select
              value={order.statusId}
              onValueChange={changeStatus}
              disabled={pending || Boolean(order.archivedAt)}
            >
              <SelectTrigger aria-label="Estado" data-testid="status-select">
                <SelectValue placeholder={statusName} />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((status) => (
                  <SelectItem key={status.id} value={status.id}>
                    {status.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Un pedido archivado está congelado: ni se edita ni se cancela.
              Lo garantiza la base; aquí simplemente no se ofrece. */}
          {!order.archivedAt && (
            <>
              <Button asChild variant="outline" data-testid="edit-order">
                <Link href={`/orders/${order.id}/edit`}>Editar</Link>
              </Button>

              <CancelOrderButton
                orderId={order.id}
                statuses={statuses}
                currentKind={statusKind}
              />
            </>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>No se pudo cambiar el estado</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Líneas del pedido</CardTitle>
          </CardHeader>
          <CardContent>
            {lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Este pedido todavía no tiene líneas.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ítem</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => (
                    <TableRow key={line.id} data-testid="order-line">
                      <TableCell>
                        {line.itemId ? (
                          <Link
                            href={`/catalog/${line.itemId}`}
                            className="hover:underline"
                          >
                            {line.itemName ?? "Ítem"}
                          </Link>
                        ) : (
                          (line.itemName ?? "Línea libre")
                        )}
                        {line.variantName && (
                          <span className="text-muted-foreground">
                            {" "}
                            · {line.variantName}
                          </span>
                        )}
                        {line.description && (
                          <p className="text-xs text-muted-foreground">
                            {line.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {line.quantity}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {line.unitPrice.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {line.lineTotal.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={3} className="text-right font-medium">
                      Total
                    </TableCell>
                    {/* Calculado desde las líneas por `order_totals`: no hay
                        ninguna columna que lo guarde (convención nº 4). */}
                    <TableCell
                      className="text-right font-medium tabular-nums"
                      data-testid="order-total"
                    >
                      {order.total.toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Datos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <Detail label="Cliente" testId="detail-contact">
              {contact ? (
                <Link href="/contacts" className="hover:underline">
                  {contact.name}
                </Link>
              ) : (
                <span className="text-muted-foreground">Sin cliente</span>
              )}
            </Detail>
            <Detail label="Canal" testId="detail-channel">
              {channelName ?? "—"}
            </Detail>
            <Detail label="Modo de entrega" testId="detail-delivery">
              {order.deliveryMode ? DELIVERY_LABELS[order.deliveryMode] : "—"}
            </Detail>
            <Detail label="Fecha comprometida" testId="detail-due-date">
              <span className={cn(overdue && "text-destructive")}>
                {order.dueDate ?? "—"}
              </span>
            </Detail>
            <Detail label="Registrado">
              {formatDateTime(order.occurredAt, timezone)}
            </Detail>
            {order.notes && (
              <div>
                <p className="text-muted-foreground">Nota</p>
                <p className="whitespace-pre-wrap">{order.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Imágenes de referencia</CardTitle>
        </CardHeader>
        <CardContent>
          {images.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin imágenes de referencia.
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {images.map((image) => (
                <figure key={image.id} data-testid="order-image" className="w-40">
                  {image.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image.url}
                      alt={image.fileName}
                      className="h-28 w-40 rounded-md border object-cover"
                    />
                  ) : (
                    // El objeto puede no estar en el bucket (la semilla solo
                    // crea la fila): el detalle no debe romperse por eso.
                    <div className="flex h-28 w-40 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
                      No disponible
                    </div>
                  )}
                  <figcaption className="mt-1 truncate text-xs text-muted-foreground">
                    {image.fileName}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Un solo historial (convención nº 7). Para el ayudante llega vacío
          por RLS, así que el bloque no se muestra. */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Historial</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-2 text-sm">
              {history.map((entry) => (
                <li
                  key={entry.id}
                  data-testid="history-entry"
                  data-action={entry.action}
                  className="flex flex-wrap items-baseline gap-2"
                >
                  <span className="font-medium">{ACTION_LABELS[entry.action]}</span>
                  <span className="text-muted-foreground">
                    {formatDateTime(entry.occurredAt, timezone)}
                  </span>
                  {entry.actorLabel && (
                    <span className="text-muted-foreground">
                      · {entry.actorLabel}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
      </div>
    </MainContainer>
  );
}

function Detail({
  label,
  testId,
  children,
}: {
  label: string;
  testId?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p data-testid={testId}>{children}</p>
    </div>
  );
}
