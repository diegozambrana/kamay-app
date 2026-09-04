"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaymentStatusBadge } from "@/features/payments/payment-status-badge";
import { lineColorClasses } from "@/lib/business-lines/colors";
import { formatDate } from "@/lib/format/datetime";
import { cn } from "@/lib/utils";

import { KIND_LABELS } from "./expense-detail";
import type { ExpenseRowView } from "./expenses-screen";
import type { ReceiptUpload } from "./receipt-upload-store";

/** La bandeja en escritorio: una tabla; la fila abre el detalle en el panel. */
export function ExpenseRows({
  rows,
  timezone,
  uploads,
  onOpen,
}: {
  rows: ExpenseRowView[];
  timezone: string;
  uploads: Record<string, ReceiptUpload>;
  onOpen: (expenseId: string) => void;
}) {
  return (
    <Table data-testid="expense-table">
      <TableHeader>
        <TableRow>
          <TableHead>Fecha</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Proveedor / categoría</TableHead>
          <TableHead>Línea</TableHead>
          <TableHead className="text-right">Monto</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            key={row.id}
            data-testid="expense-row"
            data-kind={row.kind}
            data-archived={row.archivedAt ? "true" : undefined}
            className={cn("cursor-pointer", row.archivedAt && "opacity-60")}
            onClick={() => onOpen(row.id)}
          >
            <TableCell className="tabular-nums">
              {formatDate(row.occurredAt, timezone)}
            </TableCell>
            <TableCell>
              <span className="flex flex-wrap items-center gap-1.5">
                <Badge variant={row.kind === "purchase" ? "default" : "secondary"}>
                  {KIND_LABELS[row.kind]}
                </Badge>
                {row.archivedAt && <Badge variant="outline">Archivado</Badge>}
                {/* Estado de pago derivado de `total` y `paid`: la misma
                    función que usa el tablero de pedidos. */}
                <PaymentStatusBadge total={row.total} paid={row.paid} />
                <UploadIndicator upload={uploads[row.id]} />
              </span>
            </TableCell>
            <TableCell>{row.counterpartyName ?? "—"}</TableCell>
            <TableCell>
              <LineBadge name={row.lineName} color={row.lineColor} />
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums" data-testid="row-total">
              {row.total.toFixed(2)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function LineBadge({
  name,
  color,
}: {
  name: string;
  color: ExpenseRowView["lineColor"];
}) {
  return (
    <Badge variant="secondary" className="gap-1.5">
      <span className={cn("size-2 rounded-full", lineColorClasses(color).dot)} />
      {name}
    </Badge>
  );
}

/** "Comprobante subiendo…" mientras la cola trabaja; el aviso si falló (D4). */
export function UploadIndicator({ upload }: { upload: ReceiptUpload | undefined }) {
  if (!upload) return null;
  if (upload.status === "pending") {
    return (
      <span className="text-xs text-muted-foreground" data-testid="receipt-pending">
        Comprobante subiendo…
      </span>
    );
  }
  return (
    <span className="text-xs text-destructive" data-testid="receipt-failed">
      Comprobante no subido
    </span>
  );
}
