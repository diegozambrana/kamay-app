"use client";

import { useState, useTransition } from "react";

import { updateGeneralSettings } from "@/actions/configuration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Organization } from "@/types";

/** Sección General de V15: los datos de la organización, nada más. */
export function GeneralForm({ organization }: { organization: Organization }) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setSaved(false);

    startTransition(async () => {
      const result = await updateGeneralSettings({
        name: String(form.get("name") ?? ""),
        currency: String(form.get("currency") ?? ""),
        timezone: String(form.get("timezone") ?? ""),
        logoPath: String(form.get("logoPath") ?? "") || null,
      });

      if (result?.error) setError(result.error);
      else setSaved(true);
    });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-sm space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" defaultValue={organization.name} required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="currency">Moneda</Label>
        <Input
          id="currency"
          name="currency"
          defaultValue={organization.currency}
          maxLength={3}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="timezone">Zona horaria</Label>
        <Input
          id="timezone"
          name="timezone"
          defaultValue={organization.timezone}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="logoPath">Logo (ruta en almacenamiento)</Label>
        <Input
          id="logoPath"
          name="logoPath"
          defaultValue={organization.logoPath ?? ""}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {saved && !error && (
        <p role="status" className="text-sm text-muted-foreground">
          Cambios guardados.
        </p>
      )}

      <Button type="submit" disabled={pending}>
        Guardar
      </Button>
    </form>
  );
}
