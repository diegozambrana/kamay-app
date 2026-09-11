"use client";

import { useState, useTransition } from "react";

import { updateRetentionPolicy } from "@/actions/configuration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { retentionLabel } from "@/lib/activity/retention";

/**
 * Sección Retención de V15 (KAM-22).
 *
 * Dice en una frase qué ocurre al cumplirse el plazo, porque «retención: 12»
 * no informa de nada: lo que se suelta es el detalle campo a campo, y el
 * evento —quién, qué y cuándo— se queda para siempre. Quien decide el número
 * tiene que saber exactamente qué está decidiendo.
 */
export function RetentionForm({ months }: { months: number }) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(new FormData(event.currentTarget).get("months"));
    setError(null);
    setSaved(null);

    startTransition(async () => {
      const result = await updateRetentionPolicy({ months: value });
      if (result?.error) setError(result.error);
      else setSaved(value);
    });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="months">Meses de detalle completo</Label>
        <Input
          id="months"
          name="months"
          type="number"
          min={1}
          max={120}
          step={1}
          defaultValue={months}
          required
          data-testid="retention-months"
        />
      </div>

      <p className="text-muted-foreground text-sm" data-testid="retention-explainer">
        Pasados {retentionLabel(months)}, la bitácora suelta <strong>el detalle</strong> de
        cada cambio —qué campo tenía antes y qué tiene ahora—. El evento se
        conserva para siempre: quién lo hizo, sobre qué registro y cuándo no se
        borran nunca. Antes de soltar nada, el sistema genera y verifica una
        exportación con ese detalle.
      </p>

      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar"}
      </Button>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {saved !== null && (
        <p className="text-muted-foreground text-sm" role="status">
          Retención guardada: {retentionLabel(saved)}.
        </p>
      )}
    </form>
  );
}
