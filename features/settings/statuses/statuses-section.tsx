"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  applyOrganizationStatuses,
  createOwnStatusSet,
  reorderStatuses,
  restoreDefaultStatuses,
} from "@/actions/statuses";
import { useConfirmDialog } from "@/components/shared/confirm-dialog";
import { useEntityDialog } from "@/components/shared/form-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { STATUS_KIND_LABELS } from "@/lib/statuses/kinds";
import type { BusinessLine, Status, StatusFlow } from "@/types";

import { SectionHeader } from "../section-header";
import { ArchiveStatusDialog } from "./archive-status-dialog";
import { StatusDialog } from "./status-dialog";
import { StatusRow } from "./status-row";

/**
 * V22 · Configuración de estados. El alcance (flujo + organización o línea)
 * vive en la dirección: cambiarlo navega y el servidor entrega el juego
 * exacto de ese alcance, incluido lo archivado.
 *
 * Agregar y editar van en un diálogo; archivar, restaurar los valores por
 * defecto, crear un juego y volver al de la organización piden confirmación
 * en otro (spec `configurable-statuses`). La lista sigue ordenable por
 * arrastre, y cada fila lleva sus acciones en su «⋯».
 */
export function StatusesSection({
  lines,
  flow,
  businessLineId,
  statuses,
}: {
  lines: BusinessLine[];
  flow: StatusFlow;
  businessLineId: string | null;
  statuses: Status[];
}) {
  const router = useRouter();
  // Solo el reordenamiento informa aquí: lo demás se equivoca dentro de su
  // diálogo.
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const edit = useEntityDialog<Status>();
  const [archiving, setArchiving] = useState<Status | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const { ask, dialog } = useConfirmDialog();

  const active = statuses.filter((status) => status.archivedAt === null);
  const archived = statuses.filter((status) => status.archivedAt !== null);

  // Orden optimista del arrastre: rige mientras contenga exactamente los
  // mismos estados que entrega el servidor; si el juego cambió (alta,
  // archivado, otro alcance), vuelve a mandar el orden del servidor.
  const serverIds = active.map((status) => status.id);
  const [optimisticIds, setOptimisticIds] = useState<string[] | null>(null);
  const orderedIds =
    optimisticIds !== null &&
    optimisticIds.length === serverIds.length &&
    serverIds.every((statusId) => optimisticIds.includes(statusId))
      ? optimisticIds
      : serverIds;

  const orderedActive = orderedIds
    .map((statusId) => active.find((status) => status.id === statusId))
    .filter((status): status is Status => status !== undefined);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function navigate(nextFlow: StatusFlow, nextLine: string | null) {
    router.push(
      `/settings/statuses?flow=${nextFlow}&line=${nextLine ?? "org"}`,
    );
  }

  function onDragEnd(event: DragEndEvent) {
    const { active: dragged, over } = event;
    if (!over || dragged.id === over.id) return;

    const from = orderedIds.indexOf(String(dragged.id));
    const to = orderedIds.indexOf(String(over.id));
    const next = arrayMove(orderedIds, from, to);
    setOptimisticIds(next);
    setError(null);
    startTransition(async () => {
      const result = await reorderStatuses({ orderedIds: next });
      if (result?.error) setError(result.error);
    });
  }

  const scopeLine = lines.find((line) => line.id === businessLineId);
  const hasOwnSet = active.length > 0;

  const archive = (status: Status) => {
    setArchiving(status);
    setArchiveOpen(true);
  };

  const restoreDefaults = () =>
    ask({
      title: "¿Restaurar los estados por defecto?",
      description:
        "Los estados vuelven a los de fábrica —nombre, tipo, color y orden— y los que no son de fábrica se archivan. Si alguno de esos está en uso, no se restaura nada.",
      confirmLabel: "Restaurar",
      destructive: true,
      action: () => restoreDefaultStatuses({ businessLineId, flow }),
    });

  const createDefaultSet = () =>
    ask({
      title: "¿Crear el juego por defecto?",
      description:
        "La organización recibe los estados de fábrica para este flujo. Después puedes cambiarlos.",
      confirmLabel: "Crear el juego",
      action: () => restoreDefaultStatuses({ businessLineId: null, flow }),
    });

  const createOwnSet = (line: BusinessLine) =>
    ask({
      title: `¿Crear un juego propio para ${line.name}?`,
      description:
        "Se copia el juego de la organización para esta línea, y desde ahí puedes cambiarlo sin afectar a las demás.",
      confirmLabel: "Crear juego propio",
      action: () => createOwnStatusSet({ businessLineId: line.id, flow }),
    });

  const switchToOrganizationSet = (line: BusinessLine) =>
    ask({
      title: `¿Usar el juego de la organización en ${line.name}?`,
      description:
        "El juego propio de esta línea se archiva y vuelve a regir el de la organización. Los pedidos y tareas anteriores conservan su historia.",
      confirmLabel: "Usar el juego de la organización",
      destructive: true,
      action: () => applyOrganizationStatuses({ businessLineId: line.id, flow }),
    });

  return (
    <section>
      <SectionHeader
        title="Estados"
        description="Cada línea puede tener su propio flujo de trabajo; el tipo declarado es lo que las alertas y los reportes entienden."
        action={hasOwnSet && <Button onClick={edit.openNew}>Agregar estado</Button>}
      />

      {/* Selector de flujo y de alcance */}
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Flujo" className="flex rounded-lg border p-0.5">
          {(["order", "task"] as const).map((candidate) => (
            <button
              key={candidate}
              role="tab"
              aria-selected={flow === candidate}
              onClick={() => navigate(candidate, businessLineId)}
              className={
                flow === candidate
                  ? "rounded-md bg-foreground px-3 py-1 text-sm text-background"
                  : "rounded-md px-3 py-1 text-sm text-muted-foreground"
              }
            >
              {candidate === "order" ? "Pedidos" : "Tareas"}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="status-scope" className="sr-only">
            Alcance
          </Label>
          <select
            id="status-scope"
            data-testid="status-scope"
            value={businessLineId ?? "org"}
            onChange={(event) =>
              navigate(
                flow,
                event.target.value === "org" ? null : event.target.value,
              )
            }
            className="h-8 rounded-lg border bg-background px-2 text-sm"
          >
            <option value="org">Toda la organización</option>
            {lines.map((line) => (
              <option key={line.id} value={line.id}>
                {line.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="mt-4 rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        Los cambios no afectan la historia de pedidos y tareas anteriores.
      </p>

      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Línea sin juego propio: rige el de la organización */}
      {!hasOwnSet && scopeLine && (
        <div className="mt-4 rounded-lg border border-dashed px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            {scopeLine.name} usa el juego de estados de la organización.
          </p>
          <Button className="mt-3" onClick={() => createOwnSet(scopeLine)}>
            Crear juego propio para esta línea
          </Button>
        </div>
      )}

      {/* Organización sin juego para este flujo */}
      {!hasOwnSet && !scopeLine && (
        <div className="mt-4 rounded-lg border border-dashed px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            La organización todavía no tiene juego de estados para este flujo.
          </p>
          <Button className="mt-3" onClick={createDefaultSet}>
            Crear el juego por defecto
          </Button>
        </div>
      )}

      {hasOwnSet && (
        <>
          <DndContext
            // Sin un id estable, dnd-kit numera sus descripciones con un
            // contador interno que servidor y cliente no comparten: la
            // hidratación se queja del aria-describedby.
            id="statuses-dnd"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={orderedIds}
              strategy={verticalListSortingStrategy}
            >
              <ul
                data-testid="status-list"
                className="mt-4 divide-y overflow-hidden rounded-lg border"
              >
                {orderedActive.map((status) => (
                  <StatusRow
                    key={status.id}
                    status={status}
                    onEdit={edit.openEdit}
                    onArchive={archive}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={restoreDefaults}>
              Restaurar valores por defecto
            </Button>
            {scopeLine && (
              <Button size="sm" variant="outline" onClick={() => switchToOrganizationSet(scopeLine)}>
                Usar el juego de la organización
              </Button>
            )}
          </div>
        </>
      )}

      {/* Lo archivado sigue visible: los registros históricos lo referencian */}
      {archived.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Archivados
          </h3>
          <ul className="divide-y rounded-lg border border-dashed">
            {archived.map((status) => (
              <li
                key={status.id}
                className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground"
              >
                <span className="flex-1">{status.name}</span>
                <span>{STATUS_KIND_LABELS[status.kind]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <StatusDialog
        dialog={edit}
        active={orderedActive}
        businessLineId={businessLineId}
        flow={flow}
      />
      <ArchiveStatusDialog
        key={archiving?.id}
        status={archiving}
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        active={orderedActive}
      />
      {dialog}
    </section>
  );
}
