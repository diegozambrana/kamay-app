"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArchiveIcon, GripVertical, PencilIcon } from "lucide-react";

import { RowActionsMenu } from "@/components/shared/row-actions-menu";
import { STATUS_KIND_LABELS } from "@/lib/statuses/kinds";
import type { Status } from "@/types";

import { ColorDot } from "../color-select";

/**
 * Una fila de V22: asa para reordenar y, al final, el «⋯» con «Editar» y
 * «Archivar» (spec `configurable-statuses` → *Las acciones de un estado están
 * en su menú*). La edición y el archivado ya no se despliegan en la fila: los
 * abre la sección en un diálogo.
 *
 * Los `listeners` del arrastre van solo en el asa, así que abrir el menú no
 * arrastra la fila.
 */
export function StatusRow({
  status,
  onEdit,
  onArchive,
}: {
  status: Status;
  onEdit: (status: Status) => void;
  onArchive: (status: Status) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: status.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-testid="status-row"
      className="flex items-center gap-2 bg-background px-3 py-2"
    >
      <button
        type="button"
        aria-label={`Reordenar ${status.name}`}
        className="cursor-grab text-muted-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      <ColorDot color={status.color} />

      <span className="flex-1 text-sm">{status.name}</span>

      <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
        {STATUS_KIND_LABELS[status.kind]}
      </span>

      {status.isQueue && (
        <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
          Columna en cola
        </span>
      )}

      <RowActionsMenu
        label={`Acciones de ${status.name}`}
        actions={[
          { label: "Editar", icon: PencilIcon, onSelect: () => onEdit(status) },
          {
            label: "Archivar",
            icon: ArchiveIcon,
            destructive: true,
            onSelect: () => onArchive(status),
          },
        ]}
      />
    </li>
  );
}
