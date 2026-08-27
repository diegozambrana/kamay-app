"use client";

import { useState, useTransition } from "react";

import { createItemVariant, updateItemVariant } from "@/actions/catalog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { itemVariantFormSchema } from "@/lib/catalog/schema";
import type { ItemVariant } from "@/types";

/** Alta y edición de una variante ('11oz', 'Negro', 'XL'), en diálogo. */
export function VariantFormDialog({
  open,
  onOpenChange,
  itemId,
  variant,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  variant?: ItemVariant;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    const parsed = itemVariantFormSchema.safeParse({
      name: String(data.get("name") ?? ""),
      salePrice: String(data.get("salePrice") ?? ""),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = variant
        ? await updateItemVariant({ ...parsed.data, id: variant.id, itemId })
        : await createItemVariant({
            ...parsed.data,
            // Identificador generado en el cliente (convención nº 9).
            id: crypto.randomUUID(),
            itemId,
          });

      if (result?.error) {
        setError(result.error);
        return;
      }
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <form onSubmit={submit} data-testid="variant-form">
          <DialogHeader>
            <DialogTitle>
              {variant ? "Editar variante" : "Nueva variante"}
            </DialogTitle>
            <DialogDescription>
              Una presentación del mismo ítem: tamaño, color o medida.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>No se pudo guardar</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <FieldGroup className="mt-4">
            <Field>
              <FieldLabel htmlFor="variant-name">Nombre</FieldLabel>
              <Input
                id="variant-name"
                name="name"
                defaultValue={variant?.name}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="variant-price">Precio</FieldLabel>
              <Input
                id="variant-price"
                name="salePrice"
                inputMode="decimal"
                defaultValue={variant?.salePrice ?? ""}
              />
              <FieldDescription>
                Solo si difiere del precio del ítem.
              </FieldDescription>
            </Field>
          </FieldGroup>

          <DialogFooter className="mt-6">
            <DialogClose asChild>
              <Button variant="outline" type="button">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {variant ? "Guardar" : "Agregar variante"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
