"use client";

import { ArrowLeftIcon, PaperclipIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { linkExpenseToAsset } from "@/actions/assets";
import { archiveExpense, unarchiveExpense } from "@/actions/expenses";
import { relatedTasksFor } from "@/actions/tasks";
import type { RelatedTask } from "@/services/tasks/task-service";
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
import { RecordHistory } from "@/components/activity/record-history";
import type { RecordHistory as RecordHistoryData } from "@/services/activity/record-history";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
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
import { IMAGE_ACCEPT } from "@/lib/catalog/photos";
import { formatDate, formatDateTime } from "@/lib/format/datetime";
import { formatFileSize } from "@/lib/format/file-size";
import { cn } from "@/lib/utils";
import { PaymentBlock } from "@/features/payments/payment-block";
import type { ExpenseItemWithNames } from "@/services/expenses/expense-item-service";
import type { ExpenseWithTotal } from "@/services/expenses/expense-service";
import type { BusinessLine, Contact, Payment } from "@/types";

import { useReceiptUploadStore } from "./receipt-upload-store";

export const KIND_LABELS = { purchase: "Compra", expense: "Gasto" } as const;

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
  /**
   * El activo al que pertenece este egreso, si pertenece a alguno (KAM-19).
   * El nombre se resuelve en el servidor: el detalle no consulta.
   */
  asset: { itemId: string; name: string } | null;
  /** Activos vigentes que se pueden elegir para vincular como mantenimiento. */
  assetOptions: { itemId: string; name: string }[];
  receipts: ReceiptView[];
  /** Movimientos del egreso, anulados incluidos. */
  payments: Payment[];
  history: RecordHistoryData;
};

/**
 * Detalle del egreso. El mismo componente sirve al panel lateral de la
 * bandeja (`variant="panel"`) y a la página `/expenses/[id]` para enlaces
 * directos (`variant="page"`, design D6).
 *
 * El total y lo pagado salen de la vista, nunca de una columna; el saldo se
 * deriva de ambos al leer; y el historial sale de `activity_log`, nunca de una
 * tabla propia.
 *
 * Registrar un pago es del dueño, y a `/expenses` solo llega el dueño: el
 * ayudante no tiene política de lectura sobre `expenses`.
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
  const { expense, lines, supplier, categoryName, businessLine, order, asset, assetOptions, receipts, history } =
    data;
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  /** Las tareas que referencian este egreso, para el aviso al archivar (D5). */
  const [linkedTasks, setLinkedTasks] = useState<RelatedTask[]>([]);
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
            onClick={() => {
              if (archived) {
                toggleArchived();
                return;
              }
              // Se pregunta antes de abrir: el aviso enumera qué tareas
              // apuntan aquí, y ninguna queda rota al archivar (D5).
              void relatedTasksFor("expense", expense.id).then((tasks) => {
                setLinkedTasks(tasks);
                setConfirming(true);
              });
            }}
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

          {asset && (
            <Detail label="Activo" testId="detail-asset">
              <Link href="/assets" className="hover:underline">
                {asset.name}
              </Link>
              <span className="ml-2 text-muted-foreground">
                {expense.assetExpenseRole === "acquisition"
                  ? "· compra del activo"
                  : "· mantenimiento"}
              </span>
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

      {/* Pagos y saldo. Un egreso archivado está congelado: se ven sus
          movimientos pero no se registran nuevos. */}
      <PaymentBlock
        target={{ kind: "expense", expenseId: data.expense.id }}
        total={data.expense.total}
        paid={data.expense.paid}
        payments={data.payments}
        timezone={timezone}
        canVoid
        frozen={Boolean(data.expense.archivedAt)}
      />

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

      {/* Vincular el egreso a un activo (KAM-19). Solo llega aquí la persona
          dueña —el ayudante no lee `expenses`—, así que no hay guardia de rol
          en la pantalla: la impone la RLS de la tabla. */}
      <AssetLinkCard expense={expense} asset={asset} options={assetOptions} />

      {/* Un solo historial (convención nº 7): la misma lectura y la misma
          redacción que la bitácora general. */}
      {history.items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Historial</CardTitle>
          </CardHeader>
          <CardContent>
            <RecordHistory history={history} timezone={timezone} />
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

          {linkedTasks.length > 0 && (
            <div className="text-muted-foreground flex flex-col gap-1 text-sm">
              <p>
                {linkedTasks.length === 1
                  ? "Una tarea apunta a este egreso y seguirá apuntando:"
                  : `${linkedTasks.length} tareas apuntan a este egreso y seguirán apuntando:`}
              </p>
              <ul data-testid="archive-warning-tasks">
                {linkedTasks.map((task) => (
                  <li key={task.id}>· {task.title}</li>
                ))}
              </ul>
            </div>
          )}
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

/**
 * Declarar a qué activo pertenece un egreso, o deshacer el vínculo.
 *
 * Solo se ofrece el papel *mantenimiento*: la adquisición la declara el alta
 * del activo desde su compra, que es donde se conoce el costo. Vincular aquí
 * una adquisición a mano permitiría dos verdades sobre el mismo hecho.
 */
function AssetLinkCard({
  expense,
  asset,
  options,
}: {
  expense: ExpenseWithTotal;
  asset: { itemId: string; name: string } | null;
  options: { itemId: string; name: string }[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState(asset?.itemId ?? "");

  const isAcquisition = expense.assetExpenseRole === "acquisition";

  function apply(assetId: string) {
    setChoice(assetId);
    setError(null);
    startTransition(async () => {
      const result = await linkExpenseToAsset({
        expenseId: expense.id,
        assetId: assetId === "" ? null : assetId,
        role: assetId === "" ? null : "maintenance",
      });
      if (result?.error) setError(result.error);
    });
  }

  if (options.length === 0 && !asset) return null;

  return (
    <Card data-testid="asset-link">
      <CardHeader>
        <CardTitle>Mantenimiento de un activo</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>No se pudo vincular</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isAcquisition ? (
          <p className="text-sm text-muted-foreground">
            Este egreso es la compra de {asset?.name}. Su importe ya está
            representado por el costo declarado del activo.
          </p>
        ) : (
          <>
            <Select value={choice} onValueChange={(value) => apply(value)} disabled={pending}>
              <SelectTrigger data-testid="asset-link-select" aria-label="Activo">
                <SelectValue placeholder="Sin activo" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {options.map((option) => (
                    <SelectItem key={option.itemId} value={option.itemId}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            {asset && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start"
                disabled={pending}
                onClick={() => apply("")}
              >
                Desvincular
              </Button>
            )}

            <p className="text-xs text-muted-foreground">
              Lo vinculado suma al costo del activo y deja de restar del margen
              con el que se mide su recuperación.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
