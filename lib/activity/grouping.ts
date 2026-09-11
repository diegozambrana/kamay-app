/**
 * El agrupado por día de V23.
 *
 * En el servidor y en la zona horaria de la organización, no en el navegador:
 * agrupar en el cliente pondría cada evento en el día de quien mira, y el
 * mismo evento caería en «Hoy» o en «Ayer» según desde dónde se abriera la
 * pantalla.
 */

/** El día civil `YYYY-MM-DD` de un instante, en una zona horaria. */
export function civilDayOf(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * `HH:MM` de un instante, en una zona horaria.
 *
 * `hourCycle: "h23"` y no `hour12: false`: con lo segundo, la medianoche sale
 * como «24:00», que en una columna de horas se lee como el día siguiente y
 * queda por encima de las 23:50 del mismo día.
 */
export function timeOf(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("es-BO", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

/**
 * Cómo se encabeza un día: «Hoy», «Ayer», o el día de la semana.
 *
 * Más allá de una semana el día de la semana deja de orientar —«martes» a
 * secas puede ser cualquiera de los últimos años— y se usa la fecha larga, que
 * va debajo en ambos casos.
 */
export function dayLabel(day: string, today: string): string {
  if (day === today) return "Hoy";

  const yesterday = shiftDays(today, -1);
  if (day === yesterday) return "Ayer";

  const withinWeek = day > shiftDays(today, -7);
  const weekday = new Intl.DateTimeFormat("es-BO", {
    timeZone: "UTC",
    weekday: "long",
  }).format(new Date(`${day}T12:00:00Z`));

  return withinWeek ? capitalize(weekday) : longDate(day);
}

/** «miércoles 19 de agosto», la fecha completa bajo el encabezado. */
export function longDate(day: string): string {
  return new Intl.DateTimeFormat("es-BO", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${day}T12:00:00Z`));
}

function shiftDays(day: string, delta: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Agrupa manteniendo el orden de entrada.
 *
 * La lista ya viene ordenada de la consulta —`occurred_at desc, id desc`— y
 * este agrupado no reordena nada: si lo hiciera, el desempate estable que el
 * servicio se molesta en pedir se perdería aquí.
 */
export function groupByDay<T extends { occurredAt: string }>(
  items: readonly T[],
  timeZone: string,
): { day: string; items: T[] }[] {
  const days: { day: string; items: T[] }[] = [];

  for (const item of items) {
    const day = civilDayOf(item.occurredAt, timeZone);
    const last = days.at(-1);
    if (last && last.day === day) last.items.push(item);
    else days.push({ day, items: [item] });
  }

  return days;
}
