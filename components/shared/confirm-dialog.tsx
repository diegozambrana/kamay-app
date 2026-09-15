"use client";

import { useCallback, useState, useTransition, type ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/**
 * El botón de una acción destructiva, sólido. La variante `destructive` de
 * `Button` —texto rojo sobre un velo rojo— no llega a 4,5:1 sobre el pie del
 * diálogo en ningún tema (3,8 en claro, 4,2 en oscuro; spec `accessibility`).
 * En oscuro el rojo del tema es claro y el blanco no se leería: se usa uno
 * más profundo.
 */
const DESTRUCTIVE_ACTION =
  "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/40 dark:bg-red-700 dark:hover:bg-red-700/90";

/** Lo que devuelven las Server Actions del proyecto: nada, o un error. */
export type ConfirmResult = { error?: string } | undefined | void;

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Qué va a pasar, en una o dos frases. */
  description: ReactNode;
  /** El rótulo del botón: la acción misma («Archivar»), nunca «Aceptar». */
  confirmLabel: string;
  destructive?: boolean;
  pending?: boolean;
  error?: string | null;
  /** Para cuando el contenido extra todavía no permite confirmar. */
  confirmDisabled?: boolean;
  onConfirm: () => void;
  /** Contenido propio entre el texto y los botones (a dónde mover, p. ej.). */
  children?: ReactNode;
};

/**
 * Confirmación de una acción que no es un formulario (spec
 * `settings-interaction` → *Every action that is not a form asks for
 * confirmation*).
 *
 * El botón de la acción no es `AlertDialogAction`: ese cierra al hacer clic,
 * antes de saber si la acción falló, y el error quedaría sin sitio donde
 * mostrarse. Aquí el diálogo lo cierra quien lo usa, cuando la acción
 * terminó bien. Mientras corre, ni «Cancelar» ni Escape lo cierran: cerrarlo
 * no la detendría, solo escondería su resultado.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  pending = false,
  error,
  confirmDisabled = false,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return;
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {children}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <Button
            type="button"
            className={destructive ? DESTRUCTIVE_ACTION : undefined}
            disabled={pending || confirmDisabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export type ConfirmRequest = {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  /** La Server Action ya ligada a su registro. */
  action: () => Promise<ConfirmResult>;
};

/**
 * Una confirmación por sección: `ask()` la abre con su texto y su acción, y
 * `dialog` es el elemento que la sección pinta una vez. Con error, el diálogo
 * se queda abierto y lo muestra; sin él, se cierra.
 *
 * Un hook y no una propiedad de la tabla (design D2): se confirma también
 * desde botones que no son de una fila, y la tabla sigue siendo solo
 * presentación.
 */
export function useConfirmDialog() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ask = useCallback((next: ConfirmRequest) => {
    setError(null);
    setRequest(next);
    setOpen(true);
  }, []);

  function confirm() {
    if (!request) return;
    setError(null);
    startTransition(async () => {
      const result = await request.action();
      if (result && result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  }

  // La petición se conserva al cerrar: el texto no debe cambiar mientras el
  // diálogo se desvanece.
  const dialog = request ? (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
      title={request.title}
      description={request.description}
      confirmLabel={request.confirmLabel}
      destructive={request.destructive}
      pending={pending}
      error={error}
      onConfirm={confirm}
    />
  ) : null;

  return { ask, dialog };
}
