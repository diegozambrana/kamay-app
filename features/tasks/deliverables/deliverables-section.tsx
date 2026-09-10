"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { declareDeliverable, withdrawDeliverable } from "@/actions/tasks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DELIVERABLE_DEFINITIONS,
  declarableTypes,
  isFulfilled,
  type Deliverable,
  type DeliverableType,
} from "@/lib/tasks/deliverables";

export type DeliverablesSectionProps = {
  taskId: string;
  deliverables: Deliverable[];
  isOwner: boolean;
  readOnly: boolean;
};

/**
 * La sección *Entregables esperados* del detalle de tarea.
 *
 * Declarar qué debe existir al terminar es opcional y siempre lo será: el
 * asistente de cierre es una oferta, no un peaje. Una tarea sin entregables se
 * cierra sin ver ningún diálogo.
 *
 * Los tipos que se ofrecen salen del dominio (`declarableTypes`), no de una
 * lista escrita aquí: el activo es el único reservado a la persona dueña
 * —`asset_details` va bajo `is_owner()`— y esa regla vive en un solo sitio.
 */
export function DeliverablesSection({
  taskId,
  deliverables,
  isOwner,
  readOnly,
}: DeliverablesSectionProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState<DeliverableType | "">("");
  const [pending, startTransition] = useTransition();

  const declared = new Set(deliverables.map((d) => d.deliverableType));
  const available = declarableTypes(isOwner).filter(
    (definition) => !declared.has(definition.type),
  );

  function declare() {
    if (choice === "") return;
    setError(null);
    startTransition(async () => {
      const result = await declareDeliverable({ taskId, type: choice });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setChoice("");
      router.refresh();
    });
  }

  function withdraw(type: DeliverableType) {
    setError(null);
    startTransition(async () => {
      const result = await withdrawDeliverable({ taskId, type });
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3" data-testid="deliverables-section">
      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      {deliverables.length === 0 ? (
        <p
          className="text-muted-foreground text-sm"
          data-testid="empty-deliverables"
        >
          Esta tarea no espera crear nada al cerrarse.
        </p>
      ) : (
        <ul className="flex flex-col gap-1" data-testid="declared-deliverables">
          {deliverables.map((deliverable) => {
            const done = isFulfilled(deliverable);
            return (
              <li
                key={deliverable.id}
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <span className="flex-1">
                  {DELIVERABLE_DEFINITIONS[deliverable.deliverableType].label}
                </span>

                {done && <Badge variant="secondary">Creado</Badge>}

                {/* Un entregable cumplido no se retira: lo creado no se
                    deshace desde aquí. */}
                {!readOnly && !done && (
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    aria-label={`Retirar ${DELIVERABLE_DEFINITIONS[deliverable.deliverableType].label}`}
                    onClick={() => withdraw(deliverable.deliverableType)}
                  >
                    <XIcon className="size-4" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!readOnly && available.length > 0 && (
        <div className="flex gap-2">
          <Select
            value={choice}
            onValueChange={(value) => setChoice(value as DeliverableType)}
            disabled={pending}
          >
            <SelectTrigger className="flex-1" aria-label="Entregable esperado">
              <SelectValue placeholder="Declarar un entregable" />
            </SelectTrigger>
            <SelectContent>
              {available.map((definition) => (
                <SelectItem key={definition.type} value={definition.type}>
                  {definition.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={declare} disabled={pending || choice === ""}>
            <PlusIcon className="size-4" />
            Declarar
          </Button>
        </div>
      )}
    </div>
  );
}
