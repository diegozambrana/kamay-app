"use client";

import { useState, useTransition } from "react";

import { createUnit, updateUnit } from "@/actions/configuration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Unit } from "@/types";

import { ConfigList } from "./config-list";

/** Sección Unidades de V15. Aquí la clave visible es el código ('u', 'kg'…). */
export function UnitsSection({ units }: { units: Unit[] }) {
  const [editing, setEditing] = useState<Unit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const values = {
      code: String(data.get("code") ?? ""),
      name: String(data.get("name") ?? ""),
    };
    setError(null);

    startTransition(async () => {
      const result = editing
        ? await updateUnit({ ...values, id: editing.id })
        : await createUnit(values);

      if (result?.error) {
        setError(result.error);
        return;
      }

      setEditing(null);
      form.reset();
    });
  }

  return (
    <section>
      <h2 className="text-lg font-medium">Unidades</h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">
        Cómo se mide lo que se compra y se vende.
      </p>

      <form
        onSubmit={onSubmit}
        className="mb-6 flex flex-wrap items-end gap-3"
        key={editing?.id ?? "new"}
      >
        <div className="space-y-1.5">
          <Label htmlFor="unit-code">Código</Label>
          <Input
            id="unit-code"
            name="code"
            defaultValue={editing?.code ?? ""}
            placeholder="kg"
            maxLength={10}
            className="w-24"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="unit-name">Nombre</Label>
          <Input
            id="unit-name"
            name="name"
            defaultValue={editing?.name ?? ""}
            placeholder="Kilogramo"
            required
          />
        </div>

        <Button type="submit" disabled={pending}>
          {editing ? "Guardar" : "Crear unidad"}
        </Button>

        {editing && (
          <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
            Cancelar
          </Button>
        )}
      </form>

      {error && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {error}
        </p>
      )}

      <ConfigList
        entity="unit"
        items={units.map((unit) => ({
          id: unit.id,
          label: `${unit.code} · ${unit.name}`,
          archivedAt: unit.archivedAt,
        }))}
        onEdit={(item) => {
          const unit = units.find((candidate) => candidate.id === item.id);
          if (unit) setEditing(unit);
        }}
      />
    </section>
  );
}
