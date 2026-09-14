"use client";

import * as React from "react";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { type RowAction, RowActionsMenu } from "./row-actions-menu";

export type DataTableColumn<TRow> = {
  /** Identifica la columna; también la llave del valor si no hay `cell`. */
  key: string;
  header: string;
  /** Lo que muestra la celda. Sin él, `String(row[key])`. */
  cell?: (row: TRow) => React.ReactNode;
  className?: string;
  /** No se repite en la tarjeta del celular (p. ej. porque ya es su título). */
  hideOnCard?: boolean;
  /** En la tarjeta, solo el valor: un botón no necesita rótulo delante. */
  bareOnCard?: boolean;
};

export type DataTableProps<TRow> = {
  rows: TRow[];
  columns: DataTableColumn<TRow>[];
  getRowKey: (row: TRow) => string;
  /** Las acciones del menú «⋯» de cada fila; sin ellas no hay columna. */
  rowActions?: (row: TRow) => RowAction[];
  /** Nombre accesible del menú de cada fila: «Acciones de Geeko Store». */
  rowActionsLabel?: (row: TRow) => string;
  /** El título de la tarjeta en el celular. Sin él, la primera columna. */
  cardTitle?: (row: TRow) => React.ReactNode;
  /** Qué mostrar sin filas: el vacío inicial o el de «sin resultados». */
  empty?: React.ReactNode;
  /** `data-testid` de cada fila y de cada tarjeta. */
  rowTestId?: string;
  /** `data-testid` del contenedor. */
  testId?: string;
  caption?: string;
};

/**
 * Tabla de datos compartida (KAM-26), adaptada de `CustomTable` de katu-ui:
 * columnas declaradas una vez, menú de acciones por fila y, en pantallas
 * chicas, la misma información en tarjetas —en 390 px una tabla de cuatro
 * columnas obliga a desplazarse a lo ancho, y ninguna vista puede
 * (spec *Platform views fit a phone*)—.
 *
 * **Sin búsqueda, orden ni paginación propios**, a diferencia del original.
 * Aquel usa `@tanstack/react-table` para filtrar y paginar en el cliente, lo
 * que exige tener la tabla entera en el navegador: justo lo que la spec
 * `performance-budget` prohíbe (*No data view loads an entire table*). Aquí
 * la vista recibe ya su ventana del servidor —búsqueda en `?q=`, «Mostrar
 * más» con `LoadMore`— y la tabla solo la presenta. Por eso tampoco hace
 * falta la dependencia.
 *
 * Tabla y tarjetas están las dos en el documento y el CSS decide cuál se ve:
 * el servidor no sabe el ancho de la pantalla. `display: none` las saca
 * también del árbol de accesibilidad, así que un lector de pantalla no oye
 * cada fila dos veces.
 */
export function DataTable<TRow>({
  rows,
  columns,
  getRowKey,
  rowActions,
  rowActionsLabel,
  cardTitle,
  empty,
  rowTestId,
  testId,
  caption,
}: DataTableProps<TRow>) {
  if (rows.length === 0) return <>{empty ?? null}</>;

  const valueOf = (column: DataTableColumn<TRow>, row: TRow): React.ReactNode => {
    if (column.cell) return column.cell(row);
    const raw = (row as Record<string, unknown>)[column.key];
    return raw == null ? "" : String(raw);
  };
  const actionsLabel = (row: TRow) => rowActionsLabel?.(row) ?? "Acciones";
  const [firstColumn] = columns;

  return (
    <div data-testid={testId} className="w-full">
      {/* Celular: tarjetas. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => {
          const actions = rowActions?.(row) ?? [];
          return (
            <li key={getRowKey(row)} data-testid={rowTestId}>
              <Card className="relative gap-2 py-3">
                {actions.length > 0 && (
                  <div className="absolute top-2 right-2">
                    <RowActionsMenu actions={actions} label={actionsLabel(row)} />
                  </div>
                )}
                <CardContent className={cn("flex flex-col gap-1.5 px-4", actions.length > 0 && "pr-12")}>
                  <div className="min-w-0 font-medium break-words">
                    {cardTitle ? cardTitle(row) : firstColumn && valueOf(firstColumn, row)}
                  </div>
                  {columns
                    .filter((column) => !column.hideOnCard && (cardTitle || column !== firstColumn))
                    .map((column) => (
                      <div key={column.key} className="flex min-w-0 gap-2 text-sm">
                        {!column.bareOnCard && (
                          <span className="shrink-0 text-muted-foreground">{column.header}</span>
                        )}
                        <span className="min-w-0 flex-1 break-words">{valueOf(column, row)}</span>
                      </div>
                    ))}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>

      {/* Escritorio: tabla. */}
      <div className="hidden overflow-hidden rounded-lg border md:block">
        <Table>
          {caption && <caption className="sr-only">{caption}</caption>}
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key} className={column.className}>
                  {column.header}
                </TableHead>
              ))}
              {rowActions && (
                <TableHead className="w-12 text-right">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const actions = rowActions?.(row) ?? [];
              return (
                <TableRow key={getRowKey(row)} data-testid={rowTestId}>
                  {columns.map((column) => (
                    <TableCell key={column.key} className={cn("whitespace-normal", column.className)}>
                      {valueOf(column, row)}
                    </TableCell>
                  ))}
                  {rowActions && (
                    <TableCell className="text-right">
                      {actions.length > 0 && (
                        <RowActionsMenu actions={actions} label={actionsLabel(row)} />
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
