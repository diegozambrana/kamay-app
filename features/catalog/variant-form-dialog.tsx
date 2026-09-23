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
import { attributeInputsFrom, attributesSchema } from "@/lib/catalog/attributes";
import { itemVariantFormSchema } from "@/lib/catalog/schema";
import { ITEM_KIND_FIELDS } from "@/lib/catalog/fields";
import type { ItemCategoryAttribute, ItemKind, ItemVariant } from "@/types";

import { AttributeFields } from "./attribute-fields";

/** Alta y edición de una variante ('11oz', 'Negro', 'XL'), en diálogo. */
export function VariantFormDialog({
  open,
  onOpenChange,
  itemId,
  itemKind,
  variant,
  attributeFields = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  /** El precio solo se pide si el ítem es un producto (`ITEM_KIND_FIELDS`). */
  itemKind: ItemKind;
  variant?: ItemVariant;
  /**
   * Los atributos vigentes de alcance variante de la categoría del ítem
   * (`catalog-custom-attributes`), en orden. Sin ellos, el formulario es el
   * de siempre.
   */
  attributeFields?: ItemCategoryAttribute[];
}) {
  const hasPrice = ITEM_KIND_FIELDS[itemKind].salePrice;
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

    // El mismo esquema que el servidor, que igual vuelve a validar.
    const attributes = attributeInputsFrom(data, attributeFields);
    const checked = attributesSchema(attributeFields, variant?.attributes ?? {}).safeParse(
      attributes,
    );
    if (!checked.success) {
      setError(checked.error.issues[0].message);
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = variant
        ? await updateItemVariant({ ...parsed.data, attributes, id: variant.id, itemId })
        : await createItemVariant({
            ...parsed.data,
            attributes,
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
            {hasPrice && (
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
            )}
            <AttributeFields
              fields={attributeFields}
              values={variant?.attributes ?? {}}
              idPrefix="variant"
            />
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
