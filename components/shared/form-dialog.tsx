"use client";

import { useCallback, useId, useState, useTransition, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { ConfirmResult } from "./confirm-dialog";

export type FormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  /** El rótulo del envío: «Crear línea», «Guardar cambios». */
  submitLabel: string;
  pending?: boolean;
  error?: string | null;
  onSubmit: (data: FormData) => void;
  /** Los campos del formulario. */
  children: ReactNode;
  "data-testid"?: string;
};

/**
 * Alta o edición en un diálogo (spec `settings-interaction` → *Creating a
 * configuration entry happens in a dialog*).
 *
 * Controlado y sin `DialogTrigger`: el mismo diálogo se abre desde el botón de
 * la sección para crear y desde el menú de una fila para editar (design D3).
 * El contenido se desmonta al cerrarse, así que los campos con
 * `defaultValue` vuelven a empezar cada vez que se abre: cancelar no deja
 * nada escrito para la próxima.
 *
 * Mientras el envío viaja no se cierra: cerrarlo no lo detendría, solo
 * escondería su resultado.
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  pending = false,
  error,
  onSubmit,
  children,
  "data-testid": testId,
}: FormDialogProps) {
  const formId = useId();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        data-testid={testId}
        // Sin descripción, Radix avisa en consola si no se le dice que falta
        // a propósito.
        {...(description ? {} : { "aria-describedby": undefined })}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <form
          id={formId}
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(new FormData(event.currentTarget));
          }}
          className="flex flex-col gap-4"
        >
          {children}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={pending}>
              Cancelar
            </Button>
          </DialogClose>
          <Button type="submit" form={formId} disabled={pending}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * El estado de un `FormDialog` que crea y edita la misma entidad: abierto o
 * no, sobre qué registro (`null` = uno nuevo), el envío en curso y el error
 * del servidor. `submit()` corre la acción; con error el diálogo sigue abierto
 * y lo muestra, sin él se cierra.
 *
 * El registro se conserva al cerrar para que el título no cambie mientras el
 * diálogo se desvanece.
 */
export function useEntityDialog<T>() {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const openNew = useCallback(() => {
    setError(null);
    setTarget(null);
    setOpen(true);
  }, []);

  const openEdit = useCallback((item: T) => {
    setError(null);
    setTarget(item);
    setOpen(true);
  }, []);

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) setError(null);
  }, []);

  function submit(action: () => Promise<ConfirmResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result && result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  }

  return { open, target, error, setError, pending, openNew, openEdit, onOpenChange, submit };
}

export type EntityDialog<T> = ReturnType<typeof useEntityDialog<T>>;
