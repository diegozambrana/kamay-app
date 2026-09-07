/** Cuántos días antes del vencimiento la fecha empieza a avisar. */
const SOON_DAYS = 2;

/**
 * El semáforo de la fecha límite de una tarea.
 *
 * `none` no es "a tiempo": es que no hay nada que medir. Una tarea sin fecha
 * no está ni al día ni retrasada, y pintarla de cualquier color sería afirmar
 * algo que nadie declaró.
 */
export type DueSignal = "none" | "later" | "soon" | "today" | "overdue";

/**
 * A diferencia de los pedidos, aquí no interviene el tipo de estado: una tarea
 * en revisión con la fecha pasada **sí** va tarde. En un pedido, «en espera»
 * significa que la pelota está en el tejado del cliente; en una tarea propia no
 * hay nadie más a quien esperar.
 *
 * Una tarea cerrada deja de avisar: ya no hay nada que apurar.
 *
 * @param dueDate fecha límite en `YYYY-MM-DD`, o `null`
 * @param today "hoy" en la zona horaria de la organización, en `YYYY-MM-DD`
 */
export function dueSignal(
  dueDate: string | null,
  today: string,
  options: { closed?: boolean } = {},
): DueSignal {
  if (!dueDate || options.closed) return "none";

  if (dueDate < today) return "overdue";
  if (dueDate === today) return "today";

  return withinDays(today, dueDate, SOON_DAYS) ? "soon" : "later";
}

/** ¿`to` cae dentro de los próximos `days` días desde `from`? */
function withinDays(from: string, to: string, days: number): boolean {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return false;

  return (end - start) / 86_400_000 <= days;
}
