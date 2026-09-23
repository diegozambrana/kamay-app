import { cn } from "@/lib/utils";

/**
 * La muestra de un color de atributo (`catalog-custom-attributes`, design
 * D11): un cuadrito del color junto a su hex. El hex va escrito porque el color
 * solo no dice nada a un lector de pantalla ni a quien distingue mal los tonos.
 */
export function ColorSwatch({ hex, className }: { hex: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)} data-testid="color-swatch">
      <span
        aria-hidden
        className="size-4 shrink-0 rounded-sm border border-border"
        style={{ backgroundColor: hex }}
      />
      <span className="tabular-nums">{hex}</span>
    </span>
  );
}
