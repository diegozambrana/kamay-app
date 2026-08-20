"use client";

import { useState, useTransition } from "react";

import { createBusinessLine, updateBusinessLine } from "@/actions/configuration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LINE_COLOR_LABELS, lineColorClasses } from "@/lib/business-lines/colors";
import { cn } from "@/lib/utils";
import { LINE_COLORS, type BusinessLine, type LineColor } from "@/types";

import { ConfigList } from "./config-list";

/**
 * Sección Líneas de negocio de V15. La línea compartida se lista sin control de
 * archivar: el invariante lo garantiza la base, y ofrecer un botón que siempre
 * falla sería mentirle al usuario.
 */
export function BusinessLinesSection({ lines }: { lines: BusinessLine[] }) {
  const [editing, setEditing] = useState<BusinessLine | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const values = {
      name: String(data.get("name") ?? ""),
      color: String(data.get("color") ?? "zinc") as LineColor,
    };
    setError(null);

    startTransition(async () => {
      const result = editing
        ? await updateBusinessLine({ ...values, id: editing.id })
        : await createBusinessLine(values);

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
      <h2 className="text-lg font-medium">Líneas de negocio</h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">
        Cada línea tiene sus propias cuentas y su propio color.
      </p>

      <form
        onSubmit={onSubmit}
        className="mb-6 flex flex-wrap items-end gap-3"
        key={editing?.id ?? "new"}
      >
        <div className="space-y-1.5">
          <Label htmlFor="line-name">Nombre</Label>
          <Input
            id="line-name"
            name="name"
            defaultValue={editing?.name ?? ""}
            placeholder="Sublimación"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="line-color">Color</Label>
          <select
            id="line-color"
            name="color"
            defaultValue={editing?.color ?? "zinc"}
            className="h-8 rounded-lg border bg-background px-2 text-sm"
          >
            {LINE_COLORS.map((color) => (
              <option key={color} value={color}>
                {LINE_COLOR_LABELS[color]}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit" disabled={pending}>
          {editing ? "Guardar" : "Crear línea"}
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
        entity="line"
        items={lines.map((line) => ({
          id: line.id,
          label: line.name,
          archivedAt: line.archivedAt,
          protected: line.isShared,
          leading: (
            <span
              aria-hidden
              className={cn(
                "size-2.5 rounded-full",
                lineColorClasses(line.color).dot,
              )}
            />
          ),
        }))}
        onEdit={(item) => {
          const line = lines.find((candidate) => candidate.id === item.id);
          if (line) setEditing(line);
        }}
      />
    </section>
  );
}
