/**
 * Fecha y hora de un evento, siempre en la zona horaria de la organización.
 *
 * Dos trampas evitadas a propósito:
 *
 * 1. `toLocaleString()` a secas resolvería la zona del contenedor en el
 *    servidor y la de quien mira en el navegador, y React descartaría el
 *    render del servidor por diferencia de hidratación. La zona se fija — y
 *    además es lo correcto: la historia del taller se cuenta en su hora.
 * 2. Tampoco se usa un patrón con nombre (`dateStyle`): Node y el navegador
 *    traen versiones distintas de ICU y para `es-BO` escriben el mes distinto
 *    ("26 ago de 2026" frente a "26 ago 2026"), que es otra diferencia de
 *    hidratación. Se piden partes numéricas —estables entre versiones— y el
 *    orden lo arma este código.
 */
export function formatDateTime(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  // Hora 24 y día/mes/año, como se escribe en Bolivia.
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("day")}/${get("month")}/${get("year")} ${hour}:${get("minute")}`;
}

/**
 * Solo la fecha, en la zona horaria de la organización y con el mismo criterio
 * de partes numéricas que `formatDateTime`: día/mes/año.
 */
export function formatDate(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("day")}/${get("month")}/${get("year")}`;
}
