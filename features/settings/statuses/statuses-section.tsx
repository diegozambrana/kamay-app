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
  createStatus,
  reorderStatuses,
  restoreDefaultStatuses,
} from "@/actions/statuses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LINE_COLOR_LABELS } from "@/lib/business-lines/colors";
import { STATUS_KIND_LABELS } from "@/lib/statuses/kinds";
import { setIsComplete, statusFormSchema } from "@/lib/statuses/schema";
import {
  LINE_COLORS,
  STATUS_KINDS,
  type BusinessLine,
  type LineColor,
  type Status,
  type StatusFlow,
  type StatusKind,
} from "@/types";

import { StatusRow } from "./status-row";

/** Confirmaciones de las acciones de todo el juego, desplegadas en el sitio. */
type Confirming = "none" | "restore" | "use-org";

/**
 * V22 · Configuración de estados. El alcance (flujo + organización o línea)
 * vive en la dirección: cambiarlo navega y el servidor entrega el juego
 * exacto de ese alcance, incluido lo archivado.
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
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Confirming>("none");
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

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

  function run(action: () => Promise<{ error: string } | undefined>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) setError(result.error);
      else setConfirming("none");
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const { active: dragged, over } = event;
    if (!over || dragged.id === over.id) return;

    const from = orderedIds.indexOf(String(dragged.id));
    const to = orderedIds.indexOf(String(over.id));
    const next = arrayMove(orderedIds, from, to);
    setOptimisticIds(next);
    run(() => reorderStatuses({ orderedIds: next }));
  }

  function submitAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const values = {
      name: String(data.get("name") ?? ""),
      color: String(data.get("color") ?? "zinc") as LineColor,
      kind: String(data.get("kind") ?? "in_progress") as StatusKind,
      isQueue: data.get("isQueue") === "on",
    };

    const parsed = statusFormSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    if (!setIsComplete([...orderedActive.map((s) => s.kind), parsed.data.kind])) {
      setError("Todo juego necesita al menos un estado inicial y uno final.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await createStatus({
        businessLineId,
        flow,
        ...parsed.data,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setAdding(false);
      form.reset();
    });
  }

  const scopeLine = lines.find((line) => line.id === businessLineId);
  const hasOwnSet = active.length > 0;

  return (
    <section>
      <h2 className="text-lg font-medium">Estados</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Cada línea puede tener su propio flujo de trabajo; el tipo declarado es
        lo que las alertas y los reportes entienden.
      </p>

      {/* Selector de flujo y de alcance */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
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
          <Button
            className="mt-3"
            disabled={pending}
            onClick={() =>
              run(() =>
                createOwnStatusSet({ businessLineId: scopeLine.id, flow }),
              )
            }
          >
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
          <Button
            className="mt-3"
            disabled={pending}
            onClick={() =>
              run(() => restoreDefaultStatuses({ businessLineId: null, flow }))
            }
          >
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
                    siblings={orderedActive.filter(
                      (sibling) => sibling.id !== status.id,
                    )}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>

          {/* Agregar */}
          {adding ? (
            <form
              onSubmit={submitAdd}
              className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border px-3 py-3"
            >
              <div className="space-y-1.5">
                <Label htmlFor="new-status-name">Nombre</Label>
                <Input id="new-status-name" name="name" required />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-status-kind">Tipo</Label>
                <select
                  id="new-status-kind"
                  name="kind"
                  defaultValue="in_progress"
                  className="h-8 rounded-lg border bg-background px-2 text-sm"
                >
                  {STATUS_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {STATUS_KIND_LABELS[kind]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-status-color">Color</Label>
                <select
                  id="new-status-color"
                  name="color"
                  defaultValue="zinc"
                  className="h-8 rounded-lg border bg-background px-2 text-sm"
                >
                  {LINE_COLORS.map((color) => (
                    <option key={color} value={color}>
                      {LINE_COLOR_LABELS[color]}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex h-8 items-center gap-2 text-sm">
                <input type="checkbox" name="isQueue" />
                Columna en cola
              </label>

              <Button type="submit" size="sm" disabled={pending}>
                Agregar estado
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setAdding(false)}
              >
                Cancelar
              </Button>
            </form>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setAdding(true)}>
                Agregar estado
              </Button>

              {confirming === "restore" ? (
                <span className="flex items-center gap-2 text-sm">
                  ¿Restaurar el juego por defecto?
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        restoreDefaultStatuses({ businessLineId, flow }),
                      )
                    }
                  >
                    Restaurar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirming("none")}
                  >
                    Cancelar
                  </Button>
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirming("restore")}
                >
                  Restaurar valores por defecto
                </Button>
              )}

              {scopeLine &&
                (confirming === "use-org" ? (
                  <span className="flex items-center gap-2 text-sm">
                    El juego propio se archiva y vuelve a regir el de la
                    organización.
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={pending}
                      onClick={() =>
                        run(() =>
                          applyOrganizationStatuses({
                            businessLineId: scopeLine.id,
                            flow,
                          }),
                        )
                      }
                    >
                      Confirmar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirming("none")}
                    >
                      Cancelar
                    </Button>
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirming("use-org")}
                  >
                    Usar el juego de la organización
                  </Button>
                ))}
            </div>
          )}
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
    </section>
  );
}
