"use client";

import { useState, useTransition } from "react";

import { updateFairSettings } from "@/actions/configuration";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/**
 * Sección "Venta rápida" de General (`fair-all-lines`).
 *
 * Apagada por omisión, con la explicación de a qué línea va cada venta junto
 * al interruptor — spec `org-configuration` → "Fair mode can show every
 * line, off by default".
 */
export function FairAllLinesForm({ allLines }: { allLines: boolean }) {
  const [checked, setChecked] = useState(allLines);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    startTransition(async () => {
      const result = await updateFairSettings({ allLines: checked });
      if (result?.error) setError(result.error);
      else setSaved(true);
    });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-4">
      <div className="flex items-start gap-3">
        <Switch
          id="fair-all-lines"
          checked={checked}
          onCheckedChange={(value) => {
            setChecked(value);
            setSaved(false);
          }}
        />
        <div className="-mt-0.5">
          <Label htmlFor="fair-all-lines">Venta rápida con todas las líneas</Label>
          <p className="text-muted-foreground text-xs" data-testid="fair-all-lines-notice">
            La feria muestra los productos de todas las líneas activas. Al
            registrar, cada producto se registra en su propia línea, y los
            productos compartidos en la línea elegida al abrir la feria.
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
