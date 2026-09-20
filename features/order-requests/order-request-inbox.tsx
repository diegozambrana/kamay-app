"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format/datetime";
import { deriveOrderRequestStatus, isOrderRequestExpired } from "@/lib/order-requests/status";
import type { BusinessLine, Contact, OrderRequest } from "@/types";

import { GenerateRequestDialog } from "./generate-request-dialog";

const STATUS_LABELS = {
  waiting: "Esperando al cliente",
  received: "Recibida",
  accepted: "Aceptada",
  discarded: "Descartada",
} as const;

/**
 * KAM-28 · La bandeja de solicitudes: abierta a cualquier persona con
 * membresía, dueño o ayudante (spec `order-requests` — Requirement: La
 * bandeja está abierta a cualquier persona con membresía).
 */
export function OrderRequestInbox({
  requests,
  lines,
  contacts,
  organizationName,
  timezone,
}: {
  requests: OrderRequest[];
  lines: BusinessLine[];
  contacts: Contact[];
  organizationName: string;
  timezone: string;
}) {
  const lineName = (id: string) => lines.find((line) => line.id === id)?.name ?? "—";

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Solicitudes de pedido</CardTitle>
          <CardDescription>
            Enlaces de un solo uso para que un cliente mande sus datos por sí mismo.
          </CardDescription>
        </div>
        <GenerateRequestDialog
          lines={lines}
          contacts={contacts}
          organizationName={organizationName}
        />
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <Empty>
            <EmptyTitle>Todavía no hay solicitudes</EmptyTitle>
            <EmptyDescription>
              Genera un enlace y compártelo con un cliente por WhatsApp.
            </EmptyDescription>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Línea</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Generada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => {
                const status = deriveOrderRequestStatus(request);
                const expired =
                  status === "waiting" && isOrderRequestExpired(request.expiresAt);
                return (
                  <TableRow key={request.id} data-testid="order-request-row">
                    <TableCell>
                      <Link
                        href={`/orders/requests/${request.id}`}
                        className="font-medium hover:underline"
                      >
                        {request.declaredName ?? request.prefilledName}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {request.declaredPhone ?? request.prefilledPhone}
                      </p>
                    </TableCell>
                    <TableCell>{lineName(request.businessLineId)}</TableCell>
                    <TableCell>
                      <Badge variant={status === "discarded" ? "outline" : "secondary"}>
                        {expired ? "Vencida" : STATUS_LABELS[status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(request.createdAt, timezone)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
