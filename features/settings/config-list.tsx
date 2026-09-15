"use client";

import { ArchiveIcon, ArchiveRestoreIcon, PencilIcon } from "lucide-react";

import {
  archiveConfigurationItem,
  unarchiveConfigurationItem,
} from "@/actions/configuration";
import { useConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";

export type ConfigEntity = "line" | "channel" | "category" | "unit";

type EntityCopy = {
  /** El vacío de la sección, dicho por su nombre, y qué hacer con él. */
  empty: string;
  emptyHint: string;
  /** El botón de alta de la sección, que también abre el diálogo. */
  createButton: string;
  /** El envío del diálogo de alta. */
  createSubmit: string;
  newTitle: string;
  editTitle: string;
  /** Qué pasa al archivar: se deja de ofrecer, la historia no cambia. */
  archiveEffect: string;
};

/**
 * Los rótulos de cada catálogo en un solo sitio: el botón de la sección, el
 * diálogo y las confirmaciones hablan de lo mismo con las mismas palabras
 * (spec `settings-interaction`, tabla de *Creating a configuration entry
 * happens in a dialog*).
 */
export const ENTITY_COPY: Record<ConfigEntity, EntityCopy> = {
  line: {
    empty: "Aún no hay líneas de negocio",
    emptyHint: "Usa «Crear línea» para agregar la primera.",
    createButton: "Crear línea",
    createSubmit: "Crear línea",
    newTitle: "Nueva línea",
    editTitle: "Editar línea",
    archiveEffect:
      "Deja de ofrecerse en el selector de línea y en los formularios nuevos. Los registros que ya la usan la siguen mostrando con su nombre y su color.",
  },
  channel: {
    empty: "Aún no hay canales de venta",
    emptyHint: "Usa «Nuevo canal» para agregar el primero.",
    createButton: "Nuevo canal",
    createSubmit: "Crear canal",
    newTitle: "Nuevo canal",
    editTitle: "Editar canal",
    archiveEffect:
      "Deja de ofrecerse al registrar ventas y pedidos. Los que ya lo usan lo siguen mostrando.",
  },
  category: {
    empty: "Aún no hay categorías de gasto",
    emptyHint: "Usa «Nueva categoría» para agregar la primera.",
    createButton: "Nueva categoría",
    createSubmit: "Crear categoría",
    newTitle: "Nueva categoría",
    editTitle: "Editar categoría",
    archiveEffect:
      "Deja de ofrecerse al registrar egresos. Los egresos que ya la usan la siguen mostrando.",
  },
  unit: {
    empty: "Aún no hay unidades de medida",
    emptyHint: "Usa «Nueva unidad» para agregar la primera.",
    createButton: "Nueva unidad",
    createSubmit: "Crear unidad",
    newTitle: "Nueva unidad",
    editTitle: "Editar unidad",
    archiveEffect:
      "Deja de ofrecerse en el catálogo y en los insumos nuevos. Lo que ya la usa la sigue mostrando.",
  },
};

type ConfigRow = { id: string; archivedAt: string | null };

/**
 * Las tablas de una sección de catálogo (design D5): los activos con «Editar»
 * y «Archivar» en su «⋯», y debajo —solo si hay— los archivados con
 * «Restaurar». Lo archivado sigue visible aquí, y solo aquí, para poder
 * devolverlo; en los formularios de creación ya no aparece.
 *
 * Archivar y restaurar piden confirmación (spec `settings-interaction` →
 * *Every action that is not a form asks for confirmation*); si la base lo
 * rechaza, el motivo se lee en el mismo diálogo.
 */
export function ConfigTables<T extends ConfigRow>({
  entity,
  items,
  columns,
  caption,
  labelOf,
  isProtected,
  onEdit,
}: {
  entity: ConfigEntity;
  items: T[];
  columns: DataTableColumn<T>[];
  /** Nombre accesible de la tabla de activos: «Líneas de negocio». */
  caption: string;
  /** Cómo se nombra una fila en su menú y en las confirmaciones. */
  labelOf: (item: T) => string;
  /** Las filas protegidas no ofrecen archivar (la línea compartida). */
  isProtected?: (item: T) => boolean;
  onEdit: (item: T) => void;
}) {
  const { ask, dialog } = useConfirmDialog();
  const copy = ENTITY_COPY[entity];

  const active = items.filter((item) => !item.archivedAt);
  const archived = items.filter((item) => item.archivedAt);

  const archive = (item: T) =>
    ask({
      title: `¿Archivar «${labelOf(item)}»?`,
      description: copy.archiveEffect,
      confirmLabel: "Archivar",
      destructive: true,
      action: () => archiveConfigurationItem({ entity, id: item.id }),
    });

  const restore = (item: T) =>
    ask({
      title: `¿Restaurar «${labelOf(item)}»?`,
      description: "Vuelve a ofrecerse en los formularios nuevos.",
      confirmLabel: "Restaurar",
      action: () => unarchiveConfigurationItem({ entity, id: item.id }),
    });

  return (
    <div className="flex flex-col gap-6">
      <DataTable
        rows={active}
        columns={columns}
        getRowKey={(item) => item.id}
        caption={caption}
        testId={`${entity}-list`}
        rowTestId={`${entity}-row`}
        rowActionsLabel={(item) => `Acciones de ${labelOf(item)}`}
        rowActions={(item) => [
          { label: "Editar", icon: PencilIcon, onSelect: () => onEdit(item) },
          ...(isProtected?.(item)
            ? []
            : [
                {
                  label: "Archivar",
                  icon: ArchiveIcon,
                  destructive: true,
                  onSelect: () => archive(item),
                },
              ]),
        ]}
        empty={<EmptyState title={copy.empty} description={copy.emptyHint} />}
      />

      {archived.length > 0 && (
        <section aria-labelledby={`${entity}-archived-title`}>
          <h3
            id={`${entity}-archived-title`}
            className="mb-2 text-sm font-medium text-muted-foreground"
          >
            Archivados
          </h3>
          <DataTable
            rows={archived}
            columns={columns}
            getRowKey={(item) => item.id}
            caption="Archivados"
            testId={`${entity}-archived-list`}
            rowTestId={`${entity}-archived-row`}
            rowActionsLabel={(item) => `Acciones de ${labelOf(item)}`}
            rowActions={(item) => [
              { label: "Restaurar", icon: ArchiveRestoreIcon, onSelect: () => restore(item) },
            ]}
          />
        </section>
      )}

      {dialog}
    </div>
  );
}
