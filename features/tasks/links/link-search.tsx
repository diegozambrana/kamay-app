"use client";

import { SearchIcon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { linkTask, searchLinkTargets } from "@/actions/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LinkTarget, ResolvedTaskLink } from "@/services/tasks/task-service";
import type { TaskLinkType } from "@/types";

const TYPE_LABELS: Record<TaskLinkType, string> = {
  order: "Pedido",
  contact: "Contacto",
  item: "Ítem",
  expense: "Egreso",
  asset: "Activo",
};

/** Lo que tarda en dejar de teclear alguien que está pensando el término. */
const DEBOUNCE_MS = 250;

export type LinkSearchProps = {
  taskId: string;
  /** Lo ya vinculado, para no ofrecerlo de nuevo. */
  existing: ResolvedTaskLink[];
  onLinked: () => void;
};

/**
 * El buscador único de vínculos (design D2).
 *
 * Una sola caja para pedidos, contactos, ítems, egresos y activos: obligar a
 * elegir el tipo antes de escribir es pedirle a la persona que clasifique lo
 * que busca antes de encontrarlo.
 *
 * Lo que **no** hace aquí: filtrar por organización ni por rol. La consulta
 * corre en el servidor con el cliente de la persona, así que RLS ya decide, y
 * los activos ni siquiera se consultan para quien no es dueño (D9).
 *
 * Elegir un resultado escribe el vínculo de inmediato: no hay paso de guardado,
 * porque no hay nada más que decidir después de elegir.
 */
export function LinkSearch({ taskId, existing, onLinked }: LinkSearchProps) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<LinkTarget[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    // Con el campo vacío no se consulta nada. Lo que había se descarta al
    // rendir, no aquí: vaciar el estado desde el efecto es escribir lo que
    // se puede derivar.
    if (term.trim() === "") return;

    let current = true;
    const timer = setTimeout(() => {
      void searchLinkTargets(term).then((found) => {
        if (current) setResults(found);
      });
    }, DEBOUNCE_MS);

    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [term]);

  // Lo ya vinculado se descarta aquí y no en la consulta: son unas decenas de
  // filas, y cruzarlo en la base costaría una consulta por tipo para nada.
  const linked = new Set(
    existing.map((link) => `${link.entityType}:${link.entityId}`),
  );
  const offered =
    term.trim() === ""
      ? []
      : results.filter(
          (result) => !linked.has(`${result.entityType}:${result.entityId}`),
        );

  function choose(target: LinkTarget) {
    setError(null);
    startTransition(async () => {
      const result = await linkTask({
        taskId,
        entityType: target.entityType,
        entityId: target.entityId,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setTerm("");
      setResults([]);
      onLinked();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2" />
        <Input
          className="pl-8"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Buscar un pedido, contacto, ítem, egreso o activo"
          aria-label="Buscar para vincular"
          disabled={pending}
        />
      </div>

      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      {term.trim() !== "" && offered.length === 0 && (
        <p className="text-muted-foreground text-sm" data-testid="no-link-results">
          Nada coincide con «{term}».
        </p>
      )}

      {offered.length > 0 && (
        <ul className="flex flex-col gap-1" data-testid="link-results">
          {offered.map((target) => (
            <li key={`${target.entityType}:${target.entityId}`}>
              <Button
                variant="ghost"
                className="h-auto w-full justify-start px-2 py-1.5 text-left"
                disabled={pending}
                onClick={() => choose(target)}
              >
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm">{target.label}</span>
                  <span className="text-muted-foreground text-xs">
                    {TYPE_LABELS[target.entityType]}
                    {target.hint !== null && ` · ${target.hint}`}
                  </span>
                </span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export { TYPE_LABELS };
