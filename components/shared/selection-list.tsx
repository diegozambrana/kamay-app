"use client";

import { CheckIcon } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { matchesSearch } from "@/lib/search/normalize";
import { cn } from "@/lib/utils";

export type SelectionMode = "single" | "multiple";

export type SelectionListProps<T> = {
  items: readonly T[];
  getKey: (item: T) => string;
  /** El texto contra el que se filtra: nombre, o nombre y variante. */
  getSearchText: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  mode: SelectionMode;
  /** Las claves marcadas. En modo simple, a lo sumo una. */
  selected: readonly string[];
  onSelectedChange: (keys: string[]) => void;
  /** Nombre accesible del filtro y de la lista. */
  label: string;
  placeholder?: string;
  /** El filtro, si el padre necesita leerlo o conservarlo entre vistas. */
  term?: string;
  onTermChange?: (term: string) => void;
  /** Lo que se muestra cuando el filtro no deja ninguna fila. */
  empty?: (term: string) => ReactNode;
  /** Contenido fijo bajo la lista, como «Registrar nuevo cliente». */
  footerSlot?: ReactNode;
  className?: string;
  "data-testid"?: string;
};

/**
 * Lista filtrable para elegir una o varias entidades (design D1–D2 de
 * `order-form-picker-dialogs`).
 *
 * `cmdk` aporta la navegación con flechas y los roles `listbox/option`, pero
 * su filtro difuso queda apagado: se filtra con `matchesSearch`, la misma
 * normalización que la base, para que teclear aquí y buscar en el directorio
 * den lo mismo.
 *
 * Lo marcado se guarda por clave y no por posición: cambiar el filtro esconde
 * filas, no las desmarca.
 *
 * El `aria-selected` de `cmdk` significa «resaltada», no «elegida»; el estado
 * de elección se expone con `aria-checked`.
 */
export function SelectionList<T>({
  items,
  getKey,
  getSearchText,
  renderItem,
  mode,
  selected,
  onSelectedChange,
  label,
  placeholder = "Filtrar",
  term: controlledTerm,
  onTermChange,
  empty,
  footerSlot,
  className,
  "data-testid": testId,
}: SelectionListProps<T>) {
  const [localTerm, setLocalTerm] = useState("");
  const term = controlledTerm ?? localTerm;

  const visible = useMemo(
    () => items.filter((item) => matchesSearch(getSearchText(item), term)),
    [items, getSearchText, term],
  );

  function changeTerm(next: string) {
    if (controlledTerm === undefined) setLocalTerm(next);
    onTermChange?.(next);
  }

  function toggle(key: string) {
    if (mode === "single") {
      onSelectedChange([key]);
      return;
    }
    onSelectedChange(
      selected.includes(key)
        ? selected.filter((current) => current !== key)
        : [...selected, key],
    );
  }

  return (
    <Command
      shouldFilter={false}
      label={label}
      data-testid={testId}
      className={cn("h-auto min-h-0 rounded-lg! border bg-transparent", className)}
    >
      <CommandInput
        value={term}
        onValueChange={changeTerm}
        placeholder={placeholder}
        aria-label={label}
      />

      {visible.length > 0 && (
        <CommandList className="max-h-none min-h-0 flex-1" aria-label={label}>
          <div className="p-1">
            {visible.map((item) => {
              const key = getKey(item);
              const checked = selected.includes(key);
              return (
                <CommandItem
                  key={key}
                  value={key}
                  aria-checked={checked}
                  // En modo simple el ícono de check del propio `CommandItem`
                  // basta; en múltiple lo reemplaza la casilla de la izquierda.
                  data-checked={mode === "single" ? checked : undefined}
                  data-testid="selection-option"
                  onSelect={() => toggle(key)}
                >
                  {mode === "multiple" && (
                    // Casilla decorativa: una casilla real sería un control
                    // enfocable dentro de una opción, que no admite hijos
                    // interactivos.
                    <span
                      aria-hidden
                      data-state={checked ? "checked" : "unchecked"}
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input",
                        checked &&
                          "border-primary bg-primary text-primary-foreground",
                      )}
                    >
                      {checked && <CheckIcon className="size-3.5" />}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">{renderItem(item)}</div>
                </CommandItem>
              );
            })}
          </div>
        </CommandList>
      )}

      {visible.length === 0 && (
        <div data-testid="selection-empty" className="px-3 py-4 text-sm">
          {empty ? (
            empty(term)
          ) : (
            <p className="text-center text-muted-foreground">Sin coincidencias</p>
          )}
        </div>
      )}

      {footerSlot && <div className="border-t p-1">{footerSlot}</div>}
    </Command>
  );
}
