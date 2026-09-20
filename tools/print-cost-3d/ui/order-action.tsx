"use client";

import { useId, useState, useTransition } from "react";

import { addOrderLine } from "@/actions/orders";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readConfig, type PrintCostConfig } from "@/tools/print-cost-3d/schema";
import { CalculatorForm, InvalidConfigNotice } from "@/tools/print-cost-3d/ui/calculator-form";
import { money } from "@/tools/print-cost-3d/ui/format";
import { usePrintCost } from "@/tools/print-cost-3d/ui/use-print-cost";

/**
 * KAM-27 · La calculadora abierta desde el detalle de un pedido (spec
 * `print-cost-3d` → *Desde un pedido, el resultado se vuelve una línea*).
 *
 * Se calcula, se elige precio unitario o por mayor, se ajustan descripción,
 * cantidad y precio, y al confirmar se añade **una línea libre** por la acción
 * del núcleo `addOrderLine` — con la sesión, el rol, la RLS y la bitácora de
 * quien confirma. La línea lleva descripción, cantidad y precio: **ni el costo
 * ni el margen salen de este diálogo**.
 *
 * El precio sugerido es un punto de partida, no una atadura: lo que se guarde
 * es lo que quede escrito, igual que con el precio del catálogo.
 */
type PriceKind = "unit" | "wholesale";

const DEFAULT_DESCRIPTION = "Impresión 3D";

function toNumber(text: string): number {
  return Number(text.trim().replace(",", "."));
}

function LineBuilder({
  orderId,
  config,
  currency,
  onDone,
}: {
  orderId: string;
  config: PrintCostConfig;
  currency: string;
  onDone: () => void;
}) {
  const baseId = useId();
  const state = usePrintCost(config);
  const { result, input } = state;

  const [kind, setKind] = useState<PriceKind>("unit");
  const [description, setDescription] = useState(DEFAULT_DESCRIPTION);
  // `null` = la persona no lo ha tocado: sigue al cálculo. En cuanto escribe,
  // manda lo que escribió, aunque el cálculo cambie por debajo.
  const [quantity, setQuantity] = useState<string | null>(null);
  const [price, setPrice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const suggested = result ? (kind === "unit" ? result.unitPrice : result.wholesalePrice) : null;
  const priceText = price ?? (suggested === null ? "" : money(suggested));
  const quantityText = quantity ?? String(input?.units ?? 1);
  const ready = state.touched && result !== null;

  function confirm() {
    setError(null);
    startTransition(async () => {
      const response = await addOrderLine({
        orderId,
        line: {
          // Identificador generado en el cliente (convención nº 9).
          id: crypto.randomUUID(),
          description: description.trim(),
          quantity: toNumber(quantityText),
          unitPrice: toNumber(priceText),
        },
      });
      if (response?.error) setError(response.error);
      else onDone();
    });
  }

  return (
    <>
      <div className="max-h-[60vh] space-y-6 overflow-y-auto pr-1">
        <CalculatorForm config={config} currency={currency} state={state} />

        {ready && (
          <fieldset className="space-y-4 border-t pt-4" data-testid="print-cost-line">
            <legend className="text-sm font-medium">La línea que se añadirá al pedido</legend>

            <div role="radiogroup" aria-label="Precio a usar" className="flex flex-wrap gap-4 text-sm">
              {(
                [
                  ["unit", "Precio unitario", result.unitPrice],
                  ["wholesale", "Precio por mayor", result.wholesalePrice],
                ] as const
              ).map(([value, label, amount]) => (
                <label key={value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`${baseId}-kind`}
                    checked={kind === value}
                    onChange={() => {
                      setKind(value);
                      // Cambiar de precio sugerido descarta el ajuste a mano.
                      setPrice(null);
                    }}
                  />
                  {label} ({money(amount)})
                </label>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_7rem_8rem]">
              <div className="space-y-1.5">
                <Label htmlFor={`${baseId}-description`}>Descripción</Label>
                <Input
                  id={`${baseId}-description`}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${baseId}-quantity`}>Cantidad</Label>
                <Input
                  id={`${baseId}-quantity`}
                  type="text"
                  inputMode="decimal"
                  value={quantityText}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${baseId}-price`}>Precio ({currency})</Label>
                <Input
                  id={`${baseId}-price`}
                  type="text"
                  inputMode="decimal"
                  value={priceText}
                  onChange={(event) => setPrice(event.target.value)}
                />
              </div>
            </div>
          </fieldset>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={pending}>
            Cancelar
          </Button>
        </DialogClose>
        <Button type="button" disabled={!ready || pending} onClick={confirm}>
          {pending ? "Añadiendo…" : "Añadir al pedido"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function PrintCostOrderAction({
  orderId,
  config,
  currency,
}: {
  orderId: string;
  config: unknown;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const parsed = readConfig(config);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        data-testid="order-tool-print-cost-3d"
        onClick={() => setOpen(true)}
      >
        Calcular impresión 3D
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        {/* El contenido se desmonta al cerrar: cada apertura empieza vacía, y
            un cálculo cancelado no deja nada escrito para la próxima. */}
        <DialogContent className="sm:max-w-4xl" data-testid="print-cost-dialog">
          <DialogHeader>
            <DialogTitle>Calculadora de impresión 3D</DialogTitle>
            <DialogDescription>
              Calcula el costo de la pieza y añade una línea a este pedido con el precio que
              decidas. El costo y el margen no se guardan.
            </DialogDescription>
          </DialogHeader>

          {parsed ? (
            <LineBuilder
              orderId={orderId}
              config={parsed}
              currency={currency}
              onDone={() => setOpen(false)}
            />
          ) : (
            <InvalidConfigNotice />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
