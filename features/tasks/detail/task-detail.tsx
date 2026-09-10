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
import { useRouter } from "next/navigation";

import { ClosingDialog } from "@/features/tasks/deliverables/closing-dialog";
import { DeliverablesSection } from "@/features/tasks/deliverables/deliverables-section";
import { TaskLinks } from "@/features/tasks/links/task-links";
import type { Deliverable } from "@/lib/tasks/deliverables";
import type { ResolvedTaskLink } from "@/services/tasks/task-service";

import { TaskHistory } from "./task-history";

export type TaskDetailProps = {
  task: Task;
  statuses: Status[];
  businessLines: BusinessLine[];
  assignees: { userId: string; displayName: string | null }[];
  attachments: TaskAttachment[];
  /** Los vínculos resueltos contra sus destinos (KAM-21). */
  links: ResolvedTaskLink[];
  /** Los entregables declarados de la tarea (KAM-21). */
  deliverables: Deliverable[];
  isOwner: boolean;
  /** Lo que los formularios de egreso del asistente necesitan. */
  suppliers: { id: string; name: string }[];
  expenseCategories: { id: string; name: string }[];
  supplies: { id: string; name: string }[];
  /**
   * El estado de tipo `final` al que se llevó la tarea desde el tablero.
   *
   * Llega en la dirección (`?close=`) porque el asistente necesita datos que
   * el tablero no carga (design D7). `null` = no hay cierre en curso.
   */
  closingStatusId: string | null;
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
 * Las secciones *Vínculos* y *Entregables esperados* son de KAM-21, que las
 * encendió en la ranura que esta pantalla había dejado sin pintar.
 */
export function TaskDetail({
  task,
  statuses,
  businessLines,
  assignees,
  attachments,
  links,
  deliverables,
  isOwner,
  suppliers,
  expenseCategories,
  supplies,
  closingStatusId,
  history,
  timezone,
}: TaskDetailProps) {
  const router = useRouter();
  const archivada = task.archivedAt !== null;

  /** Quita `?close=` sin recargar: cancelar deja la tarea como estaba. */
  function dismissClosing() {
    router.replace(`/tasks/${task.id}`);
  }

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
              pendingDeliverables={
                deliverables.filter((d) => d.fulfilledAt === null).length
              }
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
            <CardTitle>Vínculos</CardTitle>
          </CardHeader>
          <CardContent>
            <TaskLinks taskId={task.id} links={links} readOnly={archivada} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Entregables esperados</CardTitle>
          </CardHeader>
          <CardContent>
            <DeliverablesSection
              taskId={task.id}
              deliverables={deliverables}
              isOwner={isOwner}
              readOnly={archivada}
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

      {closingStatusId !== null && (
        <ClosingDialog
          open
          taskId={task.id}
          statusId={closingStatusId}
          task={{
            title: task.title,
            businessLineId: task.businessLineId,
            bodyMarkdown: task.bodyMarkdown,
            attachments: attachments.map((file) => ({
              id: file.id,
              fileName: file.fileName,
            })),
          }}
          deliverables={deliverables}
          suppliers={suppliers}
          expenseCategories={expenseCategories}
          supplies={supplies}
          onCancel={dismissClosing}
          onClosed={() => {
            router.push("/tasks");
          }}
        />
      )}
    </MainContainer>
  );
}
