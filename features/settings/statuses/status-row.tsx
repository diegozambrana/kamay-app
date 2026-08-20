"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useState, useTransition } from "react";

import { archiveStatus, updateStatus } from "@/actions/statuses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lineColorClasses, LINE_COLOR_LABELS } from "@/lib/business-lines/colors";
import { STATUS_KIND_LABELS } from "@/lib/statuses/kinds";
import { setIsComplete, statusFormSchema } from "@/lib/statuses/schema";
import { cn } from "@/lib/utils";
import {
  LINE_COLORS,
  STATUS_KINDS,
  type LineColor,
  type Status,
  type StatusKind,
} from "@/types";

type Mode = "view" | "edit" | "archive";

/**
 * Una fila de V22: edición en el sitio y archivado con reasignación, ambos
 * desplegados dentro de la propia fila (sin diálogos modales). La validación
 * del juego —al menos un inicial y un final— se comprueba aquí antes de
 * enviar; la base la garantiza después.
 */
export function StatusRow({
  status,
  siblings,
}: {
  status: Status;
  /** Los demás estados activos del mismo juego. */
  siblings: Status[];
}) {
  const [mode, setMode] = useState<Mode>("view");
  const [error, setError] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState<string>("");
  const [pending, startTransition] = useTransition();

  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: status.id });

  const siblingKinds = siblings.map((sibling) => sibling.kind);

  function submitEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values = {
      name: String(data.get("name") ?? ""),
      color: String(data.get("color") ?? "zinc") as LineColor,
      kind: String(data.get("kind") ?? status.kind) as StatusKind,
      isQueue: data.get("isQueue") === "on",
    };

    const parsed = statusFormSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    if (!setIsComplete([...siblingKinds, parsed.data.kind])) {
      setError("Todo juego necesita al menos un estado inicial y uno final.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await updateStatus({ ...parsed.data, id: status.id });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setMode("view");
    });
  }

  function submitArchive() {
    if (!setIsComplete(siblingKinds)) {
      setError("Todo juego necesita al menos un estado inicial y uno final.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await archiveStatus({
        id: status.id,
        moveToId: moveTo === "" ? null : moveTo,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setMode("view");
    });
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-testid="status-row"
      className="bg-background px-3 py-2"
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Reordenar ${status.name}`}
          className="cursor-grab text-muted-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>

        <span
          aria-hidden
          className={cn(
            "size-2.5 rounded-full",
            lineColorClasses(status.color).dot,
          )}
        />

        <span className="flex-1 text-sm">{status.name}</span>

        <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
          {STATUS_KIND_LABELS[status.kind]}
        </span>

        {status.isQueue && (
          <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
            Columna en cola
          </span>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setError(null);
            setMode(mode === "edit" ? "view" : "edit");
          }}
        >
          Editar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setError(null);
            setMoveTo("");
            setMode(mode === "archive" ? "view" : "archive");
          }}
        >
          Archivar
        </Button>
      </div>

      {mode === "edit" && (
        <form
          onSubmit={submitEdit}
          className="mt-3 flex flex-wrap items-end gap-3 border-t pt-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor={`name-${status.id}`}>Nombre</Label>
            <Input
              id={`name-${status.id}`}
              name="name"
              defaultValue={status.name}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`kind-${status.id}`}>Tipo</Label>
            <select
              id={`kind-${status.id}`}
              name="kind"
              defaultValue={status.kind}
              className="h-8 rounded-lg border bg-background px-2 text-sm"
            >
              {STATUS_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {STATUS_KIND_LABELS[kind]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`color-${status.id}`}>Color</Label>
            <select
              id={`color-${status.id}`}
              name="color"
              defaultValue={status.color}
              className="h-8 rounded-lg border bg-background px-2 text-sm"
            >
              {LINE_COLORS.map((color) => (
                <option key={color} value={color}>
                  {LINE_COLOR_LABELS[color]}
                </option>
              ))}
            </select>
          </div>

          <label className="flex h-8 items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isQueue"
              defaultChecked={status.isQueue}
            />
            Columna en cola
          </label>

          <Button type="submit" size="sm" disabled={pending}>
            Guardar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setMode("view")}
          >
            Cancelar
          </Button>
        </form>
      )}

      {mode === "archive" && (
        <div className="mt-3 flex flex-wrap items-end gap-3 border-t pt-3">
          <div className="space-y-1.5">
            <Label htmlFor={`move-${status.id}`}>
              Mover los registros que lo usaban a
            </Label>
            <select
              id={`move-${status.id}`}
              value={moveTo}
              onChange={(event) => setMoveTo(event.target.value)}
              className="h-8 rounded-lg border bg-background px-2 text-sm"
            >
              <option value="">Sin registros que mover</option>
              {siblings.map((sibling) => (
                <option key={sibling.id} value={sibling.id}>
                  {sibling.name}
                </option>
              ))}
            </select>
          </div>

          <Button size="sm" disabled={pending} onClick={submitArchive}>
            Archivar estado
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setMode("view")}
          >
            Cancelar
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </li>
  );
}
