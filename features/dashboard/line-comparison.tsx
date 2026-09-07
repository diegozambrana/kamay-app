import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { lineColorClasses } from "@/lib/business-lines/colors";
import {
  barPercent,
  comparisonScale,
  marginOf,
  type LineCashFlow,
} from "@/lib/dashboard/indicators";
import { cn } from "@/lib/utils";

function money(value: number): string {
  return value.toFixed(2);
}

/**
 * Comparativo por línea: la caja del mes de cada línea, una al lado de otra.
 *
 * Las barras son `div` con un ancho en porcentaje y no una librería de
 * gráficos (design D6). Son tres líneas y dos cifras cada una; una
 * dependencia aquí es peso en la pantalla con el presupuesto de carga más
 * estricto del proyecto, y una decisión de herramienta tomada antes de que
 * V14 —que sí la necesitará— sepa qué le pide.
 *
 * Las barras son decorativas (`aria-hidden`) y las cifras viven en una tabla
 * de verdad: un lector de pantalla lee números, no anchos.
 */
export function LineComparison({
  rows,
  activeLineId,
  monthLabel,
  reportsHref,
}: {
  rows: readonly LineCashFlow[];
  /** `null` con "Todas": entonces no se destaca ninguna. */
  activeLineId: string | null;
  monthLabel: string;
  reportsHref?: string;
}) {
  // La escala es común a todo el comparativo: barras con escalas distintas no
  // se pueden comparar entre sí, que es lo único que un comparativo hace.
  const scale = comparisonScale(rows);

  return (
    <Card data-testid="line-comparison">
      <CardHeader>
        <CardTitle>Comparativo por línea</CardTitle>
        {reportsHref && (
          <Link
            href={reportsHref}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Ver el informe comparativo
          </Link>
        )}
      </CardHeader>

      <CardContent>
        <table className="w-full text-sm">
          <caption className="sr-only">
            Cobrado, pagado y margen de cada línea de negocio en {monthLabel}
          </caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">Línea</th>
              <th scope="col">Ingresos</th>
              <th scope="col">Egresos</th>
              <th scope="col">Margen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const active = row.businessLineId === activeLineId;
              const margin = marginOf(row);

              return (
                <tr
                  key={row.businessLineId}
                  data-testid={`comparison-row-${row.businessLineId}`}
                  data-active={active ? "true" : undefined}
                  className={cn(
                    "align-top",
                    // La línea activa se destaca, pero el comparativo la
                    // muestra igual junto a las demás: comparar es justamente
                    // ver la elegida contra el resto.
                    active && "font-medium",
                  )}
                >
                  <th
                    scope="row"
                    className="py-2 pr-3 text-left font-normal whitespace-nowrap"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          lineColorClasses(row.color).dot,
                        )}
                        aria-hidden
                      />
                      {row.name}
                    </span>
                  </th>

                  <td className="py-2 pr-3">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2 min-w-px rounded-full bg-emerald-500/70"
                        style={{ width: `${barPercent(row.collected, scale)}%` }}
                        aria-hidden
                      />
                      <span className="tabular-nums">{money(row.collected)}</span>
                    </span>
                  </td>

                  <td className="py-2 pr-3">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2 min-w-px rounded-full bg-amber-500/70"
                        style={{ width: `${barPercent(row.paid, scale)}%` }}
                        aria-hidden
                      />
                      <span className="tabular-nums">{money(row.paid)}</span>
                    </span>
                  </td>

                  <td
                    className={cn(
                      "py-2 text-right tabular-nums",
                      margin < 0 && "text-destructive",
                    )}
                  >
                    {money(margin)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
