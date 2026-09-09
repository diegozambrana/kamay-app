import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AllocationResult } from "@/lib/reports/allocation";

import { ReportChart } from "./report-chart-lazy";
import { EmptyReport, ScopeNote, money } from "./shared";


/**
 * Informe comparativo entre líneas (KAM-20).
 *
 * Es una de las dos vistas que **ignoran deliberadamente** el selector de
 * línea (mapa §Selector de línea), y la pantalla lo dice: su valor está en ver
 * las líneas juntas.
 *
 * La leyenda del reparto no es opcional ni decorativa. Llega dentro del mismo
 * objeto que las cifras (design D4) justamente para que no se pueda pintar una
 * sin la otra: una cifra repartida sin su regla no se puede verificar, solo
 * creer.
 */
export function LineComparisonReport({
  allocation,
  lineNames,
}: {
  allocation: AllocationResult;
  lineNames: Map<string, string>;
}) {
  const { lines, legend, sharedTotal } = allocation;

  if (lines.length === 0) {
    return <EmptyReport>No hay líneas de negocio que comparar.</EmptyReport>;
  }

  const totals = lines.reduce(
    (acc, line) => ({
      revenue: acc.revenue + line.revenue,
      expenses: acc.expenses + line.expenses,
      margin: acc.margin + line.margin,
    }),
    { revenue: 0, expenses: 0, margin: 0 },
  );

  const widest = Math.max(1, ...lines.map((line) => Math.abs(line.margin)));

  return (
    <div>
      <ScopeNote>
        Este informe muestra siempre todas las líneas, aunque arriba haya una
        elegida.
      </ScopeNote>

      <ReportChart
        ariaLabel="Margen por línea de negocio"
        data={lines.map((line) => ({
          label: lineNames.get(line.businessLineId) ?? "Línea",
          value: line.margin,
        }))}
      />

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Línea</TableHead>
              <TableHead className="text-right">Ingresos</TableHead>
              <TableHead className="text-right">Egresos</TableHead>
              <TableHead className="text-right">De General</TableHead>
              <TableHead className="text-right">Margen</TableHead>
              <TableHead className="w-32">Comparación</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => (
              <TableRow key={line.businessLineId}>
                <TableCell>
                  {lineNames.get(line.businessLineId) ?? "Línea"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {money(line.revenue)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {money(line.expenses)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {money(line.allocated)}
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums ${line.margin < 0 ? "text-destructive" : ""}`}
                >
                  {money(line.margin)}
                </TableCell>
                <TableCell>
                  {/* Barra en CSS: ilustra la tabla, que es la fuente. */}
                  <div
                    aria-hidden
                    className={`h-2 rounded-sm ${line.margin < 0 ? "bg-destructive/60" : "bg-foreground/60"}`}
                    style={{
                      width: `${(Math.abs(line.margin) / widest) * 100}%`,
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="font-medium">
              <TableCell>Total</TableCell>
              <TableCell className="text-right tabular-nums">
                {money(totals.revenue)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {money(totals.expenses)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {money(sharedTotal)}
              </TableCell>
              <TableCell
                className={`text-right tabular-nums ${totals.margin < 0 ? "text-destructive" : ""}`}
              >
                {money(totals.margin)}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <p
        className="mt-3 text-sm text-muted-foreground"
        data-testid="allocation-legend"
      >
        {legend}
      </p>
    </div>
  );
}
