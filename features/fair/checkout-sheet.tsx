"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PAYMENT_METHODS, type PaymentMethod } from "@/types";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  other: "Otro",
};

/**
 * El formulario de la hoja. Vive aparte para que el `key` de abajo lo vuelva a
 * montar en cada apertura: así el monto propuesto se toma del total vigente al
 * abrir, sin un efecto que sincronice estado con props.
 */
function CheckoutForm({
  total,
  onConfirm,
}: {
  total: number;
  onConfirm: (amount: number, method: PaymentMethod) => void;
}) {
  const [amount, setAmount] = useState(String(total));
  const [method, setMethod] = useState<PaymentMethod>("cash");

  const parsed = Number(amount);
  const valid = Number.isFinite(parsed) && parsed >= 0;

  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="fair-amount">Monto</Label>
        <Input
          id="fair-amount"
          data-testid="fair-amount"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="h-14 text-2xl tabular-nums"
        />
      </div>

      <ToggleGroup
        type="single"
        value={method}
        onValueChange={(value) => value && setMethod(value as PaymentMethod)}
        className="grid grid-cols-3 gap-2"
      >
        {PAYMENT_METHODS.map((option) => (
          <ToggleGroupItem key={option} value={option} className="h-12">
            {METHOD_LABELS[option]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <Button
        type="button"
        size="lg"
        data-testid="fair-confirm"
        disabled={!valid}
        onClick={() => onConfirm(parsed, method)}
        className="h-14 text-lg"
      >
        Confirmar
      </Button>
    </>
  );
}

/**
 * La hoja de cobro: el cuarto y último toque de una venta.
 *
 * Propone el total y se confirma sin escribir nada — el caso normal de una
 * feria es cobrar lo que marca la pantalla. El monto es editable porque a
 * veces se cobra en parte, y un cero registra la venta sin cobro.
 *
 * Sin descuentos, sin impuestos, sin cliente obligatorio: fuera de alcance por
 * decisión del backlog, no por falta de tiempo.
 */
export function CheckoutSheet({
  open,
  total,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  total: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: (amount: number, method: PaymentMethod) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="gap-4 p-4">
        <SheetHeader className="p-0">
          <SheetTitle>Cobrar {total}</SheetTitle>
          <SheetDescription>
            El monto propuesto es el total. Cámbialo si cobras en parte.
          </SheetDescription>
        </SheetHeader>

        {/* El `key` es lo que hace que cada apertura proponga el total vigente:
            la hoja anterior pudo quedar con un monto editado de una venta que
            ya se cobró. Sin efecto que sincronice props con estado. */}
        {open ? (
          <CheckoutForm key={`${total}`} total={total} onConfirm={onConfirm} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
