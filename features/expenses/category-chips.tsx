"use client";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ExpenseCategory } from "@/types";

/**
 * Las categorías como chips de un solo toque (V9, design D5): elegir una es
 * una interacción, no abrir un desplegable y buscar.
 */
export function CategoryChips({
  categories,
  value,
  onChange,
  error,
  disabled,
}: {
  categories: ExpenseCategory[];
  value: string;
  onChange: (categoryId: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel>Categoría</FieldLabel>
      <ToggleGroup
        type="single"
        variant="outline"
        aria-label="Categoría"
        data-testid="category-chips"
        className="flex flex-wrap justify-start"
        value={value}
        disabled={disabled}
        onValueChange={(next) => next && onChange(next)}
      >
        {categories.map((category) => (
          <ToggleGroupItem
            key={category.id}
            value={category.id}
            data-testid="category-chip"
            className="rounded-full px-3"
          >
            {category.name}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {categories.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No hay categorías: créalas en Configuración.
        </p>
      )}
      {error && <FieldError data-testid="category-error">{error}</FieldError>}
    </Field>
  );
}
