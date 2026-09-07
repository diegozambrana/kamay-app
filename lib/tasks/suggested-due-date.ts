/**
 * Cuántos días antes de la entrega se sugiere terminar la tarea.
 *
 * Dos: uno solo no deja margen para la corrección que casi siempre llega, y
 * más empujaría la tarea tan atrás que dejaría de parecerse al pedido.
 */
const DAYS_BEFORE_DELIVERY = 2;

/**
 * La fecha límite que propone *Crear tarea para este pedido*.
 *
 * Siempre **anterior** a la fecha comprometida del pedido, que es lo que el
 * criterio pide: el arte tiene que estar antes de la entrega, no el mismo día.
 * Si esa fecha ya pasó —el pedido va justo o va tarde— se propone hoy, nunca
 * una fecha en el pasado: nacer vencida no le dice nada útil a nadie.
 *
 * Sin fecha comprometida no hay nada de donde deducirla, y se devuelve `null`:
 * inventar una sería fingir una información que el pedido no tiene.
 *
 * @param orderDueDate fecha comprometida en `YYYY-MM-DD`, o `null`
 * @param today "hoy" en la zona horaria de la organización, en `YYYY-MM-DD`
 */
export function suggestedDueDate(
  orderDueDate: string | null,
  today: string,
): string | null {
  if (!orderDueDate) return null;

  const suggested = shiftDays(orderDueDate, -DAYS_BEFORE_DELIVERY);

  // Comparación lexicográfica: `YYYY-MM-DD` ordena como el calendario y no
  // reintroduce el huso horario por detrás (mismo criterio que `isOverdue`).
  return suggested < today ? today : suggested;
}

/** Suma días a una fecha `YYYY-MM-DD` sin salir de UTC. */
function shiftDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}
