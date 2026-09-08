import { timingSafeEqual } from "node:crypto";

/**
 * ¿La petición trae la credencial del cron?
 *
 * Es la única puerta del sistema que corre con service role, así que se
 * comprueba con cuidado:
 *
 * - **En tiempo constante**, para no filtrar el secreto carácter a carácter a
 *   quien pueda medir la respuesta.
 * - **Sin secreto configurado, se rechaza todo.** La alternativa —dejar pasar
 *   cuando la variable falta— convertiría un despliegue mal configurado en un
 *   generador de notificaciones abierto a cualquiera.
 */
export function isAuthorizedCron(
  header: string | null,
  secret: string | undefined,
): boolean {
  if (!secret) return false;
  if (!header) return false;

  const provided = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${secret}`);

  // `timingSafeEqual` exige longitudes iguales, y la propia diferencia de
  // longitud ya distingue: se comprueba antes y se responde igual.
  if (provided.length !== expected.length) return false;

  return timingSafeEqual(provided, expected);
}
