"use client";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DUE_DATE_SHORTCUTS, shiftDate } from "@/lib/orders/due-date";

/**
 * Fecha comprometida con atajos (V5, design.md D12).
 *
 * `today` llega del servidor calculado en la zona horaria de la organización:
 * los atajos son "hoy" del taller, no el del navegador. Por eso el componente
 * no llama nunca a `new Date()`.
 *
 * El campo es un `<input type="date">` nativo: en el celular abre el selector
 * del sistema, que es más rápido que cualquier calendario propio, y no añade
 * ninguna dependencia.
 */
export function DueDateField({
  value,
  onChange,
  today,
  error,
  disabled,
}: {
  /** `YYYY-MM-DD`, o `null` mientras no se fije ninguna. */
  value: string | null;
  onChange: (value: string | null) => void;
  /** "Hoy" en la zona de la organización, como `YYYY-MM-DD`. */
  today: string;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor="order-due-date">Fecha comprometida</FieldLabel>

      <Input
        id="order-due-date"
        type="date"
        value={value ?? ""}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.value || null)}
      />

      <div className="flex flex-wrap gap-2">
        {DUE_DATE_SHORTCUTS.map((shortcut) => (
          <Button
            key={shortcut.label}
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => onChange(shiftDate(today, shortcut.days))}
          >
            {shortcut.label}
          </Button>
        ))}

        {/* Sin fecha es un estado legítimo: un pedido puede guardarse sin
            comprometerse a un día, y volver a ese estado no debe obligar a
            pelearse con el selector nativo. */}
        {value !== null && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={disabled}
            onClick={() => onChange(null)}
          >
            Borrar
          </Button>
        )}
      </div>

      {error && <FieldError>{error}</FieldError>}
    </Field>
  );
}
