"use client";

import { Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  lineTotal,
  orderTotal,
  prefilledPrice,
  type PickableItem,
} from "@/lib/orders/lines";
import type { ItemVariant } from "@/types";

import { CatalogPicker } from "./catalog-picker";

/** Una línea tal como la edita el formulario. Los números llegan como texto. */
export type EditorLine = {
  id: string;
  itemId: string | null;
  variantId: string | null;
  description: string;
  quantity: number | string;
  unitPrice: number | string;
};

/** Nombres del catálogo, solo para mostrar: no viajan al servidor. */
export type LineNames = { item: string | null; variant: string | null };

export type LineErrors = {
  quantity?: string;
  unitPrice?: string;
  description?: string;
};

/**
 * Las líneas del pedido: buscador, filas editables y total en pantalla.
 *
 * El total se calcula aquí solo para que se vea mientras se escribe. **No
 * viaja ni se guarda** (convención nº 4): el total real lo devuelve la vista
 * `order_totals` sumando desde las líneas ya guardadas.
 *
 * El precio se prellena desde el catálogo pero queda en la línea: cambiarlo
 * aquí no toca el catálogo, y cambiar el catálogo mañana no toca este pedido
 * (esquema §2).
 */
export function OrderLinesEditor({
  lines,
  names,
  items,
  businessLineId,
  disabled,
  error,
  lineErrors,
  onAdd,
  onUpdate,
  onRemove,
}: {
  lines: EditorLine[];
  names: Record<string, LineNames>;
  items: PickableItem[];
  businessLineId: string | null;
  disabled?: boolean;
  /** Error de la sección entera, como "Agrega al menos una línea". */
  error?: string;
  lineErrors?: (LineErrors | undefined)[];
  onAdd: (line: EditorLine, displayNames: LineNames) => void;
  onUpdate: (index: number, patch: Partial<EditorLine>) => void;
  onRemove: (index: number) => void;
}) {
  function addFromCatalog(item: PickableItem, variant: ItemVariant | null) {
    onAdd(
      {
        // Generado en el cliente (convención nº 9).
        id: crypto.randomUUID(),
        itemId: item.id,
        variantId: variant?.id ?? null,
        description: "",
        quantity: 1,
        unitPrice: prefilledPrice(item, variant),
      },
      { item: item.name, variant: variant?.name ?? null },
    );
  }

  function addFreeLine() {
    onAdd(
      {
        id: crypto.randomUUID(),
        itemId: null,
        variantId: null,
        description: "",
        quantity: 1,
        unitPrice: 0,
      },
      { item: null, variant: null },
    );
  }

  const total = orderTotal(lines);

  return (
    <div className="flex flex-col gap-4" data-testid="order-lines">
      <CatalogPicker
        items={items}
        businessLineId={businessLineId}
        disabled={disabled}
        onPick={addFromCatalog}
        onFreeLine={addFreeLine}
      />

      {error && (
        <FieldError data-testid="lines-error">{error}</FieldError>
      )}

      {lines.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyTitle>Sin líneas todavía</EmptyTitle>
            <EmptyDescription>
              Busca un producto del catálogo o agrega una línea libre.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {lines.map((line, index) => {
            const issues = lineErrors?.[index];
            const displayName = names[line.id]?.item;
            const variantName = names[line.id]?.variant;

            return (
              <li
                key={line.id}
                data-testid="order-line-row"
                className="rounded-lg border p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {displayName ?? "Línea libre"}
                      {variantName && (
                        <span className="text-muted-foreground">
                          {" "}
                          · {variantName}
                        </span>
                      )}
                    </p>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={disabled}
                    aria-label={`Quitar ${displayName ?? "línea libre"}`}
                    onClick={() => onRemove(index)}
                  >
                    <Trash2Icon className="size-4" aria-hidden />
                    Quitar
                  </Button>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-[6rem_8rem_1fr]">
                  <Field data-invalid={issues?.quantity ? true : undefined}>
                    <FieldLabel htmlFor={`line-quantity-${line.id}`}>
                      Cantidad
                    </FieldLabel>
                    <Input
                      id={`line-quantity-${line.id}`}
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      value={line.quantity}
                      disabled={disabled}
                      aria-invalid={issues?.quantity ? true : undefined}
                      onChange={(event) =>
                        onUpdate(index, { quantity: event.target.value })
                      }
                    />
                    {issues?.quantity && (
                      <FieldError>{issues.quantity}</FieldError>
                    )}
                  </Field>

                  <Field data-invalid={issues?.unitPrice ? true : undefined}>
                    <FieldLabel htmlFor={`line-price-${line.id}`}>
                      Precio
                    </FieldLabel>
                    <Input
                      id={`line-price-${line.id}`}
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      value={line.unitPrice}
                      disabled={disabled}
                      aria-invalid={issues?.unitPrice ? true : undefined}
                      onChange={(event) =>
                        onUpdate(index, { unitPrice: event.target.value })
                      }
                    />
                    {issues?.unitPrice && (
                      <FieldError>{issues.unitPrice}</FieldError>
                    )}
                  </Field>

                  <Field data-invalid={issues?.description ? true : undefined}>
                    <FieldLabel htmlFor={`line-description-${line.id}`}>
                      {/* Sin producto, la descripción es lo único que dice qué
                          se pidió; con producto es la personalización. */}
                      {line.itemId === null
                        ? "Descripción"
                        : "Personalización (opcional)"}
                    </FieldLabel>
                    <Input
                      id={`line-description-${line.id}`}
                      value={line.description}
                      disabled={disabled}
                      placeholder={
                        line.itemId === null
                          ? "Qué se pidió"
                          : "Foto de la familia, fondo azul"
                      }
                      aria-invalid={issues?.description ? true : undefined}
                      onChange={(event) =>
                        onUpdate(index, { description: event.target.value })
                      }
                    />
                    {issues?.description && (
                      <FieldError>{issues.description}</FieldError>
                    )}
                  </Field>
                </div>

                <p className="mt-2 text-right text-sm text-muted-foreground">
                  Subtotal{" "}
                  <span data-testid="line-subtotal" className="tabular-nums">
                    {lineTotal(line).toFixed(2)}
                  </span>
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-right font-medium">
        Total{" "}
        <span data-testid="order-form-total" className="tabular-nums">
          {total.toFixed(2)}
        </span>
      </p>
    </div>
  );
}
