"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
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
import type { CartLine } from "@/lib/fair/cart";
import { PAYMENT_METHODS, type PaymentMethod } from "@/types";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  other: "Otro",
};

/** Redondeo a centavos para el subtotal que se muestra. */
function cents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * El cobro del pie del panel. Vive aparte para montarse solo con el panel
 * abierto: al cerrarlo se desmonta, y la apertura siguiente vuelve a proponer
 * el total vigente sin un efecto que sincronice estado con props.
 *
 * Mientras nadie edita el monto, el monto **es** el total: si con el panel
 * abierto se sube una línea, el monto propuesto sube con ella. Una vez
 * editado, queda lo que se escribió —se cobra en parte a veces—.
 */
function CheckoutFields({
  total,
  canRegister,
  onRegister,
}: {
  total: number;
  canRegister: boolean;
  onRegister: (amount: number, method: PaymentMethod) => void;
}) {
  const [edited, setEdited] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("cash");

  const amount = edited ?? String(total);
  const parsed = Number(amount);
  const valid = amount.trim() !== "" && Number.isFinite(parsed) && parsed >= 0;

  return (
    <div className="grid gap-3 border-t p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">Total</span>
        <span data-testid="drawer-total" className="text-2xl font-semibold tabular-nums">
          {total}
        </span>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="fair-amount">Monto a cobrar</Label>
        <Input
          id="fair-amount"
          data-testid="fair-amount"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setEdited(event.target.value)}
          className="h-12 text-xl tabular-nums"
        />
      </div>

      <ToggleGroup
        type="single"
        value={method}
        onValueChange={(value) => value && setMethod(value as PaymentMethod)}
        className="grid grid-cols-3 gap-2"
        aria-label="Método de pago"
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
        data-testid="fair-register"
        disabled={!canRegister || !valid}
        onClick={() => onRegister(parsed, method)}
        className="h-14 text-lg"
      >
        Registrar pedido
      </Button>
    </div>
  );
}

/**
 * El panel del carrito: se abre con *Ver carrito* desde la derecha y reúne el
 * detalle y el cobro (`fair-product-photos-visibility-cart-drawer`).
 *
 * *Registrar pedido* registra la venta con su cobro con un solo control, así
 * que una venta de dos productos sigue en cuatro toques: *Agregar*,
 * *Agregar*, *Ver carrito*, *Registrar pedido*.
 *
 * Con el carrito vacío el panel no se cierra solo: quien acaba de quitar la
 * última línea tiene el dedo donde estaba, y un panel que desaparece es un
 * toque que cae en la cuadrícula.
 *
 * Sin descuentos, sin impuestos, sin cliente obligatorio: fuera de alcance
 * por decisión del backlog, igual que en la hoja de cobro que reemplaza.
 */
export function CartDrawer({
  open,
  lines,
  units,
  total,
  onOpenChange,
  onSetQuantity,
  onRemove,
  onRegister,
}: {
  open: boolean;
  lines: readonly CartLine[];
  units: number;
  total: number;
  onOpenChange: (open: boolean) => void;
  onSetQuantity: (lineId: string, quantity: number) => void;
  onRemove: (lineId: string) => void;
  onRegister: (amount: number, method: PaymentMethod) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b p-4">
          <SheetTitle>Carrito</SheetTitle>
          <SheetDescription>
            {units} {units === 1 ? "unidad" : "unidades"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {lines.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              El carrito está vacío.
            </p>
          ) : (
            <ul className="divide-y">
              {lines.map((line) => (
                <li
                  key={line.id}
                  data-testid="cart-line"
                  className="flex items-center gap-2 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{line.name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {line.unitPrice} × {line.quantity}
                    </p>
                  </div>

                  <div className="flex items-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-11"
                      aria-label={`Disminuir ${line.name}`}
                      disabled={line.quantity <= 1}
                      onClick={() => onSetQuantity(line.id, line.quantity - 1)}
                    >
                      <Minus aria-hidden />
                    </Button>
                    <span className="w-8 text-center font-semibold tabular-nums">
                      {line.quantity}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-11"
                      aria-label={`Aumentar ${line.name}`}
                      onClick={() => onSetQuantity(line.id, line.quantity + 1)}
                    >
                      <Plus aria-hidden />
                    </Button>
                  </div>

                  <span
                    data-testid="cart-line-subtotal"
                    className="w-14 text-right text-sm font-semibold tabular-nums"
                  >
                    {cents(line.quantity * line.unitPrice)}
                  </span>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={`Quitar ${line.name}`}
                    onClick={() => onRemove(line.id)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {open ? (
          <CheckoutFields
            total={total}
            canRegister={lines.length > 0}
            onRegister={onRegister}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
