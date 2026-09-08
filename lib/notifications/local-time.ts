/**
 * La hora local de una organización, 0–23.
 *
 * El trabajo programado corre cada hora y en cada pasada atiende a quien
 * eligió esa hora **en la zona de su organización** (design D4). Una sola
 * entrada de cron sirve así a cualquier hora elegida y a cualquier zona, sin
 * que la lista de crons tenga que crecer con cada taller nuevo.
 *
 * Una zona horaria inválida en la configuración no puede impedir que el
 * trabajo corra para el resto: se cae a UTC, como hace `todayInTimezone`.
 */
export function hourInTimezone(timezone: string, now: Date = new Date()): number {
  try {
    const hour = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      hour12: false,
    }).format(now);

    // `en-GB` rinde "24" para la medianoche en algunos entornos.
    return Number(hour) % 24;
  } catch {
    return now.getUTCHours();
  }
}
