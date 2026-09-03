"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Contact, ExpenseCategory, ExpenseKind } from "@/types";

export type ExpenseFilterValues = {
  kind: ExpenseKind | null;
  contactId: string;
  expenseCategoryId: string;
  from: string;
  to: string;
  includeArchived: boolean;
};

/** El valor "sin filtro" de un `Select`: Radix no admite la cadena vacía. */
const ANY = "__any__";

/**
 * Filtros de la bandeja (V7): tipo, proveedor, categoría y periodo, más "Ver
 * archivados". La línea no está aquí: la da el selector global de la barra.
 * Cada cambio escribe la dirección, así que el enlace lo conserva todo.
 */
export function ExpenseFilters({
  values,
  suppliers,
  categories,
  onChange,
}: {
  values: ExpenseFilterValues;
  suppliers: Contact[];
  categories: ExpenseCategory[];
  onChange: (changes: Record<string, string | null>) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-4" data-testid="expense-filters">
      <ToggleGroup
        type="single"
        variant="outline"
        aria-label="Tipo"
        value={values.kind ?? "all"}
        onValueChange={(value) =>
          value && onChange({ kind: value === "all" ? null : value })
        }
      >
        <ToggleGroupItem value="all">Todos</ToggleGroupItem>
        <ToggleGroupItem value="purchase">Compras</ToggleGroupItem>
        <ToggleGroupItem value="expense">Gastos</ToggleGroupItem>
      </ToggleGroup>

      <Field className="w-52">
        <FieldLabel htmlFor="expense-filter-supplier">Proveedor</FieldLabel>
        <Select
          value={values.contactId || ANY}
          onValueChange={(value) => onChange({ contact: value === ANY ? null : value })}
        >
          <SelectTrigger id="expense-filter-supplier" data-testid="filter-supplier">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Todos</SelectItem>
            {suppliers.map((supplier) => (
              <SelectItem key={supplier.id} value={supplier.id}>
                {supplier.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field className="w-52">
        <FieldLabel htmlFor="expense-filter-category">Categoría</FieldLabel>
        <Select
          value={values.expenseCategoryId || ANY}
          onValueChange={(value) => onChange({ category: value === ANY ? null : value })}
        >
          <SelectTrigger id="expense-filter-category" data-testid="filter-category">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Todas</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field className="w-40">
        <FieldLabel htmlFor="expense-filter-from">Desde</FieldLabel>
        <Input
          id="expense-filter-from"
          type="date"
          value={values.from}
          onChange={(event) => onChange({ from: event.target.value })}
        />
      </Field>

      <Field className="w-40">
        <FieldLabel htmlFor="expense-filter-to">Hasta</FieldLabel>
        <Input
          id="expense-filter-to"
          type="date"
          value={values.to}
          onChange={(event) => onChange({ to: event.target.value })}
        />
      </Field>

      <label className="flex items-center gap-2 pb-2 text-sm">
        <Checkbox
          checked={values.includeArchived}
          onCheckedChange={(checked) => onChange({ archived: checked ? "1" : null })}
        />
        Ver archivados
      </label>
    </div>
  );
}
