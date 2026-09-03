"use client";

import { PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { pickerCandidates, type PickableItem } from "@/lib/orders/lines";
import type { ItemVariant } from "@/types";

/**
 * Buscador de productos del formulario de pedido (design.md D7).
 *
 * Filtra en memoria con `pickerCandidates`, que usa la misma normalización
 * que la base: teclear "sublimacion" encuentra "Taza para sublimación", igual
 * que buscarlo en el catálogo.
 *
 * Un producto con variantes vigentes no se puede elegir "en general": hay que
 * decir cuál, porque el precio y lo que se entrega dependen de ella.
 */
export function CatalogPicker({
  items,
  businessLineId,
  onPick,
  onFreeLine,
  disabled,
}: {
  items: PickableItem[];
  /** La línea del pedido: acota el catálogo a lo suyo y lo compartido. */
  businessLineId: string | null;
  onPick: (item: PickableItem, variant: ItemVariant | null) => void;
  onFreeLine: () => void;
  disabled?: boolean;
}) {
  const [term, setTerm] = useState("");
  /** El producto cuyas variantes se están mostrando, si tiene. */
  const [expanded, setExpanded] = useState<PickableItem | null>(null);

  const candidates = useMemo(
    () => pickerCandidates(items, businessLineId, term),
    [items, businessLineId, term],
  );

  function choose(item: PickableItem) {
    if (item.variants.length > 0) {
      setExpanded(item);
      return;
    }
    onPick(item, null);
    reset();
  }

  function chooseVariant(item: PickableItem, variant: ItemVariant) {
    onPick(item, variant);
    reset();
  }

  function reset() {
    setTerm("");
    setExpanded(null);
  }

  return (
    <div className="flex flex-col gap-2" data-testid="catalog-picker">
      <Field>
        <FieldLabel htmlFor="catalog-picker-input">Agregar del catálogo</FieldLabel>
        <Input
          id="catalog-picker-input"
          value={term}
          disabled={disabled}
          placeholder="Buscar un producto"
          onChange={(event) => {
            setTerm(event.target.value);
            setExpanded(null);
          }}
        />
      </Field>

      {term !== "" && (
        <ul
          data-testid="catalog-options"
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
                    <span className="flex items-center gap-2 text-muted-foreground">
                      {item.variants.length > 0 && (
                        <Badge variant="secondary">
                          {item.variants.length} variantes
                        </Badge>
                      )}
                      {item.salePrice !== null && (
                        <span className="tabular-nums">
                          {item.salePrice.toFixed(2)}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}

              {candidates.length === 0 && (
                <li className="px-3 py-2 text-muted-foreground">
                  Sin coincidencias en el catálogo de esta línea
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
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted"
                    onClick={() => chooseVariant(expanded, variant)}
                  >
                    <span>{variant.name}</span>
                    {(variant.salePrice ?? expanded.salePrice) !== null && (
                      <span className="tabular-nums text-muted-foreground">
                        {(variant.salePrice ?? expanded.salePrice)?.toFixed(2)}
                      </span>
                    )}
                  </button>
                </li>
              ))}
              <li className="p-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setExpanded(null)}
                >
                  Volver
                </Button>
              </li>
            </>
          )}
        </ul>
      )}

      {/* La salida para lo que no está en el catálogo. El precio se escribe a
          mano y la descripción es obligatoria: sin producto, es lo único que
          dice qué se pidió. */}
      <div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={onFreeLine}
        >
          <PlusIcon data-icon="inline-start" />
          Línea libre
        </Button>
      </div>
    </div>
  );
}
