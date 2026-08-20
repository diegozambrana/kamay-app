"use client";

import { useState, useTransition } from "react";

import type { ActionResult } from "@/actions/configuration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { ConfigList, type ConfigEntity } from "./config-list";

type NamedItem = { id: string; name: string; archivedAt: string | null };

/**
 * Secciones de Canales y Categorías: la misma pantalla con distinto nombre.
 * Las acciones llegan por parámetro para que este componente no conozca ninguna
 * entidad en particular.
 */
export function NamedSection({
  title,
  description,
  placeholder,
  entity,
  items,
  onCreate,
  onUpdate,
}: {
  title: string;
  description: string;
  placeholder: string;
  entity: ConfigEntity;
  items: NamedItem[];
  onCreate: (input: { name: string }) => Promise<ActionResult>;
  onUpdate: (input: { name: string; id: string }) => Promise<ActionResult>;
}) {
  const [editing, setEditing] = useState<NamedItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name") ?? "");
    setError(null);

    startTransition(async () => {
      const result = editing
        ? await onUpdate({ name, id: editing.id })
        : await onCreate({ name });

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
      <h2 className="text-lg font-medium">{title}</h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">{description}</p>

      <form
        onSubmit={onSubmit}
        className="mb-6 flex flex-wrap items-end gap-3"
        key={editing?.id ?? "new"}
      >
        <div className="space-y-1.5">
          <Label htmlFor={`${entity}-name`}>Nombre</Label>
          <Input
            id={`${entity}-name`}
            name="name"
            defaultValue={editing?.name ?? ""}
            placeholder={placeholder}
            required
          />
        </div>

        <Button type="submit" disabled={pending}>
          {editing ? "Guardar" : "Crear"}
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
        entity={entity}
        items={items.map((item) => ({
          id: item.id,
          label: item.name,
          archivedAt: item.archivedAt,
        }))}
        onEdit={(item) => {
          const found = items.find((candidate) => candidate.id === item.id);
          if (found) setEditing(found);
        }}
      />
    </section>
  );
}
