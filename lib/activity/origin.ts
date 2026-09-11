/**
 * Desde dónde se hizo un cambio, para la columna `origin` de la bitácora.
 *
 * La columna existe desde KAM-03 y el trigger la lee de la cabecera
 * `x-client-origin`, pero hasta KAM-22 **ningún cliente de Supabase la
 * enviaba**: los 1.149 eventos que había al implementar esto tenían `origin`
 * nulo. La fila de V23 lo muestra, así que aquí se empieza a llenar.
 *
 * Se deduce en el servidor a partir del agente de usuario, con el mismo
 * criterio que `defaultLandingPath()` ya usa para decidir el aterrizaje
 * (design D12), y no de una preferencia que el navegador pudiera falsear.
 */

import { isMobileUserAgent } from "@/lib/auth/routes";

/** Los tres valores que el esquema documenta para `activity_log.origin`. */
export type ClientOrigin = "mobile" | "desktop" | "external";

/** El nombre de la cabecera que `log_activity()` lee. No se inventa aquí. */
export const ORIGIN_HEADER = "x-client-origin";

/**
 * `mobile` o `desktop` según el agente de usuario.
 *
 * Sin agente de usuario, `desktop`: es lo mismo que decide el aterrizaje ante
 * la misma duda, y tener dos criterios distintos para la misma pregunta sería
 * peor que tener uno imperfecto.
 *
 * `external` no se produce aquí: lo escribiría una integración que escribiera
 * en la base por su cuenta, y hoy no hay ninguna.
 */
export function originFromUserAgent(
  userAgent: string | null | undefined,
): ClientOrigin {
  return isMobileUserAgent(userAgent) ? "mobile" : "desktop";
}
