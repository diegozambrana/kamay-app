"use client";

import { useState, useTransition } from "react";

import { registerCollection, registerPayment } from "@/actions/payments";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { overpayment } from "@/lib/payments/balance";
import type { PaymentMethod } from "@/types";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  other: "Otro",
};

/** El monto se muestra con dos decimales y sin separador de miles. */
function money(value: number): string {
  return value.toFixed(2);
}

/** La fecha del hecho la fija el cliente (convención nº 9). */
function nowLocal(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
}

export type PaymentTarget =
  | { kind: "order"; orderId: string }
  | { kind: "expense"; expenseId: string };

/**
 * Registrar un cobro o un pago. Es un diálogo y no una pantalla: el mapa de
 * navegación lo fija así (Pedidos → Detalle → diálogo, nunca un cuarto
 * nivel).
 *
 * El monto propuesto es el saldo pendiente, porque el caso normal —cobrar lo
 * que falta— tiene que ser un toque. Se puede cambiar, y si excede el saldo
 * se advierte pero no se bloquea: un negocio real recibe pagos de más y
 * necesita verlos, no perderlos.
 */
export function PaymentDialog({
  target,
  pendingBalance,
  open,
  onOpenChange,
  onRegistered,
}: {
  target: PaymentTarget;
  /** Saldo pendiente derivado; puede ser negativo si ya se cobró de más. */
  pendingBalance: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Actualización optimista del saldo, antes de que responda el servidor. */
  onRegistered?: (amount: number) => void;
}) {
  const isCollection = target.kind === "order";
  const suggested = pendingBalance > 0 ? money(pendingBalance) : "";

  const [amount, setAmount] = useState(suggested);
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [occurredAt, setOccurredAt] = useState(nowLocal);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Cada apertura parte del saldo del momento, no del de la vez anterior.
  function change(next: boolean) {
    if (next) {
      setAmount(pendingBalance > 0 ? money(pendingBalance) : "");
      setMethod("");
      setOccurredAt(nowLocal());
      setNote("");
      setError(null);
    }
    onOpenChange(next);
  }

  const parsedAmount = Number(amount);
  const excess = Number.isFinite(parsedAmount)
    ? overpayment(pendingBalance, parsedAmount)
    : 0;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const values = {
      id: crypto.randomUUID(),
      amount,
      method,
      // El `datetime-local` no lleva zona: se envía como instante.
      occurredAt: new Date(occurredAt).toISOString(),
      note,
    };

    startTransition(async () => {
      const result = isCollection
        ? await registerCollection({ ...values, orderId: target.orderId })
        : await registerPayment({ ...values, expenseId: target.expenseId });

      if (result?.error) {
        setError(result.error);
        return;
      }

      onRegistered?.(parsedAmount);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent data-testid="payment-dialog">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              {isCollection ? "Registrar cobro" : "Registrar pago"}
            </DialogTitle>
            <DialogDescription>
              Saldo pendiente{" "}
              <span data-testid="dialog-pending" className="tabular-nums">
                {money(pendingBalance)}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="payment-amount">Monto</Label>
            <Input
              id="payment-amount"
              name="amount"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              autoFocus
            />
          </div>

          {/* Se advierte del excedente y se deja confirmar: el saldo quedará
              negativo y visible, que es lo que el negocio necesita ver. */}
          {excess > 0 && (
            <Alert data-testid="overpayment-warning">
              <AlertDescription>
                Este {isCollection ? "cobro" : "pago"} excede el saldo pendiente
                en <span className="tabular-nums">{money(excess)}</span>. Puedes
                registrarlo igual: el saldo quedará a favor.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="payment-method">Forma de pago</Label>
            <Select
              value={method}
              onValueChange={(value) => setMethod(value as PaymentMethod)}
            >
              <SelectTrigger id="payment-method" aria-label="Forma de pago">
                <SelectValue placeholder="Sin declarar" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((value) => (
                  <SelectItem key={value} value={value}>
                    {METHOD_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="payment-date">Fecha</Label>
            <Input
              id="payment-date"
              type="datetime-local"
              value={occurredAt}
              onChange={(event) => setOccurredAt(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="payment-note">Nota</Label>
            <Textarea
              id="payment-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
            />
          </div>

          {error && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending} data-testid="payment-submit">
              {pending ? "Guardando…" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
