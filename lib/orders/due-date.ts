/**
 * Atajos de la fecha comprometida (design.md D12).
 *
 * La aritmética es de días civiles, no de milisegundos: sumar 86.400.000 ms
 * se equivoca de día en los cambios de horario de verano. `Date.UTC`
 * normaliza el desbordamiento de día, mes y año, y UTC no tiene horario de
 * verano, así que el resultado no depende ni de la zona del proceso ni de la
 * del navegador.
 *
 * El "hoy" del que se parte lo calcula el servidor con `todayInTimezone()`
 * sobre la zona de la organización: un taller en La Paz fija "mañana" con su
 * calendario, no con el del portátil.
 */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** La fecha `YYYY-MM-DD` que resulta de sumar `days` días a `today`. */
export function shiftDate(today: string, days: number): string {
  const match = DATE_ONLY.exec(today);
  if (!match) {
    throw new Error(`No es una fecha civil válida: ${today}`);
  }

  const [, year, month, day] = match;
  const shifted = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day) + days),
  );

  return shifted.toISOString().slice(0, 10);
}

export type DueDateShortcut = {
  /** Rótulo visible al usuario. */
  label: string;
  /** Días a sumar a "hoy" en la zona de la organización. */
  days: number;
};

/** Los cuatro atajos de V5, en el orden en que se ofrecen. */
export const DUE_DATE_SHORTCUTS: readonly DueDateShortcut[] = [
  { label: "Hoy", days: 0 },
  { label: "Mañana", days: 1 },
  { label: "En 3 días", days: 3 },
  { label: "En una semana", days: 7 },
];
