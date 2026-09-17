"use client";

import { useState, type ReactNode } from "react";

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

import { SelectionList, type SelectionListProps } from "./selection-list";

export type SelectionDialogProps<T> = Pick<
  SelectionListProps<T>,
  "items" | "getKey" | "getSearchText" | "renderItem" | "mode" | "label" | "placeholder" | "empty"
> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  /** Lo que llega marcado al abrir, como el cliente actual al «cambiar». */
  initialSelected?: readonly string[];
  /** El rótulo del botón que confirma, según cuántas filas hay marcadas. */
  confirmLabel: (count: number) => string;
  /** Las claves marcadas, en el orden de la lista. */
  onConfirm: (keys: string[]) => void;
  "data-testid"?: string;
};

/**
 * Elegir una o varias entidades en un diálogo, con «Cancelar» y un botón que
 * confirma (design D2 de `order-form-picker-dialogs`).
 *
 * Controlado y sin disparador propio, como `FormDialog`. La selección vive
 * **dentro** del contenido, que Radix desmonta al cerrar: cancelar, `Esc` o
 * un clic fuera descartan lo marcado sin código adicional, y al volver a
 * abrir se empieza de `initialSelected`.
 */
export function SelectionDialog<T>({
  open,
  onOpenChange,
  title,
  description,
  "data-testid": testId,
  ...body
}: SelectionDialogProps<T>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid={testId}
        className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-lg"
        {...(description ? {} : { "aria-describedby": undefined })}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <SelectionDialogBody
          {...body}
          onDone={(keys) => {
            body.onConfirm(keys);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function SelectionDialogBody<T>({
  items,
  getKey,
  initialSelected = [],
  confirmLabel,
  onDone,
  ...list
}: Omit<SelectionDialogProps<T>, "open" | "onOpenChange" | "title" | "description" | "onConfirm"> & {
  onDone: (keys: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([...initialSelected]);

  function confirm() {
    // El orden de la lista, no el de los clics: es el que el usuario ve.
    const ordered = items
      .map(getKey)
      .filter((key) => selected.includes(key));
    onDone(ordered);
  }

  return (
    <>
      <SelectionList
        {...list}
        items={items}
        getKey={getKey}
        selected={selected}
        onSelectedChange={setSelected}
        className="min-h-0 flex-1"
      />

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancelar
          </Button>
        </DialogClose>
        <Button
          type="button"
          disabled={selected.length === 0}
          data-testid="selection-confirm"
          onClick={confirm}
        >
          {confirmLabel(selected.length)}
        </Button>
      </DialogFooter>
    </>
  );
}
