"use client";

import {
  detachFromTask,
  toggleTaskChecklistItem,
  updateTaskBody,
  updateTaskField,
} from "@/actions/tasks";
import { MainContainer } from "@/components/layout/main-container";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AttachmentPanel,
  type TaskAttachment,
} from "@/features/tasks/attachments/attachment-panel";
import { MarkdownEditor } from "@/features/tasks/editor/markdown-editor";
import type { ActivityEntry, BusinessLine, Status, Task } from "@/types";

import { TaskFields } from "./task-fields";
import { TaskHistory } from "./task-history";

export type TaskDetailProps = {
  task: Task;
  statuses: Status[];
  businessLines: BusinessLine[];
  assignees: { userId: string; displayName: string | null }[];
  attachments: TaskAttachment[];
  history: ActivityEntry[];
  timezone: string;
};

/**
 * V18 · Detalle de tarea.
 *
 * Es una **página con dirección propia** y no un panel: se llega desde el
 * tablero, desde una notificación, desde un ítem o desde un contacto, y una
 * dirección compartible es lo que hace que esos enlaces existan.
 *
 * La sección *Vínculos* del diseño de V18 no está: la construye KAM-21. Se
 * deja sin ranura en lugar de pintarla inerte, porque una sección vacía aquí
 * solo ocuparía pantalla sin nada que verificar.
 */
export function TaskDetail({
  task,
  statuses,
  businessLines,
  assignees,
  attachments,
  history,
  timezone,
}: TaskDetailProps) {
  const archivada = task.archivedAt !== null;

  return (
    <MainContainer
      title={
        <span className="flex flex-wrap items-center gap-2">
          <span>Tarea</span>
          {archivada && <Badge variant="secondary">Archivada</Badge>}
        </span>
      }
      description={
        archivada
          ? "Esta tarea está archivada: se puede leer, no editar. Desarchívala desde el tablero para volver a trabajar en ella."
          : undefined
      }
    >
      <div className="flex flex-col gap-6">
        <Card>
          <CardContent>
            <TaskFields
              task={task}
              statuses={statuses}
              businessLines={businessLines}
              assignees={assignees}
              onSave={updateTaskField}
              readOnly={archivada}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Descripción</CardTitle>
          </CardHeader>
          <CardContent>
            <MarkdownEditor
              taskId={task.id}
              value={task.bodyMarkdown ?? ""}
              readOnly={archivada}
              onSave={(body) => updateTaskBody({ taskId: task.id, body })}
              onToggleChecklistItem={(index, checked) =>
                toggleTaskChecklistItem({ taskId: task.id, index, checked })
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Adjuntos</CardTitle>
          </CardHeader>
          <CardContent>
            <AttachmentPanel
              taskId={task.id}
              attachments={attachments}
              readOnly={archivada}
              onDetach={(attachmentId) =>
                detachFromTask({ taskId: task.id, attachmentId })
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Historial</CardTitle>
          </CardHeader>
          <CardContent>
            <TaskHistory history={history} timezone={timezone} />
          </CardContent>
        </Card>
      </div>
    </MainContainer>
  );
}
