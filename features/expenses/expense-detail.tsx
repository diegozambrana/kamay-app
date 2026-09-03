"use client";

import { ArrowLeftIcon, PaperclipIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { archiveExpense, unarchiveExpense } from "@/actions/expenses";
import { MainContainer } from "@/components/layout/main-container";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { lineColorClasses } from "@/lib/business-lines/colors";
import { IMAGE_ACCEPT } from "@/lib/catalog/photos";
import { formatDate, formatDateTime } from "@/lib/format/datetime";
import { formatFileSize } from "@/lib/format/file-size";
import { cn } from "@/lib/utils";
import type { ExpenseItemWithNames } from "@/services/expenses/expense-item-service";
import type { ExpenseWithTotal } from "@/services/expenses/expense-service";
import type { ActivityEntry, BusinessLine, Contact } from "@/types";

import { useReceiptUploadStore } from "./receipt-upload-store";

export const KIND_LABELS = { purchase: "Compra", expense: "Gasto" } as const;

const ACTION_LABELS: Record<ActivityEntry["action"], string> = {
  created: "Registrado",
  updated: "Editado",
  status_changed: "Cambió de estado",
  archived: "Archivado",
  unarchived: "Desarchivado",
};

export type ReceiptView = {
  id: string;
  fileName: string;
  sizeBytes: number | null;
  url: string | null;
};

/** Todo lo que el detalle muestra, resuelto en el servidor de una vez. */
export type ExpenseDetailData = {
  expense: ExpenseWithTotal;
  lines: ExpenseItemWithNames[];
  supplier: Contact | null;
  categoryName: string | null;
  businessLine: BusinessLine | null;
  order: { id: string; code: number } | null;
  receipts: ReceiptView[];
  history: ActivityEntry[];
};

/**
 * Detalle del egreso. El mismo componente sirve al panel lateral de la
 * bandeja (`variant="panel"`) y a la página `/expenses/[id]` para enlaces
 * directos (`variant="page"`, design D6).
 *
 * El total sale de la vista, nunca de una columna; el historial de
 * `activity_log`, nunca de una tabla propia. El estado de pago no está aquí:
 * llega con `payments` en KAM-10.
 */
export function ExpenseDetail({
  data,
  timezone,
  variant,
}: {
  data: ExpenseDetailData;
  timezone: string;
  variant: "panel" | "page";
}) {
  const body = <DetailBody data={data} timezone={timezone} />;

  if (variant === "panel") return body;

  const { expense, businessLine } = data;

  return (
    <MainContainer
      title={
        <span className="flex flex-wrap items-center gap-3">
          <span>{KIND_LABELS[expense.kind]}</span>
          {businessLine && <LineBadge line={businessLine} />}
          {expense.archivedAt && <Badge variant="outline">Archivado</Badge>}
        </span>
      }
      description={
        <Link
          href="/expenses"
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" aria-hidden /> Egresos
        </Link>
      }
    >
      {body}
    </MainContainer>
  );
}

function LineBadge({ line }: { line: BusinessLine }) {
  return (
    <Badge variant="secondary" className="gap-1.5">
      <span className={cn("size-2 rounded-full", lineColorClasses(line.color).dot)} />
      {line.name}
    </Badge>
  );
}

function DetailBody({
  data,
  timezone,
}: {
  data: ExpenseDetailData;
  timezone: string;
}) {
  const { expense, lines, supplier, categoryName, businessLine, order, receipts, history } =
    data;
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const upload = useReceiptUploadStore((state) => state.uploads[expense.id]);
  const enqueue = useReceiptUploadStore((state) => state.enqueue);

  const archived = Boolean(expense.archivedAt);

  function toggleArchived() {
    setError(null);
    setConfirming(false);
    startTransition(async () => {
      const result = archived
        ? await unarchiveExpense({ expenseId: expense.id })
        : await archiveExpense({ expenseId: expense.id });
      if (result?.error) setError(result.error);
    });
  }

  /** Adjuntar desde el detalle: la misma cola que usa el formulario (D4). */
  function attach(file: File | undefined) {
    if (!file) return;
    void enqueue(expense.id, file, { onDone: () => router.refresh() });
  }

  return (
    <div className="flex flex-col gap-4" data-testid="expense-detail">
      {error && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>No se pudo completar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Badge data-testid="detail-kind">{KIND_LABELS[expense.kind]}</Badge>
        {businessLine && <LineBadge line={businessLine} />}
        {archived && <Badge variant="outline">Archivado</Badge>}
        <span className="text-sm text-muted-foreground" data-testid="detail-date">
          {formatDate(expense.occurredAt, timezone)}
        </span>

        <div className="ml-auto">
          {/* Quién puede archivar lo decide la base (D9); aquí solo se pide. */}
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            data-testid={archived ? "unarchive-expense" : "archive-expense"}
            onClick={() => (archived ? toggleArchived() : setConfirming(true))}
          >
            {archived ? "Desarchivar" : "Archivar"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {expense.kind === "purchase" ? (
            <Detail label="Proveedor" testId="detail-supplier">
              {supplier ? (
                <Link href="/contacts" className="hover:underline">
                  {supplier.name}
                </Link>
              ) : (
                <span className="text-muted-foreground">Sin proveedor</span>
              )}
            </Detail>
          ) : (
            <Detail label="Categoría" testId="detail-category">
              {categoryName ?? "—"}
            </Detail>
          )}

          {order && (
            <Detail label="Pedido" testId="detail-order">
              <Link href={`/orders/${order.id}`} className="hover:underline">
                #{order.code}
              </Link>
            </Detail>
          )}

          <Detail label="Registrado">
            {formatDateTime(expense.occurredAt, timezone)}
          </Detail>

          {expense.note && (
            <div>
              <p className="text-muted-foreground">Nota</p>
              <p className="whitespace-pre-wrap" data-testid="detail-note">
                {expense.note}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{expense.kind === "purchase" ? "Insumos" : "Monto"}</CardTitle>
        </CardHeader>
        <CardContent>
          {expense.kind === "purchase" && lines.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Insumo</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => (
                  <TableRow key={line.id} data-testid="expense-line">
                    <TableCell>
                      <Link href={`/catalog/${line.itemId}`} className="hover:underline">
                        {line.itemName ?? "Insumo"}
                      </Link>
                      {line.variantName && (
                        <span className="text-muted-foreground"> · {line.variantName}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{line.quantity}</TableCell>
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
                  {/* Calculado por `expense_totals` desde las líneas: no hay
                      ninguna columna que lo guarde (convención nº 4). */}
                  <TableCell
                    className="text-right font-medium tabular-nums"
                    data-testid="expense-total"
                  >
                    {expense.total.toFixed(2)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : (
            <p className="text-2xl font-semibold tabular-nums" data-testid="expense-total">
              {expense.total.toFixed(2)}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comprobantes</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {upload?.status === "pending" && (
            <p className="text-sm text-muted-foreground" data-testid="receipt-pending">
              Comprobante subiendo… ({upload.fileName})
            </p>
          )}
          {upload?.status === "failed" && (
            <Alert variant="destructive" data-testid="receipt-failed">
              <AlertTitle>El comprobante no se subió</AlertTitle>
              <AlertDescription>
                {upload.error} El egreso quedó guardado; puedes adjuntarlo de nuevo.
              </AlertDescription>
            </Alert>
          )}

          {receipts.length === 0 && !upload ? (
            <p className="text-sm text-muted-foreground">Sin comprobante.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {receipts.map((receipt) => (
                <figure
                  key={receipt.id}
                  data-testid="expense-receipt"
                  data-size-bytes={receipt.sizeBytes ?? undefined}
                  className="w-40"
                >
                  {receipt.url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- URL firmada y efímera
                    <img
                      src={receipt.url}
                      alt={receipt.fileName}
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
                    {receipt.fileName}
                    {receipt.sizeBytes !== null && ` · ${formatFileSize(receipt.sizeBytes)}`}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}

          {!archived && (
            <div>
              <input
                ref={fileInput}
                type="file"
                accept={IMAGE_ACCEPT}
                className="sr-only"
                data-testid="receipt-input"
                onChange={(event) => {
                  attach(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={upload?.status === "pending"}
                onClick={() => fileInput.current?.click()}
              >
                <PaperclipIcon className="size-4" aria-hidden /> Adjuntar comprobante
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Un solo historial (convención nº 7): sale de `activity_log`. */}
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
                    <span className="text-muted-foreground">· {entry.actorLabel}</span>
                  )}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar este egreso?</AlertDialogTitle>
            <AlertDialogDescription>
              Dejará de verse en la bandeja y de contar en los totales. No se borra:
              queda archivado con sus líneas y su historial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction data-testid="confirm-archive" onClick={toggleArchived}>
              Archivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
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
