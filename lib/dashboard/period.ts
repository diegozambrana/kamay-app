/**
 * El periodo del panel: el mes calendario en curso, en la zona horaria de la
 * organización.
 *
 * V2 no tiene selector de periodo —ese es de V14— así que el mes no se elige:
 * se resuelve. Y se resuelve con la zona del taller y no con la del servidor
 * ni la del navegador, por el mismo motivo por el que `todayInTimezone`
 * existe en `lib/orders/overdue`: un cobro de las 21:00 del último día del
 * mes en La Paz ya es del mes siguiente en UTC, y contarlo allí movería el
 * margen de un mes a otro sin que nadie hiciera nada.
 */

/**
 * El primer día del mes en curso, como `YYYY-MM-DD`.
 *
 * Es la clave con la que `cash_flow_by_line_month` identifica el mes: la
 * vista corta con `date_trunc('month', occurred_at at time zone tz)`, así que
 * el mes que aquí se calcula y el que allí se agrupa son el mismo día.
 *
 * `en-CA` porque su formato corto es exactamente `YYYY-MM-DD`, igual que en
 * `todayInTimezone`.
 */
export function monthStartInTimezone(
  timezone: string,
  now: Date = new Date(),
): string {
  return `${localDate(timezone, now).slice(0, 7)}-01`;
}

/**
 * El rótulo del periodo tal como se lee en la pantalla ("febrero de 2026").
 *
 * Se deriva del mismo mes que los datos, no de una segunda lectura del reloj:
 * un panel cuyo título dijera un mes y cuyas cifras fueran de otro sería peor
 * que uno sin título.
 */
export function monthLabel(monthStart: string, locale = "es-BO"): string {
  // Mediodía UTC: construir la fecha a las 00:00 la devolvería al día
  // anterior en cualquier zona al oeste de Greenwich, y el rótulo diría el
  // mes anterior.
  const date = new Date(`${monthStart}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return monthStart;

  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/**
 * "Hoy" y el horizonte de las entregas próximas, ambos en la zona de la
 * organización y como `YYYY-MM-DD`.
 *
 * Siete días, que es el mismo horizonte que la tarjeta de pendientes usa en
 * V2 ("vencidas, hoy, próximos 7 días"): dos horizontes distintos en la misma
 * pantalla serían arbitrarios.
 */
export const UPCOMING_DAYS = 7;

export function upcomingWindow(
  timezone: string,
  now: Date = new Date(),
): { today: string; horizon: string } {
  const today = localDate(timezone, now);

  // Aritmética sobre el día ya trasladado a la zona del taller, en UTC para
  // que ningún cambio de horario de verano añada o quite un día.
  const horizonDate = new Date(`${today}T12:00:00Z`);
  horizonDate.setUTCDate(horizonDate.getUTCDate() + UPCOMING_DAYS);

  return { today, horizon: horizonDate.toISOString().slice(0, 10) };
}

/** La fecha de `now` en la zona dada, como `YYYY-MM-DD`. */
function localDate(timezone: string, now: Date): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    // Una zona horaria inválida en la configuración no puede tumbar el panel:
    // se cae a UTC, que es lo que guarda la base.
    return now.toISOString().slice(0, 10);
  }
}
