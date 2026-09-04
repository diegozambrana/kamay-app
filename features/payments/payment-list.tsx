"use client";

import { useState, useTransition } from "react";

import { voidPayment } from "@/actions/payments";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format/datetime";
import { cn } from "@/lib/utils";
import type { Payment, PaymentMethod } from "@/types";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  other: "Otro",
};

/**
 * Lista de movimientos de un documento.
 *
 * Los anulados se muestran tachados y no se ocultan: un movimiento anulado
 * sigue siendo parte de lo que pasó, y esconderlo dejaría el saldo sin
 * explicación. Lo que no hace es contar, y de eso se ocupa la vista.
 */
export function PaymentList({
  payments,
  timezone,
  canVoid,
  onVoided,
}: {
  payments: Payment[];
  timezone: string;
  /** Anular es del dueño: lo decide `enforce_archive_rules` en la base. */
  canVoid: boolean;
  /** Actualización optimista del saldo al anular. */
  onVoided?: (amount: number) => void;
}) {
  const [asking, setAsking] = useState<Payment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirmVoid() {
    if (!asking) return;
    const target = asking;
    setError(null);

    startTransition(async () => {
      const result = await voidPayment({ id: target.id });
      if (result?.error) {
        setError(result.error);
        return;
      }
      onVoided?.(target.amount);
      setAsking(null);
    });
  }

  if (payments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no hay movimientos registrados.
      </p>
    );
  }

  return (
    <>
      {error && (
        <Alert variant="destructive" role="alert" className="mb-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <ul className="flex flex-col gap-2 text-sm">
        {payments.map((payment) => {
          const voided = Boolean(payment.archivedAt);

          return (
            <li
              key={payment.id}
              data-testid="payment-entry"
              data-voided={voided ? "1" : "0"}
              className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-2 last:border-b-0"
            >
              <span className="flex flex-wrap items-baseline gap-2">
                <span
                  className={cn("font-medium tabular-nums", voided && "line-through")}
                >
                  {payment.amount.toFixed(2)}
                </span>
                {payment.method && (
                  <span className="text-muted-foreground">
                    {METHOD_LABELS[payment.method]}
                  </span>
                )}
                <span className="text-muted-foreground">
                  {formatDateTime(payment.occurredAt, timezone)}
                </span>
                {voided && <Badge variant="outline">Anulado</Badge>}
                {payment.note && (
                  <span className="text-muted-foreground">· {payment.note}</span>
                )}
              </span>

              {canVoid && !voided && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-testid="void-payment"
                  onClick={() => setAsking(payment)}
                >
                  Anular
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      <AlertDialog
        open={asking !== null}
        onOpenChange={(open) => !open && setAsking(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular este movimiento?</AlertDialogTitle>
            <AlertDialogDescription>
              No se borra: queda registrado como anulado y deja de contar en el
              saldo. Tanto el movimiento como su anulación quedan en la
              bitácora.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                confirmVoid();
              }}
              disabled={pending}
              data-testid="confirm-void"
            >
              {pending ? "Anulando…" : "Anular"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
