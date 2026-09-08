"use client";

import { useMemo, useState, useTransition } from "react";

import { completeTask, postponeTask, uncompleteTask } from "@/actions/tasks";
import { Input } from "@/components/ui/input";
import { groupByDue } from "@/lib/tasks/groups";

import { PendingRow, type PendingTask } from "./pending-row";

/**
 * V20 · Mis pendientes.
 *
 * Contesta una sola pregunta —«¿qué hago hoy?»— y por eso agrupa por fecha y
 * no por estado: el kanban es la vista de gestión, y esta es la de ejecución.
 *
 * **Ignora el selector de línea deliberadamente.** Es una de las dos únicas
 * vistas que lo hacen (mapa §2, junto al comparativo de Reportes), porque aquí
 * el valor está en verlo todo junto; a cambio, cada fila dice de qué línea es.
 *
 * El alcance por rol no se decide aquí: la RLS ya recortó lo que llega.
 */
export function MyTasksScreen({
  tasks,
  today,
  tomorrow,
}: {
  tasks: PendingTask[];
  /** "Hoy" en la zona de la organización, resuelto en el servidor. */
  today: string;
  /** "Mañana" en esa misma zona: posponer no puede usar la del navegador. */
  tomorrow: string;
}) {
  const [done, setDone] = useState<Map<string, string>>(new Map());
  const [search, setSearch] = useState("");
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matching = term
      ? tasks.filter((task) => task.title.toLowerCase().includes(term))
      : tasks;

    // Lo marcado hecho en esta sesión se queda en su grupo, tachado: por eso
    // se anota aparte en vez de retirarlo de la lista.
    return matching.map((task) => ({ ...task, done: done.has(task.id) }));
  }, [tasks, search, done]);

  const groups = useMemo(
    () =>
      groupByDue(
        filtered.map((task) => ({ ...task, closedAt: null })),
        today,
      ),
    [filtered, today],
  );

  const onComplete = (task: PendingTask) => {
    setDone((current) => new Map(current).set(task.id, task.statusId));
    startTransition(() => {
      void completeTask({ taskId: task.id });
    });
  };

  const onUncomplete = (task: PendingTask) => {
    const previous = done.get(task.id);
    setDone((current) => {
      const next = new Map(current);
      next.delete(task.id);
      return next;
    });
    if (!previous) return;
    startTransition(() => {
      void uncompleteTask({ taskId: task.id, statusId: previous });
    });
  };

  const onPostpone = (task: PendingTask) => {
    startTransition(() => {
      void postponeTask({ taskId: task.id, dueDate: tomorrow });
    });
  };

  /**
   * Reprogramar comparte acción con posponer: las dos son «cambia la fecha
   * límite», y separarlas crearía dos caminos para una sola escritura.
   */
  const onReschedule = (task: PendingTask, dueDate: string) => {
    startTransition(() => {
      void postponeTask({ taskId: task.id, dueDate });
    });
  };

  const total = groups.reduce((sum, group) => sum + group.tasks.length, 0);

  return (
    <div className="flex flex-col gap-4">
      <Input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Buscar en tus pendientes"
        aria-label="Buscar en tus pendientes"
        className="max-w-sm"
      />

      {total === 0 ? (
        <p data-testid="my-tasks-empty" className="text-sm text-muted-foreground">
          {search.trim()
            ? "Ninguna tarea coincide con lo que buscas."
            : "No tienes tareas pendientes."}
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.key} data-testid={`group-${group.key}`}>
            <h2 className="mb-2 flex items-baseline gap-2 text-sm font-medium">
              {group.label}
              <span
                data-testid={`count-${group.key}`}
                className="text-xs text-muted-foreground tabular-nums"
              >
                {group.tasks.length}
              </span>
            </h2>

            {group.tasks.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nada aquí.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {group.tasks.map((task) => (
                  <PendingRow
                    key={task.id}
                    task={task}
                    onComplete={onComplete}
                    onUncomplete={onUncomplete}
                    onPostpone={onPostpone}
                    onReschedule={onReschedule}
                  />
                ))}
              </ul>
            )}
          </section>
        ))
      )}
    </div>
  );
}
