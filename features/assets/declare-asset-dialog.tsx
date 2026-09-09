"use client";

import { useState, useTransition } from "react";

import { saveAssetDetails } from "@/actions/assets";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { assetDetailsSchema } from "@/lib/assets/schema";

/** El activo que una compra recién guardada permite declarar. */
export type DeclarableAsset = {
  itemId: string;
  name: string;
  /** Importe de su línea en la compra: cantidad × precio. */
  suggestedCost: number;
  /** Fecha del hecho de la compra, en formato `YYYY-MM-DD`. */
  suggestedDate: string;
};

/**
 * Ofrecer declarar un activo tras guardar la compra que lo trajo (design D9).
 *
 * Es un ofrecimiento **posterior al guardado**, no un paso del formulario:
 * `create_expense` es atómica y meterle dentro un `asset_details` opcional la
 * volvería condicional sobre datos que solo la persona dueña puede escribir.
 * Declinar no deshace nada — la compra ya está guardada y el activo se puede
 * declarar después desde el catálogo.
 *
 * Las cifras llegan prellenadas pero editables: una compra puede traer la
 * máquina y sus accesorios en el mismo documento, así que el costo del activo
 * no siempre es el importe de su línea (design D3).
 */
export function DeclareAssetDialog({
  asset,
  expenseId,
  onDone,
}: {
  asset: DeclarableAsset | null;
  /** El egreso queda marcado como la adquisición del activo al aceptar. */
  expenseId: string;
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!asset) return null;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!asset) return;

    const data = new FormData(event.currentTarget);
    const parsed = assetDetailsSchema.safeParse({
      itemId: asset.itemId,
      acquisitionCost: String(data.get("acquisitionCost") ?? ""),
      acquiredOn: String(data.get("acquiredOn") ?? ""),
      supplierId: null,
      notes: null,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await saveAssetDetails({ ...parsed.data, acquisitionExpenseId: expenseId });
      if (result?.error) {
        setError(result.error);
        return;
      }
      onDone();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onDone()}>
      <DialogContent data-testid="declare-asset-dialog">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>¿Declarar {asset.name} como activo?</DialogTitle>
            <DialogDescription>
              La compra ya quedó guardada. Si declaras la máquina, podrás ver
              cuánto lleva devuelto del margen de su línea desde hoy.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-4">
            {error && (
              <Alert variant="destructive">
                <AlertTitle>No se pudo declarar</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Field>
              <FieldLabel htmlFor="declare-cost">Costo de adquisición</FieldLabel>
              <Input
                id="declare-cost"
                name="acquisitionCost"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                defaultValue={asset.suggestedCost}
                required
              />
              <FieldDescription>
                Viene de su línea en esta compra. Ajústalo si la compra traía
                además otras cosas.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="declare-date">Fecha de compra</FieldLabel>
              <Input
                id="declare-date"
                name="acquiredOn"
                type="date"
                defaultValue={asset.suggestedDate}
                required
              />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="ghost" disabled={pending} onClick={onDone}>
              Ahora no
            </Button>
            <Button type="submit" disabled={pending}>
              Declarar activo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
