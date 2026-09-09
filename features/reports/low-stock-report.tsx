import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import type { LowStockRow } from "@/services/reports/report-service";

import { EmptyReport, RowLink, ScopeNote, money } from "./shared";

/**
 * Informe *insumos por acabarse* (KAM-20).
 *
 * **No obedece al selector de periodo**, y la pantalla lo dice: "estoy por
 * quedarme sin esto" es una pregunta sobre hoy, no sobre un rango. Una
 * excepción silenciosa se leería como un fallo.
 *
 * Tampoco lleva leyenda de reparto: este informe no reparte nada, y una
 * leyenda donde no hubo reparto es tan engañosa como su ausencia donde sí lo
 * hubo.
 */
export function LowStockReport({
  rows,
  itemNames,
  supplierNames,
}: {
  rows: LowStockRow[];
  itemNames: Map<string, string>;
  supplierNames: Map<string, string>;
}) {
  return (
    <div>
      <ScopeNote>
        Muestra el saldo de hoy, no el del periodo elegido arriba.
      </ScopeNote>

      {rows.length === 0 ? (
        <EmptyReport>
          Ningún insumo está por debajo de su mínimo. Los insumos sin mínimo
          declarado no se vigilan.
        </EmptyReport>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Insumo</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="text-right">Mínimo</TableHead>
                <TableHead className="text-right">Faltante</TableHead>
                <TableHead className="text-right">Último costo</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.itemId}>
                  <TableCell>
                    <RowLink href={`/catalog/${row.itemId}`}>
                      {itemNames.get(row.itemId) ?? "Insumo"}
                    </RowLink>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.balance}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {row.minStock}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {row.missing}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.lastCost === null ? "—" : money(row.lastCost)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.lastSupplierId
                      ? (supplierNames.get(row.lastSupplierId) ?? "—")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="outline" size="sm">
                      {/* V18 prellenada: insumo, faltante y línea. */}
                      <Link
                        href={`/tasks/new?item=${row.itemId}&missing=${row.missing}&title=${encodeURIComponent(
                          `Reponer ${itemNames.get(row.itemId) ?? "insumo"}`,
                        )}`}
                      >
                        Crear tarea
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
