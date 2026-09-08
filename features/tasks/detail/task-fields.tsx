"use client";

import { useState, useTransition } from "react";

import type { UpdateTaskFieldInput } from "@/actions/tasks";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BusinessLine, Status, Task } from "@/types";

/** Un valor de `Select` no puede ser cadena vacía: se usa este centinela. */
const SIN_ASIGNAR = "unassigned";

export type TaskFieldsProps = {
  task: Task;
  statuses: Status[];
  businessLines: BusinessLine[];
  assignees: { userId: string; displayName: string | null }[];
  onSave: (input: UpdateTaskFieldInput) => Promise<{ error: string } | undefined>;
  readOnly?: boolean;
};

/**
 * La cabecera editable de la tarea.
 *
 * **Cada campo guarda por su cuenta** (design D3): una tarea se toca muchas
 * veces al día por un solo dato, y un botón *Guardar* al pie obligaría a bajar
 * hasta él para cambiar un responsable. Ninguno bloquea a los demás mientras
 * viaja.
 */
export function TaskFields({
  task,
  statuses,
  businessLines,
  assignees,
  onSave,
  readOnly = false,
}: TaskFieldsProps) {
  const [title, setTitle] = useState(task.title);
  const [error, setError] = useState<string | null>(null);
  const [, startSaving] = useTransition();

  function save(input: UpdateTaskFieldInput, onFail?: () => void) {
    setError(null);
    startSaving(async () => {
      const result = await onSave(input);
      if (result?.error) {
        setError(result.error);
        onFail?.();
      }
    });
  }

  /** La fecha viaja como `YYYY-MM-DD`; el input nativo ya la da así. */
  const dueDate = task.dueAt ? task.dueAt.slice(0, 10) : "";
  // `datetime-local` no admite zona: se recorta a minutos, que es la precisión
  // con la que alguien fija un recordatorio.
  const remindAt = task.remindAt ? task.remindAt.slice(0, 16) : "";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="task-title">Título</Label>
        <Input
          id="task-title"
          value={title}
          disabled={readOnly}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => {
            if (title === task.title) return;
            save({ taskId: task.id, field: "title", value: title }, () =>
              // El título anterior se conserva: un campo que se queda vacío en
              // pantalla mientras el servidor dice que no, miente.
              setTitle(task.title),
            );
          }}
          className="text-lg font-semibold"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="task-status">Estado</Label>
          <Select
            value={task.statusId}
            disabled={readOnly}
            onValueChange={(value) =>
              save({ taskId: task.id, field: "statusId", value })
            }
          >
            <SelectTrigger id="task-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statuses.map((status) => (
                <SelectItem key={status.id} value={status.id}>
                  {status.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="task-line">Línea</Label>
          <Select
            value={task.businessLineId}
            disabled={readOnly}
            onValueChange={(value) =>
              save({ taskId: task.id, field: "businessLineId", value })
            }
          >
            <SelectTrigger id="task-line">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {businessLines.map((line) => (
                <SelectItem key={line.id} value={line.id}>
                  {line.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="task-assignee">Responsable</Label>
          <Select
            value={task.assigneeId ?? SIN_ASIGNAR}
            disabled={readOnly}
            onValueChange={(value) =>
              save({
                taskId: task.id,
                field: "assigneeId",
                value: value === SIN_ASIGNAR ? null : value,
              })
            }
          >
            <SelectTrigger id="task-assignee">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SIN_ASIGNAR}>Sin asignar</SelectItem>
              {assignees.map((person) => (
                <SelectItem key={person.userId} value={person.userId}>
                  {person.displayName ?? "Sin nombre"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="task-due">Fecha límite</Label>
          <Input
            id="task-due"
            type="date"
            defaultValue={dueDate}
            disabled={readOnly}
            onChange={(event) =>
              save({
                taskId: task.id,
                field: "dueDate",
                value: event.target.value === "" ? null : event.target.value,
              })
            }
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="task-remind">Recordatorio</Label>
          <Input
            id="task-remind"
            type="datetime-local"
            defaultValue={remindAt}
            disabled={readOnly}
            onChange={(event) =>
              save({
                taskId: task.id,
                field: "remindAt",
                value:
                  event.target.value === ""
                    ? null
                    : new Date(event.target.value).toISOString(),
              })
            }
          />
          {!task.dueAt && (
            <p className="text-muted-foreground text-xs">
              El recordatorio cuelga de la fecha límite.
            </p>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
