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
import type { ExpenseBreakdownRow } from "@/services/reports/report-service";

import { ReportChart } from "./report-chart-lazy";
import { EmptyReport, RowLink, money } from "./shared";


type Group = {
  key: string;
  label: string;
  href: string;
  total: number;
};

/**
 * Informe *en qué se va el dinero* (KAM-20).
 *
 * Las compras no llevan categoría de gasto y aparecen bajo una entrada propia:
 * atribuirlas a una categoría real las escondería, y dejarlas fuera
 * descuadraría el total contra el comparativo —que el criterio 1 exige que
 * cuadren—.
 */
export function ExpenseBreakdownReport({
  rows,
  categoryNames,
  period,
}: {
  rows: ExpenseBreakdownRow[];
  categoryNames: Map<string, string>;
  period: { from: string; to: string };
}) {
  const [sort, setSort] = useState<"total" | "name">("total");

  const groups = useMemo<Group[]>(() => {
    const byKey = new Map<string, Group>();

    for (const row of rows) {
      const isPurchase = row.kind === "purchase";
      const key = isPurchase
        ? "purchase"
        : (row.expenseCategoryId ?? "sin-categoria");
      const label = isPurchase
        ? "Compras a proveedores"
        : (categoryNames.get(row.expenseCategoryId ?? "") ?? "Sin categoría");
      const href = isPurchase
        ? `/expenses?kind=purchase&from=${period.from}&to=${period.to}`
        : `/expenses?category=${row.expenseCategoryId ?? ""}&from=${period.from}&to=${period.to}`;

      const current = byKey.get(key);
      if (current) current.total += row.total;
      else byKey.set(key, { key, label, href, total: row.total });
    }

    const list = [...byKey.values()];
    return sort === "total"
      ? list.sort((a, b) => b.total - a.total)
      : list.sort((a, b) => a.label.localeCompare(b.label, "es"));
  }, [rows, categoryNames, period, sort]);

  const total = groups.reduce((sum, group) => sum + group.total, 0);

  if (groups.length === 0) {
    return <EmptyReport>No hubo egresos en este periodo.</EmptyReport>;
  }

  return (
    <div>
      <ReportChart
        ariaLabel="Egresos por categoría"
        data={groups.map((group) => ({
          label: group.label,
          value: group.total,
        }))}
      />

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button
                  type="button"
                  onClick={() => setSort("name")}
                  aria-pressed={sort === "name"}
                  className={
                    sort === "name"
                      ? "font-semibold underline underline-offset-4"
                      : ""
                  }
                >
                  Categoría
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button
                  type="button"
                  onClick={() => setSort("total")}
                  aria-pressed={sort === "total"}
                  className={
                    sort === "total"
                      ? "font-semibold underline underline-offset-4"
                      : ""
                  }
                >
                  Total
                </button>
              </TableHead>
              <TableHead className="text-right">Peso</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) => (
              <TableRow key={group.key}>
                <TableCell>
                  <RowLink href={group.href}>{group.label}</RowLink>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {money(group.total)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {total === 0
                    ? "—"
                    : `${((group.total / total) * 100).toFixed(1)} %`}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="font-medium">
              <TableCell>Total</TableCell>
              <TableCell className="text-right tabular-nums">
                {money(total)}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
