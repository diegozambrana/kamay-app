import { Badge } from "@/components/ui/badge";
import { ALL_LINES, type ActiveLine, type OutstandingByLine } from "@/types";

/** El monto se muestra con dos decimales. */
function money(value: number): string {
  return value.toFixed(2);
}

/**
 * Suma lo pendiente de la línea activa, o de todas.
 *
 * El recorte a cero de los saldos negativos ya lo hizo la vista: aquí solo se
 * suman filas. La regla vive en un único sitio para que KAM-20 la herede
 * (design D7).
 */
export function outstandingFor(
  rows: readonly OutstandingByLine[],
  activeLine: ActiveLine,
): number {
  const relevant =
    activeLine === ALL_LINES
      ? rows
      : rows.filter((row) => row.businessLineId === activeLine);

  const total = relevant.reduce((sum, row) => sum + row.outstanding, 0);
  return Math.round(total * 100) / 100;
}

/**
 * Indicador "Por cobrar" o "Por pagar" de la cabecera.
 *
 * Al ayudante, Por pagar le llega vacío por `security_invoker` —no ve los
 * egresos a los que se refiere— y el indicador muestra cero sin una línea de
 * lógica de permisos aquí. Su sitio definitivo son las tarjetas del panel
 * principal (V2, KAM-14), que consumirán la misma vista.
 */
export function OutstandingSummary({
  label,
  rows,
  activeLine,
  testId,
}: {
  label: string;
  rows: readonly OutstandingByLine[];
  activeLine: ActiveLine;
  testId?: string;
}) {
  const amount = outstandingFor(rows, activeLine);

  return (
    <Badge variant="outline" data-testid={testId} className="gap-1.5 font-normal">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{money(amount)}</span>
    </Badge>
  );
}
