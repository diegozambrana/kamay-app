"use client";

import { CalendarDaysIcon, LayoutGridIcon, ListIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { MainContainer } from "@/components/layout/main-container";
import { EmptyState } from "@/components/shared/empty-state";
import { FilteredEmptyState } from "@/components/shared/filtered-empty-state";
import { LoadMore } from "@/components/shared/load-more";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useFilterState, useSearchReset } from "@/hooks/use-filter-state";
import type { Status, Tag } from "@/types";

import { BoardView, type BoardTask } from "./board-view";
import { CalendarView } from "./calendar-view";
import { ListView } from "./list-view";
import { QuickAdd } from "./quick-add";

type View = "board" | "list" | "calendar";

export type Assignee = { userId: string; displayName: string | null };

/**
 * Los parámetros que estrechan la lista. `view` cambia la forma y `archived`
 * ensancha; ninguno es un filtro (design D2).
 */
const TASK_FILTERS = ["q", "assignee", "tag", "status", "link", "nodeliv"] as const;

/**
 * V17 · Pantalla de tareas. Los filtros y la vista viven en la dirección, de
 * modo que cambiar de vista los conserva sin ningún estado compartido y el
 * tablero es enlazable.
 */
export function TasksScreen({
  tasks,
  statuses,
  allStatuses,
  assignees,
  tags,
  activeLineId,
  quickAddLineId,
  view,
  search,
  assigneeId,
  tagId,
  statusId,
  linkFilter,
  withoutDeliverables,
  includeArchived,
  today,
  closedLimit = 50,
  hasMoreClosed = false,
}: {
  tasks: BoardTask[];
  /** El juego resuelto de la línea activa: las columnas del tablero. */
  statuses: Status[];
  /** Todos los estados del flujo: la lista los necesita para nombrarlos. */
  allStatuses: Status[];
  assignees: Assignee[];
  tags: Tag[];
  activeLineId: string | null;
  quickAddLineId: string | null;
  view: View;
  search: string;
  assigneeId: string;
  tagId: string;
  statusId: string;
  /** "" | "any" | "none": tareas con algún vínculo, sin ninguno, o todas. */
  linkFilter: string;
  /** Solo las que se cerraron sin crear nada de lo declarado. */
  withoutDeliverables: boolean;
  includeArchived: boolean;
  today: string;
  /** Cuántas tareas cerradas trae la ventana (KAM-23). */
  closedLimit?: number;
  /** Si hay tareas cerradas más antiguas que las que se muestran. */
  hasMoreClosed?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const { hasActiveFilters, clearFilters } = useFilterState(TASK_FILTERS);
  const { searchKey, armSearchReset } = useSearchReset(search);

  // Con el filtro en «Todas» conviven tareas de varias líneas, y el color es lo
  // único que las distingue de un vistazo.
  const showLine = activeLineId === null;

  const statusNames = new Map(allStatuses.map((status) => [status.id, status.name]));

  // La consulta actual es la vista de origen: el detalle y la edición la
  // conservan para poder volver aquí con estos mismos filtros (design D5).
  const from = params.toString();

  function updateParams(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    router.push(`/tasks?${next.toString()}`);
  }

  return (
    <MainContainer
      title="Tareas"
      description="Tu propio trabajo pendiente."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(value) => value && updateParams({ view: value })}
            variant="outline"
            aria-label="Vista"
          >
            <ToggleGroupItem value="board" aria-label="Tablero">
              <LayoutGridIcon className="size-4" aria-hidden /> Tablero
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="Lista">
              <ListIcon className="size-4" aria-hidden /> Lista
            </ToggleGroupItem>
            <ToggleGroupItem value="calendar" aria-label="Calendario">
              <CalendarDaysIcon className="size-4" aria-hidden /> Calendario
            </ToggleGroupItem>
          </ToggleGroup>

          <Button asChild data-testid="new-task">
            <Link href="/tasks/new">
              <PlusIcon className="size-4" aria-hidden /> Nueva tarea
            </Link>
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field className="w-56">
            <FieldLabel htmlFor="task-search">Buscar</FieldLabel>
            <Input
              key={searchKey}
              id="task-search"
              defaultValue={search}
              placeholder="Título de la tarea"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  updateParams({ q: event.currentTarget.value });
                }
              }}
            />
          </Field>

          <Field className="w-44">
            <FieldLabel htmlFor="task-assignee">Responsable</FieldLabel>
            <select
              id="task-assignee"
              value={assigneeId}
              onChange={(event) => updateParams({ assignee: event.target.value })}
              className="h-9 rounded-lg border bg-background px-2 text-sm"
            >
              <option value="">Cualquiera</option>
              {assignees.map((person) => (
                <option key={person.userId} value={person.userId}>
                  {person.displayName ?? "Sin nombre"}
                </option>
              ))}
            </select>
          </Field>

          <Field className="w-44">
            <FieldLabel htmlFor="task-tag">Etiqueta</FieldLabel>
            <select
              id="task-tag"
              value={tagId}
              onChange={(event) => updateParams({ tag: event.target.value })}
              className="h-9 rounded-lg border bg-background px-2 text-sm"
            >
              <option value="">Todas</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </Field>

          <Field className="w-44">
            <FieldLabel htmlFor="task-status">Estado</FieldLabel>
            <select
              id="task-status"
              value={statusId}
              onChange={(event) => updateParams({ status: event.target.value })}
              className="h-9 rounded-lg border bg-background px-2 text-sm"
            >
              <option value="">Todos</option>
              {allStatuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.name}
                </option>
              ))}
            </select>
          </Field>

          <Field className="w-44">
            <FieldLabel htmlFor="task-link">Vínculo</FieldLabel>
            <select
              id="task-link"
              value={linkFilter}
              onChange={(event) => updateParams({ link: event.target.value || null })}
              className="h-9 rounded-lg border bg-background px-2 text-sm"
            >
              <option value="">Todas</option>
              <option value="any">Con algún vínculo</option>
              <option value="none">Sin vínculos</option>
            </select>
          </Field>

          {/* La marca de *cerrada sin entregables* es discreta en la tarjeta;
              lo que la hace localizable es este filtro (KAM-21). */}
          <label className="flex items-center gap-2 pb-2 text-sm">
            <Checkbox
              checked={withoutDeliverables}
              onCheckedChange={(checked) =>
                updateParams({ nodeliv: checked ? "1" : null })
              }
              aria-label="Cerradas sin entregables"
            />
            Cerradas sin entregables
          </label>

          <label className="flex items-center gap-2 pb-2 text-sm">
            <Checkbox
              checked={includeArchived}
              onCheckedChange={(checked) =>
                updateParams({ archived: checked ? "1" : null })
              }
              aria-label="Ver archivadas"
            />
            Ver archivadas
          </label>
        </div>

        {error && (
          <Alert variant="destructive" data-testid="task-error">
            <AlertTitle>No se pudo completar la acción</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Con «Todas» activa no hay un juego único de columnas: Sublimación
            puede tener cuatro estados y Alfarería dos, sin correspondencia. El
            tablero pide elegir una línea; lista y calendario sí cruzan todas,
            que es el mismo criterio que ya usa el tablero de pedidos. */}
        {tasks.length === 0 &&
          (hasActiveFilters ? (
            <FilteredEmptyState
              description="Ninguna tarea coincide con los filtros elegidos."
              onClearFilters={() => {
                armSearchReset();
                clearFilters();
              }}
            />
          ) : (
            // La acción del vacío es el alta rápida misma: crear la primera
            // tarea sigue costando tres interacciones, no un viaje al
            // formulario. Sin línea que resolver, `QuickAdd` ya degrada a él.
            <EmptyState
              title="Aún no hay tareas"
              description="Lo que tengas pendiente en el taller aparecerá aquí."
              action={<QuickAdd businessLineId={quickAddLineId} onError={setError} />}
            />
          ))}

        {tasks.length > 0 && view === "board" && statuses.length === 0 && (
          <Alert data-testid="pick-a-line">
            <AlertTitle>Elige una línea para ver el tablero</AlertTitle>
            <AlertDescription>
              Cada línea tiene su propio flujo de estados, así que el tablero
              necesita una. La lista y el calendario sí muestran todas juntas.
            </AlertDescription>
          </Alert>
        )}

        {tasks.length > 0 && view === "board" && statuses.length > 0 && (
          <BoardView
            tasks={tasks}
            statuses={statuses}
            today={today}
            showLine={showLine}
            quickAddLineId={quickAddLineId}
            onError={setError}
            from={from}
          />
        )}

        {tasks.length > 0 && view === "list" && (
          <ListView
            tasks={tasks}
            statusNames={statusNames}
            today={today}
            showLine={showLine}
            from={from}
          />
        )}

        {tasks.length > 0 && view === "calendar" && (
          <CalendarView tasks={tasks} today={today} showLine={showLine} />
        )}

        {hasMoreClosed && (
          <LoadMore
            param="closed"
            limit={closedLimit}
            shownLabel={`todas las tareas abiertas y las ${closedLimit} cerradas más recientes`}
          />
        )}
      </div>
    </MainContainer>
  );
}
