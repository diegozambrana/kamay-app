/**
 * El periodo de la bandeja de egresos (V7). Fechas civiles `YYYY-MM-DD`,
 * siempre en la zona horaria de la organización: "hoy" lo resuelve el
 * servidor con `todayInTimezone` y aquí solo se arma el mes.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type DateRange = { from: string; to: string };

export function isCivilDate(value: string | null | undefined): value is string {
  return typeof value === "string" && DATE_PATTERN.test(value);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Del primer al último día del mes de `today`, ambos inclusive. */
export function currentMonthRange(today: string): DateRange {
  const [year, month] = today.split("-").map(Number);
  // El día 0 del mes siguiente es el último de este.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}

/**
 * Resuelve el periodo pedido en la dirección: cada extremo que falte o venga
 * mal formado cae en el del mes en curso.
 */
export function resolvePeriod(
  from: string | undefined,
  to: string | undefined,
  today: string,
): DateRange {
  const month = currentMonthRange(today);
  return {
    from: isCivilDate(from) ? from : month.from,
    to: isCivilDate(to) ? to : month.to,
  };
}

/**
 * El instante en que empieza un día civil en una zona horaria, en ISO UTC.
 * Es lo que permite comparar `occurred_at` (un instante) contra un periodo de
 * fechas del taller sin que el borde del mes se corra unas horas.
 */
export function startOfDayInTimezone(date: string, timeZone: string): string {
  const guess = new Date(`${date}T00:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(guess);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  // Lo que la zona marca en el instante de la suposición, leído como UTC;
  // la diferencia con la suposición es el desfase de la zona.
  const local = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  const offset = local - guess.getTime();

  return new Date(guess.getTime() - offset).toISOString();
}

/** El instante en que empieza el día siguiente: límite superior exclusivo. */
export function startOfNextDayInTimezone(date: string, timeZone: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const nextDate = `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
  return startOfDayInTimezone(nextDate, timeZone);
}

/**
 * El instante del hecho a partir de la fecha civil del formulario. Si es hoy,
 * la hora real de ahora (convención nº 9); si es otro día, el mediodía local
 * de esa fecha, para que ninguna zona horaria la corra al día de al lado.
 */
export function occurredAtForDate(
  date: string,
  today: string,
  now: Date = new Date(),
): string {
  if (date === today) return now.toISOString();
  return new Date(`${date}T12:00:00`).toISOString();
}
