"use client";

import { PackagePlusIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { SelectionDialog } from "@/components/shared/selection-dialog";
import { Button } from "@/components/ui/button";
import {
  pickerOptions,
  type PickableItem,
  type PickerOption,
} from "@/lib/orders/lines";

const optionKey = (option: PickerOption) => option.key;
const optionSearchText = (option: PickerOption) => option.searchText;

/**
 * «Agregar del catálogo»: el botón y el diálogo de selección múltiple del
 * formulario de pedido (design D3–D4 de `order-form-picker-dialogs`).
 *
 * Las filas salen de `pickerOptions`: lo vigente de la línea del pedido y lo
 * compartido, con una fila por variante. Devuelve las opciones marcadas en el
 * orden de la lista; convertirlas en líneas es cosa del editor.
 */
export function CatalogPickerDialog({
  items,
  businessLineId,
  disabled,
  onAdd,
}: {
  items: PickableItem[];
  /** La línea del pedido: acota el catálogo a lo suyo y lo compartido. */
  businessLineId: string | null;
  disabled?: boolean;
  onAdd: (options: PickerOption[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const options = useMemo(
    () => pickerOptions(items, businessLineId),
    [items, businessLineId],
  );

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled}
        data-testid="catalog-picker-open"
        onClick={() => setOpen(true)}
      >
        <PackagePlusIcon data-icon="inline-start" />
        Agregar del catálogo
      </Button>

      <SelectionDialog
        open={open}
        onOpenChange={setOpen}
        data-testid="catalog-picker-dialog"
        title="Agregar del catálogo"
        description="Marca uno o varios productos. Cada uno se agrega como una línea con cantidad 1."
        label="Buscar un producto"
        placeholder="Buscar un producto"
        mode="multiple"
        items={options}
        getKey={optionKey}
        getSearchText={optionSearchText}
        renderItem={(option) => (
          <span className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate">
              {option.item.name}
              {option.variant && (
                <span className="text-muted-foreground"> · {option.variant.name}</span>
              )}
            </span>
            {option.referencePrice !== null && (
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {option.referencePrice.toFixed(2)}
              </span>
            )}
          </span>
        )}
        empty={(term) => (
          <p className="text-center text-muted-foreground">
            {term.trim() === "" && options.length === 0
              ? "El catálogo de esta línea no tiene productos vigentes."
              : "Sin coincidencias en el catálogo de esta línea."}
          </p>
        )}
        confirmLabel={(count) => (count > 0 ? `Agregar (${count})` : "Agregar")}
        onConfirm={(keys) =>
          onAdd(options.filter((option) => keys.includes(option.key)))
        }
      />
    </>
  );
}
