"use client";

import { Badge } from "@/components/ui/badge";
import { PaymentStatusBadge } from "@/features/payments/payment-status-badge";
import { formatDate } from "@/lib/format/datetime";
import { cn } from "@/lib/utils";

import { KIND_LABELS } from "./expense-detail";
import { LineBadge, UploadIndicator } from "./expense-row";
import type { ExpenseRowView } from "./expenses-screen";
import type { ReceiptUpload } from "./receipt-upload-store";

/** La bandeja en móvil: una tarjeta apilada por egreso (mapa §11). */
export function ExpenseCard({
  row,
  timezone,
  upload,
  onOpen,
}: {
  row: ExpenseRowView;
  timezone: string;
  upload: ReceiptUpload | undefined;
  onOpen: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        data-testid="expense-card"
        data-kind={row.kind}
        data-archived={row.archivedAt ? "true" : undefined}
        className={cn(
          "flex w-full flex-col gap-2 rounded-lg border p-3 text-left",
          row.archivedAt && "opacity-60",
        )}
        onClick={onOpen}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge variant={row.kind === "purchase" ? "default" : "secondary"}>
              {KIND_LABELS[row.kind]}
            </Badge>
            {row.archivedAt && <Badge variant="outline">Archivado</Badge>}
            <PaymentStatusBadge total={row.total} paid={row.paid} />
          </span>
          <span className="font-medium tabular-nums" data-testid="row-total">
            {row.total.toFixed(2)}
          </span>
        </div>
        <p className="text-sm">{row.counterpartyName ?? "—"}</p>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <LineBadge name={row.lineName} color={row.lineColor} />
          <span className="tabular-nums">{formatDate(row.occurredAt, timezone)}</span>
        </div>
        <UploadIndicator upload={upload} />
      </button>
    </li>
  );
}
