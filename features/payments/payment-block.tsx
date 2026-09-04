"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { balance } from "@/lib/payments/balance";
import { cn } from "@/lib/utils";
import type { Payment } from "@/types";

import { PaymentDialog, type PaymentTarget } from "./payment-dialog";
import { PaymentList } from "./payment-list";
import { PaymentStatusBadge } from "./payment-status-badge";

/**
 * Bloque de cobros y saldo del detalle de un pedido (V4) o de un egreso (V7).
 *
 * El saldo se actualiza de forma optimista al registrar o anular —el mismo
 * patrón que el arrastre del tablero—, pero la lista de movimientos espera la
 * respuesta real: un importe mal redondeado en el cliente sería un error
 * visible en dinero, y el saldo aproximado durante un instante no lo es
 * (design D8).
 */
export function PaymentBlock({
  target,
  total,
  paid,
  payments,
  timezone,
  canVoid,
  canRegister = true,
  frozen = false,
}: {
  target: PaymentTarget;
  total: number;
  /** Lo cobrado según la vista: nunca una columna (convención nº 4). */
  paid: number;
  payments: Payment[];
  timezone: string;
  canVoid: boolean;
  /** El ayudante no registra pagos de egresos (matriz §16). */
  canRegister?: boolean;
  /** Un documento archivado está congelado: no admite movimientos nuevos. */
  frozen?: boolean;
}) {
  const isCollection = target.kind === "order";
  // Ajuste optimista sobre lo que dice el servidor, no un saldo propio.
  const [adjustment, setAdjustment] = useState(0);
  const [open, setOpen] = useState(false);

  // Cuando el servidor responde y `revalidatePath` trae el `paid` nuevo, el
  // ajuste ya está contado en él: mantenerlo lo sumaría dos veces y el saldo
  // mostraría 140 donde debe mostrar 340. Se descarta en el mismo render en
  // que cambia el dato del servidor.
  const [serverPaid, setServerPaid] = useState(paid);
  if (paid !== serverPaid) {
    setServerPaid(paid);
    setAdjustment(0);
  }

  const shownPaid = paid + adjustment;
  const pendingBalance = balance(total, shownPaid);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>{isCollection ? "Cobros y saldo" : "Pagos y saldo"}</CardTitle>
        {canRegister && !frozen && (
          <Button
            type="button"
            size="sm"
            data-testid="register-payment"
            onClick={() => setOpen(true)}
          >
            {isCollection ? "Registrar cobro" : "Registrar pago"}
          </Button>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <Figure label="Total" value={total} testId="payment-total" />
          <Figure
            label={isCollection ? "Cobrado" : "Pagado"}
            value={shownPaid}
            testId="payment-paid"
          />
          <Figure
            label="Saldo pendiente"
            value={pendingBalance}
            testId="payment-balance"
            // Un saldo negativo es saldo a favor: se marca, no se esconde.
            className={cn(pendingBalance < 0 && "text-sky-700 dark:text-sky-400")}
          />
          <PaymentStatusBadge total={total} paid={shownPaid} />
        </div>

        <PaymentList
          payments={payments}
          timezone={timezone}
          canVoid={canVoid}
          onVoided={(amount) => setAdjustment((current) => current - amount)}
        />
      </CardContent>

      <PaymentDialog
        target={target}
        pendingBalance={pendingBalance}
        open={open}
        onOpenChange={setOpen}
        onRegistered={(amount) => setAdjustment((current) => current + amount)}
      />
    </Card>
  );
}

function Figure({
  label,
  value,
  testId,
  className,
}: {
  label: string;
  value: number;
  testId: string;
  className?: string;
}) {
  return (
    <span className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("font-medium tabular-nums", className)} data-testid={testId}>
        {value.toFixed(2)}
      </span>
    </span>
  );
}
