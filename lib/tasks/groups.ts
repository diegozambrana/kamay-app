import { dueSignal } from "./overdue";

/**
 * Cuántos días abarca el grupo *Próximos 7 días*.
 *
 * Siete, y **no** los dos de `SOON_DAYS`: aquel es el umbral del color de la
 * tarjeta —cuándo la fecha empieza a ponerse ámbar— y este es el de la
 * agrupación. Son dos preguntas distintas sobre la misma fecha, y confundirlas
 * dejaría el grupo con dos días de contenido y un rótulo que dice siete.
 */
export const UPCOMING_DAYS = 7;

/** Los cuatro grupos de V20, en el único orden en que se muestran. */
export const GROUP_KEYS = ["overdue", "today", "upcoming", "undated"] as const;

export type GroupKey = (typeof GROUP_KEYS)[number];

export const GROUP_LABELS: Record<GroupKey, string> = {
  overdue: "Vencidas",
  today: "Hoy",
  upcoming: "Próximos 7 días",
  undated: "Sin fecha",
};

/** Lo mínimo que hace falta para agrupar. */
export type GroupableTask = {
  id: string;
  /** Fecha límite en `YYYY-MM-DD`, o `null`. */
  dueDate: string | null;
  closedAt: string | null;
};

export type TaskGroup<T extends GroupableTask> = {
  key: GroupKey;
  label: string;
  tasks: T[];
};

/**
 * Reparte las tareas en los cuatro grupos de *Mis pendientes*.
 *
 * **Lo vencido va primero, siempre.** No es una preferencia de orden: es la
 * respuesta a la pregunta que la pantalla existe para contestar, y ponerlo en
 * cualquier otro sitio obligaría a buscar lo urgente.
 *
 * Reutiliza `dueSignal()` en lugar de volver a comparar fechas, para que el
 * semáforo de la tarjeta y la agrupación de la lista no puedan discrepar sobre
 * qué es «hoy». Lo único que esta función añade es la ventana de siete días,
 * que el semáforo no tiene.
 *
 * Los cuatro grupos se devuelven **siempre**, vacíos incluidos: quien rinde
 * decide si oculta uno sin contenido o lo declara, pero la forma del resultado
 * no cambia según los datos, que es lo que hace la pantalla estable.
 *
 * @param today "hoy" en la zona horaria de la organización, en `YYYY-MM-DD`
 */
export function groupByDue<T extends GroupableTask>(
  tasks: T[],
  today: string,
): TaskGroup<T>[] {
  const buckets: Record<GroupKey, T[]> = {
    overdue: [],
    today: [],
    upcoming: [],
    undated: [],
  };

  for (const task of tasks) {
    // Lo cerrado no es pendiente. Se descarta antes de agrupar y no después,
    // para que ningún contador lo cuente.
    if (task.closedAt) continue;

    const key = keyOf(task, today);
    // `null` es lo que vence más allá de la semana: tiene fecha, así que no es
    // «Sin fecha», y no toca todavía, así que no es ninguno de los otros tres.
    if (key) buckets[key].push(task);
  }

  // Dentro de cada grupo, lo más urgente primero. En *Sin fecha* no hay nada
  // que ordenar por fecha, y se respeta el orden de llegada.
  for (const key of ["overdue", "today", "upcoming"] as const) {
    buckets[key].sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  }

  return GROUP_KEYS.map((key) => ({
    key,
    label: GROUP_LABELS[key],
    tasks: buckets[key],
  }));
}

/**
 * A qué grupo pertenece una tarea abierta, o `null` si a ninguno.
 *
 * **Una tarea que vence dentro de un mes no aparece en esta pantalla.** No
 * cabe en ningún grupo y no debe forzarse a ninguno: meterla en *Próximos 7
 * días* contradiría el rótulo, y en *Sin fecha* sería sencillamente falso —sí
 * tiene fecha—. V20 contesta «qué hago hoy», y lo que vence en un mes se ve en
 * el tablero, que es la vista de gestión. Los cuatro grupos del backlog son
 * exactamente cuatro, y esto es lo que los mantiene siendo cuatro.
 */
export function keyOf(task: GroupableTask, today: string): GroupKey | null {
  const signal = dueSignal(task.dueDate, today);

  // `none` aquí solo puede venir de una tarea sin fecha: las cerradas ya se
  // descartaron antes de llegar.
  if (signal === "none") return "undated";
  if (signal === "overdue") return "overdue";
  if (signal === "today") return "today";

  // `soon` y `later` se distinguen por la ventana de siete días, que es de
  // esta pantalla y no del semáforo de color.
  return withinUpcoming(today, task.dueDate!) ? "upcoming" : null;
}

/**
 * Los conteos de la tarjeta del panel.
 *
 * Sale de la misma función que la pantalla, y es deliberado: calcular los
 * conteos por otra vía es la manera segura de que un día dejen de coincidir
 * con lo que V20 enseña.
 */
export function pendingCounts(
  tasks: GroupableTask[],
  today: string,
): { overdue: number; today: number; upcoming: number } {
  const groups = groupByDue(tasks, today);
  const count = (key: GroupKey) =>
    groups.find((group) => group.key === key)!.tasks.length;

  return {
    overdue: count("overdue"),
    today: count("today"),
    upcoming: count("upcoming"),
  };
}

/** ¿La fecha cae dentro de los próximos siete días? */
function withinUpcoming(today: string, dueDate: string): boolean {
  const start = Date.parse(`${today}T00:00:00Z`);
  const end = Date.parse(`${dueDate}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return false;

  return (end - start) / 86_400_000 <= UPCOMING_DAYS;
}
