"use client";

import {
  ArchiveIcon,
  EyeIcon,
  MoreHorizontalIcon,
  PencilIcon,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Una columna del listado.
 *
 * `value` es la clave de la fila cuando basta con mostrar el dato tal cual, o
 * una función cuando hay que componerlo (una miniatura, una insignia, un
 * importe formateado). Es lo que evita una tabla distinta por pantalla.
 */
export type DataTableColumn<T> = {
  id: string;
  label: string;
  value: keyof T | ((row: T) => React.ReactNode);
  align?: "start" | "end";
  /** El encabezado existe para lectores de pantalla pero no se dibuja. */
  hideLabel?: boolean;
  className?: string;
};

export type DataTableAction<T> = {
  id: string;
  label: string;
  icon?: LucideIcon;
  variant?: "default" | "destructive";
  /** Filas donde la acción no aplica: no se muestra, no se deshabilita. */
  hidden?: (row: T) => boolean;
  /** Pide confirmación antes de ejecutarla. */
  confirm?: {
    title: string;
    description: string;
    actionLabel: string;
  };
};

/**
 * Las tres acciones de fila del proyecto. Quien use la tabla puede pasar otra
 * lista, pero mientras sean estas no hace falta repetirlas en cada pantalla.
 * Archivar pide confirmación porque saca el registro de todos los listados.
 */
export const DEFAULT_ROW_ACTIONS: DataTableAction<never>[] = [
  { id: "view", label: "Ver", icon: EyeIcon },
  { id: "edit", label: "Editar", icon: PencilIcon },
  {
    id: "archive",
    label: "Archivar",
    icon: ArchiveIcon,
    variant: "destructive",
    confirm: {
      title: "¿Archivar este registro?",
      description:
        "Dejará de aparecer en listados y buscadores, pero seguirá visible en los registros que ya lo referencian. Puedes devolverlo desde el filtro «Ver archivados».",
      actionLabel: "Archivar",
    },
  },
];

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Por defecto: Ver, Editar y Archivar. */
  actions?: DataTableAction<T>[];
  onAction?: (actionId: string, row: T) => void;
  /** Atributos por fila (`data-archived`, por ejemplo). */
  rowProps?: (row: T) => React.ComponentProps<typeof TableRow>;
  empty?: { title: string; description?: string };
  className?: string;
  "data-testid"?: string;
};

function cellContent<T>(column: DataTableColumn<T>, row: T): React.ReactNode {
  if (typeof column.value === "function") return column.value(row);
  const raw = row[column.value];
  return raw === null || raw === undefined ? "—" : String(raw);
}

/**
 * Listado genérico: recibe qué columnas mostrar y qué se puede hacer con cada
 * fila. Las acciones viven en un menú de tres puntos a la derecha, y las que
 * lo piden abren un diálogo de confirmación antes de ejecutarse.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  actions = DEFAULT_ROW_ACTIONS as DataTableAction<T>[],
  onAction,
  rowProps,
  empty,
  className,
  "data-testid": testId,
}: DataTableProps<T>) {
  // La acción que espera confirmación, con la fila sobre la que se pidió.
  const [confirming, setConfirming] = useState<{
    action: DataTableAction<T>;
    row: T;
  } | null>(null);

  const hasActions = actions.length > 0 && onAction !== undefined;

  if (rows.length === 0 && empty) {
    return (
      <Empty className={cn("border border-dashed", className)}>
        <EmptyHeader>
          <EmptyTitle>{empty.title}</EmptyTitle>
          {empty.description && (
            <EmptyDescription>{empty.description}</EmptyDescription>
          )}
        </EmptyHeader>
      </Empty>
    );
  }

  function run(action: DataTableAction<T>, row: T) {
    if (action.confirm) {
      setConfirming({ action, row });
      return;
    }
    onAction?.(action.id, row);
  }

  return (
    <>
      <div className={cn("overflow-hidden rounded-lg border", className)}>
        <Table data-testid={testId}>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={column.id}
                  className={cn(
                    column.align === "end" && "text-right",
                    column.hideLabel && "sr-only",
                    column.className,
                  )}
                >
                  {column.label}
                </TableHead>
              ))}
              {hasActions && <TableHead className="sr-only">Acciones</TableHead>}
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((row) => {
              const available = actions.filter(
                (action) => !action.hidden?.(row),
              );

              return (
                <TableRow key={rowKey(row)} {...rowProps?.(row)}>
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      className={cn(
                        column.align === "end" && "text-right",
                        column.className,
                      )}
                    >
                      {cellContent(column, row)}
                    </TableCell>
                  ))}

                  {hasActions && (
                    <TableCell className="w-px text-right">
                      {available.length > 0 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Acciones"
                            >
                              <MoreHorizontalIcon />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuGroup>
                              {available.map((action) => {
                                const Icon = action.icon;
                                return (
                                  <DropdownMenuItem
                                    key={action.id}
                                    variant={action.variant}
                                    onSelect={() => run(action, row)}
                                  >
                                    {Icon && <Icon />}
                                    {action.label}
                                  </DropdownMenuItem>
                                );
                              })}
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirming?.action.confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirming?.action.confirm?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirming) onAction?.(confirming.action.id, confirming.row);
                setConfirming(null);
              }}
            >
              {confirming?.action.confirm?.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
