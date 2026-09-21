"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { UpdateTaskFieldInput } from "@/actions/tasks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { lineColorClasses } from "@/lib/business-lines/colors";
import { formatCalendarDate, formatDateTime } from "@/lib/format/datetime";
import { withFrom } from "@/lib/tasks/list-href";
import { opensClosingWizard } from "@/lib/tasks/deliverables";
import { cn } from "@/lib/utils";
import type { BusinessLine, Status, Task } from "@/types";

export type TaskFieldsProps = {
  task: Task;
  statuses: Status[];
  businessLines: BusinessLine[];
  assignees: { userId: string; displayName: string | null }[];
  onSave: (input: UpdateTaskFieldInput) => Promise<{ error: string } | undefined>;
  /** Cuántos entregables quedan sin cumplir: decide si el cierre abre V19. */
  pendingDeliverables: number;
  /** La vista de origen, para que *Editar* y la vuelta la conserven. */
  from?: string | null;
  timezone: string;
  readOnly?: boolean;
};

/** Un dato ausente se dice; no se deja un hueco en blanco. */
function Dato({
  label,
  children,
  empty = "Sin definir",
}: {
  label: string;
  children?: React.ReactNode;
  empty?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      {/* Cualquier hijo vacío cuenta como ausente, no solo `null`: un
          `lista.length > 0 && …` devuelve `false`, que `??` dejaría pasar. */}
      {children ? children : <span className="text-muted-foreground text-sm">{empty}</span>}
    </div>
  );
}

/**
 * La cabecera de la tarea: **se lee, no se edita** (KAM-29).
 *
 * Hasta KAM-16 cada campo era un control que guardaba solo. La razón era
 * buena —una tarea se toca muchas veces al día por un solo dato— pero el
 * precio era que abrir una tarea fuese entrar a un formulario: un `Select`
 * rozado sin querer cambiaba el responsable, y nada distinguía leer de
 * modificar.
 *
 * Lo que se hace **mientras se trabaja** se quedó aquí: el estado, que además
 * es la puerta del asistente de cierre, y —fuera de este componente— el
 * cuerpo, las casillas, los adjuntos, los vínculos y los entregables. Los
 * datos que **describen** la tarea se cambian en `/tasks/[id]/edit`.
 */
export function TaskFields({
  task,
  statuses,
  businessLines,
  assignees,
  onSave,
  pendingDeliverables,
  from = null,
  timezone,
  readOnly = false,
}: TaskFieldsProps) {
  const [error, setError] = useState<string | null>(null);
  const [, startSaving] = useTransition();
  const router = useRouter();

  const status = statuses.find((candidate) => candidate.id === task.statusId);
  const line = businessLines.find((candidate) => candidate.id === task.businessLineId);
  const assignee = assignees.find((person) => person.userId === task.assigneeId);

  /**
   * Cambiar a un estado de tipo `final` con entregables sin cumplir abre el
   * asistente en vez de cerrar en silencio (design D7 de KAM-21).
   *
   * Es la segunda entrada a V19, y usa la **misma** decisión que el tablero:
   * `opensClosingWizard`. El asistente vive en esta misma pantalla; llevarlo
   * a la dirección es lo que permite llegar también desde el tablero.
   */
  function changeStatus(value: string) {
    const destination = statuses.find((candidate) => candidate.id === value);

    if (destination && opensClosingWizard(destination.kind, pendingDeliverables)) {
      router.push(withFrom(`/tasks/${task.id}?close=${value}`, from));
      return;
    }

    setError(null);
    startSaving(async () => {
      const result = await onSave({ taskId: task.id, field: "statusId", value });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-lg font-semibold">{task.title}</h2>

        {!readOnly && (
          <Button asChild variant="outline" size="sm" data-testid="edit-task">
            <Link href={withFrom(`/tasks/${task.id}/edit`, from)}>Editar</Link>
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Dato label="Estado">
          {/* El único control vivo de la cabecera: es lo que se hace mientras
              se trabaja, y arrastrar en el tablero ya lo cambia sin abrir
              nada. Se toca desde su propia etiqueta de color (design D8). */}
          <Select
            value={task.statusId}
            disabled={readOnly}
            onValueChange={changeStatus}
          >
            <SelectTrigger
              id="task-status"
              aria-label="Estado"
              className="h-auto w-fit border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            >
              <Badge
                variant="secondary"
                className={cn(status && lineColorClasses(status.color).badge)}
              >
                {status?.name ?? "Sin estado"}
              </Badge>
            </SelectTrigger>
            <SelectContent>
              {statuses.map((candidate) => (
                <SelectItem key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Dato>

        <Dato label="Línea de negocio" empty="Sin línea">
          {line && (
            <span className="flex items-center gap-2 text-sm">
              <span
                className={cn("size-2 rounded-full", lineColorClasses(line.color).dot)}
                aria-hidden
              />
              {line.name}
            </span>
          )}
        </Dato>

        <Dato label="Responsable" empty="Sin responsable">
          {task.assigneeId && (
            <span className="text-sm">
              {assignee?.displayName ?? "Sin nombre"}
            </span>
          )}
        </Dato>

        <Dato label="Fecha límite" empty="Sin fecha límite">
          {task.dueAt && (
            <span className="text-sm">
              {formatCalendarDate(task.dueAt.slice(0, 10))}
            </span>
          )}
        </Dato>

        <Dato label="Recordatorio" empty="Sin recordatorio">
          {task.remindAt && (
            <span className="text-sm">{formatDateTime(task.remindAt, timezone)}</span>
          )}
        </Dato>

        <Dato label="Etiquetas" empty="Sin etiquetas">
          {task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {task.tags.map((tag) => (
                <Badge key={tag.id} variant="outline">
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
        </Dato>
      </div>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
