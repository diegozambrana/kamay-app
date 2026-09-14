"use client";

import { MoreHorizontalIcon, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Una acción sobre una fila: un enlace (`href`) o algo que pasa aquí
 * (`onSelect`). Las destructivas van al final, separadas.
 */
export type RowAction = {
  label: string;
  icon?: LucideIcon;
  href?: string;
  onSelect?: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

/**
 * El menú «⋯» de una fila de `DataTable` (KAM-26). Adaptado de
 * `TableActionsDropdown` de katu-ui: allí las acciones son un catálogo fijo
 * (ver, editar, borrar…); aquí cada vista declara las suyas, porque en Kamay
 * no se borra nada y lo que se hace con una fila cambia de pantalla en
 * pantalla.
 */
export function RowActionsMenu({
  actions,
  label,
}: {
  actions: RowAction[];
  /** Nombre accesible del disparador: «Acciones de Geeko Store». */
  label: string;
}) {
  const regular = actions.filter((action) => !action.destructive);
  const destructive = actions.filter((action) => action.destructive);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label={label}>
          <MoreHorizontalIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {regular.map((action) => (
          <ActionItem key={action.label} action={action} />
        ))}
        {regular.length > 0 && destructive.length > 0 && <DropdownMenuSeparator />}
        {destructive.map((action) => (
          <ActionItem key={action.label} action={action} />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ActionItem({ action }: { action: RowAction }) {
  const Icon = action.icon;
  const content = (
    <>
      {Icon && <Icon aria-hidden />}
      {action.label}
    </>
  );
  const className = cn(action.destructive && "text-destructive");

  if (action.href) {
    return (
      <DropdownMenuItem asChild disabled={action.disabled} className={className}>
        <Link href={action.href}>{content}</Link>
      </DropdownMenuItem>
    );
  }
  return (
    <DropdownMenuItem
      onSelect={action.onSelect}
      disabled={action.disabled}
      className={className}
    >
      {content}
    </DropdownMenuItem>
  );
}
