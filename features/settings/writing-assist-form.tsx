"use client";

import { useState, useTransition } from "react";

import { updateWritingAssistSettings } from "@/actions/configuration";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

/**
 * Sección "Asistencia de redacción" de General (KAM-30).
 *
 * Apagada por omisión, con el aviso explícito de que activarla manda el
 * cuerpo de las tareas a un proveedor externo — spec `org-configuration` →
 * "Writing assist is activated per organization, off by default".
 */
export function WritingAssistForm({ enabled }: { enabled: boolean }) {
  const [checked, setChecked] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    startTransition(async () => {
      const result = await updateWritingAssistSettings({ enabled: checked });
      if (result?.error) setError(result.error);
      else setSaved(true);
    });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-4">
      <div className="flex items-start gap-3">
        <Checkbox
          id="writing-assist-enabled"
          checked={checked}
          onCheckedChange={(value) => {
            setChecked(value === true);
            setSaved(false);
          }}
        />
        <div className="-mt-0.5">
          <Label htmlFor="writing-assist-enabled">Activar la asistencia de redacción</Label>
          <p className="text-muted-foreground text-xs" data-testid="writing-assist-notice">
            Con esto activado, quien edite una tarea puede pedir una propuesta
            de redacción para su descripción. El texto de la tarea sale hacia
            un proveedor externo para generarla; nada se guarda sin que la
            persona la acepte primero.
          </p>
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar"}
      </Button>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="text-muted-foreground text-sm" role="status">
          Cambios guardados.
        </p>
      )}
    </form>
  );
}
