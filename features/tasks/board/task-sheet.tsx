"use client";

import { useState, useTransition } from "react";

import { updateTaskFields } from "@/actions/tasks";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TagPicker } from "@/features/tasks/tag-picker";
import type { Tag } from "@/types";

import type { BoardTask } from "./board-view";

/**
 * Panel compacto de edición de una tarea: responsable, fecha límite y
 * etiquetas — el alcance de edición que pide KAM-15.
 *
 * No es V18. La pantalla de detalle completa —con Markdown, adjuntos,
 * historial y edición campo a campo— la construye KAM-16 en `/tasks/[id]`, y
 * esta tarea deja esa ruta libre a propósito (design D12). Cuando llegue,
 * sustituir este panel es cambiar a dónde apunta la tarjeta.
 */
export function TaskSheet({
  task,
  tags,
  assignees,
  open,
  onOpenChange,
  onError,
}: {
  task: BoardTask | null;
  tags: Tag[];
  assignees: { userId: string; displayName: string | null }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onError: (message: string) => void;
}) {
  const [pending, startTransition] = useTransition();

  if (!task) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent data-testid="task-sheet">
        <SheetHeader>
          <SheetTitle>{task.title}</SheetTitle>
          <SheetDescription>{task.lineName}</SheetDescription>
        </SheetHeader>

        <TaskSheetForm
          key={task.id}
          task={task}
          tags={tags}
          assignees={assignees}
          pending={pending}
          onSave={(fields) => {
            startTransition(async () => {
              const result = await updateTaskFields({
                taskId: task.id,
                ...fields,
              });
              if (result?.error) {
                onError(result.error);
                return;
              }
              onOpenChange(false);
            });
          }}
        />
      </SheetContent>
    </Sheet>
  );
}

function TaskSheetForm({
  task,
  tags,
  assignees,
  pending,
  onSave,
}: {
  task: BoardTask;
  tags: Tag[];
  assignees: { userId: string; displayName: string | null }[];
  pending: boolean;
  onSave: (fields: {
    assigneeId: string | null;
    dueDate: string | null;
    tagNames: string[];
  }) => void;
}) {
  const [assigneeId, setAssigneeId] = useState(
    assignees.find((person) => person.displayName === task.assigneeName)?.userId ??
      "",
  );
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [tagNames, setTagNames] = useState(task.tags.map((tag) => tag.name));

  return (
    <div className="flex flex-col gap-4 px-4 pb-4">
      <Field>
        <FieldLabel htmlFor="sheet-assignee">Responsable</FieldLabel>
        <select
          id="sheet-assignee"
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
        <FieldLabel htmlFor="sheet-due">Fecha límite</FieldLabel>
        <Input
          id="sheet-due"
          type="date"
          value={dueDate}
          disabled={pending}
          onChange={(event) => setDueDate(event.target.value)}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="sheet-tags">Etiquetas</FieldLabel>
        <TagPicker
          available={tags}
          value={tagNames}
          onChange={setTagNames}
          disabled={pending}
        />
      </Field>

      <Button
        disabled={pending}
        data-testid="save-task-sheet"
        onClick={() =>
          onSave({
            assigneeId: assigneeId || null,
            dueDate: dueDate || null,
            tagNames,
          })
        }
      >
        Guardar
      </Button>
    </div>
  );
}
