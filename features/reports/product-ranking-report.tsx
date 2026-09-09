"use client";

import { useMemo, useState } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProductRankingRow } from "@/services/reports/report-service";

import { EmptyReport, RowLink, money } from "./shared";

/**
 * Informe *qué se vende más* (KAM-20).
 *
 * **Unidades y margen se ven siempre a la vez**, se ordene por la que se
 * ordene. El propósito declarado del informe es distinguir el producto que
 * vende mucho y deja poco: ocultar una columna al ordenar por la otra lo haría
 * imposible, que es exactamente el error que este informe existe para evitar.
 */
export function ProductRankingReport({
  rows,
  itemNames,
  channelNames,
}: {
  rows: ProductRankingRow[];
  itemNames: Map<string, string>;
  channelNames: Map<string, string>;
}) {
  const [sort, setSort] = useState<"units" | "margin">("units");

  const visible = useMemo(
    () =>
      [...rows].sort((a, b) =>
        sort === "units"
          ? b.unitsSold - a.unitsSold
          : b.revenue - b.attributedCost - (a.revenue - a.attributedCost),
      ),
    [rows, sort],
  );

  if (rows.length === 0) {
    return <EmptyReport>No se vendió ningún producto en este periodo.</EmptyReport>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead className="text-right">
              <button
                type="button"
                onClick={() => setSort("units")}
                aria-pressed={sort === "units"}
                className={sort === "units" ? "font-semibold underline underline-offset-4" : ""}
              >
                Unidades
              </button>
            </TableHead>
            <TableHead className="text-right">Ingresos</TableHead>
            <TableHead className="text-right">
              <button
                type="button"
                onClick={() => setSort("margin")}
                aria-pressed={sort === "margin"}
                className={sort === "margin" ? "font-semibold underline underline-offset-4" : ""}
              >
                Margen
              </button>
            </TableHead>
            <TableHead>Canal</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((row) => (
            <TableRow key={row.itemId}>
              <TableCell>
                <RowLink href={`/catalog/${row.itemId}`}>
                  {itemNames.get(row.itemId) ?? "Ítem"}
                </RowLink>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {row.unitsSold}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {money(row.revenue)}
              </TableCell>
              <TableCell
                className={`text-right tabular-nums ${row.revenue - row.attributedCost < 0 ? "text-destructive" : ""}`}
              >
                {money(row.revenue - row.attributedCost)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {row.topChannelId ? channelNames.get(row.topChannelId) ?? "—" : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
