"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { RelatedTask } from "@/services/tasks/task-service";

export type ArchiveWarningProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Las tareas que referencian el registro. Vacío = no hay nada que avisar. */
  relatedTasks: RelatedTask[];
  /** Qué se está archivando, para nombrarlo en el aviso. */
  label: string;
  onConfirm: () => void;
};

/**
 * El aviso previo a archivar un registro que alguna tarea referencia (D5).
 *
 * **Avisa, no impide.** El criterio 7 del backlog pide enumerar las tareas
 * antes de confirmar, no bloquear el archivado; y ninguna queda rota porque en
 * Kamay nada se borra: el vínculo sobrevive y sigue resolviendo al mismo
 * registro, ahora señalado como archivado.
 *
 * Un trigger que rechazara el archivado dejaría sin salida a quien tiene
 * encima una tarea cerrada hace meses, y obligaría a inventar un «archivar de
 * todos modos» que atravesara la base.
 *
 * Un solo diálogo para los cuatro flujos —pedido, ítem, contacto y egreso—.
 * Quién puede archivar lo sigue decidiendo `enforce_archive_rules()`; esto
 * solo informa antes.
 */
export function ArchiveWarning({
  open,
  onOpenChange,
  relatedTasks,
  label,
  onConfirm,
}: ArchiveWarningProps) {
  const count = relatedTasks.length;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="archive-warning">
        <AlertDialogHeader>
          <AlertDialogTitle>Archivar {label}</AlertDialogTitle>
          <AlertDialogDescription>
            {count === 0 ? (
              <>Dejará de aparecer en listados y buscadores. Nada se borra.</>
            ) : (
              <>
                {count === 1
                  ? "Una tarea apunta a este registro"
                  : `${count} tareas apuntan a este registro`}
                . Seguirán apuntando y ninguna quedará rota; el registro
                aparecerá en ellas como archivado.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {count > 0 && (
          <ul
            className="text-muted-foreground flex flex-col gap-1 text-sm"
            data-testid="archive-warning-tasks"
          >
            {relatedTasks.map((task) => (
              <li key={task.id}>· {task.title}</li>
            ))}
          </ul>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Archivar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
