"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createTask } from "@/actions/tasks";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { TaskLinkType } from "@/types";
import type { BusinessLine, Tag } from "@/types";

import { TagPicker } from "./tag-picker";

export type TaskFormPrefill = {
  title?: string;
  businessLineId?: string;
  dueDate?: string | null;
  link?: { entityType: TaskLinkType; entityId: string } | null;
  /** Contexto visible: de qué pedido viene. No es un dato de la tarea. */
  linkLabel?: string | null;
  customerName?: string | null;
};

/**
 * Formulario de alta de tarea.
 *
 * Todo lo prellenado es una **propuesta**: la línea, la fecha y el propio
 * vínculo se pueden cambiar o quitar antes de guardar. La decisión de crear la
 * tarea, y con qué, es siempre de la persona — es la misma regla que impide
 * que un pedido genere tareas por su cuenta (convención nº 10).
 */
export function TaskForm({
  lines,
  assignees,
  tags,
  currentUserId,
  prefill,
}: {
  lines: BusinessLine[];
  assignees: { userId: string; displayName: string | null }[];
  tags: Tag[];
  currentUserId: string;
  prefill?: TaskFormPrefill;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(prefill?.title ?? "");
  const [businessLineId, setBusinessLineId] = useState(
    prefill?.businessLineId ?? lines[0]?.id ?? "",
  );
  // El responsable propuesto es quien crea la tarea (§6.3). Se puede cambiar o
  // vaciar.
  const [assigneeId, setAssigneeId] = useState(currentUserId);
  const [dueDate, setDueDate] = useState(prefill?.dueDate ?? "");
  const [tagNames, setTagNames] = useState<string[]>([]);
  const [keepLink, setKeepLink] = useState(Boolean(prefill?.link));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createTask({
        title,
        businessLineId,
        assigneeId: assigneeId || null,
        dueDate: dueDate || null,
        tagNames,
        link: keepLink ? (prefill?.link ?? null) : null,
      });

      if ("error" in result) {
        setError(result.error);
        return;
      }

      router.push("/tasks");
    });
  }

  return (
    <form onSubmit={submit} className="flex max-w-xl flex-col gap-4">
      {error && (
        <Alert variant="destructive" data-testid="task-form-error">
          <AlertTitle>No se pudo guardar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Field>
        <FieldLabel htmlFor="task-title">Título</FieldLabel>
        <Input
          id="task-title"
          value={title}
          autoFocus
          disabled={pending}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="¿Qué hay que hacer?"
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="task-line">Línea de negocio</FieldLabel>
        <select
          id="task-line"
          value={businessLineId}
          disabled={pending}
          onChange={(event) => setBusinessLineId(event.target.value)}
          className="h-9 rounded-lg border bg-background px-2 text-sm"
        >
          {lines.map((line) => (
            <option key={line.id} value={line.id}>
              {line.name}
            </option>
          ))}
        </select>
      </Field>

      <Field>
        <FieldLabel htmlFor="task-assignee">Responsable</FieldLabel>
        <select
          id="task-assignee"
          value={assigneeId}
          disabled={pending}
          onChange={(event) => setAssigneeId(event.target.value)}
          className="h-9 rounded-lg border bg-background px-2 text-sm"
        >
          <option value="">Sin responsable</option>
          {assignees.map((person) => (
            <option key={person.userId} value={person.userId}>
              {person.displayName ?? "Sin nombre"}
            </option>
          ))}
        </select>
      </Field>

      <Field>
        <FieldLabel htmlFor="task-due">Fecha límite</FieldLabel>
        <Input
          id="task-due"
          type="date"
          value={dueDate ?? ""}
          disabled={pending}
          onChange={(event) => setDueDate(event.target.value)}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="task-tags">Etiquetas</FieldLabel>
        <TagPicker
          available={tags}
          value={tagNames}
          onChange={setTagNames}
          disabled={pending}
        />
      </Field>

      {/* El vínculo llega prellenado desde el pedido y se puede quitar: es una
          propuesta, no una imposición. La interfaz para añadir vínculos a mano
          —el buscador de pedidos, ítems y contactos— es de KAM-21. */}
      {prefill?.link && (
        <div
          data-testid="task-link"
          className="rounded-lg border bg-muted/40 p-3 text-sm"
        >
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={keepLink}
              disabled={pending}
              onChange={(event) => setKeepLink(event.target.checked)}
            />
            Vincular con {prefill.linkLabel ?? "el pedido"}
          </label>
          {prefill.customerName && (
            <p className="mt-1 pl-6 text-xs text-muted-foreground">
              Cliente: {prefill.customerName}
            </p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending} data-testid="save-task">
          Guardar
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => router.push("/tasks")}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
