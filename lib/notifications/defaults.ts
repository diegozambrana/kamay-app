import type { NotificationPreferences } from "./types";

/**
 * La hora por omisión del resumen diario.
 *
 * Las siete: antes de que el taller abra, para que el resumen esté esperando
 * y no llegue a media tarea.
 */
export const DEFAULT_SUMMARY_HOUR = 7;

/**
 * Lo que recibe quien nunca abrió la sección de preferencias: **todo
 * encendido**.
 *
 * El sentido de la elección es que se pueda apagar lo que molesta, no que
 * haya que encender lo que hace falta. Alguien que nunca entra ahí es
 * exactamente quien más necesita que el sistema le avise.
 *
 * Estos valores están duplicados en los `default` de la migración, y es
 * deliberado: la base los aplica a quien sí guarda una fila parcial, y esta
 * constante a quien no tiene fila ninguna. Si divergieran, el mismo usuario
 * recibiría cosas distintas según hubiera pulsado *Guardar* alguna vez.
 */
export const DEFAULT_PREFERENCES: NotificationPreferences = {
  due_summary: true,
  task_assigned: true,
  task_review: true,
  task_overdue: true,
  task_stalled: true,
  stock_below_min: true,
  dailySummaryHour: DEFAULT_SUMMARY_HOUR,
  emailEnabled: true,
};

/** La fila de `notification_preferences`, tal como la devuelve la base. */
export type PreferencesRow = {
  due_summary: boolean | null;
  task_assigned: boolean | null;
  task_review: boolean | null;
  task_overdue: boolean | null;
  task_stalled: boolean | null;
  stock_below_min: boolean | null;
  daily_summary_hour: number | null;
  email_enabled: boolean | null;
};

/**
 * Resuelve unas preferencias contra los valores por omisión.
 *
 * **La ausencia de fila no es un caso de error, es el caso normal.** Nadie
 * siembra estas filas al invitar a alguien, y una organización creada antes de
 * que existiera la tabla funciona igual: por eso `null` y `undefined` caen a
 * la omisión en lugar de tratarse como «apagado».
 *
 * Una hora fuera de 0–23 también cae a la omisión. La base ya la rechaza al
 * escribir, pero un dato corrupto no debe dejar a nadie sin resumen para
 * siempre.
 */
export function resolvePreferences(
  row: Partial<PreferencesRow> | null | undefined,
): NotificationPreferences {
  if (!row) return { ...DEFAULT_PREFERENCES };

  return {
    due_summary: row.due_summary ?? DEFAULT_PREFERENCES.due_summary,
    task_assigned: row.task_assigned ?? DEFAULT_PREFERENCES.task_assigned,
    task_review: row.task_review ?? DEFAULT_PREFERENCES.task_review,
    task_overdue: row.task_overdue ?? DEFAULT_PREFERENCES.task_overdue,
    task_stalled: row.task_stalled ?? DEFAULT_PREFERENCES.task_stalled,
    stock_below_min: row.stock_below_min ?? DEFAULT_PREFERENCES.stock_below_min,
    dailySummaryHour: validHour(row.daily_summary_hour),
    emailEnabled: row.email_enabled ?? DEFAULT_PREFERENCES.emailEnabled,
  };
}

function validHour(hour: number | null | undefined): number {
  if (typeof hour !== "number" || !Number.isInteger(hour)) {
    return DEFAULT_SUMMARY_HOUR;
  }
  return hour >= 0 && hour <= 23 ? hour : DEFAULT_SUMMARY_HOUR;
}
