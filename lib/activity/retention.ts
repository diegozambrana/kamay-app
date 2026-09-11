/**
 * La política de retención del detalle de la bitácora.
 *
 * Vive en `organizations.settings` y no en una columna nueva: el esquema
 * canónico ya declara ese `jsonb` como el sitio de «preferencias, retención,
 * reparto», así que no se altera ninguna tabla ni se inventa ningún concepto
 * (convenciones nº 6 y nº 11, design D9).
 *
 * El valor por defecto se resuelve **al leer** y no con una migración que
 * rellene la clave en todas las filas: así una organización creada mañana
 * también lo tiene sin que nadie la actualice.
 */

import { z } from "zod";

/** Lo que el backlog pide cuando nadie ha configurado nada. */
export const DEFAULT_RETENTION_MONTHS = 12;

/**
 * El plazo, en meses.
 *
 * Cero no se admite: sería «purga todo lo que entre», y una política que vacía
 * el detalle en el mismo momento de escribirlo no es una política de
 * retención, es apagar la bitácora por la puerta de atrás. El techo de 120
 * meses no protege de nada técnico; evita el cero de más al teclear.
 */
export const retentionMonthsSchema = z
  .number({ message: "El plazo debe ser un número de meses." })
  .int("El plazo debe ser un número entero de meses.")
  .min(1, "El plazo debe ser de al menos un mes.")
  .max(120, "El plazo no puede pasar de 120 meses.");

export const retentionSettingsSchema = z.object({
  months: retentionMonthsSchema,
});

export type RetentionSettingsInput = z.infer<typeof retentionSettingsSchema>;

/** La clave dentro de `settings`. Una sola vez, aquí. */
export const RETENTION_KEY = "activity_retention" as const;

/**
 * El plazo vigente de una organización.
 *
 * Un `settings` sin la clave, con la clave a medias o con un valor imposible
 * devuelve el defecto: la pantalla tiene que poder decir un plazo siempre, y
 * una configuración corrupta no es motivo para dejar de retener.
 */
export function readRetentionMonths(settings: unknown): number {
  if (typeof settings !== "object" || settings === null) {
    return DEFAULT_RETENTION_MONTHS;
  }

  const raw = (settings as Record<string, unknown>)[RETENTION_KEY];
  if (typeof raw !== "object" || raw === null) return DEFAULT_RETENTION_MONTHS;

  const parsed = retentionMonthsSchema.safeParse(
    (raw as Record<string, unknown>).months,
  );
  return parsed.success ? parsed.data : DEFAULT_RETENTION_MONTHS;
}

/**
 * El instante a partir del cual un evento está vencido.
 *
 * Restar meses y no días: «doce meses» significa la misma fecha del año
 * pasado, no 365 días, y la diferencia importa el 29 de febrero.
 */
export function retentionCutoff(months: number, now: Date = new Date()): string {
  const cutoff = new Date(now.getTime());
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  return cutoff.toISOString();
}

/** «12 meses» / «1 mes», para el aviso de la cabecera de V23 y la sección V15. */
export function retentionLabel(months: number): string {
  return months === 1 ? "1 mes" : `${months} meses`;
}
