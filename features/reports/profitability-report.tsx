"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { marginOf } from "@/lib/reports/margin";
import type { ProfitabilityRow } from "@/services/reports/report-service";

import { EmptyReport, RowLink, money, percent } from "./shared";

type SortKey = "margin" | "revenue" | "date";

/**
 * Informe de rentabilidad (KAM-20, design D6).
 *
 * La marca **sin costo registrado** no es una nota al pie: mientras no existan
 * las fichas de producto, la mayoría de los pedidos no tendrá egreso asignado
 * y su margen será del 100 %, que es aritméticamente cierto y comercialmente
 * falso. Por eso la marca se ve en la fila **y se puede filtrar**: lo que este
 * informe responde con honestidad no es "cuánto gané", sino "de qué pedidos sé
 * realmente cuánto gané".
 */
export function ProfitabilityReport({
  rows,
  orderLabels,
}: {
  rows: ProfitabilityRow[];
  orderLabels: Map<string, string>;
}) {
  const [sort, setSort] = useState<SortKey>("margin");
  const [onlyWithoutCost, setOnlyWithoutCost] = useState(false);

  const visible = useMemo(() => {
    const filtered = onlyWithoutCost ? rows.filter((row) => !row.hasCost) : rows;

    return [...filtered].sort((a, b) => {
      if (sort === "date") return b.occurredAt.localeCompare(a.occurredAt);
      if (sort === "revenue") return b.revenue - a.revenue;
      return (
        b.revenue - b.materialCost - (a.revenue - a.materialCost)
      );
    });
  }, [rows, sort, onlyWithoutCost]);

  const withoutCost = rows.filter((row) => !row.hasCost).length;

  if (rows.length === 0) {
    return <EmptyReport>No hubo pedidos ni ventas en este periodo.</EmptyReport>;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={onlyWithoutCost ? "default" : "outline"}
          size="sm"
          onClick={() => setOnlyWithoutCost((value) => !value)}
          aria-pressed={onlyWithoutCost}
        >
          Solo sin costo registrado ({withoutCost})
        </Button>
        <span className="text-xs text-muted-foreground">
          El costo sale de los egresos asignados al pedido. Un consumo de
          inventario no se puede atribuir a un pedido todavía.
        </span>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>
                <SortButton active={sort === "date"} onClick={() => setSort("date")}>
                  Fecha
                </SortButton>
              </TableHead>
              <TableHead className="text-right">
                <SortButton
                  active={sort === "revenue"}
                  onClick={() => setSort("revenue")}
                >
                  Ingresos
                </SortButton>
              </TableHead>
              <TableHead className="text-right">Costo</TableHead>
              <TableHead className="text-right">
                <SortButton
                  active={sort === "margin"}
                  onClick={() => setSort("margin")}
                >
                  Margen
                </SortButton>
              </TableHead>
              <TableHead className="text-right">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((row) => {
              const margin = marginOf({
                revenue: row.revenue,
                cost: row.materialCost,
              });

              return (
                <TableRow key={row.orderId}>
                  <TableCell>
                    <RowLink href={`/orders/${row.orderId}`}>
                      {orderLabels.get(row.orderId) ?? "Pedido"}
                    </RowLink>
                    {!row.hasCost && (
                      <span className="ml-2 rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        sin costo registrado
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.occurredAt.slice(0, 10)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(row.revenue)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(row.materialCost)}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${margin.amount < 0 ? "text-destructive" : ""}`}
                  >
                    {money(margin.amount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {percent(margin.percent)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SortButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={active ? "font-semibold underline underline-offset-4" : ""}
    >
      {children}
    </button>
  );
}
