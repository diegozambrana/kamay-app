import type { StatusKind } from "@/types";

/**
 * Los tipos de estado en los que un pedido vencido está realmente retrasado.
 *
 * Un pedido en espera no lo está: el trabajo del taller terminó y la pelota
 * está en el tejado del cliente, así que pintarlo de rojo sería ruido diario.
 * Uno terminado o cancelado tampoco. La regla vive aquí y solo aquí.
 */
const OVERDUE_KINDS: readonly StatusKind[] = ["initial", "in_progress"];

export type OverdueInput = {
  /** Fecha comprometida en formato `YYYY-MM-DD`, o `null` si no se fijó. */
  dueDate: string | null;
  /**
   * El tipo declarado del estado, jamás su nombre: los nombres los configura
   * cada organización por línea (convención nº 5).
   */
  statusKind: StatusKind;
  /** "Hoy" en la zona horaria de la organización, como `YYYY-MM-DD`. */
  today: string;
};

/**
 * Si un pedido debe mostrar alerta de retraso. Única definición de
 * "retrasado" del proyecto: el tablero, la lista y el calendario la comparten.
 */
export function isOverdue({ dueDate, statusKind, today }: OverdueInput): boolean {
  if (!dueDate) return false;
  if (!OVERDUE_KINDS.includes(statusKind)) return false;

  // Comparación lexicográfica: `YYYY-MM-DD` ordena como ordena el calendario,
  // y evita construir fechas que reintroducirían el huso horario por detrás.
  return dueDate < today;
}

/**
 * "Hoy" en la zona horaria de la organización, no en la del navegador: un
 * taller en La Paz no debe ver un pedido en rojo porque el portátil viajó.
 *
 * `en-CA` porque su formato corto es exactamente `YYYY-MM-DD`.
 */
export function todayInTimezone(timezone: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    // Una zona horaria inválida en la configuración no puede tumbar el
    // tablero: se cae a UTC, que es lo que guarda la base.
    return now.toISOString().slice(0, 10);
  }
}
