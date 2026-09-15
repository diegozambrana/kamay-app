"use client";

import { useState, useTransition } from "react";

import { archiveStatus } from "@/actions/statuses";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setIsComplete } from "@/lib/statuses/schema";
import type { Status } from "@/types";

import { INCOMPLETE_SET } from "./status-dialog";

/** Radix no admite una opción con valor vacío: «nada que mover» se nombra. */
const NOWHERE = "none";

/**
 * Archivar un estado pidiendo, en la misma confirmación, a dónde mover los
 * registros que lo usaban (spec `configurable-statuses` → *Archivar pide a
 * dónde mover dentro de la confirmación*). Si archivarlo dejaría el juego sin
 * inicial o sin final, el diálogo lo dice y no deja confirmar.
 */
export function ArchiveStatusDialog({
  status,
  open,
  onOpenChange,
  active,
}: {
  status: Status | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Los estados activos del juego, incluido el que se archiva. */
  active: Status[];
}) {
  const [moveTo, setMoveTo] = useState(NOWHERE);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!status) return null;

  const siblings = active.filter((candidate) => candidate.id !== status.id);
  const blocked = !setIsComplete(siblings.map((sibling) => sibling.kind));

  function confirm() {
    if (!status) return;
    setError(null);
    startTransition(async () => {
      const result = await archiveStatus({
        id: status.id,
        moveToId: moveTo === NOWHERE ? null : moveTo,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      onOpenChange(false);
    });
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setMoveTo(NOWHERE);
          setError(null);
        }
      }}
      title={`¿Archivar «${status.name}»?`}
      description="Deja de ser una columna del tablero. Los pedidos y tareas anteriores conservan su historia."
      confirmLabel="Archivar estado"
      destructive
      pending={pending}
      error={blocked ? INCOMPLETE_SET : error}
      confirmDisabled={blocked}
      onConfirm={confirm}
    >
      {!blocked && (
        <Field>
          <FieldLabel htmlFor="archive-move-to">Mover los registros que lo usaban a</FieldLabel>
          <Select value={moveTo} onValueChange={setMoveTo}>
            <SelectTrigger id="archive-move-to" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NOWHERE}>Sin registros que mover</SelectItem>
              {siblings.map((sibling) => (
                <SelectItem key={sibling.id} value={sibling.id}>
                  {sibling.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
    </ConfirmDialog>
  );
}
