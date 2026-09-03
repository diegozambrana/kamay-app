"use client";

import { Trash2Icon } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { purchaseTotal } from "@/lib/expenses/totals";
import { formatDate } from "@/lib/format/datetime";
import { pickerCandidates, type PickableItem } from "@/lib/orders/lines";
import type { ItemVariant } from "@/types";

/** Una fila tal como la edita el formulario. Los números llegan como texto. */
export type PurchaseEditorLine = {
  id: string;
  itemId: string;
  variantId: string | null;
  quantity: number | string;
  unitPrice: number | string;
};

/** Nombres del catálogo, solo para mostrar: no viajan al servidor. */
export type PurchaseLineNames = { item: string; variant: string | null };

export type PurchaseLineErrors = { quantity?: string; unitPrice?: string };

/** La pista del último precio pagado por un insumo (design D3). */
export type LastCostHint = {
  lastCost: number;
  lastPurchaseAt: string;
  supplierName: string | null;
};

function toNumber(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * La tabla editable de insumos del formulario de compra (V8): buscador, filas
 * con cantidad y precio, y el total en vivo.
 *
 * El precio de cada fila nace VACÍO. Junto a él, si el insumo ya se compró
 * antes, se muestra el último precio pagado como pista —con su fecha y su
 * proveedor— y nada lo copia al campo: la persona escribe lo que pagó hoy
 * (criterio 4 del backlog, design D3).
 *
 * El total se calcula aquí solo para verlo mientras se escribe; no viaja ni
 * se guarda (convención nº 4): el real lo devuelve `expense_totals`.
 */
export function PurchaseLinesTable({
  lines,
  names,
  supplies,
  businessLineId,
  hints,
  timezone,
  disabled,
  error,
  lineErrors,
  onAdd,
  onUpdate,
  onRemove,
}: {
  lines: PurchaseEditorLine[];
  names: Record<string, PurchaseLineNames>;
  supplies: PickableItem[];
  businessLineId: string | null;
  hints: Record<string, LastCostHint>;
  timezone: string;
  disabled?: boolean;
  /** Error de la sección entera, como "Agrega al menos un insumo". */
  error?: string;
  lineErrors?: (PurchaseLineErrors | undefined)[];
  onAdd: (line: PurchaseEditorLine, displayNames: PurchaseLineNames) => void;
  onUpdate: (index: number, patch: Partial<PurchaseEditorLine>) => void;
  onRemove: (index: number) => void;
}) {
  const total = purchaseTotal(
    lines.map((line) => ({
      quantity: toNumber(line.quantity),
      unitPrice: toNumber(line.unitPrice),
    })),
  );

  function pick(item: PickableItem, variant: ItemVariant | null) {
    onAdd(
      {
        // Generado en el cliente (convención nº 9).
        id: crypto.randomUUID(),
        itemId: item.id,
        variantId: variant?.id ?? null,
        quantity: 1,
        // Vacío a propósito: la pista se muestra, no se copia.
        unitPrice: "",
      },
      { item: item.name, variant: variant?.name ?? null },
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="purchase-lines">
      <SupplyPicker
        supplies={supplies}
        businessLineId={businessLineId}
        disabled={disabled}
        onPick={pick}
      />

      {error && <FieldError data-testid="lines-error">{error}</FieldError>}

      {lines.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyTitle>Sin insumos todavía</EmptyTitle>
            <EmptyDescription>Busca un insumo del catálogo para agregarlo.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {lines.map((line, index) => {
            const issues = lineErrors?.[index];
            const displayName = names[line.id]?.item ?? "Insumo";
            const variantName = names[line.id]?.variant;
            const hint = hints[line.itemId];
            const subtotal = toNumber(line.quantity) * toNumber(line.unitPrice);

            return (
              <li
                key={line.id}
                data-testid="purchase-line-row"
                className="rounded-lg border p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">
                    {displayName}
                    {variantName && (
                      <span className="text-muted-foreground"> · {variantName}</span>
                    )}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={disabled}
                    aria-label={`Quitar ${displayName}`}
                    onClick={() => onRemove(index)}
                  >
                    <Trash2Icon className="size-4" aria-hidden />
                    Quitar
                  </Button>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field data-invalid={issues?.quantity ? true : undefined}>
                    <FieldLabel htmlFor={`purchase-quantity-${line.id}`}>Cantidad</FieldLabel>
                    <Input
                      id={`purchase-quantity-${line.id}`}
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      value={line.quantity}
                      disabled={disabled}
                      aria-invalid={issues?.quantity ? true : undefined}
                      onChange={(event) => onUpdate(index, { quantity: event.target.value })}
                    />
                    {issues?.quantity && <FieldError>{issues.quantity}</FieldError>}
                  </Field>

                  <Field data-invalid={issues?.unitPrice ? true : undefined}>
                    <FieldLabel htmlFor={`purchase-price-${line.id}`}>Precio unitario</FieldLabel>
                    <Input
                      id={`purchase-price-${line.id}`}
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      value={line.unitPrice}
                      placeholder="0.00"
                      disabled={disabled}
                      aria-invalid={issues?.unitPrice ? true : undefined}
                      onChange={(event) => onUpdate(index, { unitPrice: event.target.value })}
                    />
                    {hint && (
                      <p className="text-xs text-muted-foreground" data-testid="last-cost-hint">
                        Último: {hint.lastCost.toFixed(2)} ·{" "}
                        {formatDate(hint.lastPurchaseAt, timezone)}
                        {hint.supplierName && ` · ${hint.supplierName}`}
                      </p>
                    )}
                    {issues?.unitPrice && <FieldError>{issues.unitPrice}</FieldError>}
                  </Field>
                </div>

                <p className="mt-2 text-right text-sm text-muted-foreground">
                  Subtotal{" "}
                  <span data-testid="line-subtotal" className="tabular-nums">
                    {subtotal.toFixed(2)}
                  </span>
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-right font-medium">
        Total{" "}
        <span data-testid="purchase-form-total" className="tabular-nums">
          {total.toFixed(2)}
        </span>
      </p>
    </div>
  );
}

/**
 * Buscador de insumos. Filtra en memoria con la misma normalización que la
 * base (`pickerCandidates`), acotado a la línea de la compra y a lo
 * compartido. Un insumo con variantes exige elegir cuál.
 */
function SupplyPicker({
  supplies,
  businessLineId,
  onPick,
  disabled,
}: {
  supplies: PickableItem[];
  businessLineId: string | null;
  onPick: (item: PickableItem, variant: ItemVariant | null) => void;
  disabled?: boolean;
}) {
  const [term, setTerm] = useState("");
  const [expanded, setExpanded] = useState<PickableItem | null>(null);

  const candidates = useMemo(
    () => pickerCandidates(supplies, businessLineId, term),
    [supplies, businessLineId, term],
  );

  function choose(item: PickableItem) {
    if (item.variants.length > 0) {
      setExpanded(item);
      return;
    }
    onPick(item, null);
    reset();
  }

  function reset() {
    setTerm("");
    setExpanded(null);
  }

  return (
    <div className="flex flex-col gap-2" data-testid="supply-picker">
      <Field>
        <FieldLabel htmlFor="supply-picker-input">Agregar insumo</FieldLabel>
        <Input
          id="supply-picker-input"
          value={term}
          disabled={disabled}
          placeholder="Buscar un insumo"
          onChange={(event) => {
            setTerm(event.target.value);
            setExpanded(null);
          }}
        />
      </Field>

      {term !== "" && (
        <ul
          data-testid="supply-options"
          className="divide-y overflow-hidden rounded-lg border text-sm"
        >
          {expanded === null ? (
            <>
              {candidates.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted"
                    onClick={() => choose(item)}
                  >
                    <span>{item.name}</span>
                    {item.variants.length > 0 && (
                      <Badge variant="secondary">{item.variants.length} variantes</Badge>
                    )}
                  </button>
                </li>
              ))}
              {candidates.length === 0 && (
                <li className="px-3 py-2 text-muted-foreground">
                  Sin coincidencias entre los insumos de esta línea
                </li>
              )}
            </>
          ) : (
            <>
              <li className="px-3 py-2 text-muted-foreground">
                Elige una variante de {expanded.name}
              </li>
              {expanded.variants.map((variant) => (
                <li key={variant.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    data-testid="variant-option"
                    className="w-full px-3 py-2 text-left hover:bg-muted"
                    onClick={() => {
                      onPick(expanded, variant);
                      reset();
                    }}
                  >
                    {variant.name}
                  </button>
                </li>
              ))}
              <li className="p-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => setExpanded(null)}>
                  Volver
                </Button>
              </li>
            </>
          )}
        </ul>
      )}
    </div>
  );
}
