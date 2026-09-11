"use client";

import { useState, useTransition } from "react";

import { unarchiveFromEvent } from "@/actions/activity";
import { Button } from "@/components/ui/button";
import { isUnarchivable } from "@/lib/activity/unarchive";

/**
 * Desarchivar desde el evento de archivado (Flujo G de la especificación).
 *
 * Solo aparece sobre un evento `archived`. Si el registro ya volvió a estar
 * vigente, el evento posterior de `unarchived` lo dice y esta acción sobre el
 * evento antiguo es inofensiva: la acción de dominio la resuelve como un
 * desarchivado de algo ya desarchivado.
 *
 * Recuperar es desarchivar, no revertir: el backlog deja fuera la reversión de
 * cambios individuales a propósito, y este botón es su única alternativa.
 */
export function UnarchiveFromEvent({
  action,
  tableName,
  recordId,
  recordLabel,
}: {
  action: string;
  tableName: string;
  recordId: string;
  recordLabel: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (action !== "archived" || !isUnarchivable(tableName)) return null;

  if (done) {
    return (
      <span className="text-muted-foreground shrink-0 text-xs" role="status">
        Desarchivado
      </span>
    );
  }

  return (
    <span className="flex shrink-0 items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        data-testid="activity-unarchive"
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await unarchiveFromEvent({ tableName, recordId });
            if (result?.error) setError(result.error);
            else setDone(true);
          })
        }
      >
        {pending ? "Desarchivando…" : "Desarchivar"}
        {recordLabel && <span className="sr-only"> {recordLabel}</span>}
      </Button>
      {error && (
        <span role="alert" className="text-destructive text-xs">
          {error}
        </span>
      )}
    </span>
  );
}
