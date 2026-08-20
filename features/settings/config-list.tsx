"use client";

import { useState, useTransition } from "react";

import {
  archiveConfigurationItem,
  unarchiveConfigurationItem,
  type ActionResult,
} from "@/actions/configuration";
import { Button } from "@/components/ui/button";

export type ConfigEntity = "line" | "channel" | "category" | "unit";

export type ConfigItem = {
  id: string;
  /** Texto visible de la fila. */
  label: string;
  archivedAt: string | null;
  /** Adorno a la izquierda (el punto de color de una línea, por ejemplo). */
  leading?: React.ReactNode;
  /** Las filas protegidas no ofrecen archivar (la línea compartida). */
  protected?: boolean;
};

/**
 * Lista de una sección de configuración. Lo archivado sigue visible aquí —y
 * solo aquí— para poder devolverlo; en los formularios de creación ya no
 * aparece.
 */
export function ConfigList({
  entity,
  items,
  onEdit,
}: {
  entity: ConfigEntity;
  items: ConfigItem[];
  onEdit: (item: ConfigItem) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const active = items.filter((item) => !item.archivedAt);
  const archived = items.filter((item) => item.archivedAt);

  function run(action: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <ul data-testid={`${entity}-list`} className="divide-y rounded-lg border">
        {active.map((item) => (
          <li key={item.id} className="flex items-center gap-2 px-3 py-2">
            {item.leading}
            <span className="flex-1 text-sm">{item.label}</span>
            <Button variant="ghost" size="sm" onClick={() => onEdit(item)}>
              Editar
            </Button>
            {!item.protected && (
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    archiveConfigurationItem({ entity, id: item.id }),
                  )
                }
              >
                Archivar
              </Button>
            )}
          </li>
        ))}

        {active.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">
            Todavía no hay nada aquí.
          </li>
        )}
      </ul>

      {archived.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Archivados
          </h3>
          <ul className="divide-y rounded-lg border border-dashed">
            {archived.map((item) => (
              <li key={item.id} className="flex items-center gap-2 px-3 py-2">
                {item.leading}
                <span className="flex-1 text-sm text-muted-foreground">
                  {item.label}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    run(() =>
                      unarchiveConfigurationItem({ entity, id: item.id }),
                    )
                  }
                >
                  Restaurar
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
