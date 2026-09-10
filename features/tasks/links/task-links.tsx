"use client";

import { XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { unlinkTask } from "@/actions/tasks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ResolvedTaskLink } from "@/services/tasks/task-service";
import type { TaskLinkType } from "@/types";

import { LinkSearch, TYPE_LABELS } from "./link-search";

/** A dónde lleva cada tipo de vínculo. El egreso y el activo tienen su ruta. */
function hrefFor(link: ResolvedTaskLink): string {
  switch (link.entityType) {
    case "order":
      return `/orders/${link.entityId}`;
    case "item":
      return `/catalog/${link.entityId}`;
    case "asset":
      return `/assets?id=${link.entityId}`;
    case "expense":
      return `/expenses/${link.entityId}`;
    case "contact":
      return `/contacts?id=${link.entityId}`;
  }
}

export type TaskLinksProps = {
  taskId: string;
  links: ResolvedTaskLink[];
  /** Una tarea archivada se mira, no se edita. */
  readOnly: boolean;
};

/**
 * La sección *Vínculos* del detalle de tarea, la ranura que KAM-16 dejó sin
 * pintar a propósito (design D8).
 *
 * Cada vínculo muestra el estado **actual** del registro apuntado, resuelto al
 * leer: `task_links` guarda tipo e identificador y nada más. Renombrar el ítem
 * o mover el pedido de columna cambia lo que se ve aquí sin tocar el vínculo.
 *
 * Un destino archivado sigue mostrándose, señalado: nada se borra en Kamay, y
 * esconder el vínculo dejaría a la tarea explicando menos de lo que explicaba.
 */
export function TaskLinks({ taskId, links, readOnly }: TaskLinksProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(entityType: TaskLinkType, entityId: string) {
    setError(null);
    startTransition(async () => {
      const result = await unlinkTask({ taskId, entityType, entityId });
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3" data-testid="task-links">
      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      {links.length === 0 ? (
        <p className="text-muted-foreground text-sm" data-testid="empty-links">
          Esta tarea no apunta a ningún registro.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {links.map((link) => (
            <li
              key={`${link.entityType}:${link.entityId}`}
              className="flex items-center gap-2 rounded-md border px-3 py-2"
            >
              <Link
                href={hrefFor(link)}
                className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm hover:underline"
              >
                <span className="truncate font-medium">{link.label}</span>
                <span className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
                  <span>{TYPE_LABELS[link.entityType]}</span>
                  {link.statusName !== null && <span>{link.statusName}</span>}
                </span>
              </Link>

              {link.archived && (
                <Badge variant="outline" data-testid="link-archived">
                  Archivado
                </Badge>
              )}

              {!readOnly && (
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={pending}
                  aria-label={`Quitar el vínculo con ${link.label}`}
                  onClick={() => remove(link.entityType, link.entityId)}
                >
                  <XIcon className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <LinkSearch
          taskId={taskId}
          existing={links}
          onLinked={() => router.refresh()}
        />
      )}
    </div>
  );
}
