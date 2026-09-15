"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LINE_COLOR_LABELS, lineColorClasses } from "@/lib/business-lines/colors";
import { cn } from "@/lib/utils";
import { LINE_COLORS, type LineColor } from "@/types";

/** El punto de color que acompaña a una línea o a un estado. */
export function ColorDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2.5 shrink-0 rounded-full", lineColorClasses(color).dot, className)}
    />
  );
}

/**
 * Elegir el color de una línea o de un estado, cada opción con su punto.
 * Con `name`, Radix deja un `<select>` oculto dentro del formulario y el valor
 * llega en el `FormData` como con el nativo (design D6).
 */
export function ColorSelect({
  id,
  name,
  defaultValue = "zinc",
}: {
  id: string;
  name: string;
  defaultValue?: LineColor;
}) {
  return (
    <Select name={name} defaultValue={defaultValue}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LINE_COLORS.map((color) => (
          <SelectItem key={color} value={color}>
            <ColorDot color={color} />
            {LINE_COLOR_LABELS[color]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
