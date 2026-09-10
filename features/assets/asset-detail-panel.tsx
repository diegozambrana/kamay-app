"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { linkExpenseToAsset } from "@/actions/assets";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RelatedTasksPanel } from "@/features/tasks/links/related-tasks-panel";
import { hasAttributableLine } from "@/lib/assets/recovery";
import { formatCalendarDate, formatDateTime } from "@/lib/format/datetime";
import type { ActivityEntry, AssetRecovery } from "@/types";

import type { AssetExpense } from "@/services/assets/asset-service";

import { AssetDetailsForm } from "./asset-details-form";
import { RecoveryBar } from "./recovery-bar";

const ACTION_LABELS: Record<ActivityEntry["action"], string> = {
  created: "Registrado",
  updated: "Editado",
  status_changed: "Cambió de estado",
  archived: "Archivado",
  unarchived: "Desarchivado",
};

/** El activo abierto, con todo lo que el panel muestra, resuelto en el servidor. */
export type AssetDetailView = {
  asset: AssetRecovery;
  supplierId: string | null;
  supplierName: string | null;
  notes: string | null;
  /** Los egresos que le pertenecen, de los dos papeles. */
  expenses: AssetExpense[];
  history: ActivityEntry[];
  /** Proveedores vigentes, para el formulario de datos. */
  suppliers: { id: string; name: string }[];
};

function ExpenseLine({ expense }: { expense: AssetExpense }) {
  return (
    <li className="flex items-baseline justify-between gap-2" data-testid="asset-expense">
      <Link
        href={`/expenses/${expense.id}`}
        className="underline-offset-4 hover:underline"
        data-role={expense.assetExpenseRole ?? undefined}
      >
        {formatCalendarDate(expense.occurredAt.slice(0, 10))}
        {expense.note ? ` · ${expense.note}` : ""}
      </Link>
      <span className="tabular-nums">{expense.total.toFixed(2)}</span>
    </li>
  );
}

/**
 * Detalle del activo en panel lateral (mapa §7): sus datos, el desglose de su
 * costo, los egresos que le pertenecen y su historial.
 *
 * Cada egreso lleva a su detalle: el panel dice cuánto, y el egreso dice qué
 * fue. Duplicar aquí las líneas de la compra sería mantener dos versiones de
 * lo mismo.
 */
export function AssetDetailPanel({
  detail,
  timezone,
  onClose,
}: {
  detail: AssetDetailView | null;
  timezone: string;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!detail) {
    return (
      <Sheet open={false} onOpenChange={() => undefined}>
        <SheetContent />
      </Sheet>
    );
  }

  const { asset, supplierId, supplierName, notes, expenses, history, suppliers } = detail;
  const acquisition = expenses.find((item) => item.assetExpenseRole === "acquisition") ?? null;
  const maintenance = expenses.filter((item) => item.assetExpenseRole === "maintenance");

  function unlink(expenseId: string) {
    setError(null);
    startTransition(async () => {
      const result = await linkExpenseToAsset({ expenseId, assetId: null, role: null });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <Sheet open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{asset.name}</SheetTitle>
          <SheetDescription>
            <Link href={`/catalog/${asset.itemId}`} className="hover:underline">
              Abrir el ítem en el catálogo
            </Link>
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-4">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>No se pudo completar la acción</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {hasAttributableLine(asset) ? (
            <RecoveryBar
              totalCost={asset.totalCost}
              marginSince={asset.lineMarginSince}
              label={asset.name}
            />
          ) : (
            <p className="text-sm text-muted-foreground" data-testid="not-attributable">
              Compartido entre líneas: su recuperación no se puede atribuir a una
              sola línea hasta que exista la regla de reparto de los reportes.
            </p>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Costo total</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-1 text-sm" data-testid="cost-breakdown">
                <div className="flex justify-between gap-2">
                  <dt>Adquisición</dt>
                  <dd className="tabular-nums">{asset.acquisitionCost.toFixed(2)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Mantenimiento</dt>
                  <dd className="tabular-nums">{asset.maintenanceCost.toFixed(2)}</dd>
                </div>
                <div className="flex justify-between gap-2 border-t pt-1 font-medium">
                  <dt>Total</dt>
                  <dd className="tabular-nums" data-testid="detail-total-cost">
                    {asset.totalCost.toFixed(2)}
                  </dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-muted-foreground">
                Comprado el {formatCalendarDate(asset.acquiredOn)}
                {supplierName ? ` a ${supplierName}` : ""}.
              </p>
              {notes && <p className="mt-1 text-xs text-muted-foreground">{notes}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Egresos del activo</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div>
                <h3 className="text-xs font-medium text-muted-foreground">Adquisición</h3>
                {acquisition ? (
                  <ul className="mt-1">
                    <ExpenseLine expense={acquisition} />
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground" data-testid="no-acquisition">
                    Sin egreso de compra vinculado. Mientras no lo esté, ese pago
                    sigue restando del margen de la línea.
                  </p>
                )}
              </div>

              <div>
                <h3 className="text-xs font-medium text-muted-foreground">Mantenimiento</h3>
                {maintenance.length === 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Todavía no se ha gastado nada en mantenerlo.
                  </p>
                ) : (
                  <ul className="mt-1 flex flex-col gap-1">
                    {maintenance.map((expense) => (
                      <div key={expense.id} className="flex items-baseline gap-2">
                        <ExpenseLine expense={expense} />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          onClick={() => unlink(expense.id)}
                        >
                          Desvincular
                        </Button>
                      </div>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Para vincular un gasto, ábrelo en la bandeja de egresos y elige
                  este activo.
                </p>
              </div>
            </CardContent>
          </Card>

          <AssetDetailsForm
            itemId={asset.itemId}
            acquisitionCost={asset.acquisitionCost}
            acquiredOn={asset.acquiredOn}
            supplierId={supplierId}
            notes={notes}
            suppliers={suppliers}
          />

          <Card>
            <CardHeader>
              <CardTitle>Tareas relacionadas</CardTitle>
            </CardHeader>
            <CardContent>
              {/* El panel elige en cliente, así que el bloque sigue a la
                  selección. La pantalla ya es solo del dueño (KAM-19), de modo
                  que aquí no hace falta ningún filtro de rol añadido. */}
              <RelatedTasksPanel
                entityType="asset"
                entityId={asset.itemId}
                timezone={timezone}
              />
            </CardContent>
          </Card>

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
        </div>
      </SheetContent>
    </Sheet>
  );
}
