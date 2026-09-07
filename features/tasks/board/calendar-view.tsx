"use client";

import { Badge } from "@/components/ui/badge";

import { TaskCard } from "./task-card";
import type { BoardTask } from "./board-view";

/**
 * Vista de calendario: las tareas agrupadas por fecha límite. Las que no
 * tienen fecha se muestran aparte, porque no pertenecen a ningún día y
 * esconderlas las haría desaparecer del alcance del usuario.
 */
export function CalendarView({
  tasks,
  today,
  showLine,
}: {
  tasks: BoardTask[];
  today: string;
  showLine: boolean;
}) {
  const withDate = tasks.filter((task) => task.dueDate);
  const withoutDate = tasks.filter((task) => !task.dueDate);

  const byDate = new Map<string, BoardTask[]>();
  for (const task of withDate) {
    const key = task.dueDate!;
    byDate.set(key, [...(byDate.get(key) ?? []), task]);
  }

  const days = [...byDate.keys()].sort();

  if (tasks.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No hay tareas que mostrar.
      </p>
    );
  }

  return (
    <div data-testid="tasks-calendar" className="flex flex-col gap-6">
      {days.map((day) => (
        <section key={day} data-testid="calendar-day" data-day={day}>
          <header className="mb-2 flex items-center gap-2">
            <h2 className="text-sm font-medium">{day}</h2>
            <Badge variant="secondary" className="tabular-nums">
              {byDate.get(day)!.length}
            </Badge>
          </header>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {byDate.get(day)!.map((task) => (
              <TaskCard key={task.id} task={task} today={today} showLine={showLine} />
            ))}
          </div>
        </section>
      ))}

      {withoutDate.length > 0 && (
        <section data-testid="calendar-undated">
          <header className="mb-2 flex items-center gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">Sin fecha</h2>
            <Badge variant="secondary" className="tabular-nums">
              {withoutDate.length}
            </Badge>
          </header>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {withoutDate.map((task) => (
              <TaskCard key={task.id} task={task} today={today} showLine={showLine} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
